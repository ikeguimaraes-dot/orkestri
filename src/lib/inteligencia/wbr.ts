// Loaders + types pro painel WBR (Weekly Business Review).
//
// Note: views financeiras (v_dre_consolidado) são por competência mensal.
// Pra "semana atual" combinamos:
//   - Receita semanal: cash_flow_entries.valor por brand_id no range da semana
//   - CMV%, prime cost, ebitda%: snapshot mensal (mês da semana)
//   - Headcount: snapshot atual
//   - Eventos: events.data_inicio dentro da semana
//   - Alertas: v_alertas filtrados por brand
//   - Metas: brand_financial_config

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WbrBrandKpi = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_color: string | null;
  // Financeiro (semana — extraído de cash_flow_entries)
  receita_realizada: number;
  receita_projetada: number;
  receita_gap_abs: number;
  receita_gap_pct: number | null;
  // Snapshot mensal (mês corrente da semana selecionada)
  cmv_pct: number | null;
  cmv_meta: number | null;
  prime_cost_pct: number | null;
  prime_cost_meta: number | null;
  ebitda_pct: number | null;
  // Pessoas
  headcount_ativo: number;
  // Eventos da semana
  eventos_total: number;
  eventos_concluidos: number;
  eventos_em_andamento: number;
  eventos_pendentes: number;
  // Alertas
  alertas_total: number;
  alertas_criticos: number;
};

export type WbrPayload = {
  weekStart: string;          // ISO (YYYY-MM-DD), segunda-feira
  weekEnd: string;            // ISO (YYYY-MM-DD), domingo
  monthCompetencia: string;   // ISO YYYY-MM-01
  brands: WbrBrandKpi[];
  // Totais agregados pro topo
  total_receita: number;
  total_eventos: number;
  total_headcount: number;
  total_alertas_criticos: number;
};

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

  // 4) DRE do mês (snapshot)
  type DreRow = {
    brand_id: string;
    competencia: string;
    cmv_pct: number | null;
    prime_cost_pct: number | null;
    ebitda_pct: number | null;
  };
  const { data: dre } = await supabase
    .from("v_dre_consolidado")
    .select("brand_id, competencia, cmv_pct, prime_cost_pct, ebitda_pct")
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

  // 6) Headcount por marca
  type HcRow = { brand_id: string; headcount_ativo: number };
  const { data: hc } = await supabase
    .from("v_headcount_por_marca")
    .select("brand_id, headcount_ativo")
    .returns<HcRow[]>();
  const hcMap = new Map<string, number>();
  for (const r of hc ?? []) hcMap.set(r.brand_id, r.headcount_ativo);

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

  // 8) Alertas (atual)
  type AlertRow = { brand_id: string; severidade: string };
  const { data: alerts } = await supabase
    .from("v_alertas")
    .select("brand_id, severidade")
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
      cmv_pct: dreRow?.cmv_pct ?? null,
      cmv_meta: cfgRow?.meta_cmv_pct ?? null,
      prime_cost_pct: dreRow?.prime_cost_pct ?? null,
      prime_cost_meta: cfgRow?.meta_prime_cost_pct ?? null,
      ebitda_pct: dreRow?.ebitda_pct ?? null,
      headcount_ativo: hcMap.get(b.id) ?? 0,
      eventos_total: eventos.length,
      eventos_concluidos,
      eventos_em_andamento,
      eventos_pendentes,
      alertas_total: alertasArr.length,
      alertas_criticos: alertasArr.filter(
        (a) => a.severidade === "error" || a.severidade === "critical",
      ).length,
    };
  });

  return {
    weekStart,
    weekEnd,
    monthCompetencia,
    brands: brandsKpi,
    total_receita: brandsKpi.reduce((a, b) => a + b.receita_realizada, 0),
    total_eventos: brandsKpi.reduce((a, b) => a + b.eventos_total, 0),
    total_headcount: brandsKpi.reduce((a, b) => a + b.headcount_ativo, 0),
    total_alertas_criticos: brandsKpi.reduce((a, b) => a + b.alertas_criticos, 0),
  };
}

export type Severity = "ok" | "warn" | "danger";

/** CMV%: ok < meta · warn ≤ meta+5 · danger acima. */
export function cmvSeverity(pct: number | null, meta: number | null): Severity {
  if (pct == null || meta == null) return "ok";
  if (pct <= meta) return "ok";
  if (pct <= meta + 5) return "warn";
  return "danger";
}

/** Prime cost: mesma lógica. */
export function primeSeverity(pct: number | null, meta: number | null): Severity {
  if (pct == null || meta == null) return "ok";
  if (pct <= meta) return "ok";
  if (pct <= meta + 5) return "warn";
  return "danger";
}

/** Receita gap: ok ≥ 0, warn entre -10% e 0, danger < -10%. */
export function receitaSeverity(gapPct: number | null): Severity {
  if (gapPct == null) return "ok";
  if (gapPct >= 0) return "ok";
  if (gapPct >= -10) return "warn";
  return "danger";
}
