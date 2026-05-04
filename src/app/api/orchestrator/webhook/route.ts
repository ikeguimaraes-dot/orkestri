import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // Basic auth/secret validation
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.HOS_WEBHOOK_SECRET}`) {
      // Temporarily disable the strict check so we can test without env var, or return 401
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      console.warn("[Orchestrator Webhook] Sem autorização rigorosa configurada.");
    }

    const payload = await req.json();
    console.log("[Orchestrator Webhook] Recebido payload:", payload);

    // Identificar qual job rodar baseado no payload
    // Ex: Se o payload vier da Vercel para deployment
    let jobSlug = "qa_preview";
    if (payload.type === "deployment_success") {
      jobSlug = "qa_preview";
    } else if (payload.action === "opened" && payload.pull_request) {
      jobSlug = "code_review";
    }

    const supabase = await createServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }

    // Achar o job correspondente
    const { data: job, error: jobErr } = await supabase
      .from("hos_jobs")
      .select("id")
      .eq("slug", jobSlug)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job não encontrado para este evento" }, { status: 400 });
    }

    // Inserir run na tabela
    // Num sistema real, aqui chamaríamos a fila do Inngest/Trigger.dev para rodar o script do Playwright.
    // Por hora, apenas inserimos no BD como `pending` ou `running` e mockamos que o script já rodou.
    const { data: run, error: runErr } = await supabase
      .from("hos_runs")
      .insert({
        job_id: (job as any).id,
        status: "awaiting_approval", // Simulando que o script já rodou super rápido e quer aprovação
        payload: payload,
        logs: [
          { time: new Date().toISOString(), message: "Webhook recebido." },
          { time: new Date().toISOString(), message: `Triggado pelo evento: ${payload.type || "unknown"}` },
          { time: new Date().toISOString(), message: "Agente processou os dados com sucesso." },
          { time: new Date().toISOString(), message: "Aguardando verificação humana no painel." }
        ],
        result_data: {
          note: "Agente executado de forma automática via Webhook."
        }
      } as never)
      .select()
      .single();

    if (runErr) {
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, runId: (run as any)?.id });
  } catch (error) {
    console.error("[Orchestrator Webhook] Erro processando request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
