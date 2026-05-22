"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";

export type ReuniaoStatus = "agendada" | "realizada" | "cancelada";
export type ActionItemStatus = "pendente" | "concluido" | "cancelado";

export type EmployeeStub = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
};

export type ActionItem = {
  id: string;
  reuniao_id: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: ActionItemStatus;
  created_at: string;
};

export type Reuniao = {
  id: string;
  unit_id: string;
  gestor_id: string;
  colaborador_id: string;
  data_reuniao: string;
  duracao_min: number;
  status: ReuniaoStatus;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

export type ReuniaoWithDetails = Reuniao & {
  gestor: EmployeeStub;
  colaborador: EmployeeStub;
  action_items: ActionItem[];
};

export type ReuniaoFilters = {
  status?: string;
  gestor_id?: string;
  colaborador_id?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
};

export type CreateReuniaoInput = {
  unit_id: string;
  gestor_id: string;
  colaborador_id: string;
  data_reuniao: string;
  duracao_min: number;
  notas?: string;
  action_items: { descricao: string; responsavel_id?: string; prazo?: string }[];
};

export type UpdateReuniaoInput = {
  notas?: string;
  status?: ReuniaoStatus;
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

const REUNIAO_SELECT =
  "*, gestor:employees!gestor_id(id,nome,sobrenome,funcao), colaborador:employees!colaborador_id(id,nome,sobrenome,funcao), action_items:reuniao_action_items(*)";

export async function listReunioes(
  unitId: string,
  filters?: ReuniaoFilters,
): Promise<ReuniaoWithDetails[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let q = (supabase as any)
      .from("reunioes_1on1")
      .select(REUNIAO_SELECT)
      .eq("unit_id", unitId)
      .order("data_reuniao", { ascending: false });

    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.gestor_id) q = q.eq("gestor_id", filters.gestor_id);
    if (filters?.colaborador_id) q = q.eq("colaborador_id", filters.colaborador_id);
    if (filters?.periodo_inicio) q = q.gte("data_reuniao", filters.periodo_inicio);
    if (filters?.periodo_fim) q = q.lte("data_reuniao", filters.periodo_fim + "T23:59:59");

    const { data, error } = await q;
    if (error) {
      console.error("[listReunioes]", error.message);
      return [];
    }
    return (data ?? []) as ReuniaoWithDetails[];
  } catch (e) {
    console.error("[listReunioes] exceção:", e);
    return [];
  }
}

export async function getReuniao(id: string): Promise<ReuniaoWithDetails | null> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    let q = (supabase as any)
      .from("reunioes_1on1")
      .select(REUNIAO_SELECT)
      .eq("id", id);

    if (unitIds !== null) {
      q = q.in("unit_id", unitIds);
    }

    const { data, error } = await q.single();
    if (error || !data) return null;
    return data as ReuniaoWithDetails;
  } catch {
    return null;
  }
}

export async function createReuniao(
  input: CreateReuniaoInput,
): Promise<ActionResult<Reuniao>> {
  try {
    if (!input.gestor_id || !input.colaborador_id) {
      return { ok: false, error: "Selecione gestor e colaborador" };
    }
    if (input.gestor_id === input.colaborador_id) {
      return { ok: false, error: "Gestor e colaborador devem ser pessoas diferentes" };
    }
    if (!input.data_reuniao) {
      return { ok: false, error: "Selecione a data e hora da reunião" };
    }

    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(input.unit_id)) {
      return { ok: false, error: "Acesso não autorizado para esta unidade" };
    }

    const user = await requireUser();
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: reuniao, error: reuniaoError } = await supabase
      .from("reunioes_1on1")
      .insert({
        unit_id: input.unit_id,
        gestor_id: input.gestor_id,
        colaborador_id: input.colaborador_id,
        data_reuniao: input.data_reuniao,
        duracao_min: input.duracao_min ?? 30,
        status: "agendada",
        notas: input.notas?.trim() || null,
        created_by: user.id,
      } as never)
      .select()
      .single();

    if (reuniaoError || !reuniao) {
      return { ok: false, error: reuniaoError?.message ?? "Falha ao criar reunião" };
    }

    if (input.action_items.length > 0) {
      const validItems = input.action_items.filter((ai) => ai.descricao.trim().length > 0);
      if (validItems.length > 0) {
        const { error: aiError } = await supabase
          .from("reuniao_action_items")
          .insert(
            validItems.map((ai) => ({
              reuniao_id: (reuniao as Reuniao).id,
              descricao: ai.descricao.trim(),
              responsavel_id: ai.responsavel_id || null,
              prazo: ai.prazo || null,
              status: "pendente",
            }) as never),
          );
        if (aiError) console.error("[createReuniao] action_items:", aiError.message);
      }
    }

    revalidatePath("/pessoas/reunioes");
    return { ok: true, data: reuniao as Reuniao };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function updateReuniao(
  id: string,
  input: UpdateReuniaoInput,
): Promise<ActionResult<Reuniao>> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    if (unitIds !== null) {
      const { data: r } = await supabase
        .from("reunioes_1on1")
        .select("unit_id")
        .eq("id", id)
        .maybeSingle();
      const uid = (r as { unit_id: string } | null)?.unit_id;
      if (!uid || !unitIds.includes(uid)) {
        return { ok: false, error: "Acesso não autorizado" };
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.notas !== undefined) updates.notas = input.notas.trim() || null;
    if (input.status !== undefined) updates.status = input.status;

    const { data, error } = await supabase
      .from("reunioes_1on1")
      .update(updates as never)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar reunião" };
    }

    revalidatePath(`/pessoas/reunioes/${id}`);
    revalidatePath("/pessoas/reunioes");
    return { ok: true, data: data as Reuniao };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function updateActionItem(
  itemId: string,
  status: ActionItemStatus,
  reuniaoId: string,
): Promise<ActionResult<ActionItem>> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    if (unitIds !== null) {
      const { data: r } = await supabase
        .from("reunioes_1on1")
        .select("unit_id")
        .eq("id", reuniaoId)
        .maybeSingle();
      const uid = (r as { unit_id: string } | null)?.unit_id;
      if (!uid || !unitIds.includes(uid)) {
        return { ok: false, error: "Acesso não autorizado" };
      }
    }

    const { data, error } = await supabase
      .from("reuniao_action_items")
      .update({ status } as never)
      .eq("id", itemId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar action item" };
    }

    revalidatePath(`/pessoas/reunioes/${reuniaoId}`);
    return { ok: true, data: data as ActionItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function listGestoresEColaboradores(
  unitId: string,
): Promise<EmployeeStub[]> {
  try {
    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(unitId)) return [];

    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");

    if (error) return [];
    return (data ?? []) as EmployeeStub[];
  } catch {
    return [];
  }
}
