"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";

// ── Types ──────────────────────────────────────────────────────────

export type RunStatus      = "em_andamento" | "concluido" | "cancelado";
export type ChecklistStatus = "pendente" | "concluido" | "ignorado";
export type Responsavel    = "rh" | "gestor" | "colaborador" | "ti";

export type OnboardingTemplate = {
  id: string;
  unit_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  tarefas?: OnboardingTarefa[];
};

export type OnboardingTarefa = {
  id: string;
  template_id: string;
  titulo: string;
  descricao: string | null;
  responsavel: Responsavel;
  prazo_dias: number;
  ordem: number;
};

export type ChecklistItem = {
  id: string;
  run_id: string;
  tarefa_id: string;
  status: ChecklistStatus;
  concluido_em: string | null;
  concluido_por: string | null;
  tarefa: OnboardingTarefa;
};

export type OnboardingRun = {
  id: string;
  unit_id: string;
  employee_id: string;
  template_id: string;
  status: RunStatus;
  data_inicio: string;
  created_at: string;
};

export type RunSummary = OnboardingRun & {
  employee: { id: string; nome: string; sobrenome: string; funcao: string };
  template: { id: string; nome: string };
  checklist: { id: string; status: ChecklistStatus }[];
};

export type RunWithDetails = OnboardingRun & {
  employee: { id: string; nome: string; sobrenome: string; funcao: string };
  template: { id: string; nome: string };
  checklist: ChecklistItem[];
};

export type CreateTemplateInput = {
  unit_id: string;
  nome: string;
  descricao?: string;
  tarefas: {
    titulo: string;
    descricao?: string;
    responsavel: Responsavel;
    prazo_dias: number;
    ordem: number;
  }[];
};

// ── Auth helper ────────────────────────────────────────────────────

async function getAuthorizedUnitIds(): Promise<string[] | null> {
  const user = await requireUser();
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("unit_id")
    .eq("user_id", user.id);
  const unitIds = (roles ?? [])
    .map((r: any) => r.unit_id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
  return unitIds.length > 0 ? unitIds : null;
}

// ── Orchestrator integration ────────────────────────────────────────

async function resolverOnboardingPendente(
  employeeId: string,
  runId: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data: job } = await (supabase as any)
      .from("hos_jobs")
      .select("id")
      .eq("slug", "onboarding_checker")
      .eq("is_active", true)
      .maybeSingle();

    if (!job) return;

    await (supabase as any)
      .from("hos_runs")
      .update({
        status: "approved",
        result_data: {
          resolved_by_onboarding: true,
          onboarding_run_id: runId,
          resolved_at: new Date().toISOString(),
        },
      })
      .eq("job_id", job.id)
      .in("status", ["pending", "awaiting_approval"])
      .filter("payload->>'employee_id'", "eq", employeeId);
  } catch (e) {
    console.warn("[resolverOnboardingPendente]", e);
  }
}

// ── Templates ──────────────────────────────────────────────────────

export async function listTemplates(
  unitId: string,
): Promise<(OnboardingTemplate & { tarefas: { id: string }[] })[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await (supabase as any)
      .from("onboarding_templates")
      .select("*, tarefas:onboarding_tarefas(id)")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("[listTemplates]", error.message);
      return [];
    }
    return (data ?? []) as (OnboardingTemplate & { tarefas: { id: string }[] })[];
  } catch (e) {
    console.error("[listTemplates] exceção:", e);
    return [];
  }
}

export async function getTemplate(id: string): Promise<OnboardingTemplate | null> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    let q = (supabase as any)
      .from("onboarding_templates")
      .select("*, tarefas:onboarding_tarefas(*)")
      .eq("id", id)
      .order("ordem", { foreignTable: "onboarding_tarefas", ascending: true });

    if (unitIds !== null) q = q.in("unit_id", unitIds);

    const { data, error } = await q.single();
    if (error || !data) return null;
    return data as OnboardingTemplate;
  } catch {
    return null;
  }
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<ActionResult<OnboardingTemplate>> {
  try {
    if (!input.nome || input.nome.trim().length < 2) {
      return { ok: false, error: "Nome deve ter pelo menos 2 caracteres" };
    }
    if (input.tarefas.length === 0) {
      return { ok: false, error: "Adicione ao menos uma tarefa ao template" };
    }

    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(input.unit_id)) {
      return { ok: false, error: "Acesso não autorizado para esta unidade" };
    }

    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: tpl, error: tplError } = await (supabase as any)
      .from("onboarding_templates")
      .insert({
        unit_id: input.unit_id,
        nome: input.nome.trim(),
        descricao: input.descricao?.trim() || null,
        ativo: true,
      })
      .select("*")
      .single();

    if (tplError || !tpl) {
      return { ok: false, error: tplError?.message ?? "Falha ao criar template" };
    }

    const { error: tarError } = await (supabase as any)
      .from("onboarding_tarefas")
      .insert(
        input.tarefas.map((t, i) => ({
          template_id: tpl.id,
          titulo: t.titulo.trim(),
          descricao: t.descricao?.trim() || null,
          responsavel: t.responsavel,
          prazo_dias: Math.max(1, t.prazo_dias),
          ordem: t.ordem ?? i,
        })),
      );

    if (tarError) console.error("[createTemplate] tarefas:", tarError.message);

    revalidatePath("/pessoas/onboarding/templates");
    return { ok: true, data: tpl as OnboardingTemplate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ── Runs ───────────────────────────────────────────────────────────

export async function listOnboardingRuns(
  unitId: string,
  status?: RunStatus,
): Promise<RunSummary[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let q = (supabase as any)
      .from("onboarding_runs")
      .select(
        "*, employee:employees!employee_id(id,nome,sobrenome,funcao), template:onboarding_templates!template_id(id,nome), checklist:onboarding_checklist(id,status)",
      )
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) {
      console.error("[listOnboardingRuns]", error.message);
      return [];
    }
    return (data ?? []) as RunSummary[];
  } catch (e) {
    console.error("[listOnboardingRuns] exceção:", e);
    return [];
  }
}

export async function getOnboardingRun(id: string): Promise<RunWithDetails | null> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    let q = (supabase as any)
      .from("onboarding_runs")
      .select(
        "*, employee:employees!employee_id(id,nome,sobrenome,funcao), template:onboarding_templates!template_id(id,nome), checklist:onboarding_checklist(id,run_id,tarefa_id,status,concluido_em,concluido_por,tarefa:onboarding_tarefas!tarefa_id(id,titulo,descricao,responsavel,prazo_dias,ordem))",
      )
      .eq("id", id);

    if (unitIds !== null) q = q.in("unit_id", unitIds);

    const { data, error } = await q.single();
    if (error || !data) return null;

    // Sort checklist by tarefa.ordem
    const run = data as RunWithDetails;
    run.checklist.sort((a, b) => (a.tarefa?.ordem ?? 0) - (b.tarefa?.ordem ?? 0));
    return run;
  } catch {
    return null;
  }
}

export async function createOnboardingRun(
  unitId: string,
  employeeId: string,
  templateId: string,
  dataInicio?: string,
): Promise<ActionResult<OnboardingRun>> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) {
      return { ok: false, error: "Acesso não autorizado para esta unidade" };
    }

    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const startDate = dataInicio ?? new Date().toISOString().split("T")[0];

    const { data: run, error: runError } = await (supabase as any)
      .from("onboarding_runs")
      .insert({
        unit_id: unitId,
        employee_id: employeeId,
        template_id: templateId,
        status: "em_andamento",
        data_inicio: startDate,
      })
      .select("*")
      .single();

    if (runError || !run) {
      return { ok: false, error: runError?.message ?? "Falha ao criar onboarding" };
    }

    // Fetch template tasks
    const { data: tarefas, error: tarError } = await (supabase as any)
      .from("onboarding_tarefas")
      .select("id")
      .eq("template_id", templateId)
      .order("ordem");

    if (tarError) {
      console.error("[createOnboardingRun] tarefas:", tarError.message);
    }

    // Create checklist items
    if (tarefas && tarefas.length > 0) {
      const { error: clError } = await (supabase as any)
        .from("onboarding_checklist")
        .insert(
          (tarefas as { id: string }[]).map((t) => ({
            run_id: run.id,
            tarefa_id: t.id,
            status: "pendente",
          })),
        );
      if (clError) console.error("[createOnboardingRun] checklist:", clError.message);
    }

    // Orchestrator integration: resolve pending checker runs for this employee
    await resolverOnboardingPendente(employeeId, run.id);

    revalidatePath("/pessoas/onboarding");
    return { ok: true, data: run as OnboardingRun };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function updateChecklistItem(
  id: string,
  status: ChecklistStatus,
  runId: string,
): Promise<ActionResult<{ id: string; status: ChecklistStatus }>> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    const user = await requireUser();
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Verify run belongs to authorized unit
    if (unitIds !== null) {
      const { data: r } = await (supabase as any)
        .from("onboarding_runs")
        .select("unit_id")
        .eq("id", runId)
        .maybeSingle();
      const uid = (r as { unit_id: string } | null)?.unit_id;
      if (!uid || !unitIds.includes(uid)) {
        return { ok: false, error: "Acesso não autorizado" };
      }
    }

    const updates: Record<string, unknown> = { status };
    if (status === "concluido") {
      updates.concluido_em = new Date().toISOString();
      updates.concluido_por = user.id;
    } else {
      updates.concluido_em = null;
      updates.concluido_por = null;
    }

    const { data, error } = await (supabase as any)
      .from("onboarding_checklist")
      .update(updates)
      .eq("id", id)
      .select("id, status")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar tarefa" };
    }

    // Auto-complete run if all items are done/ignored
    const { data: remaining } = await (supabase as any)
      .from("onboarding_checklist")
      .select("id")
      .eq("run_id", runId)
      .eq("status", "pendente");

    if (remaining && (remaining as any[]).length === 0) {
      await (supabase as any)
        .from("onboarding_runs")
        .update({ status: "concluido" })
        .eq("id", runId);
    }

    revalidatePath(`/pessoas/onboarding/${runId}`);
    revalidatePath("/pessoas/onboarding");
    return { ok: true, data: data as { id: string; status: ChecklistStatus } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ── Employee list for run creation ──────────────────────────────────

export async function listEmployeesForRun(
  unitId: string,
): Promise<{ id: string; nome: string; sobrenome: string; funcao: string }[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");

    if (error) return [];
    return (data ?? []) as { id: string; nome: string; sobrenome: string; funcao: string }[];
  } catch {
    return [];
  }
}
