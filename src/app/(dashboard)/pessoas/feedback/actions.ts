"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";

const T = "feedbacks" as const;

export type FeedbackTipo = "positivo" | "desenvolvimento";
export type FeedbackCategoria =
  | "atendimento"
  | "trabalho_em_equipe"
  | "lideranca"
  | "pontualidade"
  | "tecnico"
  | "comportamento"
  | "outro";

export type Feedback = {
  id: string;
  unit_id: string;
  de_employee_id: string;
  para_employee_id: string;
  tipo: FeedbackTipo;
  categoria: FeedbackCategoria;
  mensagem: string;
  anonimo: boolean;
  created_at: string;
};

export type FeedbackWithNames = Feedback & {
  de_nome: string | null;
  para_nome: string | null;
};

export type EmployeeStub = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
};

export type CreateFeedbackInput = {
  unit_id: string;
  de_employee_id: string;
  para_employee_id: string;
  tipo: FeedbackTipo;
  categoria: FeedbackCategoria;
  mensagem: string;
  anonimo: boolean;
};

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

export async function listFeedbacksRecebidos(
  employeeId: string,
): Promise<FeedbackWithNames[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = Feedback & {
      de_emp: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
    };

    const { data, error } = await supabase
      .from(T)
      .select("*, de_emp:employees!de_employee_id(nome, sobrenome)")
      .eq("para_employee_id", employeeId)
      .order("created_at", { ascending: false })
      .returns<JoinRow[]>();

    if (error) {
      console.error("[listFeedbacksRecebidos]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const de = Array.isArray(r.de_emp) ? r.de_emp[0] : r.de_emp;
      const { de_emp, ...rest } = r;
      void de_emp;
      return {
        ...rest,
        de_nome: de ? `${de.nome} ${de.sobrenome}`.trim() : null,
        para_nome: null,
      } as FeedbackWithNames;
    });
  } catch (e) {
    console.error("[listFeedbacksRecebidos] exceção:", e);
    return [];
  }
}

export async function listFeedbacksEnviados(
  employeeId: string,
): Promise<FeedbackWithNames[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = Feedback & {
      para_emp: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
    };

    const { data, error } = await supabase
      .from(T)
      .select("*, para_emp:employees!para_employee_id(nome, sobrenome)")
      .eq("de_employee_id", employeeId)
      .order("created_at", { ascending: false })
      .returns<JoinRow[]>();

    if (error) {
      console.error("[listFeedbacksEnviados]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const para = Array.isArray(r.para_emp) ? r.para_emp[0] : r.para_emp;
      const { para_emp, ...rest } = r;
      void para_emp;
      return {
        ...rest,
        de_nome: null,
        para_nome: para ? `${para.nome} ${para.sobrenome}`.trim() : null,
      } as FeedbackWithNames;
    });
  } catch (e) {
    console.error("[listFeedbacksEnviados] exceção:", e);
    return [];
  }
}

export async function listColaboradoresParaFeedback(
  unitId: string,
  excludeEmployeeId?: string,
): Promise<EmployeeStub[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type Row = { id: string; nome: string; sobrenome: string; funcao: string };
    let q = supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("nome");

    if (excludeEmployeeId) {
      q = q.neq("id", excludeEmployeeId);
    }

    const { data, error } = await q.returns<Row[]>();
    if (error) {
      console.error("[listColaboradoresParaFeedback]", error.message);
      return [];
    }
    return (data ?? []) as EmployeeStub[];
  } catch (e) {
    console.error("[listColaboradoresParaFeedback] exceção:", e);
    return [];
  }
}

export async function createFeedback(
  input: CreateFeedbackInput,
): Promise<ActionResult<Feedback>> {
  try {
    if (!input.mensagem || input.mensagem.trim().length < 20) {
      return { ok: false, error: "Mensagem deve ter pelo menos 20 caracteres" };
    }
    if (input.de_employee_id === input.para_employee_id) {
      return { ok: false, error: "Não é possível dar feedback para si mesmo" };
    }

    await requireUser();
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(T)
      .insert({
        unit_id: input.unit_id,
        de_employee_id: input.de_employee_id,
        para_employee_id: input.para_employee_id,
        tipo: input.tipo,
        categoria: input.categoria,
        mensagem: input.mensagem.trim(),
        anonimo: input.anonimo,
      } as never)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar feedback" };
    }

    revalidatePath("/pessoas/feedback");
    return { ok: true, data: data as Feedback };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
