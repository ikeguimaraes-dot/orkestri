import { Suspense } from "react";
import { addDays, format, parse, startOfWeek } from "date-fns";

import { EscalaGrid } from "@/components/pessoas/EscalaGrid";
import { listEmployees, listShifts } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ inicio?: string }>;

export default async function EscalaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const { inicio } = await searchParams;

  const referenceDate = parseInicio(inicio) ?? new Date();
  // weekStartsOn: 0 = Domingo (header da grade vai Dom→Sáb).
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);

  const isoStart = format(weekStart, "yyyy-MM-dd");
  const isoEnd = format(weekEnd, "yyyy-MM-dd");

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto" }}>
      <header style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Escala
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
          Escala semanal
        </h1>
      </header>

      <Suspense fallback={<GridSkeleton />}>
        <EscalaSection
          weekStartIso={isoStart}
          weekEndIso={isoEnd}
        />
      </Suspense>
    </div>
  );
}

async function EscalaSection({
  weekStartIso,
  weekEndIso,
}: {
  weekStartIso: string;
  weekEndIso: string;
}) {
  const unit = await getCurrentUnit();
  if (!unit) {
    return <NoUnitState />;
  }

  const [employees, shifts] = await Promise.all([
    listEmployees(unit.id),
    listShifts(unit.id, weekStartIso, weekEndIso),
  ]);

  const ativos = employees.filter((e) => e.ativo);

  if (ativos.length === 0) {
    return <NoEmployeesState unitName={unit.name} />;
  }

  return (
    <EscalaGrid
      key={weekStartIso}
      unitId={unit.id}
      unitName={unit.name}
      employees={ativos}
      shifts={shifts}
      weekStartIso={weekStartIso}
    />
  );
}

function parseInicio(value: string | undefined): Date | null {
  if (!value) return null;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? null : d;
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
        Escolhe uma unidade no seletor da sidebar pra montar a escala.
      </p>
    </div>
  );
}

function NoEmployeesState({ unitName }: { unitName: string }) {
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
        Nenhum colaborador ativo na {unitName}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0", lineHeight: 1.55 }}>
        Cadastre colaboradores em{" "}
        <span style={{ color: "var(--brand)", fontWeight: 600 }}>Pessoas → Colaboradores</span>{" "}
        antes de montar a escala.
      </p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            background: "var(--surface-2)",
            borderRadius: 6,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

