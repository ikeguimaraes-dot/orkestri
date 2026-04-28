import { notFound } from "next/navigation";
import {
  getTrainingTemplate,
  listRecordsForTemplate,
} from "@/app/(dashboard)/pessoas/treinamentos/actions";
import { listEmployees } from "@/lib/pessoas/actions";
import { getCurrentUnit } from "@/lib/auth/unit";
import { requireUser } from "@/lib/auth/server";
import type { EmployeeStub } from "@/types/pessoas";
import { TemplateDetalheClient } from "./template-detalhe-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TemplateDetalhePage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const [tpl, records, unit] = await Promise.all([
    getTrainingTemplate(id),
    listRecordsForTemplate(id),
    getCurrentUnit(),
  ]);
  if (!tpl) notFound();

  // Lista de colaboradores ativos da unit pra opção de adicionar treinamento.
  const employees = unit ? await listEmployees(unit.id) : [];
  const stubs: EmployeeStub[] = employees
    .filter((e) => e.ativo)
    .filter((e) => !tpl.funcao || e.funcao === tpl.funcao)
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      sobrenome: e.sobrenome,
      funcao: e.funcao,
      departamento: e.departamento,
    }));

  return (
    <TemplateDetalheClient
      template={tpl}
      records={records}
      employees={stubs}
    />
  );
}
