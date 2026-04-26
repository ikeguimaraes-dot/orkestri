"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import type { Employee, EmployeeInsert, EmployeeUpdate } from "@/types/pessoas";

const TABLE = "employees" as const;

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
