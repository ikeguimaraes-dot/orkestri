import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@kph/ui/button";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listOnboardingRuns, type RunStatus } from "./actions";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();
  const { status: statusParam } = await searchParams;

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
            Pessoas · Onboarding
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
            Onboarding
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, maxWidth: 580 }}>
            Acompanhe o processo de integração dos novos colaboradores.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/pessoas/onboarding/templates"
            className={buttonVariants({ variant: "outline" })}
          >
            Templates
          </Link>
          <Link
            href="/pessoas/onboarding/novo"
            className={buttonVariants({ variant: "default" })}
          >
            <Plus size={15} style={{ marginRight: 6 }} />
            Novo Onboarding
          </Link>
        </div>
      </header>

      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>
        }
      >
        <OnboardingSection status={statusParam as RunStatus | undefined} />
      </Suspense>
    </div>
  );
}

async function OnboardingSection({ status }: { status?: RunStatus }) {
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
        Selecione uma unit no menu para ver os onboardings.
      </div>
    );
  }

  const runs = await listOnboardingRuns(unit.id, status);

  return <OnboardingClient runs={runs} activeStatus={status} />;
}
