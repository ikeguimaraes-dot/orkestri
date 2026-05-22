import { redirect } from "next/navigation";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listPontoPeriodos } from "@/lib/pessoas/ponto-mensal-actions";
import { PontoMensalClient } from "./client";

export const dynamic = "force-dynamic";

export default async function RelatorioPontoPage() {
  await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) redirect("/pessoas/colaboradores");

  const periodos = await listPontoPeriodos(unit.id);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <PontoMensalClient
        unitId={unit.id}
        unitName={unit.name}
        initialPeriodos={periodos}
      />
    </div>
  );
}
