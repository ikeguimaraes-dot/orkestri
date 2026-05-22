import { getMonthlyResumo } from "../actions";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { PontoToggle } from "@/components/pessoas/PontoToggle";
import { ResumoMensalClient } from "./resumo-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ periodo?: string }>;

function currentPeriodo(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNPeriodos(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function PontoResumoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const periodo =
    sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : currentPeriodo();
  const unit = await getCurrentUnit();

  const data = unit
    ? await getMonthlyResumo(unit.id, periodo)
    : { rows: [], totals: { horas_previstas: 0, horas_realizadas: 0, saldo_banco: 0, he_aprovadas: 0 } };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ marginBottom: 18 }}>
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
        <PontoToggle active="resumo" />
      </header>

      {!unit ? (
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
      ) : (
        <ResumoMensalClient
          periodo={periodo}
          periodoOptions={lastNPeriodos(12)}
          unitName={unit.name}
          rows={data.rows}
          totals={data.totals}
        />
      )}
    </div>
  );
}
