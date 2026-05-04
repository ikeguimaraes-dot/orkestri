"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarX, FileText, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import type { AbsenceWithEmployee } from "@/types/pessoas";

const TIPO_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  justificada:   { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8", label: "Justificada" },
  injustificada: { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "Injustificada" },
  atestado:      { bg: "rgba(245,158,11,0.16)",  fg: "#A16207", label: "Atestado" },
  falta_abono:   { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Abono" },
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function FaltasClient({
  unitName,
  absences,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  absences: AbsenceWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const counts = useMemo(() => ({
    total: absences.length,
    injustificadas: absences.filter((a) => a.tipo === "injustificada").length,
    atestados: absences.filter((a) => a.tipo === "atestado").length,
  }), [absences]);

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

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<CalendarX size={18} />} label="Total do período" value={counts.total} />
        <KpiCard icon={<AlertCircle size={18} />} label="Injustificadas" value={counts.injustificadas} highlight />
        <KpiCard icon={<FileText size={18} />} label="Atestados" value={counts.atestados} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v ?? "all")}>
          <SelectTrigger style={{ width: 180 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="justificada">Justificada</SelectItem>
            <SelectItem value="injustificada">Injustificada</SelectItem>
            <SelectItem value="atestado">Atestado</SelectItem>
            <SelectItem value="falta_abono">Abono</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhuma falta para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Score</TableHead>
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
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: a.score_impact < 0 ? "#B91C1C" : "var(--text-3)" }}>
                    {a.score_impact !== 0 ? `${a.score_impact > 0 ? "+" : ""}${a.score_impact}` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
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
