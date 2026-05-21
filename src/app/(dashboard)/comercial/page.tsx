import Link from "next/link";
import { Bot, ExternalLink, CalendarCheck, Filter } from "lucide-react";
import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ComercialPage() {
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
          Comercial
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
          Comercial
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
          Reservas, atendimento, funil de vendas e agentes de conversação.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {/* Serena */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 12,
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
              <Bot size={20} />
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 99,
                background: "#22c55e1a",
                color: "#16a34a",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "inline-block",
                }}
              />
              Online
            </span>
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Serena — Atendimento Madonna Cucina
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              margin: "0 0 14px",
              lineHeight: 1.55,
            }}
          >
            Agente de atendimento ao cliente via WhatsApp
          </p>

          <Link
            href="https://madonna-painel.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              background: "var(--brand)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ExternalLink size={13} />
            Abrir painel
          </Link>
        </div>

        {/* Reservas */}
        <HubCard
          href="/comercial/reservas"
          icon={<CalendarCheck size={20} />}
          title="Reservas"
          description="Gestão de reservas de mesa por unidade — status, pax, origem e confirmação."
        />

        {/* Funil */}
        <HubCard
          href="/comercial/funil"
          icon={<Filter size={20} />}
          title="Funil de Vendas"
          description="Pipeline Kanban para acompanhar oportunidades comerciais em andamento."
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
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--brand-soft)",
          color: "var(--brand)",
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
