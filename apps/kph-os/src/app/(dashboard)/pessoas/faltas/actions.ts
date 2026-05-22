'use server'
import { createServiceClient } from '@kph/db/supabase/server'

export async function fetchFaltas(unitId: string, mes: number, ano: number) {
  const sb = createServiceClient()
  if (!sb) return []
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim    = new Date(ano, mes, 0).toISOString().slice(0, 10)
  const { data } = await (sb as any)
    .from('absences')
    .select('*, employees!inner(nome, sobrenome, funcao, unit_id)')
    .eq('employees.unit_id', unitId)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })
  return data ?? []
}

export async function createFalta(row: {
  employee_id: string; data: string; tipo: string; motivo: string; score_impact: number
}) {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }
  const { error } = await (sb as any).from('absences').insert(row)
  return { error: error?.message ?? null }
}

export async function deleteFalta(id: string) {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }
  const { error } = await (sb as any).from('absences').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function fetchEmployeesAtivos(unitId: string) {
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
