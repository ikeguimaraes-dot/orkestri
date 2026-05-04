import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { event, deployment_url, pr_number, triggered_by = 'webhook' } = body

  // Mapeia evento para o job correto
  const slugMap: Record<string, string> = {
    'deployment.preview': 'qa_preview',
    'pr.opened': 'code_review',
    'deployment.promote': 'deploy_prod',
  }

  const slug = slugMap[event]
  if (!slug) {
    return NextResponse.json({ error: 'Evento não reconhecido' }, { status: 400 })
  }

  const { data: job } = await supabase
    .from('hos_jobs')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job não encontrado ou inativo' }, { status: 404 })
  }

  const { data: run, error } = await supabase
    .from('hos_runs')
    .insert({
      job_id: job.id,
      status: 'pending',
      triggered_by,
      payload: { deployment_url, pr_number, event },
      logs: [{ ts: new Date().toISOString(), msg: `Run criado via ${triggered_by}` }]
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ run_id: run.id, status: 'pending' })
}
