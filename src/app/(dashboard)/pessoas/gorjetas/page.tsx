'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUnit, useSupabase } from '@/lib/auth/context'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { upsertGorjetaPeriodos, fetchGorjetasDados, fetchGorjetaCargos, saveGorjetaCargo, fetchEmployeesForGorjeta, fetchGorjetaPeriodsMap, upsertGorjetaDias } from './actions'

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
  const sb      = useSupabase()! as any
  const { unit, units, setUnit } = useUnit()
  const unitId  = unit?.id ?? null

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [tab, setTab] = useState<'resumo' | 'dias' | 'cargos' | 'analise' | 'importar'>('resumo')
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const d = new Date()
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
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
  const fileRefFreq = useRef<HTMLInputElement>(null)

  // ── Carregar dados ao mudar filtros ────────────────────────────────────────
  const load = useCallback(async () => {
    if (!unitId) return
    setLoading(true)
    const inicio = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-01`
    const fim    = new Date(periodo.ano, periodo.mes, 0).toISOString().slice(0, 10)

    const { periodos: pData, dias: dData } = await fetchGorjetasDados(unitId, inicio, fim)

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
  }, [unitId, periodo, sb]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // ── Cargos ────────────────────────────────────────────────────────────────
  const loadCargos = useCallback(async () => {
    if (!unitId) return
    const data = await fetchGorjetaCargos(unitId)
    setCargos(data as CargoPonto[])
  }, [unitId])

  useEffect(() => { if (tab === 'cargos') loadCargos() }, [tab, loadCargos])

  async function saveCargo(id: string, pontos: number) {
    await saveGorjetaCargo(id, pontos)
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
      const buf    = await file.arrayBuffer()
      const wb     = XLSX.read(buf, { type: 'array' })
      const wsName = wb.SheetNames[0]!
      const ws     = wb.Sheets[wsName]!
      const rows   = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      type Row = (string | number | null)[]

      // Estrutura confirmada:
      // Row onde col 1 contém "EQUIPE"        → col 2+ = datas ISO (YYYY-MM-DD)
      // Row onde col 1 contém "VALOR TOTAL PO" → col 2+ = receita bruta por dia
      let rowDatas:    Row | null = null
      let rowReceitas: Row | null = null

      for (const raw of rows) {
        const r  = raw as Row
        const c1 = String(r[1] ?? '').trim().toUpperCase()
        if (!rowDatas    && c1.includes('EQUIPE'))         { rowDatas    = r; continue }
        if (!rowReceitas && c1.includes('VALOR TOTAL PO')) { rowReceitas = r; continue }
        if (rowDatas && rowReceitas) break
      }

      if (!rowDatas)    throw new Error('Linha EQUIPE (datas) não encontrada na planilha')
      if (!rowReceitas) throw new Error('Linha VALOR TOTAL PO (receitas) não encontrada na planilha')

      function toISO(v: string | number | null): string | null {
        if (typeof v === 'number')
          return new Date((v - 25569) * 86400 * 1000).toISOString().slice(0, 10)
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()))
          return v.trim()
        return null
      }

      const periodoRows: Record<string, unknown>[] = []

      for (let col = 2; col < rowDatas.length; col++) {
        const data          = toISO(rowDatas[col] ?? null)
        const receita_bruta = Number(rowReceitas[col])
        if (!data || isNaN(receita_bruta) || receita_bruta <= 0) continue
        periodoRows.push({ unit_id: unitId, data, receita_bruta, total_pontos: 1, fonte: 'import' })
      }

      if (!periodoRows.length) throw new Error('Nenhum dia de receita válido encontrado')

      const { error: pErr } = await upsertGorjetaPeriodos(
        periodoRows as { unit_id: string; data: string; receita_bruta: number; total_pontos: number; fonte: string }[]
      )

      if (pErr) throw new Error(`Erro ao salvar períodos: ${pErr}`)
      setImportLog(prev => [...prev, `✅ ${periodoRows.length} períodos salvos no banco`, '🎉 Importação concluída!'])
      load()
    } catch (err: unknown) {
      setImportLog(prev => [...prev, `❌ Erro: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }


  const importarFrequencia = async (file: File) => {
    if (!unitId) return
    setImporting(true)
    setImportLog([])
    try {
      setImportLog(p => [...p, '🔄 Lendo aba FREQUENCIA...'])
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets['FREQUENCIA '] ?? wb.Sheets['FREQUENCIA']
      if (!ws) throw new Error('Aba FREQUENCIA não encontrada na planilha')
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, cellDates: true })
      const header = rows[0]
      if (!header?.length) throw new Error("Planilha sem cabeçalho")

      const dateCols: { col: number; date: string }[] = []
      for (let i = 7; i < header.length; i++) {
        const cell = header[i]
        if (!cell) break
        const d = cell instanceof Date ? cell.toISOString().split('T')[0]
          : typeof cell === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cell) ? cell.slice(0, 10)
          : null
        if (!d) break
        dateCols.push({ col: i, date: d })
      }
      setImportLog(p => [...p, `📅 ${dateCols.length} datas (${dateCols[0]?.date} → ${dateCols.at(-1)?.date})`])

      const [employees, periodsMap] = await Promise.all([
        fetchEmployeesForGorjeta(unitId),
        fetchGorjetaPeriodsMap(unitId),
      ])
      const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
      const empMap = new Map(employees.map(e => [norm(e.nome_completo), e]))
      setImportLog(p => [...p, `👥 ${employees.length} colaboradores · ${Object.keys(periodsMap).length} dias com receita`])

      const colabRows = rows.slice(1).filter(r => r[0] && typeof r[0] === 'string' && r[0].trim())
      const diasRows: any[] = []
      const naoEncontrados = new Set<string>()

      for (const dc of dateCols) {
        const period = periodsMap[dc.date]
        if (!period) continue
        const presentes = colabRows
          .filter(r => r[dc.col] === 'PRESENÇA')
          .map(r => ({ nome: String(r[0]), cargo: String(r[1] ?? ''), pontos: Number(r[2]) || 0 }))
        const totalPontos = presentes.reduce((s, p) => s + p.pontos, 0)
        if (totalPontos === 0) continue
        const valorPonto = period.receita_liquida / totalPontos
        for (const p of presentes) {
          const emp = empMap.get(norm(p.nome))
          if (!emp) { naoEncontrados.add(p.nome); continue }
          diasRows.push({
            unit_id: unitId,
            employee_id: emp.id,
            periodo_id: period.id,
            data: dc.date,
            cargo: p.cargo,
            pontos: p.pontos,
            presente: true,
            valor_calculado: Math.round(p.pontos * valorPonto * 100) / 100,
          })
        }
      }

      setImportLog(p => [...p, `📊 ${diasRows.length} registros calculados`])
      if (naoEncontrados.size > 0)
        setImportLog(p => [...p, `⚠️ ${naoEncontrados.size} nomes não encontrados: ${[...naoEncontrados].slice(0, 5).join(', ')}${naoEncontrados.size > 5 ? '...' : ''}`])

      const { error, count } = await upsertGorjetaDias(diasRows)
      if (error) throw new Error(error)
      setImportLog(p => [...p, `✅ ${count} registros salvos`, '🎉 Importação FREQUENCIA concluída!'])
      load()
    } catch (err) {
      setImportLog(p => [...p, `❌ Erro: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setImporting(false)
      if (fileRefFreq.current) fileRefFreq.current.value = ''
    }
  }

  const colabFiltrado = colaboradores.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.cargo.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────
  if (!mounted) return null
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gorjetas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sistema de pontos por dia · distribuição diária</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={unitId ?? ''}
            onChange={e => setUnit(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select
            value={periodo.mes}
            onChange={e => setPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={periodo.ano}
            onChange={e => setPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            <div key={k.label} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
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
            <div key={q.label} className="bg-indigo-950/40 rounded-xl border border-indigo-800/50 px-5 py-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">{q.label}</p>
                <p className="text-xs text-indigo-400 mt-0.5">Dias {q.range}</p>
              </div>
              <p className="text-xl font-bold text-indigo-300">{fmt(q.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-6">
          {(['resumo', 'dias', 'cargos', 'analise', 'importar'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-400 text-indigo-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'resumo'    ? 'Por Colaborador'
               : t === 'dias'   ? 'Por Dia'
               : t === 'cargos'  ? 'Pontos por Cargo'
               : t === 'analise' ? 'Análise'
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
            className="w-full sm:w-80 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
          ) : !colabFiltrado.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum dado para {MESES[periodo.mes - 1]}/{periodo.ano}.<br />
              Importe um Excel ou aguarde integração Lorean.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    {['Colaborador','Cargo','Dias','Pontos','1ª Quinzena','2ª Quinzena','Total'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {colabFiltrado.map((c, i) => (
                    <tr key={c.employee_id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                      <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.cargo}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.dias_presentes}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.total_pontos}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(c.quinzena1)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(c.quinzena2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(c.total_gorjeta)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-950/30 border-t border-indigo-800/50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-indigo-300 uppercase">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-300">{fmt(colabFiltrado.reduce((s, c) => s + c.quinzena1, 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-300">{fmt(colabFiltrado.reduce((s, c) => s + c.quinzena2, 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-300">{fmt(colabFiltrado.reduce((s, c) => s + c.total_gorjeta, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Por Dia ── */}
      {tab === 'dias' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
          ) : !dias.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sem dados de receita para o período.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {['Data','Receita Bruta','Receita Líquida','Total Pontos','Valor/Ponto','Fonte'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dias.map((d, i) => (
                  <tr key={d.data} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                        quinzena(d.data) === 1 ? 'bg-blue-950/40 text-blue-400' : 'bg-purple-950/40 text-purple-400'
                      }`}>Q{quinzena(d.data)}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{fmt(d.receita_bruta)}</td>
                    <td className="px-4 py-3 text-foreground">{fmt(d.receita_liquida)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{d.total_pontos.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-400">R$ {fmtN(d.valor_ponto)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.fonte === 'lorean' ? 'bg-green-950/40 text-green-400'  :
                        d.fonte === 'import' ? 'bg-yellow-950/40 text-yellow-400':
                                               'bg-muted text-muted-foreground'
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
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm text-muted-foreground">Configuração de pontos por cargo · afeta cálculos futuros</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Cargo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Pontos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargos.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{c.cargo}</td>
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
                      <span className="font-bold text-indigo-300 text-lg">{c.pontos}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editCargo === c.id ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => saveCargo(c.id, editPontos)}
                          className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition"
                        >Salvar</button>
                        <button
                          onClick={() => setEditCargo(null)}
                          className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80 transition"
                        >Cancelar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditCargo(c.id); setEditPontos(c.pontos) }}
                        className="text-xs text-indigo-400 hover:underline"
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

      {/* ── Tab: Análise ── */}
      {tab === 'analise' && (
        <div className="space-y-4">
          {!dias.length ? (
            <div className="bg-card rounded-xl border border-border text-center py-12 text-muted-foreground text-sm">
              Sem dados para o período. Importe um Excel ou aguarde integração Lorean.
            </div>
          ) : (
            <>
              {/* Médias do período */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Média Diária Bruta',   value: fmt(dias.reduce((s,d) => s + d.receita_bruta,   0) / dias.length) },
                  { label: 'Média Diária Líquida',  value: fmt(dias.reduce((s,d) => s + d.receita_liquida, 0) / dias.length) },
                  { label: 'Melhor Dia (Líquido)',  value: fmt(Math.max(...dias.map(d => d.receita_liquida))) },
                ].map(k => (
                  <div key={k.label} className="bg-card rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Gráfico de barras — Receita por Dia */}
              <div className="bg-card rounded-xl border border-border p-5">
                <p className="text-sm font-semibold text-foreground mb-4">Receita por Dia</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dias} margin={{ top: 4, right: 8, left: 8, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="data"
                      tickFormatter={d => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      labelFormatter={d => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="receita_bruta"   name="Bruta"   fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="receita_liquida" name="Líquida" fill="#a5b4fc" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparativo quinzenas */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '1ª Quinzena', value: kpis?.quinzena1Liquido ?? 0, dias: dias.filter(d => new Date(d.data+'T12:00').getDate() <= 15).length },
                  { label: '2ª Quinzena', value: kpis?.quinzena2Liquido ?? 0, dias: dias.filter(d => new Date(d.data+'T12:00').getDate() >  15).length },
                ].map(q => (
                  <div key={q.label} className="bg-card rounded-xl border border-border p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{q.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{q.dias} dia{q.dias !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-xl font-bold text-indigo-400">{fmt(q.value)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
            <p className="text-sm font-medium text-foreground">
              {importing ? 'Processando…' : 'Clique para selecionar a planilha de gorjeta (.xlsx)'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Padrão Meet &amp; Eat · aba "VALORES"</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcel}
          />

          {/* ── Importar FREQUENCIA ── */}
          <div className="border-t border-border pt-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Distribuição por Colaborador</p>
              <p className="text-xs text-muted-foreground mt-0.5">Aba FREQUENCIA · presença e pontos individuais</p>
            </div>
            <input
              ref={fileRefFreq}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importarFrequencia(f) }}
            />
            <button
              onClick={() => fileRefFreq.current?.click()}
              disabled={importing}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors disabled:opacity-50"
            >
              <p className="text-sm text-muted-foreground">Clique para selecionar a planilha de gorjeta (.xlsx)</p>
              <p className="text-xs text-muted-foreground mt-1">Padrão Meet & Eat · aba "FREQUENCIA"</p>
            </button>
          </div>

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

          <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
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
