"use server";

// Server Actions do módulo Treinamentos / Onboarding.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  trainingRecordSchema,
  trainingRecordUpdateSchema,
  trainingTemplateSchema,
  trainingTemplateUpdateSchema,
  type TrainingRecordFormValues,
  type TrainingRecordUpdateValues,
  type TrainingTemplateFormValues,
  type TrainingTemplateUpdateValues,
} from "@/lib/treinamentos/schema";
import type {
  TrainingRecord,
  TrainingRecordWithEmployee,
  TrainingRecordWithTemplate,
  TrainingTemplate,
  TrainingTemplateWithBrand,
} from "@/lib/treinamentos/types";

const T_TPL = "training_templates" as const;
const T_REC = "training_records" as const;

// ── Templates ────────────────────────────────────────────────

export async function listTrainingTemplates(
  brandId?: string | null,
): Promise<TrainingTemplateWithBrand[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = TrainingTemplate & {
      brand: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
      unit: { name: string } | { name: string }[] | null;
      records: { count: number }[] | null;
    };

    let q = supabase
      .from(T_TPL)
      .select(
        "*, brand:brands(name, color), unit:units(name), records:training_records(count)",
      )
      .order("ativo", { ascending: false })
      .order("obrigatorio", { ascending: false })
      .order("nome");
    if (brandId) q = q.eq("brand_id", brandId);

    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listTrainingTemplates]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const b = Array.isArray(r.brand) ? r.brand[0] : r.brand;
      const u = Array.isArray(r.unit) ? r.unit[0] : r.unit;
      const recCount = r.records?.[0]?.count ?? 0;
      const { brand, unit, records, ...rest } = r;
      void brand; void unit; void records;
      return {
        ...rest,
        brand_name: b?.name ?? null,
        brand_color: b?.color ?? null,
        unit_name: u?.name ?? null,
        records_count: recCount,
      } as TrainingTemplateWithBrand;
    });
  } catch (e) {
    console.error("[listTrainingTemplates] exceção:", e);
    return [];
  }
}

export async function getTrainingTemplate(
  id: string,
): Promise<TrainingTemplate | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(T_TPL)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getTrainingTemplate]", error.message);
      return null;
    }
    return (data as TrainingTemplate | null) ?? null;
  } catch (e) {
    console.error("[getTrainingTemplate] exceção:", e);
    return null;
  }
}

export async function createTrainingTemplate(
  input: TrainingTemplateFormValues,
): Promise<ActionResult<TrainingTemplate>> {
  try {
    const parsed = trainingTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      brand_id: parsed.data.brand_id,
      unit_id: parsed.data.unit_id ?? null,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      funcao: parsed.data.funcao ?? null,
      obrigatorio: parsed.data.obrigatorio ?? false,
      validade_dias: parsed.data.validade_dias ?? null,
      ativo: parsed.data.ativo ?? true,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_TPL)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/treinamentos");
    return { ok: true, data: data as TrainingTemplate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateTrainingTemplate(
  id: string,
  patch: TrainingTemplateUpdateValues,
): Promise<ActionResult<TrainingTemplate>> {
  try {
    const parsed = trainingTemplateUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(T_TPL)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/treinamentos");
    revalidatePath(`/pessoas/treinamentos/${id}`);
    return { ok: true, data: data as TrainingTemplate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Records ──────────────────────────────────────────────────

/** Records de um template + employee anexo. */
export async function listRecordsForTemplate(
  templateId: string,
): Promise<TrainingRecordWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = TrainingRecord & {
      employee: {
        id: string;
        nome: string;
        sobrenome: string;
        funcao: string;
        departamento: string | null;
      } | { id: string; nome: string; sobrenome: string; funcao: string; departamento: string | null }[] | null;
    };

    const { data, error } = await supabase
      .from(T_REC)
      .select(
        "*, employee:employees(id, nome, sobrenome, funcao, departamento)",
      )
      .eq("template_id", templateId)
      .returns<JoinRow[]>();
    if (error) {
      console.error("[listRecordsForTemplate]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const e = Array.isArray(r.employee) ? r.employee[0] : r.employee;
      const { employee, ...rest } = r;
      void employee;
      return {
        ...rest,
        employee: e
          ? {
              id: e.id,
              nome: e.nome,
              sobrenome: e.sobrenome,
              funcao: e.funcao,
              departamento: e.departamento,
            }
          : null,
      } as TrainingRecordWithEmployee;
    });
  } catch (e) {
    console.error("[listRecordsForTemplate] exceção:", e);
    return [];
  }
}

/** Records de um colaborador + template anexo. */
export async function listRecordsForEmployee(
  employeeId: string,
): Promise<TrainingRecordWithTemplate[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = TrainingRecord & {
      template: {
        id: string;
        nome: string;
        descricao: string | null;
        funcao: string | null;
        obrigatorio: boolean;
        validade_dias: number | null;
      } | { id: string; nome: string; descricao: string | null; funcao: string | null; obrigatorio: boolean; validade_dias: number | null }[] | null;
    };

    const { data, error } = await supabase
      .from(T_REC)
      .select(
        "*, template:training_templates(id, nome, descricao, funcao, obrigatorio, validade_dias)",
      )
      .eq("employee_id", employeeId)
      .returns<JoinRow[]>();
    if (error) {
      console.error("[listRecordsForEmployee]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const t = Array.isArray(r.template) ? r.template[0] : r.template;
      const { template, ...rest } = r;
      void template;
      return {
        ...rest,
        template: t ?? null,
      } as TrainingRecordWithTemplate;
    });
  } catch (e) {
    console.error("[listRecordsForEmployee] exceção:", e);
    return [];
  }
}

/**
 * Cria/atualiza um record. Se já existe (UNIQUE employee+template), faz
 * upsert. Captura `validade_dias_snapshot` lendo do template.
 */
export async function upsertTrainingRecord(
  input: TrainingRecordFormValues,
): Promise<ActionResult<TrainingRecord>> {
  try {
    const parsed = trainingRecordSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Snapshot da validade do template
    const { data: tpl } = await supabase
      .from(T_TPL)
      .select("validade_dias")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    const snapshot = tpl
      ? (tpl as { validade_dias: number | null }).validade_dias ?? null
      : null;

    const payload = {
      employee_id: parsed.data.employee_id,
      template_id: parsed.data.template_id,
      status: parsed.data.status ?? "pendente",
      data_inicio: parsed.data.data_inicio ?? null,
      data_conclusao: parsed.data.data_conclusao ?? null,
      validade_dias_snapshot: snapshot,
      observacoes: parsed.data.observacoes ?? null,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_REC)
      .upsert(payload as never, { onConflict: "employee_id,template_id" })
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/treinamentos");
    revalidatePath(`/pessoas/treinamentos/${parsed.data.template_id}`);
    revalidatePath(`/pessoas/colaboradores/${parsed.data.employee_id}`);
    return { ok: true, data: data as TrainingRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateTrainingRecord(
  id: string,
  patch: TrainingRecordUpdateValues,
): Promise<ActionResult<TrainingRecord>> {
  try {
    const parsed = trainingRecordUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(T_REC)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/treinamentos");
    return { ok: true, data: data as TrainingRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
