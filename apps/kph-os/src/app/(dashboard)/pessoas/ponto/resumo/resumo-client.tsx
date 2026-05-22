"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Download, Search, Wallet } from "lucide-react";

import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import type { MonthlyEmployeeSummary, MonthlyResumo } from "../actions";

function fmtH(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1).replace(".", ",")}h`;
}
function fmtSaldo(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1).replace(".", ",")}h`;
}

export function ResumoMensalClient({
  periodo,
  periodoOptions,
  unitName,
  rows,
  totals,
}: {
  periodo: string;
  periodoOptions: string[];
  unitName: string;
  rows: MonthlyEmployeeSummary[];
  totals: MonthlyResumo["totals"];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.employee.nome} ${r.employee.sobrenome} ${r.employee.funcao}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  function changePeriodo(p: string | null) {
    if (!p || p === periodo) return;
    router.push(`/pessoas/ponto/resumo?periodo=${encodeURIComponent(p)}`);
  }

  function exportCsv() {
    const head = [
      "Colaborador",
      "Função",
      "Fonte",
      "Dias trabalhados",
      "Horas previstas",
      "Horas realizadas",
      "Saldo banco",
      "Banco acumulado",
      "Faltas",
      "HE aprovadas",
      "Adicional noturno",
    ];
    const csvRows = filtered.map((r) => {
      const cells = [
        `${r.employee.nome} ${r.employee.sobrenome}`.trim(),
        r.employee.funcao,
        r.fonte,
        r.dias_trabalhados ?? "",
        r.horas_previstas ?? "",
        r.horas_realizadas ?? "",
        r.saldo_banco ?? "",
        r.banco_horas_acumulado ?? "",
        r.faltas ?? "",
        r.he_aprovadas_horas,
        r.adicional_noturno ?? "",
      ];
      return cells
        .map((c) => {
          const s = String(c).replace(/"/g, '""');
          return /[",;\n]/.test(s) ? `"${s}"` : s;
        })
        .join(";");
    });
    const csv = "﻿" + [head.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ponto-${periodo}-${unitName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Cards de totais */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          icon={<Calendar size={16} />}
          label="Horas previstas"
          value={fmtH(totals.horas_previstas)}
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Horas realizadas"
          value={fmtH(totals.horas_realizadas)}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="Saldo banco do mês"
          value={fmtSaldo(totals.saldo_banco)}
          tone={totals.saldo_banco >= 0 ? "ok" : "danger"}
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="HE aprovadas"
          value={fmtH(totals.he_aprovadas)}
        />
      </div>

      {/* Filtros + ações */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar colaborador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select value={periodo} onValueChange={changePeriodo}>
          <SelectTrigger style={{ minWidth: 130 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodoOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {unitName} · {filtered.length} colaborador
          {filtered.length === 1 ? "" : "es"}
        </span>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <div
          style={{
            padding: "48px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Sem dados de ponto pra {periodo}.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            overflow: "auto",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead style={{ textAlign: "right" }}>Dias</TableHead>
                <TableHead style={{ textAlign: "right" }}>Previstas</TableHead>
                <TableHead style={{ textAlign: "right" }}>Realizadas</TableHead>
                <TableHead style={{ textAlign: "right" }}>Saldo</TableHead>
                <TableHead style={{ textAlign: "right" }}>Faltas</TableHead>
                <TableHead style={{ textAlign: "right" }}>HE</TableHead>
                <TableHead style={{ textAlign: "right" }}>Ad. noturno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const fullName = `${r.employee.nome} ${r.employee.sobrenome}`.trim();
                const saldoColor =
                  r.saldo_banco == null
                    ? "var(--text-2)"
                    : r.saldo_banco > 0
                      ? "#15803D"
                      : r.saldo_banco < 0
                        ? "#B91C1C"
                        : "var(--text-2)";
                return (
                  <TableRow key={r.employee.id}>
                    <TableCell>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                          }}
                        >
                          {fullName}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 99,
                            background: r.fonte === "totvs"
                              ? "rgba(59,130,246,0.16)"
                              : "rgba(168,85,247,0.16)",
                            color: r.fonte === "totvs" ? "#1D4ED8" : "#7E22CE",
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          {r.fonte === "totvs" ? "TOTVS" : "Punches"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {r.employee.funcao}
                      </div>
                    </TableCell>
                    <TableCell style={cellNum}>
                      {r.dias_trabalhados ?? "—"}
                    </TableCell>
                    <TableCell style={cellNum}>
                      {fmtH(r.horas_previstas)}
                    </TableCell>
                    <TableCell style={cellNum}>
                      {fmtH(r.horas_realizadas)}
                    </TableCell>
                    <TableCell
                      style={{ ...cellNum, color: saldoColor, fontWeight: 600 }}
                    >
                      {fmtSaldo(r.saldo_banco)}
                    </TableCell>
                    <TableCell style={cellNum}>{r.faltas ?? "—"}</TableCell>
                    <TableCell
                      style={{
                        ...cellNum,
                        color: r.he_aprovadas_horas > 0 ? "#A16207" : "var(--text-2)",
                      }}
                    >
                      {r.he_aprovadas_horas > 0
                        ? fmtH(r.he_aprovadas_horas)
                        : "—"}
                    </TableCell>
                    <TableCell style={cellNum}>
                      {fmtH(r.adicional_noturno)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

const cellNum: React.CSSProperties = {
  textAlign: "right",
  fontSize: 12,
  color: "var(--text-2)",
  fontVariantNumeric: "tabular-nums",
};

function KpiCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "danger";
}) {
  const fg =
    tone === "ok" ? "#15803D" : tone === "danger" ? "#B91C1C" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>{label}</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: fg,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
            marginTop: 2,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
