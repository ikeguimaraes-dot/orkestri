import { Suspense } from "react";
import Link from "next/link";

import { listEmployees, listVacations } from "@/lib/pessoas/actions";
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

  const [vacations, employees] = await Promise.all([
    listVacations(unit.id, "unit"),
    listEmployees(unit.id),
  ]);

  // Mapa pra resolver employee na linha (RLS já filtrou).
  const empById = new Map(employees.map((e) => [e.id, e]));

  return (
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
  );
}
