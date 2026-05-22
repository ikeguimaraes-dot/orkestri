"use client";

import { GraduationCap } from "lucide-react";
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
  effectiveStatus,
  type TrainingRecordWithTemplate,
} from "@/lib/treinamentos/types";

export function TreinamentosTab({
  records,
}: {
  records: TrainingRecordWithTemplate[];
}) {
  if (records.length === 0) {
    return (
      <div
        style={{
          padding: "48px 20px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 99,
            background: "var(--brand-soft)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 8px",
          }}
        >
          <GraduationCap size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          Nenhum treinamento atribuído
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 0" }}>
          Atribua templates de treinamento em Pessoas → Treinamentos.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Treinamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Conclusão</TableHead>
            <TableHead>Validade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => {
            const eff = effectiveStatus(r);
            const meta = STATUS_COLOR[eff];
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {r.template?.nome ?? "—"}
                    </span>
                    {r.template?.obrigatorio && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 99,
                          background: "rgba(239,68,68,0.16)",
                          color: "#B91C1C",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        Obrig.
                      </span>
                    )}
                  </div>
                  {r.template?.descricao && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        marginTop: 2,
                        maxWidth: 360,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.template.descricao}
                    </div>
                  )}
                </TableCell>
                <TableCell>
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
                    {STATUS_LABEL[eff]}
                  </span>
                </TableCell>
                <TableCell
                  style={{
                    fontSize: 12,
                    color: "var(--text-2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.data_inicio ? formatDateBR(r.data_inicio) : "—"}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: 12,
                    color: "var(--text-2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.data_conclusao ? formatDateBR(r.data_conclusao) : "—"}
                </TableCell>
                <TableCell
                  style={{
                    fontSize: 12,
                    color: eff === "vencido" ? "#B91C1C" : "var(--text-2)",
                    fontWeight: eff === "vencido" ? 600 : 400,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.validade_ate
                    ? formatDateBR(r.validade_ate.slice(0, 10))
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
