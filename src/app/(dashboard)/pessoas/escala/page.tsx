import { Suspense } from "react";
import { addDays, endOfMonth, format, parse, startOfMonth, startOfWeek } from "date-fns";

import { EscalaGrid } from "@/components/pessoas/EscalaGrid";
import { EscalaMonthView } from "@/components/pessoas/EscalaMonthView";
import { listEmployees, listShifts } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ inicio?: string; view?: string; mes?: string }>;

export default async function EscalaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const { inicio, view, mes } = await searchParams;

  const activeView: "semana" | "mes" = view === "mes" ? "mes" : "semana";

  const referenceDate = parseInicio(inicio) ?? new Date();
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);

  const isoWeekStart = format(weekStart, "yyyy-MM-dd");
  const isoWeekEnd = format(weekEnd, "yyyy-MM-dd");

  const monthIso = parseMonth(mes) ?? format(new Date(), "yyyy-MM");

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
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 6,
          }}
        >
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            {activeView === "mes" ? "Escala mensal" : "Escala semanal"}
          </h1>
          <ViewToggle active={activeView} weekStartIso={isoWeekStart} monthIso={monthIso} />
        </div>
      </header>

      <Suspense fallback={<GridSkeleton />}>
        {activeView === "semana" ? (
          <EscalaSection weekStartIso={isoWeekStart} weekEndIso={isoWeekEnd} />
        ) : (
          <EscalaMesSection monthIso={monthIso} />
        )}
      </Suspense>
    </div>
  );
}

function ViewToggle({
  active,
  weekStartIso,
  monthIso,
}: {
  active: "semana" | "mes";
  weekStartIso: string;
  monthIso: string;
}) {
  const base: React.CSSProperties = {
    padding: "5px 14px",
    border: "1px solid var(--border)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background var(--t), color var(--t)",
    textDecoration: "none",
    display: "inline-block",
  };
  const activeStyle: React.CSSProperties = {
    background: "var(--brand)",
    color: "#fff",
    borderColor: "var(--brand)",
  };
  const inactiveStyle: React.CSSProperties = {
    background: "transparent",
    color: "var(--text-2)",
  };

  return (
    <div
      style={{
        display: "flex",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <a
        href={`/pessoas/escala?view=semana&inicio=${weekStartIso}`}
        style={{
          ...base,
          ...(active === "semana" ? activeStyle : inactiveStyle),
          borderRadius: "7px 0 0 7px",
          borderRight: "none",
        }}
      >
        Semana
      </a>
      <a
        href={`/pessoas/escala?view=mes&mes=${monthIso}`}
        style={{
          ...base,
          ...(active === "mes" ? activeStyle : inactiveStyle),
          borderRadius: "0 7px 7px 0",
        }}
      >
        Mês
      </a>
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
  if (!unit) return <NoUnitState />;

  const [employees, shifts] = await Promise.all([
    listEmployees(unit.id),
    listShifts(unit.id, weekStartIso, weekEndIso),
  ]);

  const ativos = employees.filter((e) => e.ativo);
  if (ativos.length === 0) return <NoEmployeesState unitName={unit.name} />;

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

async function EscalaMesSection({ monthIso }: { monthIso: string }) {
  const unit = await getCurrentUnit();
  if (!unit) return <NoUnitState />;

  const monthStart = startOfMonth(parse(`${monthIso}-01`, "yyyy-MM-dd", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const isoStart = format(monthStart, "yyyy-MM-dd");
  const isoEnd = format(monthEnd, "yyyy-MM-dd");

  const [employees, shifts] = await Promise.all([
    listEmployees(unit.id),
    listShifts(unit.id, isoStart, isoEnd),
  ]);

  const ativos = employees.filter((e) => e.ativo);
  if (ativos.length === 0) return <NoEmployeesState unitName={unit.name} />;

  return (
    <EscalaMonthView
      key={monthIso}
      unitId={unit.id}
      employees={ativos}
      shifts={shifts}
      monthIso={monthIso}
    />
  );
}

function parseInicio(value: string | undefined): Date | null {
  if (!value) return null;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseMonth(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  return null;
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
