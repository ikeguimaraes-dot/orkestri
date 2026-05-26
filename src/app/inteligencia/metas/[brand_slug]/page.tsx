import { notFound } from "next/navigation";
import {
  getTarget,
  listDreHistorico,
  listTargetsByBrand,
} from "../actions";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import {
  currentPeriodo,
  lastNPeriodos,
  toNumber,
} from "@/lib/metas/types";
import { MarcaDetalheClient } from "./marca-detalhe-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ brand_slug: string }>;
  searchParams: Promise<{ periodo?: string }>;
};

export default async function MarcaMetasPage({ params, searchParams }: Props) {
  await requireUser();
  const { brand_slug } = await params;
  const sp = await searchParams;
  const periodo =
    sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : currentPeriodo();

  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const { data: brandRaw } = await supabase
    .from("brands")
    .select("id, name, slug, color")
    .eq("slug", brand_slug)
    .maybeSingle();
  const brand = brandRaw as
    | { id: string; name: string; slug: string; color: string | null }
    | null;
  if (!brand) notFound();

  const periodos12 = lastNPeriodos(12, currentPeriodo());

  const [target, history, dreMap] = await Promise.all([
    getTarget(brand.id, periodo),
    listTargetsByBrand(brand.id),
    listDreHistorico(brand.id, periodos12),
  ]);

  // Monta série de evolução: meta vs realizado pros últimos 12 meses
  const targetByPeriodo = new Map(history.map((t) => [t.periodo, t]));
  const evolucao = periodos12.map((p) => {
    const t = targetByPeriodo.get(p);
    const dre = dreMap.get(p);
    return {
      periodo: p,
      meta: toNumber(t?.receita_meta) ?? null,
      realizado: dre?.receita ?? null,
    };
  });

  return (
    <MarcaDetalheClient
      brand={brand}
      periodo={periodo}
      periodoOptions={periodos12}
      target={target}
      history={history}
      evolucao={evolucao}
    />
  );
}
