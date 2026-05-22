'use server'

import { createServiceClient } from '@kph/db/supabase/server'

type PeriodoRow = {
  unit_id: string
  data: string
  receita_bruta: number
  total_pontos: number
  fonte: string
}

export async function upsertGorjetaPeriodos(rows: PeriodoRow[]): Promise<{ error: string | null }> {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }

  const { error } = await (sb as any)
    .from('gorjeta_periodos')
    .upsert(rows, { onConflict: 'unit_id,data' })

  return { error: error?.message ?? null }
}

export async function fetchGorjetasDados(
  unitId: string,
  inicio: string,
  fim: string
): Promise<{ periodos: any[]; dias: any[] }> {
  const sb = createServiceClient()
  if (!sb) return { periodos: [], dias: [] }

  const [{ data: periodos }, { data: dias }] = await Promise.all([
    (sb as any)
      .from('gorjeta_periodos')
      .select('data,receita_bruta,receita_liquida,total_pontos,valor_ponto,fonte')
      .eq('unit_id', unitId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data'),
    (sb as any)
      .from('gorjeta_dias')
      .select('employee_id,data,cargo,pontos,valor_calculado,presente,employees(nome)')
      .eq('unit_id', unitId)
      .gte('data', inicio)
      .lte('data', fim),
  ])

  return { periodos: periodos ?? [], dias: dias ?? [] }
}

export async function fetchGorjetaCargos(unitId: string): Promise<any[]> {
  const sb = createServiceClient()
  if (!sb) return []

  const { data: unitCargos } = await (sb as any)
    .from('gorjeta_cargo_pontos')
    .select('id,cargo,pontos,ativo')
    .eq('unit_id', unitId)
    .order('cargo')

  if (unitCargos?.length) return unitCargos

  // Copiar templates globais para a unidade
  const { data: templates } = await (sb as any)
    .from('gorjeta_cargo_pontos')
    .select('cargo,pontos')
    .is('unit_id', null)

  if (!templates?.length) return []

  const rows = templates.map((t: any) => ({ unit_id: unitId, cargo: t.cargo, pontos: t.pontos }))
  const { data: inserted } = await (sb as any)
    .from('gorjeta_cargo_pontos')
    .insert(rows)
    .select('id,cargo,pontos,ativo')

  return inserted ?? []
}

export async function saveGorjetaCargo(id: string, pontos: number): Promise<{ error: string | null }> {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível' }

  const { error } = await (sb as any)
    .from('gorjeta_cargo_pontos')
    .update({ pontos })
    .eq('id', id)

  return { error: error?.message ?? null }
}

export async function fetchEmployeesForGorjeta(
  unitId: string
): Promise<{ id: string; nome_completo: string; funcao: string }[]> {
  const sb = createServiceClient()
  if (!sb) return []
  const { data } = await (sb as any)
    .from('employees')
    .select('id, nome, sobrenome, funcao')
    .eq('unit_id', unitId)
    .eq('ativo', true)
  return (data ?? []).map((e: any) => ({
    id: e.id,
    nome_completo: `${e.nome ?? ''} ${e.sobrenome ?? ''}`.trim(),
    funcao: e.funcao ?? '',
  }))
}

export async function fetchGorjetaPeriodsMap(
  unitId: string
): Promise<Record<string, { id: string; receita_liquida: number }>> {
  const sb = createServiceClient()
  if (!sb) return {}
  const { data } = await (sb as any)
    .from('gorjeta_periodos')
    .select('id, data, receita_liquida')
    .eq('unit_id', unitId)
  const map: Record<string, { id: string; receita_liquida: number }> = {}
  for (const row of data ?? [])
    map[row.data] = { id: row.id, receita_liquida: parseFloat(row.receita_liquida) }
  return map
}

type DiaRow = {
  unit_id: string; employee_id: string; periodo_id: string
  data: string; cargo: string; pontos: number
  presente: boolean; valor_calculado: number
}

export async function upsertGorjetaDias(
  rows: DiaRow[]
): Promise<{ error: string | null; count: number }> {
  const sb = createServiceClient()
  if (!sb) return { error: 'Service client indisponível', count: 0 }
  const { error } = await (sb as any)
    .from('gorjeta_dias')
    .upsert(rows, { onConflict: 'unit_id,employee_id,data' })
  return { error: error?.message ?? null, count: rows.length }
}
