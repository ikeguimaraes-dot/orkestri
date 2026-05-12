import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { getEmployeeByUser } from "../actions";
import { NovoPdiClient } from "./novo-pdi-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NovoPdiPage() {
  const user = await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/pdi");

  const myEmployee = await getEmployeeByUser(user.id, unit.id);
  if (!myEmployee) redirect("/pessoas/pdi");

  return (
    <NovoPdiClient
      unitId={unit.id}
      employeeId={myEmployee.id}
      employeeNome={`${myEmployee.nome} ${myEmployee.sobrenome}`.trim()}
    />
  );
}
