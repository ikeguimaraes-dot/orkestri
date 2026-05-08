'use server'

import { createServiceClient } from '@/lib/supabase/server'

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
