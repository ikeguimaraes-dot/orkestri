import { notFound } from "next/navigation";
import { getPerformanceTemplate } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { requireUser } from "@kph/auth/server";
import { TemplateAvaliacaoDetalheClient } from "./template-detalhe-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TemplateAvaliacaoDetalhePage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const [tpl, brands] = await Promise.all([
    getPerformanceTemplate(id),
    listAccessibleBrands(),
  ]);
  if (!tpl) notFound();

  return (
    <TemplateAvaliacaoDetalheClient template={tpl} brands={brands} />
  );
}
