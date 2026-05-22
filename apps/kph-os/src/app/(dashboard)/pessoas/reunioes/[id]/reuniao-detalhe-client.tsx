"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { updateReuniao, updateActionItem } from "../actions";
import type { ReuniaoWithDetails, ReuniaoStatus, ActionItemStatus } from "../actions";

const STATUS_LABEL: Record<ReuniaoStatus, string> = {
  agendada:  "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<ReuniaoStatus, { fg: string; bg: string }> = {
  agendada:  { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  realizada: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelada: { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

const AI_STATUS_COLOR: Record<ActionItemStatus, { fg: string; bg: string }> = {
  pendente:  { fg: "#92400E", bg: "rgba(245,158,11,0.12)" },
  concluido: { fg: "#15803D", bg: "rgba(34,197,94,0.12)" },
  cancelado: { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type ItemState = { status: ActionItemStatus; saving: boolean; error: string | null };

export function ReuniaoDetalheClient({
  reuniao,
}: {
  reuniao: ReuniaoWithDetails;
}) {
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  const [status, setStatus] = useState<ReuniaoStatus>(reuniao.status);
  const [markingRealizada, setMarkingRealizada] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [notasDraft, setNotasDraft] = useState(reuniao.notas ?? "");
  const [editingNotas, setEditingNotas] = useState(false);
  const [savingNotas, setSavingNotas] = useState(false);
  const [notasError, setNotasError] = useState<string | null>(null);

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      reuniao.action_items.map((ai) => [
        ai.id,
        { status: ai.status, saving: false, error: null },
      ]),
    ),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleMarcarRealizada() {
    if (!mounted) return;
    setMarkingRealizada(true);
    setStatusError(null);
    startTransition(async () => {
      const r = await updateReuniao(reuniao.id, { status: "realizada" });
      setMarkingRealizada(false);
      if (r.ok) {
        setStatus("realizada");
      } else {
        setStatusError(r.error);
      }
    });
  }

  function handleSaveNotas() {
    if (!mounted) return;
    setSavingNotas(true);
    setNotasError(null);
    startTransition(async () => {
      const r = await updateReuniao(reuniao.id, { notas: notasDraft });
      setSavingNotas(false);
      if (r.ok) {
        setEditingNotas(false);
      } else {
        setNotasError(r.error);
      }
    });
  }

  function toggleItem(itemId: string) {
    if (!mounted) return;
    const current = itemStates[itemId]?.status ?? "pendente";
    const next: ActionItemStatus = current === "concluido" ? "pendente" : "concluido";

    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: next, saving: true, error: null },
    }));

    startTransition(async () => {
      const r = await updateActionItem(itemId, next, reuniao.id);
      setItemStates((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          status: r.ok ? next : (prev[itemId]?.status ?? current),
          saving: false,
          error: r.ok ? null : r.error,
        },
      }));
    });
  }

  const sc = STATUS_COLOR[status];
  const pendentesCount = reuniao.action_items.filter(
    (ai) => (itemStates[ai.id]?.status ?? ai.status) === "pendente",
  ).length;

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
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            {STATUS_LABEL[status]}
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>Gestor:</span>{" "}
              {reuniao.gestor.nome} {reuniao.gestor.sobrenome}
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>
                {reuniao.gestor.funcao}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>Colaborador:</span>{" "}
              {reuniao.colaborador.nome} {reuniao.colaborador.sobrenome}
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>
                {reuniao.colaborador.funcao}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              {formatDateTime(reuniao.data_reuniao)} · {reuniao.duracao_min} min
            </div>
          </div>
        </div>

        {status === "agendada" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button
              type="button"
              onClick={handleMarcarRealizada}
              disabled={markingRealizada || !mounted}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: markingRealizada ? "wait" : "pointer",
                opacity: markingRealizada ? 0.7 : 1,
                transition: "opacity var(--t)",
              }}
            >
              {markingRealizada ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Marcar como realizada
            </button>
            {statusError && (
              <span style={{ fontSize: 12, color: "#B91C1C" }}>{statusError}</span>
            )}
          </div>
        )}
      </div>

      {/* Notas */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Notas & Pauta
          </span>
          {!editingNotas && (
            <button
              type="button"
              onClick={() => setEditingNotas(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "var(--text-3)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              <Pencil size={12} />
              Editar
            </button>
          )}
        </div>

        {editingNotas ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={notasDraft}
              onChange={(e) => setNotasDraft(e.target.value)}
              rows={6}
              placeholder="Anotações, pautas, decisões da reunião…"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            {notasError && (
              <span style={{ fontSize: 12, color: "#B91C1C" }}>{notasError}</span>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleSaveNotas}
                disabled={savingNotas}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  background: "var(--brand)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: savingNotas ? "wait" : "pointer",
                  opacity: savingNotas ? 0.7 : 1,
                }}
              >
                {savingNotas && <Loader2 size={12} className="animate-spin" />}
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotasDraft(reuniao.notas ?? "");
                  setEditingNotas(false);
                  setNotasError(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "7px 12px",
                  background: "transparent",
                  color: "var(--text-3)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <X size={12} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: notasDraft ? "var(--text-2)" : "var(--text-3)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              minHeight: 40,
            }}
          >
            {notasDraft || "Sem notas. Clique em Editar para adicionar."}
          </div>
        )}
      </div>

      {/* Action Items */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Action Items
          </span>
          {reuniao.action_items.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: pendentesCount > 0 ? "#92400E" : "#15803D",
                fontWeight: 600,
              }}
            >
              {pendentesCount} pendente{pendentesCount !== 1 ? "s" : ""} /{" "}
              {reuniao.action_items.length} total
            </span>
          )}
        </div>

        {reuniao.action_items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            Nenhum action item registrado.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reuniao.action_items.map((ai) => {
              const s = itemStates[ai.id] ?? {
                status: ai.status,
                saving: false,
                error: null,
              };
              const sc = AI_STATUS_COLOR[s.status];
              const done = s.status === "concluido";

              return (
                <div
                  key={ai.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--surface-2)",
                    borderRadius: 10,
                    opacity: s.status === "cancelado" ? 0.5 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(ai.id)}
                    disabled={s.saving || !mounted || s.status === "cancelado"}
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: done ? "none" : "2px solid var(--border)",
                      background: done ? "#22C55E" : "transparent",
                      cursor: s.saving || s.status === "cancelado" ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background var(--t), border var(--t)",
                      marginTop: 2,
                    }}
                    title={done ? "Marcar como pendente" : "Marcar como concluído"}
                  >
                    {s.saving ? (
                      <Loader2 size={11} className="animate-spin" style={{ color: "var(--text-3)" }} />
                    ) : done ? (
                      <Check size={12} style={{ color: "#fff" }} />
                    ) : null}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        fontWeight: 500,
                        textDecoration: done ? "line-through" : "none",
                        marginBottom: 4,
                      }}
                    >
                      {ai.descricao}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        fontSize: 11,
                        color: "var(--text-3)",
                        flexWrap: "wrap",
                      }}
                    >
                      {ai.responsavel_id && (
                        <span>
                          Responsável: {
                            /* responsavel_id is stored; we show from action_items */
                            ai.responsavel_id.slice(0, 8) + "…"
                          }
                        </span>
                      )}
                      {ai.prazo && <span>Prazo: {formatDate(ai.prazo)}</span>}
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 99,
                          background: sc.bg,
                          color: sc.fg,
                          fontWeight: 600,
                        }}
                      >
                        {s.status === "pendente"
                          ? "Pendente"
                          : s.status === "concluido"
                          ? "Concluído"
                          : "Cancelado"}
                      </span>
                    </div>
                    {s.error && (
                      <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>
                        {s.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
