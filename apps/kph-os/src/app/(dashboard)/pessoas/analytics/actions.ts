"use server";

import { createServiceClient } from "@kph/db/supabase/server";

export type TurnoverPoint = { mes: string; admissoes: number; demissoes: number };
export type AbsenteismoPoint = { unit: string; faltas: number };
export type HeadcountPoint = { mes: string; headcount: number };
export type TimeToHirePoint = { mes: string; dias: number };

export type AnalyticsData = {
  turnover: TurnoverPoint[];
  absenteismo: AbsenteismoPoint[];
  headcount: HeadcountPoint[];
  tth: TimeToHirePoint[] | null;
};

function last12Months(): { year: number; month: number; label: string; key: string }[] {
  const now = new Date();
  const result = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    result.push({
      year,
      month,
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      key: `${year}-${String(month).padStart(2, "0")}`,
    });
  }
  return result;
}

function cutoffStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = createServiceClient();
  if (!supabase) return { turnover: [], absenteismo: [], headcount: [], tth: null };

  const months = last12Months();
  const cutoff = cutoffStr();

  type EmpRow = { data_admissao: string; data_demissao: string | null };
  type EmpUnitRow = { id: string; unit_id: string; units: { name: string } | { name: string }[] | null };
  type AbsRow = { employee_id: string };
  type EmpHeadRow = { data_admissao: string; data_demissao: string | null };

  const [empTurnoverRes, empsUnitRes, allEmpsRes, absRes] = await Promise.all([
    supabase
      .from("employees")
      .select("data_admissao, data_demissao")
      .or(`data_admissao.gte.${cutoff},data_demissao.gte.${cutoff}`)
      .returns<EmpRow[]>(),
    supabase
      .from("employees")
      .select("id, unit_id, units(name)")
      .returns<EmpUnitRow[]>(),
    supabase
      .from("employees")
      .select("data_admissao, data_demissao")
      .returns<EmpHeadRow[]>(),
    supabase
      .from("absences")
      .select("employee_id")
      .gte("data", cutoff)
      .returns<AbsRow[]>(),
  ]);

  // ── 1. Turnover mensal ─────────────────────────────────────────────
  const turnoverMap = new Map(months.map((m) => [m.key, { label: m.label, admissoes: 0, demissoes: 0 }]));
  for (const emp of empTurnoverRes.data ?? []) {
    const admKey = emp.data_admissao?.slice(0, 7);
    if (admKey && turnoverMap.has(admKey)) turnoverMap.get(admKey)!.admissoes++;
    const demKey = emp.data_demissao?.slice(0, 7);
    if (demKey && turnoverMap.has(demKey)) turnoverMap.get(demKey)!.demissoes++;
  }
  const turnover: TurnoverPoint[] = months.map((m) => {
    const e = turnoverMap.get(m.key)!;
    return { mes: e.label, admissoes: e.admissoes, demissoes: e.demissoes };
  });

  // ── 2. Absenteísmo por unidade ─────────────────────────────────────
  const empUnit = new Map<string, string>();
  for (const e of empsUnitRes.data ?? []) {
    const u = Array.isArray(e.units) ? e.units[0] : e.units;
    empUnit.set(e.id, u?.name ?? "Sem unit");
  }
  const unitCount = new Map<string, number>();
  for (const a of absRes.data ?? []) {
    const name = empUnit.get(a.employee_id) ?? "Sem unit";
    unitCount.set(name, (unitCount.get(name) ?? 0) + 1);
  }
  const absenteismo: AbsenteismoPoint[] = Array.from(unitCount.entries())
    .map(([unit, faltas]) => ({ unit, faltas }))
    .sort((a, b) => b.faltas - a.faltas);

  // ── 3. Headcount histórico ─────────────────────────────────────────
  const allEmps = allEmpsRes.data ?? [];
  const headcount: HeadcountPoint[] = months.map((m) => {
    // Último dia do mês
    const monthEnd = new Date(m.year, m.month, 0).toISOString().slice(0, 10);
    const count = allEmps.filter(
      (e) =>
        e.data_admissao <= monthEnd &&
        (!e.data_demissao || e.data_demissao > monthEnd),
    ).length;
    return { mes: m.label, headcount: count };
  });

  // ── 4. Time-to-hire (opcional) ─────────────────────────────────────
  let tth: TimeToHirePoint[] | null = null;
  try {
    type CandRow = { created_at: string; updated_at: string };
    const { data: cands, error } = await supabase
      .from("candidates")
      .select("created_at, updated_at")
      .eq("status", "aprovado")
      .gte("updated_at", cutoff + "T00:00:00Z")
      .returns<CandRow[]>();

    if (!error && cands && cands.length > 0) {
      type MonthAcc = { total: number; count: number };
      const tthMap = new Map<string, MonthAcc>(months.map((m) => [m.key, { total: 0, count: 0 }]));
      for (const c of cands) {
        const approvedKey = c.updated_at.slice(0, 7);
        const entry = tthMap.get(approvedKey);
        if (!entry) continue;
        const days = Math.round(
          (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) /
            86_400_000,
        );
        entry.total += days;
        entry.count++;
      }
      const points = months
        .map((m) => {
          const e = tthMap.get(m.key)!;
          return e.count > 0 ? { mes: m.label, dias: Math.round(e.total / e.count) } : null;
        })
        .filter(Boolean) as TimeToHirePoint[];
      if (points.length > 0) tth = points;
    }
  } catch {
    // tabela candidates não existe ou query falhou — omite gráfico
  }

  return { turnover, absenteismo, headcount, tth };
}
