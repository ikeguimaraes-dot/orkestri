import { listRuns } from '@/lib/orquestrador/actions'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  awaiting_approval: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-gray-100 text-gray-800',
}

const statusLabel: Record<string, string> = {
  pending: 'Aguardando',
  running: 'Rodando',
  awaiting_approval: '⏳ Aguarda Aprovação',
  approved: '✅ Aprovado',
  rejected: '❌ Rejeitado',
  failed: '💥 Falhou',
}

export default async function OrquestradorPage() {
  const runs = await listRuns()
  const pendentes = runs.filter(r => r.status === 'awaiting_approval')
  const historico = runs.filter(r => r.status !== 'awaiting_approval')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Orquestrador HOS</h1>
        <p className="text-gray-500 text-sm mt-1">Human-in-the-loop • Você aprova antes de ir pra produção</p>
      </div>

      {pendentes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-orange-600">⏳ Aguardando sua aprovação ({pendentes.length})</h2>
          <div className="space-y-2">
            {pendentes.map(run => (
              <Link key={run.id} href={`/orquestrador/${run.id}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-orange-50 transition">
                <div>
                  <p className="font-medium">{run.hos_jobs?.name}</p>
                  <p className="text-xs text-gray-400">{new Date(run.created_at).toLocaleString('pt-BR')} · via {run.triggered_by}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[run.status]}`}>
                  {statusLabel[run.status]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Histórico</h2>
        <div className="space-y-2">
          {historico.map(run => (
            <Link key={run.id} href={`/orquestrador/${run.id}`}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
              <div>
                <p className="font-medium">{run.hos_jobs?.name}</p>
                <p className="text-xs text-gray-400">{new Date(run.created_at).toLocaleString('pt-BR')} · via {run.triggered_by}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[run.status]}`}>
                {statusLabel[run.status]}
              </span>
            </Link>
          ))}
          {historico.length === 0 && <p className="text-gray-400 text-sm">Nenhuma execução ainda.</p>}
        </div>
      </section>
    </div>
  )
}
