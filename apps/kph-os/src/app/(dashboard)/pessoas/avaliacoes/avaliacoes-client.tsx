"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Search } from "lucide-react";

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
import { formatDateBR } from "@/lib/format";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  formatNota,
  type PerformanceReviewStatus,
  type PerformanceReviewWithEmployee,
} from "@/lib/avaliacoes/types";

type StatusFilter = PerformanceReviewStatus | "all";

export function AvaliacoesClient({
  reviews,
}: {
  reviews: PerformanceReviewWithEmployee[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [funcaoFilter, setFuncaoFilter] = useState<string>("all");
  const [periodoFilter, setPeriodoFilter] = useState<string>("all");

  // Opções dinâmicas pra filtros (vêm dos próprios dados)
  const funcaoOptions = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.employee?.funcao) set.add(r.employee.funcao);
    });
    return Array.from(set).sort();
  }, [reviews]);

  const periodoOptions = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => set.add(r.periodo));
    return Array.from(set).sort().reverse();
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (funcaoFilter !== "all" && r.employee?.funcao !== funcaoFilter)
        return false;
      if (periodoFilter !== "all" && r.periodo !== periodoFilter) return false;
      if (q) {
        const fullName = r.employee
          ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase()
          : "";
        const tplNome = (r.template_nome ?? "").toLowerCase();
        if (!fullName.includes(q) && !tplNome.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, search, statusFilter, funcaoFilter, periodoFilter]);

  return (
    <>
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
            placeholder="Buscar colaborador ou template…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={periodoFilter}
          onValueChange={(v) => v && setPeriodoFilter(v)}
        >
          <SelectTrigger style={{ minWidth: 150 }}>
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            {periodoOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={funcaoFilter}
          onValueChange={(v) => v && setFuncaoFilter(v)}
        >
          <SelectTrigger style={{ minWidth: 160 }}>
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            {funcaoOptions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger style={{ minWidth: 150 }}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="aprovada">Aprovada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reviews.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhuma avaliação com esses filtros.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Período</TableHead>
                <TableHead style={{ textAlign: "center" }}>Nota</TableHead>
                <TableHead style={{ textAlign: "center" }}>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const meta = STATUS_COLOR[r.status];
                const fullName = r.employee
                  ? `${r.employee.nome} ${r.employee.sobrenome}`.trim()
                  : "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.employee ? (
                        <Link
                          href={`/pessoas/colaboradores/${r.employee.id}`}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            textDecoration: "none",
                          }}
                        >
                          {fullName}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                          —
                        </span>
                      )}
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {r.employee?.funcao ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {r.template_nome ?? "—"}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.periodo}
                    </TableCell>
                    <TableCell
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--brand)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatNota(r.nota_geral)}
                    </TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: meta.bg,
                          color: meta.fg,
                        }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.data_avaliacao ? formatDateBR(r.data_avaliacao) : "—"}
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

function EmptyState() {
  return (
    <div
      style={{
        padding: "56px 20px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
        }}
      >
        <ClipboardCheck size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Nenhuma avaliação registrada
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 14px" }}>
        Crie templates em <strong>Templates</strong> e depois inicie avaliações
        a partir do perfil de cada colaborador.
      </p>
    </div>
  );
}
