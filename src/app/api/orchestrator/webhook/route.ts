import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function notifyDiscord(message: string) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message })
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  const body = await req.json()
  const { type, payload } = body

  const event = type ?? body.event
  const deployment_url = payload?.url ? `https://${payload.url}` : body.deployment_url
  const triggered_by = 'webhook'

  const target = payload?.target
  const slug = target === 'production' ? 'deploy_prod' : 'qa_preview'

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id, name')
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

  await notifyDiscord(
    `🤖 **Orquestrador HOS** — Nova execução aguardando aprovação\n` +
    `**Job:** ${job.name}\n` +
    `**Evento:** ${event}\n` +
    `**Deploy:** ${deployment_url ?? 'N/A'}\n` +
    `**Aprovar/Rejeitar:** https://kph-os.vercel.app/orquestrador/${run.id}`
  )

  return NextResponse.json({ run_id: run.id, status: 'awaiting_approval' })
}
