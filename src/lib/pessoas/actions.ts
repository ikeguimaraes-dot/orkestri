"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import { gerarHolerite } from "@/lib/pessoas/clt";
import type {
  Employee,
  EmployeeInsert,
  EmployeeUpdate,
  GeneratePayslipInput,
  Payslip,
  PayslipStatus,
  PayslipWithEmployee,
  Shift,
  ShiftInsert,
  ShiftUpdate,
} from "@/types/pessoas";

const TABLE = "employees" as const;
const SHIFTS_TABLE = "shifts" as const;
const PAYSLIPS_TABLE = "payslips" as const;

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
