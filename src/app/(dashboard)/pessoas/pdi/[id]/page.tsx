import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/server";
import { getPdi } from "../actions";
import { PdiDetalheClient } from "./pdi-detalhe-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PdiDetalhePage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const pdi = await getPdi(id);
  if (!pdi) notFound();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
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
            Pessoas · PDI
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 0",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            {pdi.titulo}
          </h1>
        </div>
        <Link href="/pessoas/pdi" className={buttonVariants({ variant: "outline" })}>
          ← PDIs
        </Link>
      </header>

      <PdiDetalheClient pdi={pdi} />
    </div>
  );
}
