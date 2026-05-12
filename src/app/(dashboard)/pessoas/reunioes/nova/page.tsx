import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listGestoresEColaboradores } from "../actions";
import { NovaReuniaoClient } from "./nova-reuniao-client";

export const dynamic = "force-dynamic";

export default async function NovaReuniaoPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/reunioes");

  const employees = await listGestoresEColaboradores(unit.id);

  if (employees.length < 2) redirect("/pessoas/reunioes");

  return <NovaReuniaoClient unitId={unit.id} employees={employees} />;
}
