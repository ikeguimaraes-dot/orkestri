import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listReunioes, listGestoresEColaboradores, type ReuniaoFilters } from "./actions";
import { ReunioesClient } from "./reunioes-client";

export const dynamic = "force-dynamic";

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    gestor_id?: string;
    colaborador_id?: string;
    periodo_inicio?: string;
    periodo_fim?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
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
            Pessoas · Reuniões
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
            Reuniões 1:1
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, maxWidth: 580 }}>
            Acompanhe as reuniões individuais entre gestores e colaboradores.
          </p>
        </div>
        <Link
          href="/pessoas/reunioes/nova"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus size={15} style={{ marginRight: 6 }} />
          Agendar Reunião
        </Link>
      </header>

      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>
        }
      >
        <ReunioesSection params={params} />
      </Suspense>
    </div>
  );
}

async function ReunioesSection({
  params,
}: {
  params: ReuniaoFilters;
}) {
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
        Selecione uma unit no menu para ver as reuniões.
      </div>
    );
  }

  const [reunioes, employees] = await Promise.all([
    listReunioes(unit.id, params),
    listGestoresEColaboradores(unit.id),
  ]);

  return (
    <ReunioesClient
      reunioes={reunioes}
      employees={employees}
      activeFilters={params}
    />
  );
}
