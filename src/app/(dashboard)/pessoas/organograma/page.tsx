import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { getOrganograma } from "./actions";
import { OrganogramaClient } from "./organograma-client";

export const dynamic = "force-dynamic";

export default async function OrganogramaPage() {
  await requireUser();

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
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
            Pessoas · Organograma
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
            Organograma
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, maxWidth: 580 }}>
            Visualize a hierarquia da equipe. Clique em um nó para expandir ou colapsar.
          </p>
        </div>
        <Link
          href="/pessoas/organograma/configurar"
          className={buttonVariants({ variant: "outline" })}
        >
          <Settings size={15} style={{ marginRight: 6 }} />
          Configurar hierarquia
        </Link>
      </header>

      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>
        }
      >
        <OrganogramaSection />
      </Suspense>
    </div>
  );
}

async function OrganogramaSection() {
  const unit = await getCurrentUnit();

  if (!unit) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          padding: "32px 22px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Selecione uma unit no menu para ver o organograma.
      </div>
    );
  }

  const employees = await getOrganograma(unit.id);

  return <OrganogramaClient employees={employees} />;
}
