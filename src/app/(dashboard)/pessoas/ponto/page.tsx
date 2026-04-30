import { Suspense } from "react";

import { PunchTable } from "@/components/pessoas/PunchTable";
import { PontoToggle } from "@/components/pessoas/PontoToggle";
import { listPunchesByDay } from "@/lib/pessoas/actions";
import { summarizePunchesByEmployee } from "@/lib/pessoas/punch";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ data?: string }>;

export default async function PontoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const dataIso = isValidIso(sp.data) ? sp.data! : todayIso();

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 22,
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
            Pessoas · Ponto
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 12px",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Ponto
          </h1>
          <PontoToggle active="aprovacao" />
        </div>
        <DateFilter currentIso={dataIso} />
      </header>

      <Suspense fallback={<TableSkeleton />}>
        <PontoSection dataIso={dataIso} />
      </Suspense>
    </div>
  );
}

async function PontoSection({ dataIso }: { dataIso: string }) {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          fontSize: 13,
          color: "var(--text)",
        }}
      >
        Selecione uma unidade na sidebar.
      </div>
    );
  }

  const punches = await listPunchesByDay(unit.id, dataIso);
  const summaries = summarizePunchesByEmployee(punches);

  return (
    <>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: "0 0 14px",
        }}
      >
        Folha de{" "}
        <span style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {formatDateBR(dataIso)}
        </span>{" "}
        — {unit.name}
      </p>
      <PunchTable
        unitId={unit.id}
        dataIso={dataIso}
        summaries={summaries}
        totalPunches={punches.length}
      />
    </>
  );
}

function DateFilter({ currentIso }: { currentIso: string }) {
  return (
    <form
      className="ponto-date-filter"
      method="get"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        Data
      </span>
      <input
        type="date"
        name="data"
        defaultValue={currentIso}
        style={{
          flex: 1,
          height: 28,
          padding: "0 8px",
          background: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 12,
        }}
      />
      <button
        type="submit"
        style={{
          height: 28,
          padding: "0 12px",
          background: "var(--brand)",
          color: "var(--primary-foreground)",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Aplicar
      </button>
    </form>
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
        gap: 8,
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{ height: 56, background: "var(--surface-2)", borderRadius: 6, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isValidIso(v: string | undefined): boolean {
  if (!v) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function formatDateBR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
