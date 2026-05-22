// Tipos e funções puras do WBR — sem imports de servidor.
// Pode ser importado tanto de Server Components quanto de Client Components.

export type WbrBrandKpi = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_color: string | null;
  receita_realizada: number;
  receita_projetada: number;
  receita_gap_abs: number;
  receita_gap_pct: number | null;
  cmv_pct: number | null;
  cmv_meta: number | null;
  prime_cost_pct: number | null;
  prime_cost_meta: number | null;
  ebitda_pct: number | null;
  headcount_ativo: number;
  eventos_total: number;
  eventos_concluidos: number;
  eventos_em_andamento: number;
  eventos_pendentes: number;
  alertas_total: number;
  alertas_criticos: number;
};

export type WbrPayload = {
  weekStart: string;
  weekEnd: string;
  monthCompetencia: string;
  brands: WbrBrandKpi[];
  total_receita: number;
  total_eventos: number;
  total_headcount: number;
  total_alertas_criticos: number;
};

export type Severity = "ok" | "warn" | "danger";

export function cmvSeverity(pct: number | null, meta: number | null): Severity {
  if (pct == null || meta == null) return "ok";
  if (pct <= meta) return "ok";
  if (pct <= meta + 5) return "warn";
  return "danger";
}

export function primeSeverity(pct: number | null, meta: number | null): Severity {
  if (pct == null || meta == null) return "ok";
  if (pct <= meta) return "ok";
  if (pct <= meta + 5) return "warn";
  return "danger";
}

export function receitaSeverity(gapPct: number | null): Severity {
  if (gapPct == null) return "ok";
  if (gapPct >= 0) return "ok";
  if (gapPct >= -10) return "warn";
  return "danger";
}
