import { listOrchestratorRuns } from "@/lib/orquestrador/actions";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function OrchestratorPage() {
  const runs = await listOrchestratorRuns();

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
