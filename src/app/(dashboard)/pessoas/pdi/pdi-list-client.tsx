"use client";

import Link from "next/link";
import type { PdiWithMetas, PdiStatus } from "./actions";

const STATUS_LABEL: Record<PdiStatus, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<PdiStatus, { fg: string; bg: string }> = {
  ativo: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  concluido: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelado: { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

function progressoMedio(metas: PdiWithMetas["metas"]): number {
  if (metas.length === 0) return 0;
  return Math.round(metas.reduce((sum, m) => sum + m.progresso, 0) / metas.length);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function PdiListClient({
  pdis,
  hasEmployee,
}: {
  pdis: PdiWithMetas[];
  hasEmployee: boolean;
}) {
  if (!hasEmployee) return null;

  if (pdis.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Nenhum PDI criado ainda.{" "}
        <Link href="/pessoas/pdi/novo" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}>
          Criar o primeiro PDI
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pdis.map((pdi) => {
        const meta = STATUS_COLOR[pdi.status];
        const pct = progressoMedio(pdi.metas);
        const metasConcluidas = pdi.metas.filter((m) => m.status === "concluida").length;

        return (
          <Link
            key={pdi.id}
            href={`/pessoas/pdi/${pdi.id}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                cursor: "pointer",
                transition: "border-color var(--t)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    {pdi.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {formatDate(pdi.data_inicio)} → {formatDate(pdi.data_fim)}
                    {" · "}
                    {pdi.metas.length} {pdi.metas.length === 1 ? "meta" : "metas"}
                    {pdi.metas.length > 0 && ` · ${metasConcluidas} concluída${metasConcluidas !== 1 ? "s" : ""}`}
                  </div>
                </div>
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
                  {STATUS_LABEL[pdi.status]}
                </span>
              </div>

              {pdi.metas.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginBottom: 6,
                    }}
                  >
                    <span>Progresso geral</span>
                    <span style={{ fontWeight: 700, color: pct === 100 ? "#15803D" : "var(--text-2)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div
                    style={{
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
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {pdi.metas.slice(0, 4).map((m) => (
                      <div
                        key={m.id}
                        style={{
                          flex: 1,
                          minWidth: 120,
                          background: "var(--surface-2)",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-2)",
                            fontWeight: 500,
                            marginBottom: 6,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={m.descricao}
                        >
                          {m.descricao}
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "var(--border)",
                            borderRadius: 99,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${m.progresso}%`,
                              height: "100%",
                              background: m.status === "concluida" ? "#22C55E" : "var(--brand)",
                              borderRadius: 99,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>
                          {m.progresso}% · prazo {formatDate(m.prazo)}
                        </div>
                      </div>
                    ))}
                    {pdi.metas.length > 4 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          fontSize: 11,
                          color: "var(--text-3)",
                          paddingLeft: 4,
                        }}
                      >
                        +{pdi.metas.length - 4} mais
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
