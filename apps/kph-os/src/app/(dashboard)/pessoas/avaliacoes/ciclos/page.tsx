import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@kph/ui/button";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listCiclos } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { CiclosClient } from "./ciclos-client";

export const dynamic = "force-dynamic";

export default async function CiclosPage() {
  await requireUser();
  const unit = await getCurrentUnit();
  const ciclos = unit ? await listCiclos(unit.id) : [];

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
            Pessoas · Avaliações · Ciclos 360°
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
            Ciclos 360°
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Rodadas de avaliação multi-rater com autoavaliação, pares, gestor e liderados.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/pessoas/avaliacoes"
            className={buttonVariants({ variant: "outline" })}
          >
            ← Avaliações
          </Link>
          {unit && (
            <Link
              href="/pessoas/avaliacoes/ciclos/novo"
              className={buttonVariants()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo ciclo
            </Link>
          )}
        </div>
      </header>

      {!unit ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Selecione uma unidade para ver os ciclos.
        </div>
      ) : (
        <CiclosClient ciclos={ciclos} />
      )}
    </div>
  );
}
