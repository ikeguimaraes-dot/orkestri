import { redirect } from "next/navigation";
import { getCurrentUnit } from "@kph/auth/unit";
import { requireUser } from "@kph/auth/server";
import { NovoClienteClient } from "./novo-cliente-client";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  await requireUser();
  const unit = await getCurrentUnit();
  if (!unit || !unit.brand_id) redirect("/cliente");
  return (
    <NovoClienteClient
      unitId={unit.id}
      unitName={unit.name}
      brandId={unit.brand_id}
    />
  );
}
