import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendDiscordMessage } from '@/lib/discord/notify'
import { autoApproveRun } from '@/lib/orquestrador/actions'

const ALLOWED_PROJECTS = (process.env.ORCHESTRATOR_ALLOWED_PROJECTS || 'kph-os')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  const body = await req.json()
  const { type, payload } = body

  const projectName = body?.payload?.name || body?.payload?.project?.name
  if (projectName && !ALLOWED_PROJECTS.includes(projectName)) {
    console.log(`[orchestrator] Webhook ignorado, projeto fora do allowlist: ${projectName}`)
    return Response.json({ ignored: true, project: projectName }, { status: 200 })
  }

  const event = type ?? body.event
  const deployment_url = payload?.url ? `https://${payload.url}` : body.deployment_url
  const triggered_by = 'webhook'

  const target = payload?.target
  const slug = target === 'production' ? 'deploy_prod' : 'qa_preview'

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id, name, auto_approve')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  }

  const { data: run, error } = await (supabase as any)
    .from('hos_runs')
    .insert({
      job_id: job.id,
      status: 'awaiting_approval',
      triggered_by,
      payload: { deployment_url, event, raw: payload ?? {} },
      logs: [{ ts: new Date().toISOString(), msg: `Run criado via ${triggered_by} — evento: ${event}` }]
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kph-os.vercel.app'

  if (job.auto_approve) {
    await autoApproveRun(run.id)
    await sendDiscordMessage(
      `✅ **Auto-aprovado** — ${job.name}\n` +
      `**Deploy:** ${deployment_url ?? 'N/A'}\n` +
      `Job de baixo risco — nenhuma ação necessária.\n` +
      `**Painel:** ${baseUrl}/orquestrador/${run.id}`
    )
    return NextResponse.json({ run_id: run.id, status: 'approved' })
  }

  await sendDiscordMessage(
    `🤖 **Orquestrador HOS** — Nova execução aguardando aprovação\n` +
    `**Job:** ${job.name}\n` +
    `**Evento:** ${event}\n` +
    `**Deploy:** ${deployment_url ?? 'N/A'}\n` +
    `**Run ID:** \`${run.id}\`\n` +
    `Via Discord: \`/aprovar run_id:${run.id}\` ou \`/rejeitar run_id:${run.id}\`\n` +
    `**Painel:** ${baseUrl}/orquestrador/${run.id}`
  )

  return NextResponse.json({ run_id: run.id, status: 'awaiting_approval' })
}
