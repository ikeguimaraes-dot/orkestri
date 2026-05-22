import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@kph/ui/button";
import { listPerformanceTemplates } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { requireUser } from "@kph/auth/server";
import { TemplatesAvaliacaoClient } from "./templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesAvaliacaoPage() {
  await requireUser();
  const templates = await listPerformanceTemplates();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
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
            Pessoas · Avaliações · Templates
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
            Templates de avaliação
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Modelos de avaliação por marca e função, com critérios e periodicidade definida.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/pessoas/avaliacoes"
            className={buttonVariants({ variant: "outline" })}
          >
            ← Avaliações
          </Link>
          <Link
            href="/pessoas/avaliacoes/templates/novo"
            className={buttonVariants()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo template
          </Link>
        </div>
      </header>

      <TemplatesAvaliacaoClient templates={templates} />
    </div>
  );
}
