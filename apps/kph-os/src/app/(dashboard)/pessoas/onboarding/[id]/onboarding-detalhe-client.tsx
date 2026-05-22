"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Minus } from "lucide-react";
import { updateChecklistItem } from "../actions";
import type { RunWithDetails, RunStatus, ChecklistStatus, Responsavel } from "../actions";

// ── Constants ──────────────────────────────────────────────────────

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  em_andamento: "Em andamento",
  concluido:    "Concluído",
  cancelado:    "Cancelado",
};

const RUN_STATUS_COLOR: Record<RunStatus, { fg: string; bg: string }> = {
  em_andamento: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  concluido:    { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelado:    { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

const RESP_LABEL: Record<Responsavel, string> = {
  rh:           "RH",
  gestor:       "Gestor",
  colaborador:  "Colaborador",
  ti:           "TI",
};

const RESP_COLOR: Record<Responsavel, { fg: string; bg: string }> = {
  rh:          { fg: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  gestor:      { fg: "#1D4ED8", bg: "rgba(59,130,246,0.12)" },
  colaborador: { fg: "#047857", bg: "rgba(16,185,129,0.12)" },
  ti:          { fg: "#B45309", bg: "rgba(245,158,11,0.12)" },
};

// ── Helpers ────────────────────────────────────────────────────────

function addDias(dataInicio: string, dias: number): string {
  const d = new Date(dataInicio);
  d.setDate(d.getDate() + dias);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function isVencido(dataInicio: string, dias: number): boolean {
  const deadline = new Date(dataInicio);
  deadline.setDate(deadline.getDate() + dias);
  return new Date() > deadline;
}

// ── Types ──────────────────────────────────────────────────────────

type ItemState = {
  status: ChecklistStatus;
  saving: boolean;
  error: string | null;
};

// ── Component ──────────────────────────────────────────────────────

export function OnboardingDetalheClient({ run }: { run: RunWithDetails }) {
  const [mounted, setMounted] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>(run.status);
  const [, startTransition] = useTransition();

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      run.checklist.map((c) => [
        c.id,
        { status: c.status, saving: false, error: null },
      ]),
    ),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleItem(itemId: string) {
    if (!mounted) return;
    const current = itemStates[itemId]?.status ?? "pendente";
    const next: ChecklistStatus = current === "concluido" ? "pendente" : "concluido";

    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: next, saving: true, error: null },
    }));

    startTransition(async () => {
      const r = await updateChecklistItem(itemId, next, run.id);
      setItemStates((prev) => ({
        ...prev,
        [itemId]: {
          status: r.ok ? next : (prev[itemId]?.status ?? current),
          saving: false,
          error: r.ok ? null : r.error,
        },
      }));

      // If auto-completed, update run status
      if (r.ok) {
        const allDone = run.checklist.every((c) => {
          const s = c.id === itemId ? next : (itemStates[c.id]?.status ?? c.status);
          return s === "concluido" || s === "ignorado";
        });
        if (allDone) setRunStatus("concluido");
      }
    });
  }

  function ignoreItem(itemId: string) {
    if (!mounted) return;
    const current = itemStates[itemId]?.status ?? "pendente";
    const next: ChecklistStatus = current === "ignorado" ? "pendente" : "ignorado";

    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: next, saving: true, error: null },
    }));

    startTransition(async () => {
      const r = await updateChecklistItem(itemId, next, run.id);
      setItemStates((prev) => ({
        ...prev,
        [itemId]: {
          status: r.ok ? next : (prev[itemId]?.status ?? current),
          saving: false,
          error: r.ok ? null : r.error,
        },
      }));
    });
  }

  // Progress
  const total = run.checklist.length;
  const done  = run.checklist.filter(
    (c) => itemStates[c.id]?.status === "concluido" || itemStates[c.id]?.status === "ignorado",
  ).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const sc = RUN_STATUS_COLOR[runStatus];

  // Group by responsavel
  const RESP_ORDER: Responsavel[] = ["rh", "gestor", "colaborador", "ti"];
  const groups = RESP_ORDER.map((resp) => ({
    resp,
    items: run.checklist.filter((c) => c.tarefa?.responsavel === resp),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 99,
              background: sc.bg,
              color: sc.fg,
              alignSelf: "flex-start",
            }}
          >
            {RUN_STATUS_LABEL[runStatus]}
          </span>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>Template: </span>
            {run.template.nome}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Início em {run.data_inicio.split("-").reverse().join("/")} · {run.employee.funcao}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Progresso: {done}/{total} tarefas · {pct}%
          </div>
          <div
            style={{
              width: 220,
              height: 8,
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
        </div>
      </div>

      {/* Groups */}
      {groups.map(({ resp, items }) => {
        const rc = RESP_COLOR[resp];
        const groupDone = items.filter(
          (c) => itemStates[c.id]?.status === "concluido" || itemStates[c.id]?.status === "ignorado",
        ).length;

        return (
          <div
            key={resp}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Group header */}
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-2)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 99,
                  background: rc.bg,
                  color: rc.fg,
                }}
              >
                {RESP_LABEL[resp]}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {groupDone}/{items.length}
              </span>
            </div>

            {/* Tasks */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((item, i) => {
                const s      = itemStates[item.id] ?? { status: item.status, saving: false, error: null };
                const done   = s.status === "concluido";
                const ignored = s.status === "ignorado";
                const deadline = addDias(run.data_inicio, item.tarefa.prazo_dias);
                const vencido  = !done && !ignored && isVencido(run.data_inicio, item.tarefa.prazo_dias);

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "14px 20px",
                      borderTop: i > 0 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      opacity: ignored ? 0.5 : 1,
                      transition: "opacity var(--t)",
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      disabled={s.saving || !mounted || ignored}
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: done ? "none" : `2px solid ${vencido ? "#EF4444" : "var(--border)"}`,
                        background: done ? "#22C55E" : "transparent",
                        cursor: s.saving || ignored ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background var(--t), border var(--t)",
                        marginTop: 1,
                      }}
                    >
                      {s.saving ? (
                        <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-3)" }} />
                      ) : done ? (
                        <Check size={13} style={{ color: "#fff" }} />
                      ) : null}
                    </button>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text)",
                          textDecoration: done || ignored ? "line-through" : "none",
                          marginBottom: 2,
                        }}
                      >
                        {item.tarefa.titulo}
                      </div>
                      {item.tarefa.descricao && (
                        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
                          {item.tarefa.descricao}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 11,
                          color: vencido ? "#B91C1C" : "var(--text-3)",
                          fontWeight: vencido ? 600 : 400,
                        }}
                      >
                        Prazo: {deadline}
                        {vencido && " — vencido"}
                      </div>
                      {s.error && (
                        <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>
                          {s.error}
                        </div>
                      )}
                    </div>

                    {/* Ignore button */}
                    {!done && (
                      <button
                        type="button"
                        onClick={() => ignoreItem(item.id)}
                        disabled={s.saving || !mounted}
                        title={ignored ? "Restaurar tarefa" : "Ignorar tarefa"}
                        style={{
                          flexShrink: 0,
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "transparent",
                          cursor: s.saving ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-3)",
                        }}
                      >
                        <Minus size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {run.checklist.length === 0 && (
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
          Este onboarding não tem tarefas. O template pode estar vazio.
        </div>
      )}
    </div>
  );
}
