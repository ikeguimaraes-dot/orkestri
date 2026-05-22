import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { buttonVariants } from "@kph/ui/button";
import { listPerformanceReviews } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { requireUser } from "@kph/auth/server";
import { AvaliacoesClient } from "./avaliacoes-client";

export const dynamic = "force-dynamic";

export default async function AvaliacoesPage() {
  await requireUser();
  const reviews = await listPerformanceReviews();

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
            Pessoas · Avaliações
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
            Avaliações de desempenho
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Histórico de avaliações por colaborador, período e função.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/pessoas/avaliacoes/templates"
            className={buttonVariants({ variant: "outline" })}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Templates
          </Link>
        </div>
      </header>

      <AvaliacoesClient reviews={reviews} />
    </div>
  );
}
