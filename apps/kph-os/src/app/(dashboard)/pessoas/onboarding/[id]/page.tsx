import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@kph/auth/server";
import { getOnboardingRun } from "../actions";
import { OnboardingDetalheClient } from "./onboarding-detalhe-client";

export const dynamic = "force-dynamic";

export default async function OnboardingDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const run = await getOnboardingRun(id);
  if (!run) notFound();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Link
        href="/pessoas/onboarding"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} />
        Onboarding
      </Link>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 4,
        }}
      >
        Pessoas · Onboarding
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: "0 0 20px",
          color: "var(--text)",
          letterSpacing: -0.3,
        }}
      >
        {run.employee.nome} {run.employee.sobrenome}
      </h1>

      <OnboardingDetalheClient run={run} />
    </div>
  );
}
