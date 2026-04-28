import Link from "next/link";
import { BarChart3, ChevronRight, LineChart } from "lucide-react";

import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function InteligenciaHubPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
          Inteligência
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
          Inteligência de Negócio
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            maxWidth: 720,
            lineHeight: 1.55,
          }}
        >
          Painéis consolidados pra revisão executiva — métricas financeiras,
          operacionais, comerciais e de pessoas em uma vista só.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <HubCard
          href="/inteligencia/wbr"
          icon={<BarChart3 size={20} />}
          title="WBR · Weekly Business Review"
          description="Painel semanal por marca: receita vs meta, CMV, prime cost, headcount, eventos e alertas."
        />
        <HubCardDisabled
          icon={<LineChart size={20} />}
          title="Tendências (em breve)"
          description="Séries temporais e benchmarks por marca."
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        textDecoration: "none",
        transition: "border-color var(--t)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--brand-soft)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <ChevronRight size={16} style={{ color: "var(--text-3)" }} />
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </Link>
  );
}

function HubCardDisabled({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        padding: 18,
        opacity: 0.6,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--surface-2)",
          color: "var(--text-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-2)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  );
}
