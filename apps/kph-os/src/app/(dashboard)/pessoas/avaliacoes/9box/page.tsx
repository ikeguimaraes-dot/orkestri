import Link from "next/link";

import { buttonVariants } from "@kph/ui/button";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { createServiceClient } from "@kph/db/supabase/server";
import { NineBoxClient } from "./9box-client";
import type { AvaliacaoCiclo } from "@/app/(dashboard)/pessoas/avaliacoes/actions";

export const dynamic = "force-dynamic";

export default async function NineBoxPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  let ciclos: Pick<AvaliacaoCiclo, "id" | "nome" | "status">[] = [];
  if (unit) {
    const supabase = createServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("avaliacao_ciclos")
        .select("id, nome, status")
        .eq("unit_id", unit.id)
        .order("created_at", { ascending: false });
      ciclos = (data ?? []) as typeof ciclos;
    }
  }

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
            Pessoas · Avaliações · Matriz 9Box
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
            Matriz 9Box
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Posicionamento dos colaboradores por desempenho (X) e potencial (Y) — baseado nos ciclos 360°.
          </p>
        </div>
        <Link
          href="/pessoas/avaliacoes"
          className={buttonVariants({ variant: "outline" })}
        >
          ← Avaliações
        </Link>
      </header>

      <NineBoxClient ciclos={ciclos} />
    </div>
  );
}
