"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { updateManagerId, type EmployeeNode } from "../actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SaveState = { status: SaveStatus; error?: string };

function nomeCompleto(e: EmployeeNode) {
  return `${e.nome} ${e.sobrenome}`.trim();
}

export function ConfigurarClient({
  employees,
}: {
  employees: EmployeeNode[];
}) {
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  // Local manager map — tracks pending/saved state independently per employee
  const [managerMap, setManagerMap] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(employees.map((e) => [e.id, e.manager_id])),
  );
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>(() =>
    Object.fromEntries(employees.map((e) => [e.id, { status: "idle" }])),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleChange(employeeId: string, newManagerId: string | null) {
    if (!mounted) return;
    setManagerMap((prev) => ({ ...prev, [employeeId]: newManagerId }));
    setSaveStates((prev) => ({
      ...prev,
      [employeeId]: { status: "saving" },
    }));

    startTransition(async () => {
      const r = await updateManagerId(employeeId, newManagerId);
      setSaveStates((prev) => ({
        ...prev,
        [employeeId]: r.ok
          ? { status: "saved" }
          : { status: "error", error: r.error },
      }));

      if (!r.ok) {
        // Revert the local state on error
        setManagerMap((prev) => ({
          ...prev,
          [employeeId]: employees.find((e) => e.id === employeeId)?.manager_id ?? null,
        }));
      }

      // Auto-clear "saved" after 2 s
      if (r.ok) {
        setTimeout(() => {
          setSaveStates((prev) => {
            if (prev[employeeId]?.status === "saved") {
              return { ...prev, [employeeId]: { status: "idle" } };
            }
            return prev;
          });
        }, 2000);
      }
    });
  }

  const pendingCount = Object.values(saveStates).filter(
    (s) => s.status === "saving",
  ).length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/pessoas/organograma"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} />
        Organograma
      </Link>

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Organograma
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.3,
          }}
        >
          Configurar Hierarquia
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Defina o gestor direto de cada colaborador. Ciclos na hierarquia são bloqueados automaticamente.
        </p>
      </div>

      {pendingCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-3)",
            marginBottom: 16,
          }}
        >
          <Loader2 size={13} className="animate-spin" />
          Salvando {pendingCount} alteração{pendingCount !== 1 ? "ões" : ""}…
        </div>
      )}

      {employees.length === 0 ? (
        <div
          style={{
            padding: "32px 24px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhum colaborador ativo nesta unit.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {employees.map((emp) => {
            const state = saveStates[emp.id] ?? { status: "idle" };
            const currentManagerId = managerMap[emp.id] ?? null;
            const isSaving = state.status === "saving";

            return (
              <div
                key={emp.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  opacity: isSaving ? 0.75 : 1,
                  transition: "opacity var(--t)",
                }}
              >
                {/* Employee info */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      marginBottom: 2,
                    }}
                  >
                    {nomeCompleto(emp)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {emp.funcao}
                  </div>
                </div>

                {/* Reports-to select */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Reporta para
                  </span>
                  <select
                    value={currentManagerId ?? ""}
                    onChange={(e) =>
                      handleChange(emp.id, e.target.value || null)
                    }
                    disabled={!mounted || isSaving}
                    style={{
                      padding: "7px 10px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 7,
                      fontSize: 12,
                      color: "var(--text)",
                      cursor: !mounted || isSaving ? "not-allowed" : "pointer",
                      minWidth: 200,
                    }}
                  >
                    <option value="">— Sem gestor —</option>
                    {employees
                      .filter((e) => e.id !== emp.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {nomeCompleto(e)} — {e.funcao}
                        </option>
                      ))}
                  </select>

                  {/* Status indicator */}
                  <div style={{ width: 20, flexShrink: 0 }}>
                    {isSaving && (
                      <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-3)" }} />
                    )}
                    {state.status === "saved" && (
                      <Check size={16} style={{ color: "#22C55E" }} />
                    )}
                    {state.status === "error" && (
                      <TriangleAlert size={16} style={{ color: "#EF4444" }} />
                    )}
                  </div>
                </div>

                {/* Error message */}
                {state.status === "error" && state.error && (
                  <div
                    style={{
                      width: "100%",
                      fontSize: 11,
                      color: "#B91C1C",
                      padding: "6px 10px",
                      background: "rgba(239,68,68,0.08)",
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    {state.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--text-3)" }}>
        As alterações são salvas automaticamente. Ciclos (A → B → A) são bloqueados pelo sistema.
      </div>
    </div>
  );
}
