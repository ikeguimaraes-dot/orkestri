import { redirect } from "next/navigation";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { getOrganograma } from "../actions";
import { ConfigurarClient } from "./configurar-client";

export const dynamic = "force-dynamic";

export default async function ConfigurarOrganogramaPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/organograma");

  const employees = await getOrganograma(unit.id);

  return <ConfigurarClient employees={employees} />;
}
