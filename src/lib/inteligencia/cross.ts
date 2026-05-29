// Loader server-side pro painel Cross-marca.
// Carrega v_dre_consolidado para o período atual e anterior,
// monta delta MoM por KPI por marca.

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { createOperationsClient } from "@kph/db/supabase/operations-client";
import { periodoToDate, previousPeriodo, toNumber } from "@/lib/metas/types";

/** "YYYY-MM-01" → { dateFrom: "YYYY-MM-01", dateTo: "YYYY-MM-DD" } */
function competenciaToRange(competencia: string): { dateFrom: string; dateTo: string } {
  const [y, m] = competencia.split("-");
  const year = parseInt(y ?? "1970", 10);
  const month = parseInt(m ?? "1", 10);
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { dateFrom: competencia, dateTo: `${year}-${pad(month)}-${lastDay}` };
}

export type CrossKpiRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_color: string | null;
  // Atual
  receita: number | null;
  cmv_pct: number | null;
  prime_cost_pct: number | null;
  ebitda_pct: number | null;
  // Delta vs mês anterior (absoluto)
  delta_receita: number | null;
  delta_cmv_pct: number | null;
  delta_prime_cost_pct: number | null;
  delta_ebitda_pct: number | null;
};

export type CrossPayload = {
  periodo: string;
  periodo_anterior: string;
  rows: CrossKpiRow[];
};

type DreRaw = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_color: string | null;
  competencia: string;
  receita_bruta: number | null;
  cmv_pct: number | null;
  prime_cost_pct: number | null;
  ebitda_pct: number | null;
};

export async function loadCross(periodo: string): Promise<CrossPayload | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const periodoAnterior = previousPeriodo(periodo);
  const competenciaAtual = periodoToDate(periodo);
  const competenciaAnterior = periodoToDate(periodoAnterior);
  if (!competenciaAtual || !competenciaAnterior) return null;

  // Busca DRE dos dois períodos de uma vez
  const { data: dreData, error } = await supabase
    .from("v_dre_consolidado")
    .select(
      "brand_id, brand_name, brand_slug, brand_color, competencia, receita_bruta, cmv_pct, prime_cost_pct, ebitda_pct",
    )
    .in("competencia", [competenciaAtual, competenciaAnterior])
    .returns<DreRaw[]>();

  if (error) {
    console.error("[loadCross] v_dre_consolidado:", error.message);
    return null;
  }

  const rows = dreData ?? [];

  // Separa atual vs anterior por brand
  const atual = new Map<string, DreRaw>();
  const anterior = new Map<string, DreRaw>();
  for (const r of rows) {
    if (r.competencia === competenciaAtual) atual.set(r.brand_id, r);
    if (r.competencia === competenciaAnterior) anterior.set(r.brand_id, r);
  }

  // União de todas as brands que aparecem em qualquer período
  const allBrandIds = new Set([...atual.keys(), ...anterior.keys()]);

  // Busca brands ativas (pra ter cor e slug mesmo sem dados financeiros)
  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name, slug, color")
    .eq("active", true)
    .order("name");
  type BrandRow = { id: string; name: string; slug: string; color: string | null };
  const brandsAll = (brandsData ?? []) as BrandRow[];
  const brandsMeta = new Map(brandsAll.map((b) => [b.id, b]));

  // Inclui todas as brands ativas, mesmo sem dados DRE
  for (const b of brandsAll) allBrandIds.add(b.id);

  // Fallback Meet & Eat: se DRE atual está vazio, usa vendas_diarias (MTD)
  // vendas_diarias = import automático do PDV sem brand_id — implicitamente Meet & Eat
  const meetEatBrand = brandsAll.find((b) => b.slug === "meet-and-eat");
  if (meetEatBrand && !atual.has(meetEatBrand.id)) {
    const ops = createOperationsClient();
    if (ops && competenciaAtual) {
      const { dateFrom, dateTo } = competenciaToRange(competenciaAtual);
      const { data: vendasMes } = await ops
        .from("vendas_diarias")
        .select("faturamento_bruto")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo)
        .returns<Array<{ faturamento_bruto: number | null }>>();
      const totalVendas = (vendasMes ?? []).reduce(
        (s, r) => s + (r.faturamento_bruto ?? 0),
        0,
      );
      if (totalVendas > 0) {
        atual.set(meetEatBrand.id, {
          brand_id: meetEatBrand.id,
          brand_name: meetEatBrand.name,
          brand_slug: meetEatBrand.slug,
          brand_color: meetEatBrand.color,
          competencia: competenciaAtual,
          receita_bruta: totalVendas,
          cmv_pct: null,
          prime_cost_pct: null,
          ebitda_pct: null,
        });
      }
    }
  }

  const crossRows: CrossKpiRow[] = [];
  for (const brandId of allBrandIds) {
    const a = atual.get(brandId);
    const p = anterior.get(brandId);
    const meta = brandsMeta.get(brandId);

    const receita = toNumber(a?.receita_bruta) ?? null;
    const cmv_pct = toNumber(a?.cmv_pct) ?? null;
    const prime_cost_pct = toNumber(a?.prime_cost_pct) ?? null;
    const ebitda_pct = toNumber(a?.ebitda_pct) ?? null;

    const prev_receita = toNumber(p?.receita_bruta) ?? null;
    const prev_cmv = toNumber(p?.cmv_pct) ?? null;
    const prev_prime = toNumber(p?.prime_cost_pct) ?? null;
    const prev_ebitda = toNumber(p?.ebitda_pct) ?? null;

    crossRows.push({
      brand_id: brandId,
      brand_name: a?.brand_name ?? meta?.name ?? brandId,
      brand_slug: a?.brand_slug ?? meta?.slug ?? brandId,
      brand_color: a?.brand_color ?? meta?.color ?? null,
      receita,
      cmv_pct,
      prime_cost_pct,
      ebitda_pct,
      delta_receita:
        receita != null && prev_receita != null
          ? Math.round((receita - prev_receita) * 100) / 100
          : null,
      delta_cmv_pct:
        cmv_pct != null && prev_cmv != null
          ? Math.round((cmv_pct - prev_cmv) * 10) / 10
          : null,
      delta_prime_cost_pct:
        prime_cost_pct != null && prev_prime != null
          ? Math.round((prime_cost_pct - prev_prime) * 10) / 10
          : null,
      delta_ebitda_pct:
        ebitda_pct != null && prev_ebitda != null
          ? Math.round((ebitda_pct - prev_ebitda) * 10) / 10
          : null,
    });
  }

  // Ordena: marcas com dados primeiro, depois por receita desc
  crossRows.sort((a, b) => {
    if (a.receita == null && b.receita != null) return 1;
    if (a.receita != null && b.receita == null) return -1;
    return (b.receita ?? 0) - (a.receita ?? 0);
  });

  return { periodo, periodo_anterior: periodoAnterior, rows: crossRows };
}
