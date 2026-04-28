import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { listTrainingTemplates } from "@/app/(dashboard)/pessoas/treinamentos/actions";
import { requireUser } from "@/lib/auth/server";
import { TreinamentosClient } from "./treinamentos-client";

export const dynamic = "force-dynamic";

export default async function TreinamentosPage() {
  await requireUser();
  const templates = await listTrainingTemplates();

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
            Pessoas · Treinamentos
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
            Treinamentos & Onboarding
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Templates de treinamento por marca e função, com controle de
            validade e obrigatoriedade.
          </p>
        </div>
        <Link href="/pessoas/treinamentos/novo" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo template
        </Link>
      </header>

      <TreinamentosClient templates={templates} />
    </div>
  );
}
