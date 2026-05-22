"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateMetaProgresso } from "../actions";
import type { PdiWithMetas, PdiStatus, MetaStatus } from "../actions";

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

const META_STATUS_OPTS: { value: MetaStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

const META_STATUS_COLOR: Record<MetaStatus, { fg: string; bg: string }> = {
  pendente: { fg: "var(--text-3)", bg: "var(--surface-2)" },
  em_andamento: { fg: "#92400E", bg: "rgba(245,158,11,0.14)" },
  concluida: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelada: { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function progressoMedio(metas: PdiWithMetas["metas"]): number {
  if (metas.length === 0) return 0;
  return Math.round(metas.reduce((sum, m) => sum + m.progresso, 0) / metas.length);
}

type MetaState = { progresso: number; status: MetaStatus; dirty: boolean; saving: boolean; error: string | null };

export function PdiDetalheClient({ pdi }: { pdi: PdiWithMetas }) {
  const pdiColor = STATUS_COLOR[pdi.status];
  const [metaStates, setMetaStates] = useState<Record<string, MetaState>>(() =>
    Object.fromEntries(
      pdi.metas.map((m) => [
        m.id,
        { progresso: m.progresso, status: m.status, dirty: false, saving: false, error: null },
      ]),
    ),
  );

  const [, startTransition] = useTransition();

  function setField<K extends keyof MetaState>(id: string, field: K, val: MetaState[K]) {
    setMetaStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: val, dirty: true } as MetaState,
    }));
  }

  function saveMeta(metaId: string) {
    const s = metaStates[metaId];
    if (!s || !s.dirty) return;
    setMetaStates((prev) => ({
      ...prev,
      [metaId]: { ...prev[metaId], saving: true, error: null } as MetaState,
    }));
    startTransition(async () => {
      const r = await updateMetaProgresso(metaId, s.progresso, s.status, pdi.id);
      setMetaStates((prev) => ({
        ...prev,
        [metaId]: {
          ...prev[metaId],
          saving: false,
          dirty: r.ok ? false : (prev[metaId]?.dirty ?? false),
          error: r.ok ? null : r.error,
        } as MetaState,
      }));
    });
  }

  const allProgresso = pdi.metas.map((m) => metaStates[m.id]?.progresso ?? m.progresso);
  const mediaProgresso =
    allProgresso.length > 0
      ? Math.round(allProgresso.reduce((a, b) => a + b, 0) / allProgresso.length)
      : progressoMedio(pdi.metas);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabeçalho do PDI */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>
            {formatDate(pdi.data_inicio)} → {formatDate(pdi.data_fim)}
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 99,
              background: pdiColor.bg,
              color: pdiColor.fg,
            }}
          >
            {STATUS_LABEL[pdi.status]}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Progresso geral: {mediaProgresso}%
          </div>
          <div
            style={{
              width: 200,
              height: 8,
              background: "var(--surface-2)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${mediaProgresso}%`,
                height: "100%",
                background: mediaProgresso === 100 ? "#22C55E" : "var(--brand)",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            {pdi.metas.filter((m) => (metaStates[m.id]?.status ?? m.status) === "concluida").length}/
            {pdi.metas.length} metas concluídas
          </div>
        </div>
      </div>

      {/* Metas */}
      {pdi.metas.length === 0 ? (
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
          Este PDI não tem metas cadastradas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pdi.metas.map((meta, idx) => {
            const s = metaStates[meta.id] ?? {
              progresso: meta.progresso,
              status: meta.status,
              dirty: false,
              saving: false,
              error: null,
            };
            const mColor = META_STATUS_COLOR[s.status];

            return (
              <div
                key={meta.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-3)",
                          background: "var(--surface-2)",
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: mColor.bg,
                          color: mColor.fg,
                        }}
                      >
                        {META_STATUS_OPTS.find((o) => o.value === s.status)?.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                      {meta.descricao}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      Prazo: {formatDate(meta.prazo)}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.progresso === 100 ? "#15803D" : "var(--brand)" }}>
                    {s.progresso}%
                  </div>
                </div>

                {/* Barra de progresso */}
                <div
                  style={{
                    height: 8,
                    background: "var(--surface-2)",
                    borderRadius: 99,
                    overflow: "hidden",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: `${s.progresso}%`,
                      height: "100%",
                      background: s.progresso === 100 ? "#22C55E" : "var(--brand)",
                      borderRadius: 99,
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>

                {/* Controles de edição */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <label style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Progresso
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={s.progresso}
                        onChange={(e) => setField(meta.id, "progresso", Number(e.target.value))}
                        style={{ flex: 1, accentColor: "var(--brand)" }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", minWidth: 32 }}>
                        {s.progresso}%
                      </span>
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Status
                    </span>
                    <select
                      value={s.status}
                      onChange={(e) => setField(meta.id, "status", e.target.value as MetaStatus)}
                      style={{
                        padding: "7px 10px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      {META_STATUS_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => saveMeta(meta.id)}
                    disabled={!s.dirty || s.saving}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      background: s.dirty && !s.saving ? "var(--brand)" : "var(--surface-2)",
                      color: s.dirty && !s.saving ? "#fff" : "var(--text-3)",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: s.dirty && !s.saving ? "pointer" : "default",
                      transition: "background var(--t)",
                    }}
                  >
                    {s.saving && <Loader2 size={12} className="animate-spin" />}
                    Salvar
                  </button>
                </div>

                {s.error && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#B91C1C",
                      padding: "6px 10px",
                      background: "rgba(239,68,68,0.08)",
                      borderRadius: 6,
                    }}
                  >
                    {s.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
