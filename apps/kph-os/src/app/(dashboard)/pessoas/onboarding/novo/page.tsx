import { redirect } from "next/navigation";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listTemplates, listEmployeesForRun } from "../actions";
import { NovoOnboardingClient } from "./novo-onboarding-client";

export const dynamic = "force-dynamic";

export default async function NovoOnboardingPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/onboarding");

  const [employees, templates] = await Promise.all([
    listEmployeesForRun(unit.id),
    listTemplates(unit.id),
  ]);

  if (templates.length === 0) redirect("/pessoas/onboarding/templates");

  return (
    <NovoOnboardingClient
      unitId={unit.id}
      employees={employees}
      templates={templates}
    />
  );
}
