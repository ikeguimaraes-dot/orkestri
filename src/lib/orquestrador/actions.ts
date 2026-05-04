"use server"
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";

// ── Types ──────────────────────────────────────────────────────────

export type HosJob = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HosRunStatus = "pending" | "running" | "awaiting_approval" | "approved" | "rejected" | "failed";

export type HosRun = {
  id: string;
  job_id: string;
  status: HosRunStatus;
  payload: any;
  logs: any[];
  result_data: any;
  created_at: string;
  updated_at: string;
};

export type HosRunWithJob = HosRun & {
  job: HosJob;
};

export type HosApproval = {
  id: string;
  run_id: string;
  user_id: string;
  decision: "approve" | "reject";
  feedback: string | null;
  created_at: string;
};

// ── Actions ────────────────────────────────────────────────────────

/**
 * Retorna todos os runs pendentes, em andamento ou aguardando aprovação.
 * E os últimos runs finalizados (aprovado/rejeitado/falho) num limite.
 */
export async function listOrchestratorRuns(): Promise<HosRunWithJob[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("hos_runs")
      .select("*, job:hos_jobs(*)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[listOrchestratorRuns] error:", error.message);
      return [];
    }
    return (data ?? []) as HosRunWithJob[];
  } catch (e) {
    console.error("[listOrchestratorRuns] exceção:", e);
    return [];
  }
}

/**
 * Busca os detalhes de uma execução específica.
 */
export async function getRunDetails(id: string): Promise<HosRunWithJob | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("hos_runs")
      .select("*, job:hos_jobs(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[getRunDetails] error:", error.message);
      return null;
    }
    return (data ?? null) as HosRunWithJob | null;
  } catch (e) {
    console.error("[getRunDetails] exceção:", e);
    return null;
  }
}

/**
 * Human-in-the-loop: Aprova ou rejeita uma execução que está aguardando.
 */
export async function submitRunDecision(
  runId: string,
  decision: "approve" | "reject",
  feedback?: string
): Promise<ActionResult<HosApproval>> {
  try {
    const user = await requireUser();
    if (!user) return { ok: false, error: "Não autorizado" };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // 1. Grava no histórico de aprovações
    const { data: approvalData, error: approvalErr } = await supabase
      .from("hos_approvals")
      .insert({
        run_id: runId,
        user_id: user.id,
        decision,
        feedback: feedback ?? null,
      } as never)
      .select()
      .single();

    if (approvalErr || !approvalData) {
      return { ok: false, error: approvalErr?.message ?? "Falha ao gravar decisão" };
    }

    // 2. Atualiza o status do run
    const newStatus: HosRunStatus = decision === "approve" ? "approved" : "rejected";
    const { error: runErr } = await supabase
      .from("hos_runs")
      .update({ status: newStatus } as never)
      .eq("id", runId);

    if (runErr) {
      // Falhou em atualizar o status, mas já registrou aprovação. Idealmente isso estaria numa RPC/transaction.
      console.error("[submitRunDecision] Falha ao atualizar status do run:", runErr.message);
    }

    // [OPCIONAL] Se 'approve' e o job for de Vercel Preview, você pode disparar aqui o webhook para a Vercel promover a branch.

    revalidatePath("/orquestrador");
    revalidatePath(`/orquestrador/${runId}`);

    return { ok: true, data: approvalData as HosApproval };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Simula a criação de um novo job de QA para fins de teste no painel
 */
export async function mockCreateRun(jobSlug: string): Promise<ActionResult<HosRun>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: job, error: jobErr } = await supabase
      .from("hos_jobs")
      .select("*")
      .eq("slug", jobSlug)
      .maybeSingle();

    if (jobErr || !job) {
      return { ok: false, error: "Job não encontrado" };
    }

    const { data: runData, error: runErr } = await supabase
      .from("hos_runs")
      .insert({
        job_id: (job as any).id,
        status: "awaiting_approval",
        payload: {
          preview_url: "https://kph-os-preview-123.vercel.app",
          pr_number: 42,
          commit_sha: "abcd1234efgh5678"
        },
        logs: [
          { time: new Date().toISOString(), message: "Iniciando Agent de QA..." },
          { time: new Date().toISOString(), message: "Acessando URL de preview." },
          { time: new Date().toISOString(), message: "Rodando testes visuais na Home e Dashboard." },
          { time: new Date().toISOString(), message: "Nenhuma regressão visual detectada." },
          { time: new Date().toISOString(), message: "Aguardando aprovação humana." }
        ],
        result_data: {
          screenshots: [
            "https://via.placeholder.com/800x600.png?text=Home+Screenshot",
            "https://via.placeholder.com/800x600.png?text=Dashboard+Screenshot"
          ]
        }
      } as never)
      .select()
      .single();

    if (runErr || !runData) {
      return { ok: false, error: runErr?.message ?? "Falha ao criar run" };
    }

    revalidatePath("/orquestrador");
    return { ok: true, data: runData as HosRun };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
