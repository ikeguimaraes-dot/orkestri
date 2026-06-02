import { listOrchestratorRuns } from "@/lib/orquestrador/actions";
import { loadLMReports, generateLearningMachineReport } from "@/lib/orquestrador/learning-machine";
import type { LMReport } from "@/lib/orquestrador/learning-machine";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function triggerLearningMachine() {
  "use server";
  await generateLearningMachineReport();
  revalidatePath("/orquestrador");
}

export default async function OrchestratorPage() {
  const [runs, lmReports] = await Promise.all([
    listOrchestratorRuns(),
    loadLMReports(1),
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
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-foreground mb-1">Nenhuma análise gerada ainda</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            O cron roda toda sexta às 08:00 BRT. Clique em "Gerar análise agora" para criar o primeiro relatório manualmente.
          </p>
        </div>
      ) : (
        <>
          {/* Stats row */}
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

          {/* Top agents */}
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

          {/* Insight da semana */}
          {report.insights?.insight_da_semana && (
            <div className="border-l-4 border-yellow-400 pl-3 py-1 mb-4">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {report.insights.insight_da_semana}
              </p>
            </div>
          )}

          {/* Next steps */}
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
