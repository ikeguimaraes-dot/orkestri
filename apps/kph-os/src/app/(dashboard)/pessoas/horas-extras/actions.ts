'use server'
import { createServiceClient } from '@kph/db/supabase/server'

export async function fetchHorasExtras(unitId: string, mes: number, ano: number) {
  const sb = createServiceClient()
  if (!sb) return []
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim    = new Date(ano, mes, 0).toISOString().slice(0, 10)
  const { data } = await (sb as any)
    .from('overtime_records')
    .select('*, employees(nome, sobrenome, funcao)')
    .eq('unit_id', unitId)
    .gte('date', inicio)
    .lte('date', fim)
    .order('date', { ascending: false })
  return data ?? []
}

export async function createHoraExtra(row: {
  unit_id: string; employee_id: string; date: string
  hours: number; type: string; reason: string; periodo: string; source: string
}) {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }
  const { error } = await (sb as any).from('overtime_records').insert(row)
  return { error: error?.message ?? null }
}

export async function approveHoraExtra(id: string) {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }
  const { error } = await (sb as any)
    .from('overtime_records')
    .update({ approved: true })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteHoraExtra(id: string) {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }
  const { error } = await (sb as any).from('overtime_records').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function fetchEmployeesHE(unitId: string) {
  const sb = createServiceClient()
  if (!sb) return []
  const { data } = await (sb as any)
    .from('employees')
    .select('id, nome, sobrenome, funcao')
    .eq('unit_id', unitId)
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map((e: any) => ({
    id: e.id,
    nome: `${e.nome} ${e.sobrenome}`.trim(),
    funcao: e.funcao ?? '',
  }))
}
