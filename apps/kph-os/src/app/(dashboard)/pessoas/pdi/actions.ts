"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";

export type PdiStatus = "ativo" | "concluido" | "cancelado";
export type MetaStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";

export type Pdi = {
  id: string;
  unit_id: string;
  employee_id: string;
  titulo: string;
  status: PdiStatus;
  data_inicio: string;
  data_fim: string;
  avaliacao_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type PdiMeta = {
  id: string;
  pdi_id: string;
  descricao: string;
  prazo: string;
  status: MetaStatus;
  progresso: number;
};

export type PdiWithMetas = Pdi & { metas: PdiMeta[] };

export type PdiPage = {
  data: PdiWithMetas[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type EmployeeStub = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
};

export type CreatePdiInput = {
  unit_id: string;
  employee_id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  avaliacao_id?: string;
  metas: { descricao: string; prazo: string }[];
};

/**
 * Retorna os unit_ids autorizados para o usuário logado via user_roles.
 * null = acesso irrestrito (founder / bypass sem linhas em user_roles).
 */
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

export async function getEmployeeByUser(
  userId: string,
  unitId: string,
): Promise<EmployeeStub | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao")
      .eq("unit_id", unitId)
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();
    return (data as EmployeeStub | null) ?? null;
  } catch {
    return null;
  }
}

export async function listPdis(
  employeeId: string,
  page = 1,
  pageSize = 20,
): Promise<PdiPage> {
  const empty: PdiPage = { data: [], count: 0, page, pageSize, totalPages: 0 };
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = await createSupabaseServerClient();
    if (!supabase) return empty;

    // Verifica se o employee pertence a uma unidade autorizada
    if (unitIds !== null) {
      const { data: emp } = await supabase
        .from("employees")
        .select("unit_id")
        .eq("id", employeeId)
        .maybeSingle();
      const empUnitId = (emp as { unit_id: string } | null)?.unit_id;
      if (!empUnitId || !unitIds.includes(empUnitId)) {
        console.warn("[listPdis] acesso não autorizado ao employee:", employeeId);
        return empty;
      }
    }

    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    const { data, error, count } = await supabase
      .from("pdis")
      .select("*, metas:pdi_metas(*)", { count: "exact" })
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[listPdis]", error.message);
      return empty;
    }

    const total = count ?? 0;
    return {
      data: (data ?? []) as PdiWithMetas[],
      count: total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (e) {
    console.error("[listPdis] exceção:", e);
    return empty;
  }
}

export async function getPdi(pdiId: string): Promise<PdiWithMetas | null> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    let q = supabase
      .from("pdis")
      .select("*, metas:pdi_metas(*)")
      .eq("id", pdiId);

    if (unitIds !== null) {
      q = (q as any).in("unit_id", unitIds);
    }

    const { data, error } = await (q as any).single();
    if (error || !data) return null;
    return data as PdiWithMetas;
  } catch {
    return null;
  }
}

export async function createPdi(
  input: CreatePdiInput,
): Promise<ActionResult<Pdi>> {
  try {
    if (!input.titulo || input.titulo.trim().length < 3) {
      return { ok: false, error: "Título deve ter pelo menos 3 caracteres" };
    }
    if (input.metas.length === 0) {
      return { ok: false, error: "Adicione ao menos uma meta ao PDI" };
    }
    if (input.data_fim <= input.data_inicio) {
      return { ok: false, error: "Data de término deve ser posterior ao início" };
    }

    const unitIds = await getAuthorizedUnitIds();
    if (unitIds !== null && !unitIds.includes(input.unit_id)) {
      return { ok: false, error: "Acesso não autorizado para esta unidade" };
    }

    const user = await requireUser();
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: pdi, error: pdiError } = await supabase
      .from("pdis")
      .insert({
        unit_id: input.unit_id,
        employee_id: input.employee_id,
        titulo: input.titulo.trim(),
        status: "ativo",
        data_inicio: input.data_inicio,
        data_fim: input.data_fim,
        avaliacao_id: input.avaliacao_id ?? null,
        created_by: user.id,
      } as never)
      .select()
      .single();

    if (pdiError || !pdi) {
      return { ok: false, error: pdiError?.message ?? "Falha ao criar PDI" };
    }

    const { error: metasError } = await supabase
      .from("pdi_metas")
      .insert(
        input.metas.map((m) => ({
          pdi_id: (pdi as Pdi).id,
          descricao: m.descricao.trim(),
          prazo: m.prazo,
          status: "pendente",
          progresso: 0,
        }) as never),
      );

    if (metasError) {
      console.error("[createPdi] metas:", metasError.message);
    }

    revalidatePath("/pessoas/pdi");
    return { ok: true, data: pdi as Pdi };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function updateMetaProgresso(
  metaId: string,
  progresso: number,
  status: MetaStatus,
  pdiId: string,
): Promise<ActionResult<PdiMeta>> {
  try {
    const unitIds = await getAuthorizedUnitIds();

    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Verifica que o PDI pertence a uma unidade autorizada
    if (unitIds !== null) {
      const { data: pdi } = await supabase
        .from("pdis")
        .select("unit_id")
        .eq("id", pdiId)
        .maybeSingle();
      const pdiUnitId = (pdi as { unit_id: string } | null)?.unit_id;
      if (!pdiUnitId || !unitIds.includes(pdiUnitId)) {
        return { ok: false, error: "Acesso não autorizado" };
      }
    }

    const clamped = Math.max(0, Math.min(100, Math.round(progresso)));
    const { data, error } = await supabase
      .from("pdi_metas")
      .update({ progresso: clamped, status } as never)
      .eq("id", metaId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar meta" };
    }

    revalidatePath(`/pessoas/pdi/${pdiId}`);
    return { ok: true, data: data as PdiMeta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
