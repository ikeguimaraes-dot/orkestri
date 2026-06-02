import { listOrchestratorRuns } from "@/lib/orquestrador/actions";
import { loadLMReports, generateLearningMachineReport } from "@/lib/orquestrador/learning-machine";
import { handleApproval } from "@/lib/orquestrador/approve-handler";
import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import type { LMReport } from "@/lib/orquestrador/learning-machine";
import { ApproveJobButton } from "./ApproveJobButton";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────

type OrquestradorInsight = {
  headline: string;
  insights: string[];
  proximo_passo: string;
};

// ── Server Actions ────────────────────────────────────────────────────

async function triggerLearningMachine() {
  "use server";
  await generateLearningMachineReport();
  revalidatePath("/orquestrador");
}

async function approveOrquestradorJob(jobId: string) {
  "use server";
  const result = await handleApproval(jobId);
  revalidatePath("/orquestrador");
  return result;
}

// ── Pending jobs loader ────────────────────────────────────────────────

type OrquestradorJob = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

async function loadPendingJobs(): Promise<OrquestradorJob[]> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("orquestrador_jobs")
      .select("id, type, status, payload, created_at")
      .in("status", ["pending", "waiting_approval", "awaiting_approval"])
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as OrquestradorJob[];
  } catch {
    return [];
  }
}

// ── Insight generator ─────────────────────────────────────────────────

async function generateOrquestradorInsight(): Promise<OrquestradorInsight | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch context data in parallel
    const [jobsRes, runsRes, agentRunsRes, lmRes] = await Promise.all([
      // total_jobs_semana — from orquestrador_jobs
      (supabase as any)
        .from("orquestrador_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      // taxa_aprovacao — from hos_runs (have approval flow)
      (supabase as any)
        .from("hos_runs")
        .select("status")
        .gte("created_at", sevenDaysAgo),
      // agentes_ativos — from agent_runs last 7 days
      (supabase as any)
        .from("agent_runs")
        .select("agent_name")
        .gte("created_at", sevenDaysAgo)
        .eq("status", "completed"),
      // ultimo score
      (supabase as any)
        .from("learning_machine_reports")
        .select("insights")
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(1),
    ]);

    const totalJobs: number = jobsRes.count ?? 0;

    const hosRuns: { status: string }[] = runsRes.data ?? [];
    const totalAprovacao = hosRuns.length;
    const aprovados = hosRuns.filter((r) => r.status === "approved").length;
    const taxaAprovacao =
      totalAprovacao > 0 ? Math.round((aprovados / totalAprovacao) * 100) : null;

    const agentRunRows: { agent_name: string }[] = agentRunsRes.data ?? [];
    const agentesAtivos = new Set(agentRunRows.map((r) => r.agent_name)).size;
    const agentesDormentes = 40 - agentesAtivos;

    const lmRow = lmRes.data?.[0];
    const ultimoScore: number | null =
      lmRow?.insights?.score_operacional ?? null;

    const ctx = {
      total_jobs_semana: totalJobs,
      taxa_aprovacao: taxaAprovacao,
      agentes_ativos_semana: agentesAtivos,
      agentes_dormentes: agentesDormentes,
      ultimo_score_operacional: ultimoScore,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:
          "Você é um Chief of Staff de um grupo de hospitalidade que opera com 40 agentes de IA especializados. Analise a performance operacional dos agentes e do pipeline de automação e gere um insight estratégico. Responda APENAS em JSON válido sem markdown:",
        messages: [
          {
            role: "user",
            content: `Dados operacionais dos últimos 7 dias:
- Jobs executados no Orquestrador: ${ctx.total_jobs_semana}
- Taxa de aprovação de runs HOS: ${ctx.taxa_aprovacao !== null ? ctx.taxa_aprovacao + "%" : "sem dados"}
- Agentes IA ativos: ${ctx.agentes_ativos_semana}/40
- Agentes dormentes: ${ctx.agentes_dormentes}/40
- Score operacional Learning Machine: ${ctx.ultimo_score_operacional !== null ? ctx.ultimo_score_operacional + "/100" : "não calculado"}

Responda APENAS com este JSON:
{
  "headline": "frase de 8-10 palavras resumindo o estado operacional",
  "insights": ["bullet 1", "bullet 2", "bullet 3"],
  "proximo_passo": "ação prioritária concreta e específica"
}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const aiResponse = await response.json();
    const raw: string = aiResponse.content?.[0]?.text ?? "";
    if (!raw) return null;

    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) return null;

    return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as OrquestradorInsight;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function OrchestratorPage() {
  const [runs, lmReports, insight, pendingJobs] = await Promise.all([
    listOrchestratorRuns(),
    loadLMReports(1),
    Promise.race([
      generateOrquestradorInsight(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]),
    loadPendingJobs(),
  ]);

  const latestLM = lmReports?.[0] ?? null;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Orquestrador HOS</h2>
        <div className="flex items-center space-x-2">
          <Link
            href="/orquestrador/insights"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
          >
            Insights
          </Link>
        </div>
      </div>

      {/* Learning Machine Panel — always visible */}
      <LearningMachinePanel report={latestLM} triggerAction={triggerLearningMachine} />

      {/* Contextual AI Insight Panel */}
      {insight && <InsightPanel insight={insight} />}

      {/* Pending Jobs — awaiting approval */}
      {pendingJobs.length > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-card-foreground shadow-sm p-6">
          <div className="flex items-center gap-2 pb-4">
            <span className="text-base">⏳</span>
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              Aguardando aprovação
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 ml-1">
              {pendingJobs.length}
            </span>
          </div>
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Resumo</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pendingJobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {job.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[240px] truncate">
                      {typeof job.payload?.headline === "string"
                        ? job.payload.headline
                        : typeof job.payload?.description === "string"
                        ? job.payload.description
                        : JSON.stringify(job.payload).slice(0, 80)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ApproveJobButton
                        jobId={job.id}
                        jobType={job.type}
                        approveAction={approveOrquestradorJob}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 pb-4">
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Execuções Recentes</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe e aprove as ações sugeridas pelos Agentes de IA.
            </p>
          </div>

          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payload (Origem)</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhuma execução encontrada.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{run.job?.name}</div>
                        <div className="text-xs text-muted-foreground">{run.job?.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {run.payload?.preview_url ? (
                          <a href={run.payload.preview_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {run.payload.preview_url}
                          </a>
                        ) : run.payload?.pr_number ? (
                          <span>PR #{run.payload.pr_number}</span>
                        ) : run.payload?.deployment_url ? (
                          <a href={run.payload.deployment_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {run.payload.deployment_url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/orquestrador/${run.id}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── InsightPanel ──────────────────────────────────────────────────────

function InsightPanel({ insight }: { insight: OrquestradorInsight }) {
  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚡</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Chief of Staff · Insight Operacional
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 ml-auto">
          IA
        </span>
      </div>

      <p className="text-lg font-semibold text-foreground mb-4 leading-snug">
        {insight.headline}
      </p>

      <ul className="space-y-2 mb-4">
        {insight.insights.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
            {bullet}
          </li>
        ))}
      </ul>

      <div className="border-t pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">
          Próximo passo
        </span>
        <span className="text-sm text-foreground/90">{insight.proximo_passo}</span>
      </div>
    </div>
  );
}

// ── LearningMachinePanel ──────────────────────────────────────────────

function LearningMachinePanel({
  report,
  triggerAction,
}: {
  report: LMReport | null;
  triggerAction: () => Promise<void>;
}) {
  const score = report?.insights?.score_operacional ?? null;
  const scoreColor =
    score === null ? "text-muted-foreground" :
    score >= 80 ? "text-green-600 dark:text-green-400" :
    score >= 60 ? "text-yellow-600 dark:text-yellow-400" :
    "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex items-start justify-between pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧠</span>
            <h3 className="text-2xl font-semibold leading-none tracking-tight">
              Learning Machine
            </h3>
            {report && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                Semana {report.week_number}/{report.year}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {report?.insights?.headline ?? "Análise semanal dos 40 agentes IA do KPH OS."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {score !== null && (
            <div className="text-right">
              <div className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{score}</div>
              <div className="text-xs text-muted-foreground">score operacional</div>
            </div>
          )}
          <form action={triggerAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 whitespace-nowrap"
            >
              {report ? "↻ Atualizar" : "▶ Gerar análise agora"}
            </button>
          </form>
        </div>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-foreground mb-1">Nenhuma análise gerada ainda</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            O cron roda toda sexta às 08:00 BRT. Clique em "Gerar análise agora" para criar o primeiro relatório manualmente.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums">{report.total_runs}</div>
              <div className="text-xs text-muted-foreground">execuções</div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {report.active_agents}
              </div>
              <div className="text-xs text-muted-foreground">agentes ativos</div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {report.inactive_agents}
              </div>
              <div className="text-xs text-muted-foreground">agentes dormentes</div>
            </div>
          </div>

          {report.top_agents && report.top_agents.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Top agentes da semana
              </div>
              <div className="flex flex-wrap gap-2">
                {report.top_agents.map((a) => (
                  <span
                    key={a.nome}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  >
                    {a.nome}
                    <span className="opacity-70">×{a.runs}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.insights?.insight_da_semana && (
            <div className="border-l-4 border-yellow-400 pl-3 py-1 mb-4">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {report.insights.insight_da_semana}
              </p>
            </div>
          )}

          {report.insights?.proximos_passos && report.insights.proximos_passos.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Próximos passos
              </div>
              <div className="space-y-1">
                {report.insights.proximos_passos.slice(0, 3).map((step, i) => {
                  const prioColor =
                    step.prioridade === "alta" ? "text-red-600 dark:text-red-400" :
                    step.prioridade === "media" ? "text-yellow-600 dark:text-yellow-400" :
                    "text-muted-foreground";
                  return (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`text-xs font-bold uppercase mt-0.5 shrink-0 w-10 ${prioColor}`}>
                        {step.prioridade}
                      </span>
                      <span className="text-foreground/80">{step.acao}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")} · Cron toda sexta 08:00 BRT
          </div>
        </>
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    awaiting_approval: "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  const labels: Record<string, string> = {
    pending: "Pendente",
    running: "Executando",
    awaiting_approval: "Aguardando Aprovação",
    approved: "Aprovado",
    rejected: "Rejeitado",
    failed: "Falhou",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}
