import { notFound, redirect } from "next/navigation";
import { getEmployee } from "@/lib/pessoas/actions";
import { listPerformanceTemplates } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { NovaAvaliacaoClient } from "./novo-review-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ employeeId: string }> };

export default async function NovaAvaliacaoPage({ params }: Props) {
  await requireUser();
  const { employeeId } = await params;
  const employee = await getEmployee(employeeId);
  if (!employee) notFound();

  // Resolve brand_id da unit do colaborador
  const supabase = await createSupabaseServerClient();
  let brandId: string | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("units")
      .select("brand_id")
      .eq("id", employee.unit_id)
      .maybeSingle();
    brandId = (data as { brand_id: string | null } | null)?.brand_id ?? null;
  }
  if (!brandId) {
    // Sem brand definido → não tem como filtrar templates
    redirect(`/pessoas/colaboradores/${employeeId}`);
  }

  const allTemplates = await listPerformanceTemplates(brandId);
  const templates = allTemplates.filter(
    (t) =>
      t.ativo &&
      (t.funcao == null || t.funcao === employee.funcao),
  );

  return (
    <NovaAvaliacaoClient
      employee={{
        id: employee.id,
        nome: employee.nome,
        sobrenome: employee.sobrenome,
        funcao: employee.funcao,
      }}
      templates={templates.map((t) => ({
        id: t.id,
        nome: t.nome,
        descricao: t.descricao,
        funcao: t.funcao,
        periodicidade: t.periodicidade,
        criterios: Array.isArray(t.criterios) ? t.criterios : [],
      }))}
    />
  );
}
