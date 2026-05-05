import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { getGorjetaPeriodos, getCargoPontos } from "@/lib/pessoas/gorjeta-actions";
import { GorjetasClient } from "./client";

export const dynamic = "force-dynamic";

export default async function GorjetasPage() {
  await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) redirect("/pessoas/colaboradores");

  const [periodos, cargoPontos] = await Promise.all([
    getGorjetaPeriodos(unit.id),
    getCargoPontos(unit.id),
  ]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <GorjetasClient
        unitId={unit.id}
        unitName={unit.name}
        initialPeriodos={periodos}
        initialCargoPontos={cargoPontos}
      />
    </div>
  );
}
