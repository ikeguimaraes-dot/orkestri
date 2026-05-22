"use server";

// Server Actions específicas do módulo Ponto (resumo mensal + bulk approve).

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";
import type {
  Employee,
  EmployeeStub,
  OvertimeRecord,
  TimeClockPunch,
  TimeRecord,
} from "@kph/db/types/pessoas";

const PUNCHES_TABLE = "time_clock_punches" as const;
const TIMEREC_TABLE = "time_records" as const;
const OT_TABLE = "overtime_records" as const;
const EMPLOYEES_TABLE = "employees" as const;

const BULK_APPROVE_MAX = 50;

/**
 * Aprova até `BULK_APPROVE_MAX` pontos de uma vez por array de IDs.
 * Não filtra por unit aqui — RLS já garante que o user só pode tocar
 * em punches de unidades às quais tem acesso.
 */
export async function approvePunchesBulk(
  ids: string[],
): Promise<ActionResult<{ count: number; skipped: number }>> {
  try {
    if (ids.length === 0) return { ok: true, data: { count: 0, skipped: 0 } };
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const slice = ids.slice(0, BULK_APPROVE_MAX);
    const skipped = Math.max(0, ids.length - slice.length);

    const { error } = await supabase
      .from(PUNCHES_TABLE)
      .update({ aprovado: true } as never)
      .in("id", slice)
      .is("aprovado", null);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/pessoas/ponto");
    return { ok: true, data: { count: slice.length, skipped } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Resumo mensal ─────────────────────────────────────────────

export type MonthlyEmployeeSummary = {
  employee: EmployeeStub;
  fonte: "totvs" | "punches";
  dias_trabalhados: number | null;
  horas_previstas: number | null;     // em horas decimais (ex: 220.5)
  horas_realizadas: number | null;
  saldo_banco: number | null;          // saldo do mês (+/-)
  banco_horas_acumulado: number | null;
  faltas: number | null;
  he_aprovadas_horas: number;          // horas extras aprovadas no mês
  adicional_noturno: number | null;
};

export type MonthlyResumo = {
  rows: MonthlyEmployeeSummary[];
  totals: {
    horas_previstas: number;
    horas_realizadas: number;
    saldo_banco: number;
    he_aprovadas: number;
  };
};

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** "2026-04" → { startIso: "2026-04-01", endIso: "2026-04-30" } */
function periodoBounds(periodo: string): { startIso: string; endIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 0));
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
  };
}

/**
 * Resumo mensal de ponto da unit. Tenta time_records primeiro (resumo
 * importado do TOTVS); fallback calcula a partir de time_clock_punches
 * aprovados quando não há time_record pra um colaborador no período.
 *
 * HE aprovadas vêm sempre de overtime_records (independente da fonte).
 */
export async function getMonthlyResumo(
  unitId: string,
  periodo: string,
): Promise<MonthlyResumo> {
  const empty: MonthlyResumo = {
    rows: [],
    totals: {
      horas_previstas: 0,
      horas_realizadas: 0,
      saldo_banco: 0,
      he_aprovadas: 0,
    },
  };

  try {
    const bounds = periodoBounds(periodo);
    if (!bounds) return empty;
    const supabase = await createSupabaseServerClient();
    if (!supabase) return empty;

    // 1) Colaboradores ativos da unit
    const { data: empData, error: empErr } = await supabase
      .from(EMPLOYEES_TABLE)
      .select("id, nome, sobrenome, funcao, departamento, ativo, jornada")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");
    if (empErr) {
      console.error("[getMonthlyResumo] employees:", empErr.message);
      return empty;
    }
    const employees = (empData ?? []) as Array<
      Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "departamento" | "ativo" | "jornada">
    >;
    if (employees.length === 0) return empty;
    const empIds = employees.map((e) => e.id);

    // 2) time_records do periodo
    const { data: trData } = await supabase
      .from(TIMEREC_TABLE)
      .select("*")
      .in("employee_id", empIds)
      .eq("periodo", periodo);
    const trByEmployee = new Map<string, TimeRecord>();
    for (const r of (trData ?? []) as TimeRecord[]) {
      trByEmployee.set(r.employee_id, r);
    }

    // 3) HE aprovadas no mês
    const { data: otData } = await supabase
      .from(OT_TABLE)
      .select("employee_id, hours, approved, date")
      .in("employee_id", empIds)
      .eq("approved", true)
      .gte("date", bounds.startIso)
      .lte("date", bounds.endIso);
    const otByEmployee = new Map<string, number>();
    for (const r of (otData ?? []) as Pick<OvertimeRecord, "employee_id" | "hours" | "approved" | "date">[]) {
      const h = parseNum(r.hours) ?? 0;
      otByEmployee.set(r.employee_id, (otByEmployee.get(r.employee_id) ?? 0) + h);
    }

    // 4) Pra colaboradores SEM time_record, calcular a partir de punches
    //    aprovados no período. Agrupa por employee_id + dia, soma intervalos
    //    entre entrada/saida. Implementação simples: lista os punches e
    //    delega o cálculo pra summarizePunchesByEmployee — mas essa função
    //    só faz por dia. Aqui vou somar minutos diretamente.
    const empSemTotvs = empIds.filter((id) => !trByEmployee.has(id));
    const punchesByEmployee = new Map<string, TimeClockPunch[]>();
    if (empSemTotvs.length > 0) {
      const { data: punchData } = await supabase
        .from(PUNCHES_TABLE)
        .select("*")
        .in("employee_id", empSemTotvs)
        .gte("timestamp_punch", `${bounds.startIso}T00:00:00`)
        .lte("timestamp_punch", `${bounds.endIso}T23:59:59`)
        .eq("aprovado", true)
        .order("timestamp_punch");
      for (const p of (punchData ?? []) as TimeClockPunch[]) {
        const arr = punchesByEmployee.get(p.employee_id) ?? [];
        arr.push(p);
        punchesByEmployee.set(p.employee_id, arr);
      }
    }

    // 5) Monta linhas
    const rows: MonthlyEmployeeSummary[] = employees.map((e) => {
      const stub: EmployeeStub = {
        id: e.id,
        nome: e.nome,
        sobrenome: e.sobrenome,
        funcao: e.funcao,
        departamento: e.departamento,
      };
      const heHoras = otByEmployee.get(e.id) ?? 0;
      const tr = trByEmployee.get(e.id);
      if (tr) {
        return {
          employee: stub,
          fonte: "totvs",
          dias_trabalhados:
            (tr.faltas_injustificadas_dias != null ||
              tr.afastamentos_dias != null ||
              tr.ferias_dias != null)
              ? estimateDiasTrabalhados(bounds, tr)
              : null,
          horas_previstas: parseNum(tr.horas_previstas),
          horas_realizadas: parseNum(tr.horas_trabalhadas),
          saldo_banco: parseNum(tr.saldo_banco),
          banco_horas_acumulado: parseNum(tr.banco_horas_acumulado),
          faltas: tr.faltas_injustificadas_dias ?? null,
          he_aprovadas_horas: heHoras,
          adicional_noturno: parseNum(tr.adicional_noturno),
        };
      }
      // Fallback: soma minutos dos punches aprovados
      const punches = punchesByEmployee.get(e.id) ?? [];
      const { dias, horas } = sumPunchesIntoDailyHours(punches);
      // Horas previstas: tenta inferir de jornada (campo livre — não confiável).
      // Deixa null pra não enganar.
      return {
        employee: stub,
        fonte: "punches",
        dias_trabalhados: dias,
        horas_previstas: null,
        horas_realizadas: horas,
        saldo_banco: null,
        banco_horas_acumulado: null,
        faltas: null,
        he_aprovadas_horas: heHoras,
        adicional_noturno: null,
      };
    });

    // 6) Totais
    const totals = rows.reduce(
      (acc, r) => {
        acc.horas_previstas += r.horas_previstas ?? 0;
        acc.horas_realizadas += r.horas_realizadas ?? 0;
        acc.saldo_banco += r.saldo_banco ?? 0;
        acc.he_aprovadas += r.he_aprovadas_horas;
        return acc;
      },
      { horas_previstas: 0, horas_realizadas: 0, saldo_banco: 0, he_aprovadas: 0 },
    );

    return { rows, totals };
  } catch (e) {
    console.error("[getMonthlyResumo] exceção:", e);
    return empty;
  }
}

/** Estima dias trabalhados a partir do periodo descontando faltas/afastamentos/férias. */
function estimateDiasTrabalhados(
  bounds: { startIso: string; endIso: string },
  tr: TimeRecord,
): number {
  const [, mo] = bounds.startIso.split("-");
  const days = new Date(
    Number(bounds.endIso.slice(0, 4)),
    Number(mo),
    0,
  ).getDate();
  // Aproximação: dias úteis ≈ dias do mês × 5/7 (descarta fins de semana)
  const uteis = Math.round(days * (5 / 7));
  return Math.max(
    0,
    uteis -
      (tr.faltas_injustificadas_dias ?? 0) -
      (tr.afastamentos_dias ?? 0) -
      (tr.ferias_dias ?? 0),
  );
}

/**
 * Agrupa punches por dia e soma intervalos entrada→saida (descartando
 * intervalos de almoço). Heurística: punches alternados na ordem
 * entrada → intervalo_inicio → intervalo_fim → saida; soma só os pares
 * (entrada, intervalo_inicio) + (intervalo_fim, saida).
 */
function sumPunchesIntoDailyHours(punches: TimeClockPunch[]): {
  dias: number;
  horas: number;
} {
  const byDay = new Map<string, TimeClockPunch[]>();
  for (const p of punches) {
    const day = p.timestamp_punch.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(p);
    byDay.set(day, arr);
  }
  let totalMinutes = 0;
  for (const [, arr] of byDay) {
    arr.sort(
      (a, b) =>
        new Date(a.timestamp_punch).getTime() -
        new Date(b.timestamp_punch).getTime(),
    );
    let openIn: Date | null = null;
    for (const p of arr) {
      const t = new Date(p.timestamp_punch);
      if (p.tipo === "entrada" || p.tipo === "intervalo_fim") {
        openIn = t;
      } else if (
        (p.tipo === "saida" || p.tipo === "intervalo_inicio") &&
        openIn
      ) {
        totalMinutes += Math.max(0, (t.getTime() - openIn.getTime()) / 60000);
        openIn = null;
      }
    }
  }
  return {
    dias: byDay.size,
    horas: Math.round((totalMinutes / 60) * 100) / 100,
  };
}
