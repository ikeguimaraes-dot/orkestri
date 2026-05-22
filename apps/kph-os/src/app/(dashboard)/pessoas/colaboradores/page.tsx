import Link from "next/link";
import { Suspense } from "react";
import { Plus, UserPlus } from "lucide-react";

import { buttonVariants } from "@kph/ui/button";
import { EmployeeTable } from "@/components/pessoas/EmployeeTable";
import { listEmployees, listEmployeeScores } from "@/lib/pessoas/actions";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import type { EmployeeScore } from "@kph/db/types/pessoas";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
  await requireUser();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Pessoas · Colaboradores
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 0",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Equipe
          </h1>
        </div>
        <Link href="/pessoas/colaboradores/novo" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo colaborador
        </Link>
      </header>

      <Suspense fallback={<TableSkeleton />}>
        <EmployeeListSection />
      </Suspense>
    </div>
  );
}

async function EmployeeListSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return <NoUnitState />;
  }
  const [employees, scores] = await Promise.all([
    listEmployees(unit.id),
    listEmployeeScores(unit.id),
  ]);
  if (employees.length === 0) {
    return <EmptyState unitName={unit.name} />;
  }
  // Map empId → score (consumido pela tabela cliente)
  const scoreMap: Record<string, EmployeeScore> = {};
  for (const s of scores) scoreMap[s.employee.id] = s;
  return (
    <>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: "0 0 14px",
        }}
      >
        Equipe da{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{unit.name}</span> —
        {" "}{employees.length} {employees.length === 1 ? "colaborador" : "colaboradores"} no total.
      </p>
      <EmployeeTable data={employees} scores={scoreMap} />
    </>
  );
}

function NoUnitState() {
  return (
    <div
      style={{
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
        Escolhe uma unidade no seletor da sidebar pra ver a equipe.
      </p>
    </div>
  );
}

function EmptyState({ unitName }: { unitName: string }) {
  return (
    <div
      style={{
        padding: "56px 28px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <UserPlus size={20} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        Nenhum colaborador na {unitName} ainda
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 380, lineHeight: 1.55, margin: 0 }}>
        Cadastra o primeiro colaborador pra começar a montar escala, lançar ponto
        e gerar holerite. Leva menos de um minuto.
      </p>
      <Link href="/pessoas/colaboradores/novo" className={buttonVariants()}>
        <Plus className="mr-2 h-4 w-4" />
        Cadastrar primeiro colaborador
      </Link>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      style={{
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
          style={{
            height: 48,
            background: "var(--surface-2)",
            borderRadius: 6,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
