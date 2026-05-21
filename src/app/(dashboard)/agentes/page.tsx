import { requireUser } from "@/lib/auth/server";
import { getAgentMetricsSummary, getAgentConversations } from "./actions";
import AgentesClient from "./agentes-client";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  await requireUser();

  const [metrics, conversations] = await Promise.all([
    getAgentMetricsSummary(),
    getAgentConversations(),
  ]);

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
          IA
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
          Agentes IA
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Monitoramento de conversas e métricas dos agentes Theo e Maya — últimos 7 dias.
        </p>
      </header>

      {/* Metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <MetricCard
          title="Conversas"
          value={String(metrics.total_conversations)}
          subtitle="total ativas"
        />
        <MetricCard
          title="Custo Total"
          value={`$${metrics.total_cost.toFixed(4)}`}
          subtitle="últimos 7 dias"
        />
        <MetricCard
          title="Latência Média"
          value={
            metrics.avg_latency_ms > 0
              ? `${Math.round(metrics.avg_latency_ms)} ms`
              : "—"
          }
          subtitle="últimos 7 dias"
        />
        <TopIntentsCard intents={metrics.top_intents} />
      </div>

      <AgentesClient conversations={conversations} />
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
        {subtitle}
      </div>
    </div>
  );
}

function TopIntentsCard({
  intents,
}: {
  intents: Array<{ intent: string; count: number }>;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 8,
        }}
      >
        Intenções Comuns
      </div>
      {intents.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>—</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {intents.map(({ intent, count }, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text)",
                  textTransform: "capitalize",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "75%",
                }}
              >
                {intent}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--brand)",
                }}
              >
                {count}×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
