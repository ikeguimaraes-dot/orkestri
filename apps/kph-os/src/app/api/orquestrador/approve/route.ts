// POST /api/orquestrador/approve — approves an orquestrador_job and executes
// its post-approval action. Authenticated via KPH_API_SECRET.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@kph/db/supabase/server'
import { handleApproval } from '@/lib/orquestrador/approve-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json() as { job_id?: string; secret?: string }

  if (!body.secret || body.secret !== process.env.KPH_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = body.job_id
  if (!jobId) {
    return NextResponse.json({ error: 'job_id obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  // Fetch and validate current status
  const { data: job, error: fetchError } = await (supabase as any)
    .from('orquestrador_jobs')
    .select('id, type, status')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  }

  const currentStatus = (job as any).status
  if (currentStatus !== 'pending') {
    return NextResponse.json(
      { error: `Job já processado (status atual: ${currentStatus})` },
      { status: 409 }
    )
  }

  // Mark as running before executing
  await (supabase as any)
    .from('orquestrador_jobs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  // Execute post-approval action
  const result = await handleApproval(jobId)

  // Update final status — success or error
  await (supabase as any)
    .from('orquestrador_jobs')
    .update({
      status: result.success ? 'success' : 'error',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  return NextResponse.json({
    success: result.success,
    action_taken: result.action_taken,
    message: result.message,
  })
}
