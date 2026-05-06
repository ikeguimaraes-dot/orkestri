'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface KPIs {
  totalBruto: number
  totalLiquido: number
  valorPontoMedio: number
  totalColaboradores: number
  quinzena1Liquido: number
  quinzena2Liquido: number
}

interface ColaboradorResumo {
  employee_id: string
  nome: string
  cargo: string
  dias_presentes: number
  total_pontos: number
  total_gorjeta: number
  quinzena1: number
  quinzena2: number
}

interface DiaReceita {
  data: string
  receita_bruta: number
  receita_liquida: number
  total_pontos: number
  valor_ponto: number
  fonte: string
}

interface CargoPonto {
  id: string
  cargo: string
  pontos: number
  ativo: boolean
}

interface Periodo { mes: number; ano: number }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtN = (v: number, d = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

function quinzena(dataStr: string): 1 | 2 {
  return new Date(dataStr).getDate() <= 15 ? 1 : 2
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function GorjetasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getBrowserClient()! as any

  const [tab, setTab] = useState<'resumo' | 'dias' | 'cargos' | 'importar'>('resumo')
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const d = new Date()
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
  const [unitId, setUnitId] = useState<string>('')
  const [units, setUnits]   = useState<{ id: string; name: string }[]>([])
  const [kpis,  setKpis]    = useState<KPIs | null>(null)
  const [colaboradores, setColaboradores] = useState<ColaboradorResumo[]>([])
  const [dias,   setDias]   = useState<DiaReceita[]>([])
  const [cargos, setCargos] = useState<CargoPonto[]>([])
  const [loading,    setLoading]    = useState(false)
  const [importLog,  setImportLog]  = useState<string[]>([])
  const [importing,  setImporting]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [editCargo,  setEditCargo]  = useState<string | null>(null)
  const [editPontos, setEditPontos] = useState<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Carregar unidades ──────────────────────────────────────────────────────
  useEffect(() => {
    sb.from('units').select('id,name').order('name')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => {
        if (data?.length) { setUnits(data); setUnitId(data[0]!.id) }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Carregar dados ao mudar filtros ────────────────────────────────────────
  const load = useCallback(async () => {
    if (!unitId) return
    setLoading(true)
    const inicio = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-01`
    const fim    = new Date(periodo.ano, periodo.mes, 0).toISOString().slice(0, 10)

    const [{ data: pData }, { data: dData }] = await Promise.all([
      sb.from('gorjeta_periodos')
        .select('data,receita_bruta,receita_liquida,total_pontos,valor_ponto,fonte')
        .eq('unit_id', unitId)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data'),
      sb.from('gorjeta_dias')
        .select('employee_id,data,cargo,pontos,valor_calculado,presente,employees(nome)')
        .eq('unit_id', unitId)
        .gte('data', inicio)
        .lte('data', fim),
    ])

    setDias((pData as DiaReceita[]) ?? [])

    if (pData?.length) {
      const totalBruto   = (pData as DiaReceita[]).reduce((s, d) => s + (d.receita_bruta ?? 0), 0)
      const totalLiquido = (pData as DiaReceita[]).reduce((s, d) => s + (d.receita_liquida ?? 0), 0)
      const pontoMedio   = (pData as DiaReceita[]).reduce((s, d) => s + (d.valor_ponto ?? 0), 0) / pData.length
      const q1 = (pData as DiaReceita[]).filter(d => quinzena(d.data) === 1).reduce((s, d) => s + d.receita_liquida, 0)
      const q2 = (pData as DiaReceita[]).filter(d => quinzena(d.data) === 2).reduce((s, d) => s + d.receita_liquida, 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const empSet = new Set((dData ?? []).map((d: any) => d.employee_id))
      setKpis({ totalBruto, totalLiquido, valorPontoMedio: pontoMedio,
                totalColaboradores: empSet.size, quinzena1Liquido: q1, quinzena2Liquido: q2 })
    } else {
      setKpis(null)
    }

    if (dData?.length) {
      const map: Record<string, ColaboradorResumo> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of dData as any[]) {
        if (!r.presente) continue
        if (!map[r.employee_id]) {
          map[r.employee_id] = {
            employee_id: r.employee_id,
            nome: r.employees?.nome ?? '—',
            cargo: r.cargo,
            dias_presentes: 0,
            total_pontos:   0,
            total_gorjeta:  0,
            quinzena1: 0,
            quinzena2: 0,
          }
        }
        const q     = quinzena(r.data)
        const entry = map[r.employee_id]!
        entry.dias_presentes++
        entry.total_pontos  += r.pontos
        entry.total_gorjeta += r.valor_calculado ?? 0
        if (q === 1) entry.quinzena1 += r.valor_calculado ?? 0
        else         entry.quinzena2 += r.valor_calculado ?? 0
      }
      setColaboradores(Object.values(map).sort((a, b) => b.total_gorjeta - a.total_gorjeta))
    } else {
      setColaboradores([])
    }

    setLoading(false)
  }, [unitId, periodo, sb])

  useEffect(() => { load() }, [load])

  // ── Cargos ────────────────────────────────────────────────────────────────
  const loadCargos = useCallback(async () => {
    if (!unitId) return

    const { data: unitCargos } = await sb
      .from('gorjeta_cargo_pontos')
      .select('id,cargo,pontos,ativo')
      .eq('unit_id', unitId)
      .order('cargo')

    if (unitCargos?.length) {
      setCargos(unitCargos as CargoPonto[])
      return
    }

    // Copiar templates globais para a unidade
    const { data: templates } = await sb
      .from('gorjeta_cargo_pontos')
      .select('cargo,pontos')
      .is('unit_id', null)

    if (templates?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (templates as any[]).map((t) => ({ unit_id: unitId, cargo: t.cargo, pontos: t.pontos }))
      const { data: inserted } = await sb
        .from('gorjeta_cargo_pontos')
        .insert(rows)
        .select('id,cargo,pontos,ativo')
      setCargos((inserted ?? []) as CargoPonto[])
    }
  }, [unitId, sb])

  useEffect(() => { if (tab === 'cargos') loadCargos() }, [tab, loadCargos])

  async function saveCargo(id: string, pontos: number) {
    await sb.from('gorjeta_cargo_pontos').update({ pontos }).eq('id', id)
    setEditCargo(null)
    loadCargos()
  }

  // ── Importador Excel ───────────────────────────────────────────────────────
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !unitId) return
    setImporting(true)
    setImportLog(['🔄 Lendo arquivo...'])

    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
      const log: string[] = ['🔄 Lendo arquivo...']

      // Aba VALORES
      const wsName = wb.SheetNames.find(n => n.toUpperCase().includes('VALOR')) ?? wb.SheetNames[0]!
      const ws     = wb.Sheets[wsName]!
      const rows   = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      log.push(`📋 Aba "${wsName}" · ${rows.length} linhas`)
      setImportLog([...log])

      // Detectar linha de cabeçalho (contém DATA ou DIA)
      let headerRow = -1
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const r = rows[i] as (string | null)[]
        if (r.some(c => String(c ?? '').toUpperCase().includes('DATA') ||
                        String(c ?? '').toUpperCase() === 'DIA')) {
          headerRow = i; break
        }
      }
      if (headerRow < 0) throw new Error('Cabeçalho DATA não encontrado na aba VALORES')

      const headers = (rows[headerRow] as (string | null)[]).map(c => String(c ?? '').trim().toUpperCase())
      log.push(`📌 Cabeçalho na linha ${headerRow + 1}: ${headers.slice(0, 6).join(' | ')} ...`)
      setImportLog([...log])

      const colData   = headers.findIndex(h => h.includes('DATA') || h === 'DIA')
      const colBruto  = headers.findIndex(h => h.includes('BRUT') || h.includes('RECEIT'))
      const colPontos = headers.findIndex(h => h.includes('PONTO') && !h.includes('VALOR'))

      if (colData < 0 || colBruto < 0)
        throw new Error(`Colunas não encontradas — DATA:${colData} BRUTO:${colBruto}`)

      const periodoRows: Record<string, unknown>[] = []
      let skipped = 0

      for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i] as (string | number | Date | null)[]
        if (!r[colData]) continue

        const dataVal = r[colData]
        const dataStr = dataVal instanceof Date
          ? dataVal.toISOString().slice(0, 10)
          : (() => {
              const num = Number(dataVal)
              if (!isNaN(num) && num > 40000) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = (XLSX.SSF as any).parse_date_code(num) as { y: number; m: number; d: number }
                return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
              }
              const parts = String(dataVal).split(/[/\-]/)
              if (parts.length === 3) {
                const [p0, p1, p2] = [parts[0]!, parts[1]!, parts[2]!]
                if (p2.length === 4)
                  return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`
                if (p0.length === 4)
                  return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`
              }
              return null
            })()

        if (!dataStr || isNaN(Date.parse(dataStr))) { skipped++; continue }

        const receita_bruta = Number(r[colBruto] ?? 0)
        if (receita_bruta <= 0) { skipped++; continue }

        const total_pontos = colPontos >= 0 ? (Number(r[colPontos] ?? 0) || 1) : 1

        periodoRows.push({ unit_id: unitId, data: dataStr, receita_bruta, total_pontos, fonte: 'import' })
      }

      log.push(`📊 ${periodoRows.length} dias detectados · ${skipped} linhas ignoradas`)
      setImportLog([...log])

      if (!periodoRows.length) throw new Error('Nenhum dia de receita válido encontrado')

      const { error: pErr } = await sb
        .from('gorjeta_periodos')
        .upsert(periodoRows, { onConflict: 'unit_id,data' })

      if (pErr) throw new Error(`Erro ao salvar períodos: ${pErr.message}`)
      log.push(`✅ ${periodoRows.length} períodos salvos`)
      setImportLog([...log])

      // Aba COLABORADORES (se existir)
      const wsColab = wb.SheetNames.find(n =>
        n.toUpperCase().includes('COLAB') ||
        n.toUpperCase().includes('FUNC')  ||
        n.toUpperCase().includes('EQUIPE')
      )
      if (wsColab) {
        log.push(`ℹ️  Aba colaboradores detectada — importação detalhada em versão futura`)
      } else {
        log.push(`ℹ️  Aba de colaboradores não encontrada — só receitas diárias importadas`)
      }

      log.push(`🎉 Importação concluída!`)
      setImportLog([...log])
      load()
    } catch (err: unknown) {
      setImportLog(prev => [...prev, `❌ Erro: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const colabFiltrado = colaboradores.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.cargo.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gorjetas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sistema de pontos por dia · distribuição diária</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {!unitId && <option value="" disabled>Carregando…</option>}
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select
            value={periodo.mes}
            onChange={e => setPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={periodo.ano}
            onChange={e => setPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Receita Bruta',     value: fmt(kpis.totalBruto),              sub: 'no período'      },
            { label: 'Receita Líquida',   value: fmt(kpis.totalLiquido),            sub: '− 20% impostos'  },
            { label: 'Valor Médio Ponto', value: `R$ ${fmtN(kpis.valorPontoMedio)}`, sub: 'por ponto/dia' },
            { label: 'Colaboradores',     value: String(kpis.totalColaboradores),   sub: 'na distribuição' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quinzenas */}
      {kpis && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '1ª Quinzena', value: kpis.quinzena1Liquido, range: '1–15'  },
            { label: '2ª Quinzena', value: kpis.quinzena2Liquido, range: '16–31' },
          ].map(q => (
            <div key={q.label} className="bg-indigo-50 rounded-xl border border-indigo-100 px-5 py-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{q.label}</p>
                <p className="text-xs text-indigo-400 mt-0.5">Dias {q.range}</p>
              </div>
              <p className="text-xl font-bold text-indigo-700">{fmt(q.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {(['resumo', 'dias', 'cargos', 'importar'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'resumo'    ? 'Por Colaborador'
               : t === 'dias'   ? 'Por Dia'
               : t === 'cargos' ? 'Pontos por Cargo'
               :                  'Importar Excel'}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Por Colaborador ── */}
      {tab === 'resumo' && (
        <div className="space-y-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou cargo…"
            className="w-full sm:w-80 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando…</div>
          ) : !colabFiltrado.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Nenhum dado para {MESES[periodo.mes - 1]}/{periodo.ano}.<br />
              Importe um Excel ou aguarde integração Lorean.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Colaborador','Cargo','Dias','Pontos','1ª Quinzena','2ª Quinzena','Total'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {colabFiltrado.map((c, i) => (
                    <tr key={c.employee_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{c.cargo}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.dias_presentes}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.total_pontos}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(c.quinzena1)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(c.quinzena2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(c.total_gorjeta)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 border-t border-indigo-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(colabFiltrado.reduce((s, c) => s + c.quinzena1, 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(colabFiltrado.reduce((s, c) => s + c.quinzena2, 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(colabFiltrado.reduce((s, c) => s + c.total_gorjeta, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Por Dia ── */}
      {tab === 'dias' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando…</div>
          ) : !dias.length ? (
            <div className="text-center py-12 text-gray-400 text-sm">Sem dados de receita para o período.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Data','Receita Bruta','Receita Líquida','Total Pontos','Valor/Ponto','Fonte'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dias.map((d, i) => (
                  <tr key={d.data} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                        quinzena(d.data) === 1 ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>Q{quinzena(d.data)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmt(d.receita_bruta)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(d.receita_liquida)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{d.total_pontos.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">R$ {fmtN(d.valor_ponto)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.fonte === 'lorean' ? 'bg-green-50 text-green-700'  :
                        d.fonte === 'import' ? 'bg-yellow-50 text-yellow-700':
                                               'bg-gray-100 text-gray-500'
                      }`}>{d.fonte}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Pontos por Cargo ── */}
      {tab === 'cargos' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500">Configuração de pontos por cargo · afeta cálculos futuros</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cargo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Pontos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cargos.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.cargo}</td>
                  <td className="px-4 py-3 text-center">
                    {editCargo === c.id ? (
                      <input
                        type="number"
                        value={editPontos}
                        min={0}
                        onChange={e => setEditPontos(Number(e.target.value))}
                        className="w-20 text-center border border-indigo-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-indigo-700 text-lg">{c.pontos}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editCargo === c.id ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => saveCargo(c.id, editPontos)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                        >Salvar</button>
                        <button
                          onClick={() => setEditCargo(null)}
                          className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
                        >Cancelar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditCargo(c.id); setEditPontos(c.pontos) }}
                        className="text-xs text-indigo-600 hover:underline"
                      >Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Importar Excel ── */}
      {tab === 'importar' && (
        <div className="space-y-6">
          <div
            onClick={() => !importing && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              importing
                ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
            }`}
          >
            <div className="text-4xl mb-3">{importing ? '⏳' : '📂'}</div>
            <p className="text-sm font-medium text-gray-700">
              {importing ? 'Processando…' : 'Clique para selecionar a planilha de gorjeta (.xlsx)'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Padrão Meet &amp; Eat · aba "VALORES"</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcel}
          />

          {importLog.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
              {importLog.map((l, i) => (
                <p key={i} className={
                  l.startsWith('❌') ? 'text-red-400'   :
                  l.startsWith('✅') ? 'text-green-400' :
                  l.startsWith('🎉') ? 'text-yellow-300 font-bold' :
                  'text-gray-300'
                }>{l}</p>
              ))}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">📋 Formato esperado</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Aba chamada <strong>VALORES</strong> (ou similar)</li>
              <li>Colunas: <strong>DATA · RECEITA BRUTA · TOTAL PONTOS</strong></li>
              <li>Uma linha por dia do período</li>
              <li>Linhas de &quot;TOTAL&quot; ou &quot;QUINZENA&quot; são ignoradas automaticamente</li>
              <li>Datas em DD/MM/AAAA ou serial Excel são suportados</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
