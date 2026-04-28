import { redirect } from "next/navigation";
import { listImportLogs } from "@/lib/pessoas/import-actions";
import { getCurrentUnit } from "@/lib/auth/unit";
import { requireUser } from "@/lib/auth/server";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) redirect("/pessoas/colaboradores");
  const logs = await listImportLogs(unit.id);
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <ImportClient unitId={unit.id} unitName={unit.name} initialLogs={logs} />
    </div>
  );
}
