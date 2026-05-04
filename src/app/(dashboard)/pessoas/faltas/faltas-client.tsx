"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CalendarX, FileText, Plus, Search, Users } from "lucide-react";

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
import { formatDateBR } from "@/lib/format";
import { createAbsence } from "@/lib/pessoas/actions";
import type { AbsenceWithEmployee, EmployeeStub } from "@/types/pessoas";

const TIPO_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  justificada:   { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8", label: "Justificada" },
  injustificada: { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "Injustificada" },
  atestado:      { bg: "rgba(245,158,11,0.16)",  fg: "#A16207", label: "Atestado" },
  falta_abono:   { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Abono" },
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const today = () => new Date().toISOString().slice(0, 10);

export function FaltasClient({
  unitId,
  unitName,
  absences: initialAbsences,
  employees,
  defaultMes,
  defaultAno,
}: {
  unitId: string;
  unitName: string;
  absences: AbsenceWithEmployee[];
  employees: EmployeeStub[];
  defaultMes: number;
  defaultAno: number;
}) {
  const router = useRouter();
  const [absences, setAbsences] = useState(initialAbsences);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formEmployee, setFormEmployee] = useState("");
  const [formData, setFormData] = useState(today());
  const [formTipo, setFormTipo] = useState("injustificada");
  const [formMotivo, setFormMotivo] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const total = absences.length;
    const justificadas = absences.filter((a) => a.tipo === "justificada" || a.tipo === "atestado" || a.tipo === "falta_abono").length;
    const injustificadas = absences.filter((a) => a.tipo === "injustificada").length;

    const byEmployee: Record<string, number> = {};
    for (const a of absences) {
      if (a.employee_id) byEmployee[a.employee_id] = (byEmployee[a.employee_id] ?? 0) + 1;
    }
    const alertas = Object.values(byEmployee).filter((n) => n >= 2).length;

    return { total, justificadas, injustificadas, alertas };
  }, [absences]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return absences.filter((a) => {
      if (tipoFilter !== "all" && a.tipo !== tipoFilter) return false;
      if (q) {
        const name = a.employee ? `${a.employee.nome} ${a.employee.sobrenome}`.toLowerCase() : "";
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [absences, tipoFilter, search]);

  function resetForm() {
    setFormEmployee("");
    setFormData(today());
    setFormTipo("injustificada");
    setFormMotivo("");
    setFormErr(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!formEmployee) { setFormErr("Selecione um colaborador."); return; }
    if (!formData) { setFormErr("Data obrigatória."); return; }

    startTransition(async () => {
      const res = await createAbsence({
        employee_id: formEmployee,
        data: formData,
        tipo: formTipo,
        motivo: formMotivo.trim() || null,
      });
      if (!res.ok) { setFormErr(res.error); return; }

      const emp = employees.find((e) => e.id === formEmployee) ?? null;
      const newRow: AbsenceWithEmployee = {
        ...(res.data as AbsenceWithEmployee),
        employee: emp,
      };
      setAbsences((prev) => [newRow, ...prev]);
      setDialogOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<CalendarX size={18} />} label="Total do período" value={counts.total} />
        <KpiCard icon={<FileText size={18} />} label="Justificadas" value={counts.justificadas} />
        <KpiCard icon={<AlertCircle size={18} />} label="Injustificadas" value={counts.injustificadas} highlight={counts.injustificadas > 0} />
        <KpiCard icon={<Users size={18} />} label="Colabs com 2+ faltas" value={counts.alertas} highlight={counts.alertas > 0} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <Select value={tipoFilter} onValueChange={(v: string | null) => setTipoFilter(v ?? "all")}>
          <SelectTrigger style={{ width: 180 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="justificada">Justificada</SelectItem>
            <SelectItem value="injustificada">Injustificada</SelectItem>
            <SelectItem value="atestado">Atestado</SelectItem>
            <SelectItem value="falta_abono">Abono</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger render={<Button />}>
            <Plus size={14} style={{ marginRight: 6 }} />
            Registrar Falta
          </DialogTrigger>
          <DialogContent style={{ maxWidth: 460 }}>
            <DialogHeader>
              <DialogTitle>Registrar Falta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              <Field label="Colaborador">
                <Select value={formEmployee} onValueChange={(v: string | null) => setFormEmployee(v ?? "")}>
                  <SelectTrigger style={{ width: "100%" }}><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome} {e.sobrenome}
                        {e.funcao ? ` — ${e.funcao}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data">
                <Input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} />
              </Field>
              <Field label="Tipo">
                <Select value={formTipo} onValueChange={(v: string | null) => setFormTipo(v ?? "injustificada")}>
                  <SelectTrigger style={{ width: "100%" }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="justificada">Justificada</SelectItem>
                    <SelectItem value="injustificada">Injustificada</SelectItem>
                    <SelectItem value="atestado">Atestado médico</SelectItem>
                    <SelectItem value="falta_abono">Abono</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Motivo (opcional)">
                <Textarea
                  rows={2}
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Descrição…"
                />
              </Field>
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
          Nenhuma falta para o filtro atual.
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
          <div style={{ overflowX: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const cor = TIPO_COLOR[a.tipo] ?? { bg: "rgba(100,100,100,0.12)", fg: "var(--text-2)", label: a.tipo };
                  const name = a.employee ? `${a.employee.nome} ${a.employee.sobrenome}`.trim() : "—";
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.employee ? (
                          <Link href={`/pessoas/colaboradores/${a.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                            {name}
                          </Link>
                        ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                        {a.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{a.employee.funcao}</div>}
                      </TableCell>
                      <TableCell style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateBR(a.data)}</TableCell>
                      <TableCell>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: cor.bg, color: cor.fg, fontWeight: 600, fontSize: 11 }}>
                          {cor.label}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: "var(--text-2)", fontSize: 13 }}>{a.motivo ?? "—"}</TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: a.score_impact < 0 ? "#B91C1C" : "var(--text-3)" }}>
                        {a.score_impact !== 0 ? `${a.score_impact > 0 ? "+" : ""}${a.score_impact}` : "—"}
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

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(239,68,68,0.12)" : "var(--brand-soft)", color: highlight ? "#B91C1C" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
