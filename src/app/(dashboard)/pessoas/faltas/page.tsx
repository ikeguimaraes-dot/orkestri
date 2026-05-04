import { Suspense } from "react";
import { listAbsences, listEmployees } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { FaltasClient } from "./faltas-client";

export const dynamic = "force-dynamic";

export default async function FaltasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Faltas
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Faltas · Controle de ausências
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Registro consolidado por unit. Faltas injustificadas descontam score do colaborador automaticamente.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <FaltasSection />
      </Suspense>
    </div>
  );
}

async function FaltasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as faltas.
      </div>
    );
  }
  const now = new Date();
  const [absences, allEmployees] = await Promise.all([
    listAbsences(unit.id, now.getMonth() + 1, now.getFullYear()),
    listEmployees(unit.id),
  ]);
  const employees = allEmployees
    .filter((e) => e.ativo)
    .map((e) => ({ id: e.id, nome: e.nome, sobrenome: e.sobrenome, funcao: e.funcao, departamento: e.departamento }));

  return (
    <FaltasClient
      unitId={unit.id}
      unitName={unit.name}
      absences={absences}
      employees={employees}
      defaultMes={now.getMonth() + 1}
      defaultAno={now.getFullYear()}
    />
  );
}
