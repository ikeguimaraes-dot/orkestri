"use server";

// Server Actions do módulo Avaliação de desempenho.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { createNotification } from "@/lib/notifications/actions";
import type { ActionResult } from "@/lib/result";
import {
  performanceReviewSchema,
  performanceReviewUpdateSchema,
  performanceTemplateSchema,
  performanceTemplateUpdateSchema,
  type PerformanceReviewFormValues,
  type PerformanceReviewUpdateValues,
  type PerformanceTemplateFormValues,
  type PerformanceTemplateUpdateValues,
} from "@/lib/avaliacoes/schema";
import type {
  PerformanceReview,
  PerformanceReviewWithEmployee,
  PerformanceReviewWithTemplate,
  PerformanceTemplate,
  PerformanceTemplateWithBrand,
} from "@/lib/avaliacoes/types";

const T_TPL = "performance_templates" as const;
const T_REV = "performance_reviews" as const;

// ── Templates ────────────────────────────────────────────────

export async function listPerformanceTemplates(
  brandId?: string | null,
): Promise<PerformanceTemplateWithBrand[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = PerformanceTemplate & {
      brand: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
      unit: { name: string } | { name: string }[] | null;
      reviews: { count: number }[] | null;
    };

    let q = supabase
      .from(T_TPL)
      .select(
        "*, brand:brands(name, color), unit:units(name), reviews:performance_reviews(count)",
      )
      .order("ativo", { ascending: false })
      .order("nome");
    if (brandId) q = q.eq("brand_id", brandId);

    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listPerformanceTemplates]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const b = Array.isArray(r.brand) ? r.brand[0] : r.brand;
      const u = Array.isArray(r.unit) ? r.unit[0] : r.unit;
      const recCount = r.reviews?.[0]?.count ?? 0;
      const { brand, unit, reviews, ...rest } = r;
      void brand;
      void unit;
      void reviews;
      return {
        ...rest,
        brand_name: b?.name ?? null,
        brand_color: b?.color ?? null,
        unit_name: u?.name ?? null,
        reviews_count: recCount,
      } as PerformanceTemplateWithBrand;
    });
  } catch (e) {
    console.error("[listPerformanceTemplates] exceção:", e);
    return [];
  }
}

export async function getPerformanceTemplate(
  id: string,
): Promise<PerformanceTemplate | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(T_TPL)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getPerformanceTemplate]", error.message);
      return null;
    }
    return (data as PerformanceTemplate | null) ?? null;
  } catch (e) {
    console.error("[getPerformanceTemplate] exceção:", e);
    return null;
  }
}

export async function createPerformanceTemplate(
  input: PerformanceTemplateFormValues,
): Promise<ActionResult<PerformanceTemplate>> {
  try {
    const parsed = performanceTemplateSchema.safeParse(input);
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
      periodicidade: parsed.data.periodicidade,
      criterios: parsed.data.criterios ?? [],
      ativo: parsed.data.ativo ?? true,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_TPL)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/avaliacoes");
    revalidatePath("/pessoas/avaliacoes/templates");
    return { ok: true, data: data as PerformanceTemplate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updatePerformanceTemplate(
  id: string,
  patch: PerformanceTemplateUpdateValues,
): Promise<ActionResult<PerformanceTemplate>> {
  try {
    const parsed = performanceTemplateUpdateSchema.safeParse(patch);
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

    revalidatePath("/pessoas/avaliacoes");
    revalidatePath("/pessoas/avaliacoes/templates");
    revalidatePath(`/pessoas/avaliacoes/templates/${id}`);
    return { ok: true, data: data as PerformanceTemplate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Reviews ──────────────────────────────────────────────────

export type ReviewListFilters = {
  brandId?: string | null;
  unitId?: string | null;
  status?: PerformanceReview["status"] | null;
  funcao?: string | null;
  periodo?: string | null;
};

/** Listagem geral de reviews (com employee + template_nome). */
export async function listPerformanceReviews(
  filters: ReviewListFilters = {},
): Promise<PerformanceReviewWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = PerformanceReview & {
      employee: {
        id: string;
        nome: string;
        sobrenome: string;
        funcao: string;
        departamento: string | null;
        unit_id: string | null;
      } | { id: string; nome: string; sobrenome: string; funcao: string; departamento: string | null; unit_id: string | null }[] | null;
      template: { id: string; nome: string; brand_id: string | null } | { id: string; nome: string; brand_id: string | null }[] | null;
    };

    let q = supabase
      .from(T_REV)
      .select(
        "*, employee:employees(id, nome, sobrenome, funcao, departamento, unit_id), template:performance_templates(id, nome, brand_id)",
      )
      .order("data_avaliacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.periodo) q = q.eq("periodo", filters.periodo);

    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listPerformanceReviews]", error.message);
      return [];
    }

    return (data ?? [])
      .map((r) => {
        const e = Array.isArray(r.employee) ? r.employee[0] : r.employee;
        const t = Array.isArray(r.template) ? r.template[0] : r.template;
        const { employee, template, ...rest } = r;
        void employee;
        void template;
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
          template_nome: t?.nome ?? null,
          // expose extras pra filtros client-side
          _employee_unit_id: e?.unit_id ?? null,
          _template_brand_id: t?.brand_id ?? null,
        } as PerformanceReviewWithEmployee & {
          _employee_unit_id: string | null;
          _template_brand_id: string | null;
        };
      })
      .filter((r) => {
        if (filters.brandId && r._template_brand_id !== filters.brandId) return false;
        if (filters.unitId && r._employee_unit_id !== filters.unitId) return false;
        if (filters.funcao && r.employee?.funcao !== filters.funcao) return false;
        return true;
      });
  } catch (e) {
    console.error("[listPerformanceReviews] exceção:", e);
    return [];
  }
}

/** Reviews de um colaborador (com template anexo). Ordenado por data_avaliacao. */
export async function listReviewsForEmployee(
  employeeId: string,
): Promise<PerformanceReviewWithTemplate[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type JoinRow = PerformanceReview & {
      template: {
        id: string;
        nome: string;
        descricao: string | null;
        funcao: string | null;
        periodicidade: string;
        criterios: unknown;
      } | { id: string; nome: string; descricao: string | null; funcao: string | null; periodicidade: string; criterios: unknown }[] | null;
    };

    const { data, error } = await supabase
      .from(T_REV)
      .select(
        "*, template:performance_templates(id, nome, descricao, funcao, periodicidade, criterios)",
      )
      .eq("employee_id", employeeId)
      .order("data_avaliacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<JoinRow[]>();
    if (error) {
      console.error("[listReviewsForEmployee]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const t = Array.isArray(r.template) ? r.template[0] : r.template;
      const { template, ...rest } = r;
      void template;
      return {
        ...rest,
        template: t
          ? ({
              id: t.id,
              nome: t.nome,
              descricao: t.descricao,
              funcao: t.funcao,
              periodicidade: t.periodicidade,
              criterios: t.criterios,
            } as PerformanceReviewWithTemplate["template"])
          : null,
      } as PerformanceReviewWithTemplate;
    });
  } catch (e) {
    console.error("[listReviewsForEmployee] exceção:", e);
    return [];
  }
}

export async function getPerformanceReview(
  id: string,
): Promise<PerformanceReviewWithTemplate | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    type JoinRow = PerformanceReview & {
      template: {
        id: string;
        nome: string;
        descricao: string | null;
        funcao: string | null;
        periodicidade: string;
        criterios: unknown;
      } | { id: string; nome: string; descricao: string | null; funcao: string | null; periodicidade: string; criterios: unknown }[] | null;
    };

    const { data, error } = await supabase
      .from(T_REV)
      .select(
        "*, template:performance_templates(id, nome, descricao, funcao, periodicidade, criterios)",
      )
      .eq("id", id)
      .maybeSingle()
      .returns<JoinRow>();
    if (error || !data) return null;
    const t = Array.isArray(data.template) ? data.template[0] : data.template;
    const { template, ...rest } = data;
    void template;
    return {
      ...rest,
      template: t
        ? ({
            id: t.id,
            nome: t.nome,
            descricao: t.descricao,
            funcao: t.funcao,
            periodicidade: t.periodicidade,
            criterios: t.criterios,
          } as PerformanceReviewWithTemplate["template"])
        : null,
    } as PerformanceReviewWithTemplate;
  } catch (e) {
    console.error("[getPerformanceReview] exceção:", e);
    return null;
  }
}

export async function createPerformanceReview(
  input: PerformanceReviewFormValues,
): Promise<ActionResult<PerformanceReview>> {
  try {
    const parsed = performanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      employee_id: parsed.data.employee_id,
      template_id: parsed.data.template_id,
      avaliador_id: user.id,
      periodo: parsed.data.periodo,
      status: parsed.data.status ?? "rascunho",
      nota_geral: parsed.data.nota_geral ?? null,
      respostas: parsed.data.respostas ?? {},
      pontos_fortes: parsed.data.pontos_fortes ?? null,
      pontos_melhoria: parsed.data.pontos_melhoria ?? null,
      plano_acao: parsed.data.plano_acao ?? null,
      data_avaliacao: parsed.data.data_avaliacao ?? null,
    };
    const { data, error } = await supabase
      .from(T_REV)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/pessoas/avaliacoes");
    revalidatePath(`/pessoas/colaboradores/${parsed.data.employee_id}`);
    return { ok: true, data: data as PerformanceReview };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updatePerformanceReview(
  id: string,
  patch: PerformanceReviewUpdateValues,
): Promise<ActionResult<PerformanceReview>> {
  try {
    const parsed = performanceReviewUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Estado anterior pra detectar transição rascunho → concluida/aprovada
    const { data: prev } = await supabase
      .from(T_REV)
      .select("status, employee_id")
      .eq("id", id)
      .maybeSingle();
    const prevStatus = (prev as { status: string } | null)?.status ?? null;

    const { data, error } = await supabase
      .from(T_REV)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    const review = data as PerformanceReview;

    // Notificação: rascunho → concluida/aprovada notifica o avaliado.
    // Concluida → aprovada também notifica (mudança meaningful).
    const newStatus = review.status;
    const transitioned =
      prevStatus !== newStatus &&
      (newStatus === "concluida" || newStatus === "aprovada");
    if (transitioned) {
      await notifyAvaliado(supabase, review);
    }

    revalidatePath("/pessoas/avaliacoes");
    revalidatePath(`/pessoas/colaboradores/${review.employee_id}`);
    return { ok: true, data: review };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Lookup employee.user_id e dispara notificação. Best-effort — não falha o action. */
async function notifyAvaliado(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  review: PerformanceReview,
): Promise<void> {
  try {
    const { data: emp } = await supabase
      .from("employees")
      .select("user_id, nome")
      .eq("id", review.employee_id)
      .maybeSingle();
    const employee = emp as { user_id: string | null; nome: string } | null;
    if (!employee?.user_id) return;
    const titulo =
      review.status === "aprovada"
        ? "Avaliação aprovada"
        : "Avaliação concluída";
    const mensagem = `Sua avaliação de ${review.periodo} foi ${review.status === "aprovada" ? "aprovada" : "concluída"}.`;
    await createNotification(
      employee.user_id,
      "avaliacao_concluida",
      titulo,
      mensagem,
      `/pessoas/colaboradores/${review.employee_id}?tab=avaliacoes`,
    );
  } catch (e) {
    console.warn("[notifyAvaliado] falha:", e);
  }
}
