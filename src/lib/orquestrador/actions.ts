'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function listRuns() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hos_runs')
    .select(`*, hos_jobs(name, slug)`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function getRunDetails(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hos_runs')
    .select(`*, hos_jobs(name, slug), hos_approvals(decision, feedback, created_at, user_id)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function submitHumanDecision(
  runId: string,
  decision: 'approve' | 'reject',
  feedback?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  await supabase.from('hos_approvals').insert({
    run_id: runId,
    user_id: user.id,
    decision,
    feedback
  })

  await supabase.from('hos_runs')
    .update({ status: decision === 'approve' ? 'approved' : 'rejected' })
    .eq('id', runId)

  revalidatePath('/orquestrador')
}
