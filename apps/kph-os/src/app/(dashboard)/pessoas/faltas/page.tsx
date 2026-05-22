'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUnit } from '@kph/auth/context'
import { fetchFaltas, createFalta, deleteFalta, fetchEmployeesAtivos } from './actions'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TIPOS = ['Injustificada','Justificada','Atestado Médico','Atestado Acidente','Licença']

interface Falta {
  id: string; data: string; tipo: string; motivo: string; score_impact: number
  employees: { nome: string; sobrenome: string; funcao: string }
}
interface Employee { id: string; nome: string; funcao: string }
interface Periodo { mes: number; ano: number }

export default function FaltasPage() {
  const { unit, units, setUnit } = useUnit()
  const unitId = unit?.id ?? null
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const d = new Date(); return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    employee_id: '', data: '', tipo: 'Injustificada', motivo: '', score_impact: -5
  })

  const load = useCallback(async () => {
    if (!unitId) return
    setLoading(true)
    const [f, e] = await Promise.all([
      fetchFaltas(unitId, periodo.mes, periodo.ano),
      fetchEmployeesAtivos(unitId),
    ])
    setFaltas(f as Falta[])
    setEmployees(e as Employee[])
    setLoading(false)
  }, [unitId, periodo])

  useEffect(() => { load() }, [load])

  const totalInjust  = faltas.filter(f => f.tipo === 'Injustificada').length
  const totalJust    = faltas.filter(f => f.tipo !== 'Injustificada').length
  const totalAtestado = faltas.filter(f => f.tipo.startsWith('Atestado')).length
  const scoreTotal   = faltas.reduce((s, f) => s + (f.score_impact ?? 0), 0)

  const filtradas = faltas.filter(f => {
    const nome = `${f.employees?.nome} ${f.employees?.sobrenome}`.toLowerCase()
    return nome.includes(search.toLowerCase()) || f.tipo.toLowerCase().includes(search.toLowerCase())
  })

  const handleSave = async () => {
    if (!form.employee_id || !form.data || !form.tipo) return
    setSaving(true)
    const { error } = await createFalta(form)
    if (!error) { setModal(false); setForm({ employee_id: '', data: '', tipo: 'Injustificada', motivo: '', score_impact: -5 }); load() }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover essa falta?')) return
    await deleteFalta(id)
    load()
  }

  if (!mounted) return null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Faltas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Registro e controle de ausências</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={unitId ?? ''} onChange={e => setUnit(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={periodo.mes} onChange={e => setPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={periodo.ano} onChange={e => setPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            {[2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => setModal(true)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
            + Nova Falta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de Faltas',    value: faltas.length,   sub: 'no período' },
          { label: 'Injustificadas',     value: totalInjust,     sub: 'sem justificativa' },
          { label: 'Justificadas',       value: totalJust,       sub: 'com documento' },
          { label: 'Impacto no Score',   value: scoreTotal,      sub: 'pontos descontados' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.label === 'Impacto no Score' ? 'text-red-400' : 'text-foreground'}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou tipo..."
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none w-72" />
          <span className="text-xs text-muted-foreground">{filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
        ) : !filtradas.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma falta registrada para o período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {['Colaborador','Cargo','Data','Tipo','Motivo','Score','Ação'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((f, i) => (
                <tr key={f.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                  <td className="px-4 py-3 font-medium text-foreground">{f.employees?.nome} {f.employees?.sobrenome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.employees?.funcao}</td>
                  <td className="px-4 py-3 text-foreground">{new Date(f.data+'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      f.tipo === 'Injustificada' ? 'bg-red-950/40 text-red-400' :
                      f.tipo.startsWith('Atestado') ? 'bg-blue-950/40 text-blue-400' :
                      'bg-green-950/40 text-green-400'
                    }`}>{f.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{f.motivo || '—'}</td>
                  <td className="px-4 py-3 text-red-400 font-medium">{f.score_impact ?? 0}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(f.id)} className="text-xs text-red-400 hover:text-red-300 transition">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Registrar Falta</h2>
              <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Colaborador</label>
                <select value={form.employee_id} onChange={e => setForm(f => ({...f, employee_id: e.target.value}))}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="">Selecione…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.nome} · {e.funcao}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Motivo (opcional)</label>
                <input value={form.motivo} onChange={e => setForm(f => ({...f, motivo: e.target.value}))}
                  placeholder="Descreva o motivo…"
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Impacto no Score</label>
                <input type="number" value={form.score_impact} onChange={e => setForm(f => ({...f, score_impact: Number(e.target.value)}))}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)}
                className="flex-1 text-sm bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80 transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                {saving ? 'Salvando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
