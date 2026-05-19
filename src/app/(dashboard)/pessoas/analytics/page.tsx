import { requireUser } from "@/lib/auth/server";
import { getAnalyticsData } from "./actions";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function PeopleAnalyticsPage() {
  await requireUser();
  const data = await getAnalyticsData();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Analytics
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
          People Analytics
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Indicadores de RH dos últimos 12 meses.
        </p>
      </header>

      <AnalyticsClient data={data} />
    </div>
  );
}
