"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReuniaoWithDetails, ReuniaoStatus, EmployeeStub, ReuniaoFilters } from "./actions";

const STATUS_LABEL: Record<ReuniaoStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<ReuniaoStatus, { fg: string; bg: string }> = {
  agendada:  { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  realizada: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  cancelada: { fg: "#9CA3AF", bg: "var(--surface-2)" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nomeCompleto(e: EmployeeStub): string {
  return `${e.nome} ${e.sobrenome}`.trim();
}

export function ReunioesClient({
  reunioes,
  employees,
  activeFilters,
}: {
  reunioes: ReuniaoWithDetails[];
  employees: EmployeeStub[];
  activeFilters: ReuniaoFilters;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [filters, setFilters] = useState<ReuniaoFilters>({
    status: activeFilters.status ?? "",
    gestor_id: activeFilters.gestor_id ?? "",
    colaborador_id: activeFilters.colaborador_id ?? "",
    periodo_inicio: activeFilters.periodo_inicio ?? "",
    periodo_fim: activeFilters.periodo_fim ?? "",
  });

  const applyFilters = useCallback(
    (next: ReuniaoFilters) => {
      const params = new URLSearchParams();
      if (next.status) params.set("status", next.status);
      if (next.gestor_id) params.set("gestor_id", next.gestor_id);
      if (next.colaborador_id) params.set("colaborador_id", next.colaborador_id);
      if (next.periodo_inicio) params.set("periodo_inicio", next.periodo_inicio);
      if (next.periodo_fim) params.set("periodo_fim", next.periodo_fim);
      router.push(`?${params.toString()}`);
    },
    [router],
  );

  function setFilter(key: keyof ReuniaoFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (mounted) applyFilters(next);
  }

  function clearFilters() {
    const empty: ReuniaoFilters = {
      status: "",
      gestor_id: "",
      colaborador_id: "",
      periodo_inicio: "",
      periodo_fim: "",
    };
    setFilters(empty);
    router.push("?");
  }

  const hasActiveFilters =
    !!filters.status ||
    !!filters.gestor_id ||
    !!filters.colaborador_id ||
    !!filters.periodo_inicio ||
    !!filters.periodo_fim;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtros */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
          <span style={labelStyle}>Status</span>
          <select
            value={filters.status ?? ""}
            onChange={(e) => setFilter("status", e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos</option>
            <option value="agendada">Agendada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <span style={labelStyle}>Gestor</span>
          <select
            value={filters.gestor_id ?? ""}
            onChange={(e) => setFilter("gestor_id", e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {nomeCompleto(e)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <span style={labelStyle}>Colaborador</span>
          <select
            value={filters.colaborador_id ?? ""}
            onChange={(e) => setFilter("colaborador_id", e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {nomeCompleto(e)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>De</span>
          <input
            type="date"
            value={filters.periodo_inicio ?? ""}
            onChange={(e) => setFilter("periodo_inicio", e.target.value)}
            style={selectStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Até</span>
          <input
            type="date"
            value={filters.periodo_fim ?? ""}
            onChange={(e) => setFilter("periodo_fim", e.target.value)}
            style={selectStyle}
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 7,
              padding: "7px 12px",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Contador */}
      {reunioes.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {reunioes.length} reunião{reunioes.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " encontrada" : ""}
          {reunioes.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Lista */}
      {reunioes.length === 0 ? (
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
          {hasActiveFilters
            ? "Nenhuma reunião encontrada com esses filtros."
            : "Nenhuma reunião agendada ainda. "}
          {!hasActiveFilters && (
            <Link
              href="/pessoas/reunioes/nova"
              style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
            >
              Agendar a primeira reunião
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reunioes.map((r) => {
            const sc = STATUS_COLOR[r.status];
            const pendentes = r.action_items.filter((ai) => ai.status === "pendente").length;

            return (
              <Link
                key={r.id}
                href={`/pessoas/reunioes/${r.id}`}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                        {STATUS_LABEL[r.status]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        {nomeCompleto(r.gestor)}
                        <span style={{ fontWeight: 400, color: "var(--text-3)", margin: "0 6px" }}>↔</span>
                        {nomeCompleto(r.colaborador)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>{formatDateTime(r.data_reuniao)}</span>
                      <span>{r.duracao_min} min</span>
                      {r.action_items.length > 0 && (
                        <span
                          style={{
                            color: pendentes > 0 ? "#92400E" : "var(--text-3)",
                            fontWeight: pendentes > 0 ? 600 : 400,
                          }}
                        >
                          {pendentes > 0
                            ? `${pendentes} action item${pendentes !== 1 ? "s" : ""} pendente${pendentes !== 1 ? "s" : ""}`
                            : `${r.action_items.length} action item${r.action_items.length !== 1 ? "s" : ""} concluído${r.action_items.length !== 1 ? "s" : ""}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {r.gestor.funcao}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                      {r.colaborador.funcao}
                    </span>
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

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const selectStyle: React.CSSProperties = {
  padding: "7px 10px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  fontSize: 12,
  color: "var(--text)",
  cursor: "pointer",
};
