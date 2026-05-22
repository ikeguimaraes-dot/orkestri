import { Suspense } from "react";

import { DisciplinaTabs } from "@/components/pessoas/DisciplinaTabs";
import {
  listAbsences,
  listEmployeeScores,
  listEmployees,
  listWarnings,
} from "@/lib/pessoas/actions";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import type { EmployeeStub } from "@kph/db/types/pessoas";

export const dynamic = "force-dynamic";

export default async function DisciplinaPage() {
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
          Pessoas · Disciplina
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
          Score & Disciplina
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
          Advertências formais (verbal/escrita/suspensão), faltas tipadas e score
          gamificado. Cada evento ajusta o score do colaborador automaticamente —
          ferramenta CLT pra blindar a casa em rescisões.
        </p>
      </header>

      <Suspense fallback={<TabsSkeleton />}>
        <DisciplinaSection />
      </Suspense>
    </div>
  );
}

async function DisciplinaSection() {
  const unit = await getCurrentUnit();
  if (!unit) return <NoUnitState />;

  const [warnings, absences, scores, employees] = await Promise.all([
    listWarnings(unit.id),
    listAbsences(unit.id),
    listEmployeeScores(unit.id),
    listEmployees(unit.id),
  ]);

  // Stub leve pros selects dos modais (evita mandar todos os 30+ campos do Employee).
  const stubs: EmployeeStub[] = employees
    .filter((e) => e.ativo)
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      sobrenome: e.sobrenome,
      funcao: e.funcao,
      departamento: e.departamento,
    }));

  return (
    <DisciplinaTabs
      unitId={unit.id}
      unitName={unit.name}
      warnings={warnings}
      absences={absences}
      scores={scores}
      employees={stubs}
    />
  );
}

function NoUnitState() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Sem unidade selecionada
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0" }}>
        Escolhe uma unidade no seletor da sidebar.
      </p>
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{ height: 44, background: "var(--surface-2)", borderRadius: 6, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}
