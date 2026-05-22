'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUnit } from '@kph/auth/context'
import { fetchHorasExtras, createHoraExtra, approveHoraExtra, deleteHoraExtra, fetchEmployeesHE } from './actions'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TIPOS_HE = ['100%','50%','DSR','Compensação']

interface HE {
  id: string; date: string; hours: number; type: string; reason: string
  periodo: string; source: string; approved: boolean
  employees: { nome: string; sobrenome: string; funcao: string }
}
interface Employee { id: string; nome: string; funcao: string }
interface Periodo { mes: number; ano: number }

export default function HorasExtrasPage() {
  const { unit, units, setUnit } = useUnit()
  const unitId = unit?.id ?? null
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const d = new Date(); return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
  const [registros, setRegistros] = useState<HE[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    employee_id: '', date: '', hours: 1, type: '50%', reason: '', periodo: '', source: 'manual'
  })

  const load = useCallback(async () => {
    if (!unitId) return
    setLoading(true)
    const [r, e] = await Promise.all([
      fetchHorasExtras(unitId, periodo.mes, periodo.ano),
      fetchEmployeesHE(unitId),
    ])
    setRegistros(r as HE[])
    setEmployees(e as Employee[])
    setLoading(false)
  }, [unitId, periodo])

  useEffect(() => { load() }, [load])

  const totalHoras    = registros.reduce((s, r) => s + Number(r.hours), 0)
  const totalAprov    = registros.filter(r => r.approved).length
  const totalPendente = registros.filter(r => !r.approved).length
  const horasAprov    = registros.filter(r => r.approved).reduce((s, r) => s + Number(r.hours), 0)

  const filtrados = registros.filter(r => {
    const nome = `${r.employees?.nome} ${r.employees?.sobrenome}`.toLowerCase()
    return nome.includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase())
  })

  const handleSave = async () => {
    if (!form.employee_id || !form.date || !unitId) return
    setSaving(true)
    const { error } = await createHoraExtra({ ...form, unit_id: unitId })
    if (!error) {
      setModal(false)
      setForm({ employee_id: '', date: '', hours: 1, type: '50%', reason: '', periodo: '', source: 'manual' })
      load()
    }
    setSaving(false)
  }

  const handleApprove = async (id: string) => {
    await approveHoraExtra(id)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esse registro?')) return
    await deleteHoraExtra(id)
    load()
  }

  if (!mounted) return null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Horas Extras</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Registro, aprovação e controle</p>
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
            + Registrar HE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de Horas',    value: `${totalHoras.toFixed(1)}h`,   sub: 'no período' },
          { label: 'Horas Aprovadas',   value: `${horasAprov.toFixed(1)}h`,   sub: `${totalAprov} registros` },
          { label: 'Pendentes',         value: totalPendente,                  sub: 'aguardando aprovação' },
          { label: 'Registros',         value: registros.length,              sub: 'total no período' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.label === 'Pendentes' && totalPendente > 0 ? 'text-amber-400' : 'text-foreground'}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou tipo..."
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none w-72" />
          <span className="text-xs text-muted-foreground">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
        ) : !filtrados.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma hora extra registrada para o período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {['Colaborador','Data','Horas','Tipo','Motivo','Status','Ação'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {r.employees?.nome} {r.employees?.sobrenome}
                    <span className="block text-xs text-muted-foreground">{r.employees?.funcao}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{new Date(r.date+'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 font-semibold text-indigo-400">{Number(r.hours).toFixed(1)}h</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-950/40 text-indigo-400">{r.type}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.reason || '—'}</td>
                  <td className="px-4 py-3">
                    {r.approved
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-950/40 text-green-400">Aprovado</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-950/40 text-amber-400">Pendente</span>
                    }
                  </td>
                  <td className="px-4 py-3 flex items-center gap-3">
                    {!r.approved && (
                      <button onClick={() => handleApprove(r.id)} className="text-xs text-green-400 hover:text-green-300 transition">Aprovar</button>
                    )}
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-300 transition">Remover</button>
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
              <h2 className="text-lg font-semibold text-foreground">Registrar Hora Extra</h2>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-medium">Data</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                    className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-medium">Horas</label>
                  <input type="number" step="0.5" min="0.5" value={form.hours} onChange={e => setForm(f => ({...f, hours: Number(e.target.value)}))}
                    className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full mt-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  {TIPOS_HE.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-medium">Motivo</label>
                <input value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}
                  placeholder="Motivo da hora extra…"
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
