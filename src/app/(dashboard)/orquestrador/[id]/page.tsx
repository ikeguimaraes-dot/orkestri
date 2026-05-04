import { getRunDetails, submitHumanDecision } from '@/lib/orquestrador/actions'
import { redirect } from 'next/navigation'

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const run = await getRunDetails(params.id)

  async function approve(formData: FormData) {
    'use server'
    const feedback = formData.get('feedback') as string
    await submitHumanDecision(run.id, 'approve', feedback)
    redirect('/orquestrador')
  }

  async function reject(formData: FormData) {
    'use server'
    const feedback = formData.get('feedback') as string
    await submitHumanDecision(run.id, 'reject', feedback)
    redirect('/orquestrador')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{run.hos_jobs?.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date(run.created_at).toLocaleString('pt-BR')} · via {run.triggered_by} · status: <strong>{run.status}</strong>
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2 text-gray-600">Payload</h2>
        <pre className="text-xs text-gray-700 overflow-auto">{JSON.stringify(run.payload, null, 2)}</pre>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2 text-gray-600">Logs do Agente</h2>
        <div className="space-y-1">
          {(run.logs as any[]).map((log, i) => (
            <p key={i} className="text-xs font-mono text-gray-700">
              <span className="text-gray-400">[{log.ts}]</span> {log.msg}
            </p>
          ))}
        </div>
      </div>

      {run.status === 'awaiting_approval' && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Sua decisão</h2>
          <textarea name="feedback" placeholder="Feedback opcional..." className="w-full border rounded p-2 text-sm" rows={3} id="feedback-text" />
          <div className="flex gap-3">
            <form action={approve}>
              <input type="hidden" name="feedback" id="feedback-approve" />
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                ✅ Aprovar
              </button>
            </form>
            <form action={reject}>
              <input type="hidden" name="feedback" id="feedback-reject" />
              <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                ❌ Rejeitar
              </button>
            </form>
          </div>
        </div>
      )}

      {run.hos_approvals?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Decisão registrada</h2>
          {run.hos_approvals.map((a: any) => (
            <p key={a.created_at} className="text-sm">
              <strong>{a.decision === 'approve' ? '✅ Aprovado' : '❌ Rejeitado'}</strong>
              {a.feedback && ` — "${a.feedback}"`}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
