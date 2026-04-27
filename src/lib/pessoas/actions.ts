"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import { gerarHolerite } from "@/lib/pessoas/clt";
import type {
  Absence,
  AbsenceInsert,
  AbsenceTipo,
  AbsenceWithEmployee,
  Employee,
  EmployeeInsert,
  EmployeeScore,
  EmployeeStub,
  EmployeeUpdate,
  GeneratePayslipInput,
  Payslip,
  PayslipStatus,
  PayslipWithEmployee,
  ScoreEvent,
  Shift,
  ShiftInsert,
  ShiftUpdate,
  Warning,
  WarningInsert,
  WarningNivel,
  WarningWithEmployee,
} from "@/types/pessoas";
import { deltaForAbsence, deltaForWarning, calcScore } from "@/lib/pessoas/score";

const TABLE = "employees" as const;
const SHIFTS_TABLE = "shifts" as const;
const PAYSLIPS_TABLE = "payslips" as const;
const WARNINGS_TABLE = "warnings" as const;
const ABSENCES_TABLE = "absences" as const;
const SCORE_EVENTS_TABLE = "score_events" as const;

// Nota: o builder do @supabase/ssr infere `never` em insert/update quando
// PostgrestVersion 12 + custom Database<T>. As entradas já estão validadas
// pelo zod schema antes de chegar aqui — `as never` é só pra TypeScript engolir.
// Boundary tipado fica nas funções (EmployeeInsert/EmployeeUpdate).

/**
 * Lista colaboradores de uma unit. RLS garante que o user só vê units onde
 * tem role. Retorna array vazio em qualquer falha — UI mostra empty state.
 */
export async function listEmployees(unitId: string): Promise<Employee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listEmployees] supabase indisponível");
      return [];
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .order("ativo", { ascending: false })
      .order("nome", { ascending: true })
      .order("sobrenome", { ascending: true });
    if (error) {
      console.error("[listEmployees] query error:", error.message, "unit:", unitId);
      return [];
    }
    return (data as Employee[] | null) ?? [];
  } catch (e) {
    console.error("[listEmployees] exceção:", e);
    return [];
  }
}

/** Busca colaborador por id. Retorna null se não existe ou sem permissão. */
export async function getEmployee(id: string): Promise<Employee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getEmployee] query error:", error.message, "id:", id);
      return null;
    }
    return (data as Employee | null) ?? null;
  } catch (e) {
    console.error("[getEmployee] exceção:", e);
    return null;
  }
}

export async function createEmployee(
  input: EmployeeInsert,
): Promise<ActionResult<Employee>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar" };
    }
    revalidatePath("/pessoas/colaboradores");
    revalidatePath("/pessoas");
    return { ok: true, data: data as Employee };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function updateEmployee(
  id: string,
  patch: EmployeeUpdate,
): Promise<ActionResult<Employee>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar" };
    }
    revalidatePath("/pessoas/colaboradores");
    revalidatePath(`/pessoas/colaboradores/${id}/editar`);
    return { ok: true, data: data as Employee };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

/**
 * Lista turnos da unit num intervalo (inclusivo). RLS já restringe à unit.
 * Datas em ISO "YYYY-MM-DD".
 */
export async function listShifts(
  unitId: string,
  dataInicio: string,
  dataFim: string,
): Promise<Shift[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listShifts] supabase indisponível");
      return [];
    }
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });
    if (error) {
      console.error("[listShifts] query error:", error.message, "unit:", unitId);
      return [];
    }
    return (data as Shift[] | null) ?? [];
  } catch (e) {
    console.error("[listShifts] exceção:", e);
    return [];
  }
}

export async function createShift(
  input: ShiftInsert,
): Promise<ActionResult<Shift>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar turno" };
    }
    revalidatePath("/pessoas/escala");
    return { ok: true, data: data as Shift };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function updateShift(
  id: string,
  patch: ShiftUpdate,
): Promise<ActionResult<Shift>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar turno" };
    }
    revalidatePath("/pessoas/escala");
    return { ok: true, data: data as Shift };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function deleteShift(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(SHIFTS_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas/escala");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

/**
 * Soft delete: marca ativo=false e seta data_demissao = hoje.
 * Não remove a row — preserva histórico de holerites/turnos.
 */
export async function deactivateEmployee(
  id: string,
): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from(TABLE)
      .update({
        ativo: false,
        data_demissao: today,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

// ── Holerites ──────────────────────────────────────────────────

type PayslipEmployeeJoin = Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "salario_base"> & {
  unit_id?: string;
};

type PayslipJoinRow = Payslip & {
  employees: PayslipEmployeeJoin | PayslipEmployeeJoin[] | null;
};

/**
 * Lista holerites de uma unit (RLS já filtra). Pode filtrar por mês/ano.
 * Mês 1-12, ano 4 dígitos. Se ambos null, retorna últimos 100.
 */
export async function listPayslips(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<PayslipWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listPayslips] supabase indisponível");
      return [];
    }

    let query = supabase
      .from(PAYSLIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, salario_base, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("competencia", { ascending: false });

    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const endDate = new Date(ano, mes, 0); // último dia do mês
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      query = query.gte("competencia", start).lte("competencia", end);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query.returns<PayslipJoinRow[]>();
    if (error) {
      console.error("[listPayslips] query error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => {
      const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      return {
        ...row,
        employee: emp ?? null,
      } as PayslipWithEmployee;
    });
  } catch (e) {
    console.error("[listPayslips] exceção:", e);
    return [];
  }
}

/** Busca holerite por id, com employee anexo. */
export async function getPayslip(id: string): Promise<PayslipWithEmployee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, salario_base, unit_id)")
      .eq("id", id)
      .maybeSingle<PayslipJoinRow>();
    if (error) {
      console.error("[getPayslip] query error:", error.message);
      return null;
    }
    if (!data) return null;
    const emp = Array.isArray(data.employees) ? data.employees[0] : data.employees;
    return { ...data, employee: emp ?? null } as PayslipWithEmployee;
  } catch (e) {
    console.error("[getPayslip] exceção:", e);
    return null;
  }
}

/**
 * Calcula CLT completo (INSS, IRRF, HE, AdN, DSR/gorjeta) e UPSERT no banco.
 * Unique em (employee_id, competencia) garante 1 holerite por mês.
 * Retorna o registro persistido (rascunho).
 */
export async function generatePayslip(
  input: GeneratePayslipInput,
): Promise<ActionResult<Payslip>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: emp, error: empErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", input.employeeId)
      .maybeSingle();
    if (empErr || !emp) {
      return { ok: false, error: empErr?.message ?? "Colaborador não encontrado" };
    }
    const employee = emp as Employee;
    const salarioBase = Number(employee.salario_base);

    // Shifts no mês.
    const start = `${input.ano}-${String(input.mes).padStart(2, "0")}-01`;
    const lastDay = new Date(input.ano, input.mes, 0).getDate();
    const end = `${input.ano}-${String(input.mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const { data: shiftsData, error: shiftsErr } = await supabase
      .from(SHIFTS_TABLE)
      .select("*")
      .eq("employee_id", input.employeeId)
      .gte("data", start)
      .lte("data", end);
    if (shiftsErr) {
      return { ok: false, error: `Falha ao buscar turnos: ${shiftsErr.message}` };
    }
    const shifts = (shiftsData ?? []) as Shift[];

    const calc = gerarHolerite({
      salarioBase,
      shifts,
      mes: input.mes,
      ano: input.ano,
      gorjeta: input.gorjeta ?? 0,
      dependentes: input.dependentes ?? 0,
      descontoVT: input.descontoVT ?? 0,
      descontoVR: input.descontoVR ?? 0,
    });

    const payload = {
      employee_id: input.employeeId,
      competencia: calc.competencia,
      salario_base: calc.salarioBase.toFixed(2),
      horas_extras: calc.horasExtras.toFixed(2),
      adicional_noturno: calc.adicionalNoturno.toFixed(2),
      gorjeta: calc.gorjeta.toFixed(2),
      dsr_gorjeta: calc.dsrGorjeta.toFixed(2),
      desconto_inss: calc.descontoInss.toFixed(2),
      desconto_irrf: calc.descontoIrrf.toFixed(2),
      desconto_vale_transporte: calc.descontoVT.toFixed(2),
      desconto_vale_refeicao: calc.descontoVR.toFixed(2),
      outros_descontos: "0.00",
      outros_acrescimos: "0.00",
      liquido: calc.liquido.toFixed(2),
      status: "rascunho" as PayslipStatus,
    };

    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .upsert(payload as never, { onConflict: "employee_id,competencia" })
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao gravar holerite" };
    }
    revalidatePath("/pessoas/holerites");
    revalidatePath(`/pessoas/holerites/${(data as Payslip).id}`);
    return { ok: true, data: data as Payslip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Bulk: gera holerite (rascunho) pra todos os colaboradores ativos da unit.
 * Default gorjeta=0, dependentes=0 — ajuste fino fica no detalhe individual.
 */
export async function generatePayslipsForUnit(
  unitId: string,
  mes: number,
  ano: number,
): Promise<ActionResult<{ count: number; failures: string[] }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, nome, sobrenome")
      .eq("unit_id", unitId)
      .eq("ativo", true);
    if (error) return { ok: false, error: error.message };

    const employees = (data ?? []) as Array<Pick<Employee, "id" | "nome" | "sobrenome">>;
    const failures: string[] = [];
    let count = 0;
    for (const e of employees) {
      const res = await generatePayslip({ employeeId: e.id, mes, ano });
      if (res.ok) count++;
      else failures.push(`${e.nome} ${e.sobrenome}: ${res.error}`);
    }
    revalidatePath("/pessoas/holerites");
    return { ok: true, data: { count, failures } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

async function setPayslipStatus(
  id: string,
  status: PayslipStatus,
): Promise<ActionResult<Payslip>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .update({ status } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar status" };
    }
    revalidatePath("/pessoas/holerites");
    revalidatePath(`/pessoas/holerites/${id}`);
    return { ok: true, data: data as Payslip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function approvePayslip(id: string): Promise<ActionResult<Payslip>> {
  return setPayslipStatus(id, "aprovado");
}

export async function markPayslipPaid(id: string): Promise<ActionResult<Payslip>> {
  return setPayslipStatus(id, "pago");
}

// ── Disciplina: warnings, absences, score ──────────────────────

type WarningJoinRow = Warning & {
  employees: EmployeeStub | EmployeeStub[] | null;
};
type AbsenceJoinRow = Absence & {
  employees: EmployeeStub | EmployeeStub[] | null;
};

function unwrapEmployee(
  e: EmployeeStub | EmployeeStub[] | null | undefined,
): EmployeeStub | null {
  if (!e) return null;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

/** Lista advertências da unit. RLS já filtra por employees.unit_id. */
export async function listWarnings(unitId: string): Promise<WarningWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("data", { ascending: false })
      .returns<WarningJoinRow[]>();
    if (error) {
      console.error("[listWarnings] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as WarningWithEmployee[];
  } catch (e) {
    console.error("[listWarnings] exceção:", e);
    return [];
  }
}

export async function getWarning(id: string): Promise<WarningWithEmployee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("id", id)
      .maybeSingle<WarningJoinRow>();
    if (error || !data) return null;
    return { ...data, employee: unwrapEmployee(data.employees) } as WarningWithEmployee;
  } catch (e) {
    console.error("[getWarning] exceção:", e);
    return null;
  }
}

/**
 * Cria advertência + score_event automático.
 * Ignora `score_impact` no input — derivado de WARNING_DELTA pelo nível.
 */
export async function createWarning(
  input: Omit<WarningInsert, "score_impact">,
): Promise<ActionResult<Warning>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const delta = deltaForWarning(input.nivel as WarningNivel);
    const payload = {
      ...input,
      score_impact: delta,
      data: input.data ?? new Date().toISOString().slice(0, 10),
    };

    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar advertência" };
    }
    const warning = data as Warning;

    // Score event vinculado.
    if (delta !== 0) {
      await supabase.from(SCORE_EVENTS_TABLE).insert({
        employee_id: input.employee_id,
        tipo: `warning_${input.nivel}`,
        delta,
        descricao: input.descricao,
        referencia_id: warning.id,
      } as never);
    }

    revalidatePath("/pessoas/disciplina");
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: warning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Lista faltas da unit. Filtra por mês/ano se ambos vierem. */
export async function listAbsences(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<AbsenceWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let query = supabase
      .from(ABSENCES_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("data", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("data", start).lte("data", end);
    }
    const { data, error } = await query.returns<AbsenceJoinRow[]>();
    if (error) {
      console.error("[listAbsences] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as AbsenceWithEmployee[];
  } catch (e) {
    console.error("[listAbsences] exceção:", e);
    return [];
  }
}

/** Cria falta + score_event automático (apenas se delta !== 0). */
export async function createAbsence(
  input: Omit<AbsenceInsert, "score_impact">,
): Promise<ActionResult<Absence>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const delta = deltaForAbsence(input.tipo as AbsenceTipo);
    const payload = { ...input, score_impact: delta };

    const { data, error } = await supabase
      .from(ABSENCES_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar falta" };
    }
    const absence = data as Absence;

    if (delta !== 0) {
      await supabase.from(SCORE_EVENTS_TABLE).insert({
        employee_id: input.employee_id,
        tipo: `absence_${input.tipo}`,
        delta,
        descricao: input.motivo,
        referencia_id: absence.id,
      } as never);
    }

    revalidatePath("/pessoas/disciplina");
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: absence };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Score atual de um colaborador (clamp 0-100). */
export async function getEmployeeScore(employeeId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return 100;
    const { data, error } = await supabase
      .from(SCORE_EVENTS_TABLE)
      .select("delta")
      .eq("employee_id", employeeId);
    if (error) {
      console.error("[getEmployeeScore] error:", error.message);
      return 100;
    }
    return calcScore((data ?? []) as Array<{ delta: number }>);
  } catch (e) {
    console.error("[getEmployeeScore] exceção:", e);
    return 100;
  }
}

/** Histórico de score events de um colaborador (timeline). */
export async function listScoreEvents(employeeId: string): Promise<ScoreEvent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(SCORE_EVENTS_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listScoreEvents] error:", error.message);
      return [];
    }
    return (data ?? []) as ScoreEvent[];
  } catch (e) {
    console.error("[listScoreEvents] exceção:", e);
    return [];
  }
}

/**
 * Score de TODOS os colaboradores da unit (1 query agregada).
 * Pra `Score Geral` tab — evita N queries.
 */
export async function listEmployeeScores(unitId: string): Promise<EmployeeScore[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data: emps, error: empErr } = await supabase
      .from(TABLE)
      .select("id, nome, sobrenome, funcao, departamento, ativo")
      .eq("unit_id", unitId)
      .order("nome");
    if (empErr) {
      console.error("[listEmployeeScores] employees error:", empErr.message);
      return [];
    }
    const employees = (emps ?? []) as Array<EmployeeStub & { ativo: boolean }>;
    if (employees.length === 0) return [];

    const empIds = employees.map((e) => e.id);

    // 3 queries paralelas: score_events, warnings count, absences count
    const [scoresRes, warnsRes, absRes] = await Promise.all([
      supabase
        .from(SCORE_EVENTS_TABLE)
        .select("employee_id, delta")
        .in("employee_id", empIds),
      supabase
        .from(WARNINGS_TABLE)
        .select("employee_id")
        .in("employee_id", empIds),
      supabase
        .from(ABSENCES_TABLE)
        .select("employee_id")
        .in("employee_id", empIds),
    ]);

    const eventsBy: Record<string, Array<{ delta: number }>> = {};
    for (const r of (scoresRes.data ?? []) as Array<{ employee_id: string; delta: number }>) {
      (eventsBy[r.employee_id] ??= []).push({ delta: r.delta });
    }
    const warnsBy: Record<string, number> = {};
    for (const r of (warnsRes.data ?? []) as Array<{ employee_id: string }>) {
      warnsBy[r.employee_id] = (warnsBy[r.employee_id] ?? 0) + 1;
    }
    const absBy: Record<string, number> = {};
    for (const r of (absRes.data ?? []) as Array<{ employee_id: string }>) {
      absBy[r.employee_id] = (absBy[r.employee_id] ?? 0) + 1;
    }

    return employees.map((emp) => ({
      employee: emp,
      score: calcScore(eventsBy[emp.id] ?? []),
      warnings_count: warnsBy[emp.id] ?? 0,
      absences_count: absBy[emp.id] ?? 0,
    }));
  } catch (e) {
    console.error("[listEmployeeScores] exceção:", e);
    return [];
  }
}
