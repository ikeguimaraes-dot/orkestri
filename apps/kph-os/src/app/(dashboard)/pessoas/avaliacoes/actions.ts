"use server";

// Server Actions do módulo Avaliação de desempenho.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient, createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
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

// ── Ciclos 360° ──────────────────────────────────────────────

export type CicloStatus = "aberto" | "em_andamento" | "encerrado";

export type AvaliacaoCiclo = {
  id: string;
  unit_id: string;
  nome: string;
  template_id: string | null;
  status: CicloStatus;
  data_inicio: string;
  data_fim: string;
  created_by: string | null;
  created_at: string;
};

export type AvaliacaoParticipante = {
  id: string;
  ciclo_id: string;
  avaliado_id: string;
  avaliador_id: string;
  tipo_avaliador: "autoavaliacao" | "par" | "gestor" | "liderado";
  status: "pendente" | "concluido";
  review_id: string | null;
};

export type CreateCicloInput = {
  unit_id: string;
  nome: string;
  template_id: string | null;
  data_inicio: string;
  data_fim: string;
  participantes: Array<{
    avaliado_id: string;
    avaliador_id: string;
    tipo_avaliador: AvaliacaoParticipante["tipo_avaliador"];
  }>;
};

export type CicloComProgresso = AvaliacaoCiclo & {
  total: number;
  concluidos: number;
  template_nome: string | null;
};

export type ParticipanteDetalhado = AvaliacaoParticipante & {
  avaliado_nome: string;
  avaliado_sobrenome: string;
  avaliado_funcao: string;
  avaliador_nome: string;
  avaliador_sobrenome: string;
};

export type NineBoxResult = {
  employee_id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
  x: number;
  y: number;
  quadrante: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

function asAny(
  client: ReturnType<typeof createServiceClient>,
): AnyClient | null {
  return client as unknown as AnyClient | null;
}

export async function createCiclo(
  data: CreateCicloInput,
): Promise<ActionResult<AvaliacaoCiclo>> {
  try {
    const user = await requireUser();
    const db = asAny(createServiceClient());
    if (!db) return { ok: false, error: "Supabase indisponível" };

    if (!data.nome.trim()) return { ok: false, error: "Nome obrigatório" };
    if (!data.data_inicio || !data.data_fim)
      return { ok: false, error: "Datas obrigatórias" };

    const { data: ciclo, error: cicloErr } = await db
      .from("avaliacao_ciclos")
      .insert({
        unit_id: data.unit_id,
        nome: data.nome.trim(),
        template_id: data.template_id ?? null,
        status: "aberto",
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        created_by: user.id,
      })
      .select()
      .single();

    if (cicloErr || !ciclo) return { ok: false, error: cicloErr?.message ?? "Falha ao criar ciclo" };

    if (data.participantes.length > 0) {
      const rows = data.participantes.map((p) => ({
        ciclo_id: ciclo.id,
        avaliado_id: p.avaliado_id,
        avaliador_id: p.avaliador_id,
        tipo_avaliador: p.tipo_avaliador,
        status: "pendente",
      }));
      const { error: partErr } = await db
        .from("avaliacao_participantes")
        .insert(rows);
      if (partErr) console.warn("[createCiclo] participantes:", partErr.message);
    }

    revalidatePath("/pessoas/avaliacoes/ciclos");
    return { ok: true, data: ciclo as AvaliacaoCiclo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listCiclos(unitId: string): Promise<CicloComProgresso[]> {
  try {
    const db = asAny(createServiceClient());
    if (!db) return [];

    const { data: ciclos, error } = await db
      .from("avaliacao_ciclos")
      .select("*, template:performance_templates(nome)")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[listCiclos]", error.message);
      return [];
    }

    const ids = (ciclos ?? []).map((c: AvaliacaoCiclo) => c.id);
    if (ids.length === 0) return [];

    const { data: parts } = await db
      .from("avaliacao_participantes")
      .select("ciclo_id, status")
      .in("ciclo_id", ids);

    return (ciclos ?? []).map((c: AvaliacaoCiclo & { template: unknown }) => {
      const cParts = (parts ?? []).filter(
        (p: { ciclo_id: string; status: string }) => p.ciclo_id === c.id,
      );
      const template = Array.isArray(c.template) ? c.template[0] : c.template;
      return {
        id: c.id,
        unit_id: c.unit_id,
        nome: c.nome,
        template_id: c.template_id,
        status: c.status,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        created_by: c.created_by,
        created_at: c.created_at,
        total: cParts.length,
        concluidos: cParts.filter(
          (p: { status: string }) => p.status === "concluido",
        ).length,
        template_nome: (template as { nome?: string } | null)?.nome ?? null,
      } as CicloComProgresso;
    });
  } catch (e) {
    console.error("[listCiclos] exceção:", e);
    return [];
  }
}

export type CicloDetalhe = AvaliacaoCiclo & {
  template_nome: string | null;
  participantes: ParticipanteDetalhado[];
};

export async function getCicloComParticipantes(
  cicloId: string,
): Promise<CicloDetalhe | null> {
  try {
    const db = asAny(createServiceClient());
    if (!db) return null;

    const { data: ciclo, error: cicloErr } = await db
      .from("avaliacao_ciclos")
      .select("*, template:performance_templates(nome)")
      .eq("id", cicloId)
      .maybeSingle();

    if (cicloErr || !ciclo) return null;

    const { data: parts, error: partsErr } = await db
      .from("avaliacao_participantes")
      .select(
        "*, avaliado:employees!avaliado_id(nome, sobrenome, funcao), avaliador:employees!avaliador_id(nome, sobrenome)",
      )
      .eq("ciclo_id", cicloId)
      .order("avaliado_id");

    if (partsErr) console.error("[getCicloComParticipantes] parts:", partsErr.message);

    const template = Array.isArray(ciclo.template) ? ciclo.template[0] : ciclo.template;

    type RawPart = {
      id: string;
      ciclo_id: string;
      avaliado_id: string;
      avaliador_id: string;
      tipo_avaliador: string;
      status: string;
      review_id: string | null;
      avaliado: unknown;
      avaliador: unknown;
    };

    const participantes: ParticipanteDetalhado[] = (parts ?? []).map((p: RawPart) => {
      const avaliado = Array.isArray(p.avaliado) ? p.avaliado[0] : p.avaliado;
      const avaliador = Array.isArray(p.avaliador) ? p.avaliador[0] : p.avaliador;
      return {
        id: p.id,
        ciclo_id: p.ciclo_id,
        avaliado_id: p.avaliado_id,
        avaliador_id: p.avaliador_id,
        tipo_avaliador: p.tipo_avaliador as AvaliacaoParticipante["tipo_avaliador"],
        status: p.status as "pendente" | "concluido",
        review_id: p.review_id ?? null,
        avaliado_nome: (avaliado as { nome?: string } | null)?.nome ?? "—",
        avaliado_sobrenome: (avaliado as { sobrenome?: string } | null)?.sobrenome ?? "",
        avaliado_funcao: (avaliado as { funcao?: string } | null)?.funcao ?? "—",
        avaliador_nome: (avaliador as { nome?: string } | null)?.nome ?? "—",
        avaliador_sobrenome: (avaliador as { sobrenome?: string } | null)?.sobrenome ?? "",
      };
    });

    return {
      id: ciclo.id,
      unit_id: ciclo.unit_id,
      nome: ciclo.nome,
      template_id: ciclo.template_id,
      status: ciclo.status as CicloStatus,
      data_inicio: ciclo.data_inicio,
      data_fim: ciclo.data_fim,
      created_by: ciclo.created_by,
      created_at: ciclo.created_at,
      template_nome: (template as { nome?: string } | null)?.nome ?? null,
      participantes,
    };
  } catch (e) {
    console.error("[getCicloComParticipantes] exceção:", e);
    return null;
  }
}

export async function calcular9Box(cicloId: string): Promise<NineBoxResult[]> {
  try {
    const db = asAny(createServiceClient());
    if (!db) return [];

    type PartRow = { avaliado_id: string; review_id: string | null; tipo_avaliador: string };

    // Carrega participantes com review_id preenchido (concluídos)
    const { data: parts, error: partsErr } = await db
      .from("avaliacao_participantes")
      .select("avaliado_id, review_id, tipo_avaliador")
      .eq("ciclo_id", cicloId)
      .eq("status", "concluido")
      .not("review_id", "is", null);

    if (partsErr || !parts?.length) return [];

    const reviewIds = (parts as PartRow[]).map((p) => p.review_id as string);

    // performance_reviews existe nos tipos — usa supabase direto
    const supabase = createServiceClient();
    if (!supabase) return [];

    const { data: reviews, error: revErr } = await supabase
      .from("performance_reviews")
      .select("id, nota_geral, respostas, template_id")
      .in("id", reviewIds);

    if (revErr || !reviews?.length) return [];

    type EmpRow = { id: string; nome: string; sobrenome: string; funcao: string };
    type ReviewRow = { id: string; nota_geral: string | number | null };

    // Carrega dados dos avaliados únicos
    const avaliadoIds = [...new Set((parts as PartRow[]).map((p) => p.avaliado_id))];
    const { data: employees } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao")
      .in("id", avaliadoIds);

    const empMap = new Map<string, EmpRow>(
      ((employees ?? []) as EmpRow[]).map((e) => [e.id, e]),
    );
    const reviewMap = new Map<string, ReviewRow>(
      ((reviews ?? []) as ReviewRow[]).map((r) => [r.id, r]),
    );

    // Agrega: X = média nota_geral dos avaliadores externos (par/gestor/liderado)
    //         Y = autoavaliação (potencial)
    const aggMap = new Map<
      string,
      { xSum: number; xCount: number; ySum: number; yCount: number }
    >();

    for (const p of parts as PartRow[]) {
      const review = reviewMap.get(p.review_id as string);
      if (!review) continue;

      const nota = review.nota_geral != null ? Number(review.nota_geral) : null;
      if (nota == null || !Number.isFinite(nota)) continue;

      const entry = aggMap.get(p.avaliado_id) ?? { xSum: 0, xCount: 0, ySum: 0, yCount: 0 };

      if (p.tipo_avaliador === "autoavaliacao") {
        entry.ySum += nota;
        entry.yCount += 1;
      } else {
        entry.xSum += nota;
        entry.xCount += 1;
      }

      aggMap.set(p.avaliado_id, entry);
    }

    const results: NineBoxResult[] = [];
    for (const [empId, agg] of aggMap) {
      const emp = empMap.get(empId);
      if (!emp) continue;

      const x = agg.xCount > 0 ? Math.round((agg.xSum / agg.xCount) * 100) / 100 : 0;
      const y = agg.yCount > 0 ? Math.round((agg.ySum / agg.yCount) * 100) / 100 : x;

      // Quadrante 1-9: col (x) 1-3 da esquerda, row (y) 1-3 de baixo
      const col = x <= 2 ? 1 : x <= 3.5 ? 2 : 3;
      const row = y <= 2 ? 1 : y <= 3.5 ? 2 : 3;
      const quadrante = (row - 1) * 3 + col;

      results.push({
        employee_id: empId,
        nome: emp.nome,
        sobrenome: emp.sobrenome,
        funcao: emp.funcao,
        x,
        y,
        quadrante,
      });
    }

    return results;
  } catch (e) {
    console.error("[calcular9Box] exceção:", e);
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────

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
