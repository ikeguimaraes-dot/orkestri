import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listEmployees } from "@/lib/pessoas/actions";
import { listPerformanceTemplates } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { NovoCicloClient } from "./novo-ciclo-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NovoCicloPage() {
  await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) redirect("/pessoas/avaliacoes/ciclos");

  const [employees, templates] = await Promise.all([
    listEmployees(unit.id),
    listPerformanceTemplates(),
  ]);

  return (
    <NovoCicloClient
      unitId={unit.id}
      unitNome={unit.name}
      employees={employees
        .filter((e) => e.ativo)
        .map((e) => ({
          id: e.id,
          nome: e.nome,
          sobrenome: e.sobrenome,
          funcao: e.funcao,
        }))}
      templates={templates
        .filter((t) => t.ativo)
        .map((t) => ({ id: t.id, nome: t.nome }))}
    />
  );
}
