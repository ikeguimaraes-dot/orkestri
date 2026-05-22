"use server";

import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";

export type EmployeeNode = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
  photo_url: string | null;
  manager_id: string | null;
};

async function getAuthorizedUnitIds(): Promise<string[] | null> {
  const user = await requireUser();
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("unit_id")
    .eq("user_id", user.id);
  const unitIds = (roles ?? [])
    .map((r: any) => r.unit_id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
  return unitIds.length > 0 ? unitIds : null;
}

export async function getOrganograma(unitId: string): Promise<EmployeeNode[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao, photo_url, manager_id")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("[getOrganograma]", error.message);
      return [];
    }
    return (data ?? []) as EmployeeNode[];
  } catch (e) {
    console.error("[getOrganograma] exceção:", e);
    return [];
  }
}

export async function detectarCiclo(
  employeeId: string,
  managerId: string,
): Promise<boolean> {
  if (managerId === employeeId) return true;

  const supabase = createServiceClient();
  if (!supabase) return false;

  // Fetch all manager links in one query to avoid N+1 and TypeScript inference cycles
  const { data } = await supabase
    .from("employees")
    .select("id, manager_id")
    .not("manager_id", "is", null);

  const chain = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; manager_id: string | null }[]) {
    if (row.manager_id) chain.set(row.id, row.manager_id);
  }

  let current: string | undefined = managerId;
  const visited = new Set<string>();
  while (current) {
    if (current === employeeId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = chain.get(current);
  }
  return false;
}

export async function updateManagerId(
  employeeId: string,
  managerId: string | null,
): Promise<ActionResult<{ id: string; manager_id: string | null }>> {
  try {
    if (managerId && managerId === employeeId) {
      return { ok: false, error: "Um colaborador não pode ser seu próprio gestor" };
    }

    const unitIds = await getAuthorizedUnitIds();
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    if (unitIds !== null) {
      const { data: emp } = await supabase
        .from("employees")
        .select("unit_id")
        .eq("id", employeeId)
        .maybeSingle();
      const uid = (emp as { unit_id: string } | null)?.unit_id;
      if (!uid || !unitIds.includes(uid)) {
        return { ok: false, error: "Acesso não autorizado" };
      }
    }

    if (managerId) {
      const cycle = await detectarCiclo(employeeId, managerId);
      if (cycle) {
        return { ok: false, error: "Esta configuração criaria um ciclo na hierarquia" };
      }
    }

    const { data, error } = await supabase
      .from("employees")
      .update({ manager_id: managerId } as never)
      .eq("id", employeeId)
      .select("id, manager_id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar hierarquia" };
    }

    return { ok: true, data: data as { id: string; manager_id: string | null } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
