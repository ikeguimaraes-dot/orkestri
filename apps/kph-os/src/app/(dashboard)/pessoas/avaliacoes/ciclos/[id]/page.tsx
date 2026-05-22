import { notFound } from "next/navigation";
import Link from "next/link";

import { buttonVariants } from "@kph/ui/button";
import { requireUser } from "@kph/auth/server";
import { getCicloComParticipantes } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { CicloDetalheClient } from "./ciclo-detalhe-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CicloDetalhePage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const ciclo = await getCicloComParticipantes(id);
  if (!ciclo) notFound();

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
            {ciclo.nome}
          </h1>
          {ciclo.template_nome && (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              Template: {ciclo.template_nome}
            </p>
          )}
        </div>
        <Link
          href="/pessoas/avaliacoes/ciclos"
          className={buttonVariants({ variant: "outline" })}
        >
          ← Ciclos
        </Link>
      </header>

      <CicloDetalheClient ciclo={ciclo} />
    </div>
  );
}
