import { Suspense } from "react";
import Link from "next/link";

import { listEmployees, listVacations, getVacationAlerts } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { FeriasConsolidadoClient } from "./ferias-client";

export const dynamic = "force-dynamic";

export default async function FeriasPage() {
  await requireUser();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Férias
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          Férias da unit
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Visão consolidada de todos os períodos de férias da unit selecionada.
          Para agendar/editar, vá no perfil do colaborador →{" "}
          <strong style={{ color: "var(--text-2)" }}>aba Férias</strong>.
        </p>
      </header>

      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <FeriasSection />
      </Suspense>
    </div>
  );
}

async function FeriasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          padding: "32px 22px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Selecione uma unit no topo para ver as férias.
      </div>
    );
  }

  const [vacations, employees, alerts] = await Promise.all([
    listVacations(unit.id, "unit"),
    listEmployees(unit.id),
    getVacationAlerts(unit.id),
  ]);

  // Mapa pra resolver employee na linha (RLS já filtrou).
  const empById = new Map(employees.map((e) => [e.id, e]));

  const { vencidas, vencendo30 } = alerts;

  return (
    <>
      {/* Banners de alerta */}
      {vencidas.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#B91C1C" }}>
              {vencidas.length} colaborador{vencidas.length > 1 ? "es" : ""} com férias vencidas — risco trabalhista
            </div>
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {vencidas.map((e) => (
                <Link key={e.id} href={`/pessoas/colaboradores/${e.id}`} style={{ color: "#B91C1C", fontWeight: 600, textDecoration: "underline" }}>
                  {e.nome}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {vencendo30.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.40)", borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#A16207" }}>
              {vencendo30.length} colaborador{vencendo30.length > 1 ? "es" : ""} com férias vencendo em 30 dias
            </div>
            <div style={{ fontSize: 12, color: "#A16207", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {vencendo30.map((e) => (
                <Link key={e.id} href={`/pessoas/colaboradores/${e.id}`} style={{ color: "#A16207", fontWeight: 600, textDecoration: "underline" }}>
                  {e.nome} ({e.diasRestantes}d)
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <FeriasConsolidadoClient
        unitName={unit.name}
        vacations={vacations.map((v) => {
          const emp = empById.get(v.employee_id);
          return {
            ...v,
            _employee_name: emp ? `${emp.nome} ${emp.sobrenome}`.trim() : "—",
            _employee_funcao: emp?.funcao ?? "",
          };
        })}
      />
    </>
  );
}
