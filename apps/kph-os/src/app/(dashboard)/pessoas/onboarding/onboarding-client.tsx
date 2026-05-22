"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RunSummary, RunStatus, ChecklistStatus } from "./actions";

const STATUS_LABEL: Record<RunStatus, string> = {
  em_andamento: "Em andamento",
  concluido:    "Concluído",
  cancelado:    "Cancelado",
};

const STATUS_COLOR: Record<RunStatus, { fg: string; bg: string }> = {
  em_andamento: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  concluido:    { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelado:    { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

function calcProgresso(
  checklist: { id: string; status: ChecklistStatus }[],
): { done: number; total: number; pct: number } {
  const total = checklist.length;
  const done  = checklist.filter((c) => c.status === "concluido" || c.status === "ignorado").length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function diasDesdeInicio(dataInicio: string): number {
  const hoje = new Date();
  const inicio = new Date(dataInicio);
  return Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
}

export function OnboardingClient({
  runs,
  activeStatus,
}: {
  runs: RunSummary[];
  activeStatus?: RunStatus;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function setFilter(s: RunStatus | "") {
    if (!mounted) return;
    router.push(s ? `?status=${s}` : "?");
  }

  const statusOpts: { value: RunStatus | ""; label: string }[] = [
    { value: "",             label: "Todos" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "concluido",    label: "Concluídos" },
    { value: "cancelado",    label: "Cancelados" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {statusOpts.map((opt) => {
          const active = (activeStatus ?? "") === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value as RunStatus | "")}
              style={{
                padding: "6px 14px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid",
                borderColor: active ? "var(--brand)" : "var(--border)",
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#fff" : "var(--text-3)",
                cursor: "pointer",
                transition: "all var(--t)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center", marginLeft: 4 }}>
          {runs.length} resultado{runs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Cards */}
      {runs.length === 0 ? (
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
          Nenhum onboarding encontrado.{" "}
          <Link
            href="/pessoas/onboarding/novo"
            style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
          >
            Iniciar o primeiro
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {runs.map((run) => {
            const { done, total, pct } = calcProgresso(run.checklist);
            const dias = diasDesdeInicio(run.data_inicio);
            const sc = STATUS_COLOR[run.status];

            return (
              <Link
                key={run.id}
                href={`/pessoas/onboarding/${run.id}`}
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
                    cursor: "pointer",
                    transition: "border-color var(--t)",
                  }}
                >
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 9px",
                          borderRadius: 99,
                          background: sc.bg,
                          color: sc.fg,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {STATUS_LABEL[run.status]}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {run.employee.nome} {run.employee.sobrenome}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {run.template.nome}
                      {" · "}
                      <span style={{ color: dias > 30 && run.status === "em_andamento" ? "#B91C1C" : "var(--text-3)" }}>
                        {dias === 0 ? "hoje" : `há ${dias} dia${dias !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{ minWidth: 180, flexShrink: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--text-3)",
                        marginBottom: 5,
                      }}
                    >
                      <span>{done}/{total} tarefas</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: pct === 100 ? "#15803D" : "var(--text-2)",
                        }}
                      >
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
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      flexShrink: 0,
                    }}
                  >
                    {run.employee.funcao}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
