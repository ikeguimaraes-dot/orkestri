"use client";

import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";

import { buttonVariants } from "@kph/ui/button";
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
  type PerformanceReviewWithTemplate,
} from "@/lib/avaliacoes/types";

export function AvaliacoesTab({
  employeeId,
  records,
}: {
  employeeId: string;
  records: PerformanceReviewWithTemplate[];
}) {
  const concluidas = records.filter(
    (r) => r.status !== "rascunho" && r.nota_geral != null,
  );

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
          <ClipboardCheck size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          Nenhuma avaliação registrada
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: "6px 0 14px",
          }}
        >
          Inicie a primeira avaliação de desempenho deste colaborador.
        </p>
        <Link
          href={`/pessoas/avaliacoes/novo/${employeeId}`}
          className={buttonVariants()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova avaliação
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {concluidas.length >= 1 && <EvolucaoChart reviews={concluidas} />}

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <strong style={{ fontSize: 13, color: "var(--text)" }}>
            Histórico ({records.length})
          </strong>
          <Link
            href={`/pessoas/avaliacoes/novo/${employeeId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Template</TableHead>
              <TableHead style={{ textAlign: "center" }}>Nota</TableHead>
              <TableHead style={{ textAlign: "center" }}>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => {
              const meta = STATUS_COLOR[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.periodo}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {r.template?.nome ?? "—"}
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
    </div>
  );
}

/**
 * Gráfico de barras inline SVG: nota_geral (0–5) por período.
 * Ordem cronológica ascendente (mais antigo à esquerda).
 */
function EvolucaoChart({
  reviews,
}: {
  reviews: PerformanceReviewWithTemplate[];
}) {
  // Ordena ascendente por data_avaliacao (fallback created_at)
  const sorted = [...reviews]
    .filter((r) => r.nota_geral != null)
    .sort((a, b) => {
      const da = a.data_avaliacao ?? a.created_at;
      const db = b.data_avaliacao ?? b.created_at;
      return da.localeCompare(db);
    });

  if (sorted.length === 0) return null;

  const W = 720;
  const H = 200;
  const PAD_T = 12;
  const PAD_B = 30;
  const PAD_L = 36;
  const PAD_R = 12;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const barGap = 8;
  const barW = Math.max(
    18,
    Math.min(60, (innerW - barGap * (sorted.length - 1)) / sorted.length),
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 13, color: "var(--text)" }}>
          Evolução da nota
        </strong>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          Escala 0 – 5 · {sorted.length} avaliação{sorted.length === 1 ? "" : "ões"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Grid horizontal a cada 1 ponto */}
        {[0, 1, 2, 3, 4, 5].map((g) => {
          const y = PAD_T + innerH - (g / 5) * innerH;
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={g === 0 ? "0" : "3 3"}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-3)"
              >
                {g}
              </text>
            </g>
          );
        })}

        {sorted.map((r, idx) => {
          const v = Number(r.nota_geral) || 0;
          const h = (v / 5) * innerH;
          const x = PAD_L + idx * (barW + barGap);
          const y = PAD_T + innerH - h;
          // Cor por faixa: <2 vermelho, 2-3.5 âmbar, >3.5 verde
          const fill = v < 2 ? "#EF4444" : v < 3.5 ? "#F59E0B" : "#22C55E";
          return (
            <g key={r.id}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                fill={fill}
                opacity={0.9}
              />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="var(--text)"
              >
                {v.toFixed(1).replace(".", ",")}
              </text>
              <text
                x={x + barW / 2}
                y={H - 12}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-3)"
              >
                {r.periodo}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
