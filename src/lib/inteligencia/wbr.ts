// Loaders server-side pro painel WBR (Weekly Business Review).
// Tipos e funções puras ficam em wbr-shared.ts (importável por Client Components).

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { createOperationsClient } from "@kph/db/supabase/operations-client";
import type { WbrBrandKpi, WbrPayload, WbrTrendPoint } from "./wbr-shared";

export type { WbrBrandKpi, WbrPayload } from "./wbr-shared";
export { cmvSeverity, primeSeverity, receitaSeverity, type Severity } from "./wbr-shared";

/** ISO week start (Monday) e end (Sunday) a partir de uma data qualquer. */
export function weekRange(refIso: string): { start: string; end: string } {
  const d = new Date(refIso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 (Dom) ... 6 (Sáb)
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function currentWeekIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Recebe 'YYYY-MM-DD' e retorna primeiro dia do mês 'YYYY-MM-01'. */
function monthFirstDay(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

/** Número ISO da semana (1-53) a partir de uma segunda-feira ISO. */
function isoWeekNumber(mondayIso: string): number {
  const d = new Date(mondayIso + "T00:00:00Z");
  // Cálculo ISO week: quarta-feira da semana determina o ano/número
  const dayOfYear = Math.floor(
    (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  return Math.ceil(dayOfYear / 7);
}

/**
 * Retorna os starts (segunda-feira) das últimas N semanas incluindo a referência,
 * em ordem cronológica (mais antigo primeiro).
 */
function lastNWeekStarts(refMondayIso: string, n: number): string[] {
  const result: string[] = [];
  const ref = new Date(refMondayIso + "T00:00:00Z");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref);
    d.setUTCDate(ref.getUTCDate() - i * 7);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

export async function loadWbr(refDateIso: string): Promise<WbrPayload | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { start: weekStart, end: weekEnd } = weekRange(refDateIso);
  const monthCompetencia = monthFirstDay(weekStart);
  // Inclusivo: filtros gte/lte com strings 'YYYY-MM-DD' funcionam direto em DATE.
  // Pra timestamptz (events) usamos ISO completo.
  const weekStartTs = `${weekStart}T00:00:00Z`;
  const weekEndTs = `${weekEnd}T23:59:59Z`;

  // 1) Brands acessíveis ao user (RLS já filtra)
  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name, slug, color")
    .eq("active", true)
    .order("name");
  type BrandRow = { id: string; name: string; slug: string; color: string | null };
  const brands = (brandsData ?? []) as BrandRow[];
  if (brands.length === 0) {
    return {
      weekStart,
      weekEnd,
      monthCompetencia,
      brands: [],
      total_receita: 0,
      total_eventos: 0,
      total_headcount: 0,
      total_alertas_criticos: 0,
      trend: [],
    };
  }
  const brandIds = brands.map((b) => b.id);

  // 2) Receita semanal — cash_flow_entries por brand_id (via period.brand_id)
  type EntryRow = {
    valor: number;
    natureza: "receita" | "despesa";
    period: { brand_id: string } | { brand_id: string }[] | null;
  };
  const { data: entries } = await supabase
    .from("cash_flow_entries")
    .select("valor, natureza, period:financial_periods(brand_id)")
    .gte("data_lancamento", weekStart)
    .lte("data_lancamento", weekEnd)
    .not("status", "in", "(cancelado,rejeitado)")
    .returns<EntryRow[]>();

  const receitaByBrand = new Map<string, number>();
  for (const e of entries ?? []) {
    if (e.natureza !== "receita") continue;
    const p = Array.isArray(e.period) ? e.period[0] : e.period;
    if (!p?.brand_id) continue;
    receitaByBrand.set(
      p.brand_id,
      (receitaByBrand.get(p.brand_id) ?? 0) + Number(e.valor),
    );
  }

  // 2b) Fallback Meet & Eat: vendas_diarias quando cash_flow_entries está vazio na semana.
  // vendas_diarias = import automático do PDV (~diário), sem brand_id — implicitamente Meet & Eat.
  const meetEatBrand = brands.find((b) => b.slug === "meet-and-eat");
  if (meetEatBrand && (receitaByBrand.get(meetEatBrand.id) ?? 0) === 0) {
    const ops = createOperationsClient();
    if (ops) {
      const { data: vendasWeek } = await ops
        .from("vendas_diarias")
        .select("faturamento_bruto")
        .gte("data_venda", weekStart)
        .lte("data_venda", weekEnd)
        .returns<Array<{ faturamento_bruto: number | null }>>();
      const totalVendas = (vendasWeek ?? []).reduce(
        (s, r) => s + (r.faturamento_bruto ?? 0),
        0,
      );
      if (totalVendas > 0) receitaByBrand.set(meetEatBrand.id, totalVendas);
    }
  }

  // 3) Projeção semanal — cash_flow_projections rateadas (mensal/4)
  type ProjRow = {
    valor_projetado: number;
    period: { brand_id: string; competencia: string } | { brand_id: string; competencia: string }[] | null;
  };
  const { data: projsData } = await supabase
    .from("cash_flow_projections")
    .select(
      "valor_projetado, natureza, period:financial_periods(brand_id, competencia)",
    )
    .eq("natureza", "receita")
    .returns<ProjRow[]>();
  const projecaoByBrand = new Map<string, number>();
  for (const p of projsData ?? []) {
    const per = Array.isArray(p.period) ? p.period[0] : p.period;
    if (!per?.brand_id) continue;
    if (per.competencia !== monthCompetencia) continue;
    // Aproximação: divide o projetado mensal por ~4.33 semanas
    projecaoByBrand.set(
      per.brand_id,
      (projecaoByBrand.get(per.brand_id) ?? 0) +
        Number(p.valor_projetado) / 4.33,
    );
  }

  // 4) DRE do mês (snapshot) — inclui receita_bruta como contexto pra semanas sem entries
  type DreRow = {
    brand_id: string;
    competencia: string;
    receita_bruta: number;
    cmv_pct: number | null;
    prime_cost_pct: number | null;
    ebitda_pct: number | null;
  };
  const { data: dre } = await supabase
    .from("v_dre_consolidado")
    .select("brand_id, competencia, receita_bruta, cmv_pct, prime_cost_pct, ebitda_pct")
    .eq("competencia", monthCompetencia)
    .returns<DreRow[]>();
  const dreMap = new Map<string, DreRow>();
  for (const r of dre ?? []) dreMap.set(r.brand_id, r);

  // 5) Metas
  type CfgRow = {
    brand_id: string;
    meta_cmv_pct: number | null;
    meta_prime_cost_pct: number | null;
  };
  const { data: cfg } = await supabase
    .from("brand_financial_config")
    .select("brand_id, meta_cmv_pct, meta_prime_cost_pct")
    .returns<CfgRow[]>();
  const cfgMap = new Map<string, CfgRow>();
  for (const r of cfg ?? []) cfgMap.set(r.brand_id, r);

  // 6) Headcount por marca + breakdown por departamento
  type HcRow = { brand_id: string; headcount_ativo: number };
  const { data: hc } = await supabase
    .from("v_headcount_por_marca")
    .select("brand_id, headcount_ativo")
    .returns<HcRow[]>();
  const hcMap = new Map<string, number>();
  for (const r of hc ?? []) hcMap.set(r.brand_id, r.headcount_ativo);

  // 6b) Breakdown por departamento (employees → units → brand_id)
  type EmpDeptRow = {
    departamento: string | null;
    unit: { brand_id: string } | { brand_id: string }[] | null;
  };
  const { data: empDepts } = await supabase
    .from("employees")
    .select("departamento, unit:units(brand_id)")
    .eq("ativo", true)
    .returns<EmpDeptRow[]>();
  // brand_id → { departamento: count }
  const deptByBrand = new Map<string, Map<string, number>>();
  for (const e of empDepts ?? []) {
    const u = Array.isArray(e.unit) ? e.unit[0] : e.unit;
    if (!u?.brand_id) continue;
    const dept = e.departamento ?? "Sem departamento";
    const inner = deptByBrand.get(u.brand_id) ?? new Map<string, number>();
    inner.set(dept, (inner.get(dept) ?? 0) + 1);
    deptByBrand.set(u.brand_id, inner);
  }

  // 7) Eventos da semana
  type EvRow = { brand_id: string; status: string };
  const { data: evs } = await supabase
    .from("events")
    .select("brand_id, status")
    .gte("data_inicio", weekStartTs)
    .lte("data_inicio", weekEndTs)
    .returns<EvRow[]>();
  const eventsByBrand = new Map<string, EvRow[]>();
  for (const e of evs ?? []) {
    const arr = eventsByBrand.get(e.brand_id) ?? [];
    arr.push(e);
    eventsByBrand.set(e.brand_id, arr);
  }

  // 8) Alertas (atual) — busca detalhes completos pra exibir no WBR
  type AlertRow = {
    brand_id: string;
    severidade: "warning" | "error";
    tipo_alerta: string;
    mensagem: string;
    resource_id: string;
    created_at: string;
  };
  const { data: alerts } = await supabase
    .from("v_alertas")
    .select("brand_id, severidade, tipo_alerta, mensagem, resource_id, created_at")
    .returns<AlertRow[]>();
  const alertsByBrand = new Map<string, AlertRow[]>();
  for (const a of alerts ?? []) {
    if (!a.brand_id) continue;
    const arr = alertsByBrand.get(a.brand_id) ?? [];
    arr.push(a);
    alertsByBrand.set(a.brand_id, arr);
  }

  // 9) Monta payload
  const brandsKpi: WbrBrandKpi[] = brands.map((b) => {
    const receita_realizada = receitaByBrand.get(b.id) ?? 0;
    const receita_projetada = Math.round((projecaoByBrand.get(b.id) ?? 0) * 100) / 100;
    const receita_gap_abs =
      Math.round((receita_realizada - receita_projetada) * 100) / 100;
    const receita_gap_pct =
      receita_projetada > 0
        ? Math.round(((receita_realizada - receita_projetada) / receita_projetada) * 10000) / 100
        : null;
    const dreRow = dreMap.get(b.id);
    const cfgRow = cfgMap.get(b.id);
    const eventos = eventsByBrand.get(b.id) ?? [];
    const eventos_concluidos = eventos.filter((e) => e.status === "concluido").length;
    const eventos_em_andamento = eventos.filter((e) => e.status === "em_andamento").length;
    const eventos_pendentes = eventos.filter(
      (e) => e.status === "pendente_aprovacao" || e.status === "aprovado",
    ).length;
    const alertasArr = alertsByBrand.get(b.id) ?? [];
    return {
      brand_id: b.id,
      brand_name: b.name,
      brand_slug: b.slug,
      brand_color: b.color,
      receita_realizada,
      receita_projetada,
      receita_gap_abs,
      receita_gap_pct,
      // Receita mensal do DRE como contexto quando não há entries na semana
      receita_mensal_dre: dreRow?.receita_bruta ?? null,
      cmv_pct: dreRow?.cmv_pct ?? null,
      cmv_meta: cfgRow?.meta_cmv_pct ?? null,
      prime_cost_pct: dreRow?.prime_cost_pct ?? null,
      prime_cost_meta: cfgRow?.meta_prime_cost_pct ?? null,
      ebitda_pct: dreRow?.ebitda_pct ?? null,
      headcount_ativo: hcMap.get(b.id) ?? 0,
      headcount_breakdown: Array.from(
        deptByBrand.get(b.id)?.entries() ?? [],
      )
        .map(([departamento, count]) => ({ departamento, count }))
        .sort((a, z) => z.count - a.count),
      eventos_total: eventos.length,
      eventos_concluidos,
      eventos_em_andamento,
      eventos_pendentes,
      alertas_total: alertasArr.length,
      alertas_criticos: alertasArr.filter((a) => a.severidade === "error").length,
      alertas_detalhe: alertasArr.map((a) => ({
        tipo_alerta: a.tipo_alerta,
        severidade: a.severidade,
        mensagem: a.mensagem,
        resource_id: a.resource_id,
        created_at: a.created_at,
      })),
    };
  });

  // 10) Trend — últimas 8 semanas de receita por marca
  const weekStarts = lastNWeekStarts(weekStart, 8);
  const trendStart = weekStarts[0]; // 8 semanas atrás
  const trendEnd = `${weekEnd}T23:59:59Z`;

  type TrendEntryRow = {
    valor: number;
    natureza: "receita" | "despesa";
    data_lancamento: string;
    period: { brand_id: string } | { brand_id: string }[] | null;
  };
  const { data: trendEntries } = await supabase
    .from("cash_flow_entries")
    .select("valor, natureza, data_lancamento, period:financial_periods(brand_id)")
    .gte("data_lancamento", trendStart)
    .lte("data_lancamento", weekEnd)
    .eq("natureza", "receita")
    .not("status", "in", "(cancelado,rejeitado)")
    .returns<TrendEntryRow[]>();

  // Agrupa por (week_start, brand_id)
  const trendMap = new Map<string, Map<string, number>>();
  for (const e of trendEntries ?? []) {
    const p = Array.isArray(e.period) ? e.period[0] : e.period;
    if (!p?.brand_id) continue;
    // Descobre a semana desta entrada
    const { start: ws } = weekRange(e.data_lancamento);
    const inner = trendMap.get(ws) ?? new Map<string, number>();
    inner.set(p.brand_id, (inner.get(p.brand_id) ?? 0) + Number(e.valor));
    trendMap.set(ws, inner);
  }

  // 10b) Fallback vendas_diarias para o trend de Meet & Eat
  if (meetEatBrand) {
    const ops2 = createOperationsClient();
    if (ops2) {
      const { data: vendasTrend } = await ops2
        .from("vendas_diarias")
        .select("data_venda, faturamento_bruto")
        .gte("data_venda", trendStart)
        .lte("data_venda", weekEnd)
        .returns<Array<{ data_venda: string; faturamento_bruto: number | null }>>();
      for (const row of vendasTrend ?? []) {
        const { start: ws } = weekRange(row.data_venda);
        const inner = trendMap.get(ws) ?? new Map<string, number>();
        // Só usa vendas_diarias se cash_flow não tem dados para essa semana/brand
        if ((inner.get(meetEatBrand.id) ?? 0) === 0 && (row.faturamento_bruto ?? 0) > 0) {
          inner.set(meetEatBrand.id, (inner.get(meetEatBrand.id) ?? 0) + (row.faturamento_bruto ?? 0));
          trendMap.set(ws, inner);
        }
      }
    }
  }

  const trend: WbrTrendPoint[] = weekStarts.map((ws) => {
    const weekNum = isoWeekNumber(ws);
    const byBrand = trendMap.get(ws) ?? new Map<string, number>();
    return {
      week_start: ws,
      week_label: `Sem ${weekNum}`,
      brands: brands.map((b) => ({
        brand_id: b.id,
        receita: byBrand.get(b.id) ?? 0,
      })),
    };
  });

  // Suprime o trendEnd warning
  void trendEnd;

  return {
    weekStart,
    weekEnd,
    monthCompetencia,
    brands: brandsKpi,
    total_receita: brandsKpi.reduce((a, b) => a + b.receita_realizada, 0),
    total_eventos: brandsKpi.reduce((a, b) => a + b.eventos_total, 0),
    total_headcount: brandsKpi.reduce((a, b) => a + b.headcount_ativo, 0),
    total_alertas_criticos: brandsKpi.reduce((a, b) => a + b.alertas_criticos, 0),
    trend,
  };
}

