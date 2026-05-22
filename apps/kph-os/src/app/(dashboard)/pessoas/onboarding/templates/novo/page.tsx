import { redirect } from "next/navigation";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { NovoTemplateClient } from "./novo-template-client";

export const dynamic = "force-dynamic";

export default async function NovoTemplatePage() {
  await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/onboarding/templates");

  return <NovoTemplateClient unitId={unit.id} />;
}
