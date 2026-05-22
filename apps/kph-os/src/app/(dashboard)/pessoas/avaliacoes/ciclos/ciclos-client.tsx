"use client";

import Link from "next/link";
import { RefreshCw, RotateCcw, CheckCircle2 } from "lucide-react";
import type { CicloComProgresso, CicloStatus } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { formatDateBR } from "@/lib/format";

const STATUS_LABEL: Record<CicloStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

const STATUS_COLOR: Record<CicloStatus, { fg: string; bg: string }> = {
  aberto: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  em_andamento: { fg: "#92400E", bg: "rgba(245,158,11,0.14)" },
  encerrado: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
};

export function CiclosClient({ ciclos }: { ciclos: CicloComProgresso[] }) {
  if (ciclos.length === 0) {
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
          <RefreshCw size={20} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          Nenhum ciclo criado
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 0" }}>
          Inicie um ciclo 360° para configurar rodadas de avaliação multi-rater.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ciclos.map((c) => {
        const pct = c.total > 0 ? Math.round((c.concluidos / c.total) * 100) : 0;
        const meta = STATUS_COLOR[c.status];
        return (
          <Link
            key={c.id}
            href={`/pessoas/avaliacoes/ciclos/${c.id}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                transition: "border-color var(--t)",
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 3,
                  }}
                >
                  {c.nome}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {c.template_nome ? `Template: ${c.template_nome} · ` : ""}
                  {formatDateBR(c.data_inicio)} → {formatDateBR(c.data_fim)}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <ProgressBar pct={pct} concluidos={c.concluidos} total={c.total} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 99,
                    background: meta.bg,
                    color: meta.fg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ProgressBar({
  pct,
  concluidos,
  total,
}: {
  pct: number;
  concluidos: number;
  total: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--surface-2)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct === 100 ? "#22C55E" : "var(--brand)",
            borderRadius: 99,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>
        {concluidos}/{total}
      </span>
    </div>
  );
}
