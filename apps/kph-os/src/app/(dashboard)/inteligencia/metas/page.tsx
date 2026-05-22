import { listMetasForPeriodo } from "./actions";
import { requireUser } from "@kph/auth/server";
import { currentPeriodo, lastNPeriodos } from "@/lib/metas/types";
import { MetasClient } from "./metas-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ periodo?: string }>;
};

export default async function MetasPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const periodo =
    sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : currentPeriodo();
  const rows = await listMetasForPeriodo(periodo);
  const periodoOptions = lastNPeriodos(12, currentPeriodo());

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
          Inteligência · Metas
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
          Metas por marca
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          KPI alvos vs realizado por marca, com semáforo de atingimento.
          Defina metas por marca clicando em uma linha.
        </p>
      </header>

      <MetasClient
        rows={rows}
        periodo={periodo}
        periodoOptions={periodoOptions}
      />
    </div>
  );
}
