"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bus, Search, TrendingDown, Users } from "lucide-react";

import { Input } from "@kph/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import { formatBRL } from "@/lib/format";
import type { TransportVoucherWithEmployee } from "@kph/db/types/pessoas";

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function VtClient({
  unitName,
  records,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  records: TransportVoucherWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const [search, setSearch] = useState("");

  const totals = useMemo(
    () => ({
      beneficiarios: records.length,
      custoEmpresa: records.reduce(
        (acc, r) => acc + Number(r.valor_empresa),
        0,
      ),
      totalDescontos: records.reduce(
        (acc, r) => acc + Number(r.desconto_funcionario),
        0,
      ),
    }),
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = r.employee
        ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase()
        : "";
      return name.includes(q);
    });
  }, [records, search]);

  return (
    <div>
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <KpiCard
          icon={<Users size={18} />}
          label="Beneficiários"
          value={totals.beneficiarios}
        />
        <KpiCard
          icon={<Bus size={18} />}
          label="Custo total empresa"
          value={formatBRL(totals.custoEmpresa)}
        />
        <KpiCard
          icon={<TrendingDown size={18} />}
          label="Total de descontos"
          value={formatBRL(totals.totalDescontos)}
        />
      </div>

      {/* Filtros */}
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
            placeholder="Buscar por colaborador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} ·{" "}
          {filtered.length} colaborador
          {filtered.length !== 1 ? "es" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          Nenhum registro para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Dias Úteis</TableHead>
              <TableHead className="text-right">Valor/Dia</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Custo Empresa</TableHead>
              <TableHead>Operadora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const name = r.employee
                ? `${r.employee.nome} ${r.employee.sobrenome}`.trim()
                : "—";
              const periodoLabel = (() => {
                const d = new Date(`${r.periodo}T00:00:00`);
                if (Number.isNaN(d.getTime())) return r.periodo;
                return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
              })();
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? (
                      <Link
                        href={`/pessoas/colaboradores/${r.employee_id}`}
                        style={{
                          fontWeight: 600,
                          color: "var(--text)",
                          textDecoration: "none",
                        }}
                      >
                        {name}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    )}
                    {r.employee?.funcao && (
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {r.employee.funcao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-2)" }}>
                    {periodoLabel}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.dias_uteis}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatBRL(r.valor_diario)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatBRL(r.total_bruto)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: "#B91C1C",
                    }}
                  >
                    {Number(r.desconto_funcionario) > 0
                      ? `−${formatBRL(r.desconto_funcionario)}`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "var(--brand)",
                    }}
                  >
                    {formatBRL(r.valor_empresa)}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {r.operadora ?? "—"}
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

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
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
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
