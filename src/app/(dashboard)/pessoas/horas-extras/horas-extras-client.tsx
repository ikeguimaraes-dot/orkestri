"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, DollarSign, Loader2, Plus, Search, Timer, TrendingUp, TrendingDown, X } from "lucide-react";
import { getBancoHorasUnit, type BancoHorasEntry } from "@/lib/pessoas/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL, formatDateBR } from "@/lib/format";
import { approveOvertime, createOvertimeRecord } from "@/lib/pessoas/actions";
import type { OvertimeRecordWithEmployee } from "@/types/pessoas";

type EmployeeForHE = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
  salario_base: string;
};

const TIPO_LABEL: Record<string, string> = { "50": "50%", "100": "100%", banco: "Banco" };
const TIPO_COLOR: Record<string, { bg: string; fg: string }> = {
  "50":  { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8" },
  "100": { bg: "rgba(245,158,11,0.16)",  fg: "#A16207" },
  banco: { bg: "rgba(168,85,247,0.16)",  fg: "#7E22CE" },
};
const STATUS_COLOR = {
  pendente:  { bg: "rgba(100,116,139,0.14)", fg: "#475569", label: "Pendente" },
  aprovada:  { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Aprovada" },
  rejeitada: { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "Rejeitada" },
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const today = () => new Date().toISOString().slice(0, 10);

function calcValorEstimado(salario: string, horas: string, tipo: string): number {
  const sal = parseFloat(salario) || 0;
  const h = parseFloat(horas) || 0;
  const mult = tipo === "100" ? 2 : tipo === "50" ? 1.5 : 1;
  const horaBase = sal / 220;
  return horaBase * h * mult;
}

export function HorasExtrasClient({
  unitId,
  unitName,
  records: initialRecords,
  employees,
  defaultMes,
  defaultAno,
}: {
  unitId: string;
  unitName: string;
  records: OvertimeRecordWithEmployee[];
  employees: EmployeeForHE[];
  defaultMes: number;
  defaultAno: number;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"he" | "banco">("he");
  const [bancoData, setBancoData] = useState<BancoHorasEntry[] | null>(null);
  const [records, setRecords] = useState(initialRecords);
  const [pending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  function handleTabChange(tab: "he" | "banco") {
    setActiveTab(tab);
    if (tab === "banco" && bancoData === null) {
      startTransition(async () => {
        const data = await getBancoHorasUnit(unitId);
        setBancoData(data);
      });
    }
  }
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formEmployee, setFormEmployee] = useState("");
  const [formData, setFormData] = useState(today());
  const [formHoras, setFormHoras] = useState("");
  const [formTipo, setFormTipo] = useState<"50" | "100" | "banco">("50");
  const [formMotivo, setFormMotivo] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === formEmployee) ?? null,
    [employees, formEmployee],
  );
  const valorPreview = selectedEmp
    ? calcValorEstimado(selectedEmp.salario_base, formHoras, formTipo)
    : 0;

  const counts = useMemo(() => {
    const totalHoras = records.reduce((acc, r) => acc + Number(r.hours), 0);
    const pendentes = records.filter((r) => r.approved === null).length;
    const aprovadas = records.filter((r) => r.approved === true).length;
    const valorTotal = records
      .filter((r) => r.approved !== false)
      .reduce((acc, r) => {
        const emp = employees.find((e) => e.id === r.employee_id);
        return acc + (emp ? calcValorEstimado(emp.salario_base, String(r.hours), r.type) : 0);
      }, 0);
    return { totalHoras, pendentes, aprovadas, valorTotal };
  }, [records, employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (tipoFilter !== "all" && r.type !== tipoFilter) return false;
      if (statusFilter === "pendente" && r.approved !== null) return false;
      if (statusFilter === "aprovada" && r.approved !== true) return false;
      if (statusFilter === "rejeitada" && r.approved !== false) return false;
      if (q) {
        const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase() : "";
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [records, tipoFilter, statusFilter, search]);

  function handleApprove(id: string, name: string) {
    if (!window.confirm(`Aprovar HE de ${name}?`)) return;
    setActingOn(id);
    startTransition(async () => {
      const r = await approveOvertime(id, true, null);
      setActingOn(null);
      if (!r.ok) { alert(`Falha: ${r.error}`); return; }
      setRecords((prev) => prev.map((x) => x.id === id ? { ...x, approved: true } : x));
    });
  }

  function handleReject(id: string, name: string) {
    if (!window.confirm(`Rejeitar HE de ${name}?`)) return;
    setActingOn(id);
    startTransition(async () => {
      const r = await approveOvertime(id, false, null);
      setActingOn(null);
      if (!r.ok) { alert(`Falha: ${r.error}`); return; }
      setRecords((prev) => prev.map((x) => x.id === id ? { ...x, approved: false } : x));
    });
  }

  function resetForm() {
    setFormEmployee("");
    setFormData(today());
    setFormHoras("");
    setFormTipo("50");
    setFormMotivo("");
    setFormErr(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!formEmployee) { setFormErr("Selecione um colaborador."); return; }
    if (!formHoras || parseFloat(formHoras) <= 0) { setFormErr("Informe um número válido de horas."); return; }

    startTransition(async () => {
      const res = await createOvertimeRecord({
        employee_id: formEmployee,
        unit_id: unitId,
        date: formData,
        hours: formHoras,
        type: formTipo,
        reason: formMotivo.trim() || null,
        source: "manual",
      });
      if (!res.ok) { setFormErr(res.error); return; }

      const emp = employees.find((e) => e.id === formEmployee) ?? null;
      const newRow: OvertimeRecordWithEmployee = {
        ...(res.data as OvertimeRecordWithEmployee),
        employee: emp ? { id: emp.id, nome: emp.nome, sobrenome: emp.sobrenome, funcao: emp.funcao, departamento: null } : null,
      };
      setRecords((prev) => [newRow, ...prev]);
      setDialogOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <div>
      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 2, marginBottom: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["he", "banco"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "background 0.15s", background: activeTab === tab ? "var(--brand)" : "transparent", color: activeTab === tab ? "var(--primary-foreground)" : "var(--text-2)" }}
          >
            {tab === "he" ? "Horas Extras" : "Banco de Horas"}
          </button>
        ))}
      </div>

      {activeTab === "banco" ? (
        <BancoHorasTab data={bancoData} loading={pending} />
      ) : (
      <div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<Timer size={18} />} label="Total de horas" value={`${counts.totalHoras.toFixed(1)}h`} />
        <KpiCard icon={<DollarSign size={18} />} label="Valor estimado" value={formatBRL(counts.valorTotal)} />
        <KpiCard icon={<Clock size={18} />} label="Pendentes" value={counts.pendentes} highlight={counts.pendentes > 0} />
        <KpiCard icon={<Check size={18} />} label="Aprovadas" value={counts.aprovadas} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <Select value={tipoFilter} onValueChange={(v: string | null) => setTipoFilter(v ?? "all")}>
          <SelectTrigger style={{ width: 150 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="50">50%</SelectItem>
            <SelectItem value="100">100%</SelectItem>
            <SelectItem value="banco">Banco de horas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: string | null) => setStatusFilter(v ?? "all")}>
          <SelectTrigger style={{ width: 150 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovada">Aprovada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno}
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger render={<Button />}>
            <Plus size={14} style={{ marginRight: 6 }} />
            Registrar HE
          </DialogTrigger>
          <DialogContent style={{ maxWidth: 460 }}>
            <DialogHeader>
              <DialogTitle>Registrar Hora Extra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <Field label="Colaborador">
                <Select value={formEmployee} onValueChange={(v: string | null) => setFormEmployee(v ?? "")}>
                  <SelectTrigger style={{ width: "100%" }}><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome} {e.sobrenome} — {e.funcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Data">
                  <Input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} />
                </Field>
                <Field label="Horas">
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={formHoras}
                    onChange={(e) => setFormHoras(e.target.value)}
                    placeholder="Ex: 2"
                  />
                </Field>
              </div>
              <Field label="Tipo">
                <Select value={formTipo} onValueChange={(v: string | null) => setFormTipo((v ?? "50") as "50" | "100" | "banco")}>
                  <SelectTrigger style={{ width: "100%" }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50% — Dia útil</SelectItem>
                    <SelectItem value="100">100% — Feriado / Domingo</SelectItem>
                    <SelectItem value="banco">Banco de horas</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Motivo (opcional)">
                <Textarea rows={2} value={formMotivo} onChange={(e) => setFormMotivo(e.target.value)} placeholder="Descreva…" />
              </Field>
              {selectedEmp && formHoras && (
                <div style={{ padding: "8px 12px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 8, fontSize: 12, color: "var(--brand)" }}>
                  Valor estimado: <strong>{formatBRL(valorPreview)}</strong> (salário/220h × {formTipo === "100" ? "2" : formTipo === "50" ? "1,5" : "1"} × {formHoras}h)
                </div>
              )}
              {formErr && (
                <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", borderRadius: 6, fontSize: 12, color: "#B91C1C" }}>
                  {formErr}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>Cancelar</Button>
                <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhum registro para o filtro atual.
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
          <div style={{ overflowX: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Horas</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Valor est.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const tipoCor = TIPO_COLOR[r.type] ?? { bg: "rgba(100,100,100,0.12)", fg: "var(--text-2)" };
                  const statusKey = r.approved === null ? "pendente" : r.approved ? "aprovada" : "rejeitada";
                  const statusCor = STATUS_COLOR[statusKey];
                  const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.trim() : "—";
                  const acting = actingOn === r.id;
                  const emp = employees.find((e) => e.id === r.employee_id);
                  const valor = emp ? calcValorEstimado(emp.salario_base, String(r.hours), r.type) : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.employee ? (
                          <Link href={`/pessoas/colaboradores/${r.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                            {name}
                          </Link>
                        ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                        {r.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.employee.funcao}</div>}
                      </TableCell>
                      <TableCell style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateBR(r.date)}</TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--brand)" }}>
                        {Number(r.hours).toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: tipoCor.bg, color: tipoCor.fg, fontWeight: 600, fontSize: 11 }}>
                          {TIPO_LABEL[r.type] ?? r.type}
                        </span>
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                        {valor != null ? formatBRL(valor) : "—"}
                      </TableCell>
                      <TableCell>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: statusCor.bg, color: statusCor.fg, fontWeight: 600, fontSize: 11 }}>
                          {statusCor.label}
                        </span>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        {r.approved === null ? (
                          <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                            <Button size="sm" variant="outline" onClick={() => handleApprove(r.id, name)} disabled={pending} title="Aprovar">
                              {acting && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" style={{ color: "#15803D" }} />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject(r.id, name)} disabled={pending} title="Rejeitar">
                              <X className="h-3.5 w-3.5" style={{ color: "#B91C1C" }} />
                            </Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

function BancoHorasTab({ data, loading }: { data: BancoHorasEntry[] | null; loading: boolean }) {
  if (loading && data === null) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Carregando banco de horas…</div>;
  }
  if (!data?.length) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>Nenhum saldo de banco de horas encontrado.</div>;
  }

  const totalH = data.reduce((s, e) => s + e.saldo_horas, 0);
  const totalV = data.reduce((s, e) => s + (e.saldo_horas >= 0 ? e.valor_estimado : 0), 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<Timer size={18} />} label="Saldo total (h)" value={`${totalH >= 0 ? "+" : ""}${totalH.toFixed(1)}h`} />
        <KpiCard icon={<DollarSign size={18} />} label="Valor a pagar (est.)" value={formatBRL(totalV)} />
        <KpiCard icon={<TrendingUp size={18} />} label="Com saldo positivo" value={data.filter((e) => e.saldo_horas > 0).length} />
        <KpiCard icon={<TrendingDown size={18} />} label="Com débito" value={data.filter((e) => e.saldo_horas < 0).length} highlight />
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Colaborador", "Saldo (h)", "Valor est.", "Última atualização"].map((h, i) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.6, textAlign: i > 0 ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((e) => {
                const pos = e.saldo_horas >= 0;
                return (
                  <tr key={e.employee_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <Link href={`/pessoas/colaboradores/${e.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>{e.nome}</Link>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.funcao}</div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: pos ? "#15803D" : "#B91C1C" }}>
                      {pos ? "+" : ""}{e.saldo_horas.toFixed(1)}h
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-2)" }}>
                      {pos ? formatBRL(e.valor_estimado) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-3)" }}>
                      {e.ultimo_calculo ? new Date(e.ultimo_calculo).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{label}</span>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(245,158,11,0.14)" : "var(--brand-soft)", color: highlight ? "#A16207" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
