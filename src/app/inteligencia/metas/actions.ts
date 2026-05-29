"use server";

// Server Actions do módulo Metas por marca.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { createOperationsClient } from "@kph/db/supabase/operations-client";
import { requireUser } from "@kph/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  brandTargetSchema,
  brandTargetUpdateSchema,
  targetNoteSchema,
  type BrandTargetFormValues,
  type BrandTargetUpdateValues,
  type TargetNoteFormValues,
} from "@/lib/metas/schema";
import {
  periodoToDate,
  toNumber,
  type BrandTarget,
  type BrandTargetWithRealizado,
  type RealizadoSnapshot,
  type TargetNote,
} from "@/lib/metas/types";

const T_TARGETS = "brand_targets" as const;
const T_NOTES = "target_notes" as const;

/**
 * Lista marcas acessíveis com meta + realizado pra um período.
 * Realizado vem das views v_dre_consolidado, v_eventos_kpi, v_headcount_por_marca.
 * Headcount é "estado atual" — não tem fatiamento por período histórico.
 */
export async function listMetasForPeriodo(
  periodo: string,
): Promise<BrandTargetWithRealizado[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const competencia = periodoToDate(periodo);
    if (!competencia) return [];

    // 1) Brands acessíveis (RLS aplica)
    const { data: brandsData, error: brandsErr } = await supabase
      .from("brands")
      .select("id, name, slug, color")
      .eq("active", true)
      .order("name");
    if (brandsErr) {
      console.error("[listMetasForPeriodo] brands:", brandsErr.message);
      return [];
    }
    const brands = (brandsData ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      color: string;
    }>;

    if (brands.length === 0) return [];

    const brandIds = brands.map((b) => b.id);

    // 2) Targets do período pra essas brands
    const { data: targetsData } = await supabase
      .from(T_TARGETS)
      .select("*")
      .in("brand_id", brandIds)
      .eq("periodo", periodo);
    const targetByBrand = new Map<string, BrandTarget>();
    for (const t of (targetsData ?? []) as BrandTarget[]) {
      targetByBrand.set(t.brand_id, t);
    }

    // 3) DRE consolidado da competência
    const { data: dreData } = await supabase
      .from("v_dre_consolidado")
      .select("brand_id, receita_bruta, cmv_pct, prime_cost_pct")
      .in("brand_id", brandIds)
      .eq("competencia", competencia);
    const dreByBrand = new Map<
      string,
      { receita: number | null; cmv_pct: number | null; prime_pct: number | null }
    >();
    for (const r of (dreData ?? []) as Array<{
      brand_id: string;
      receita_bruta: number | string | null;
      cmv_pct: number | string | null;
      prime_cost_pct: number | string | null;
    }>) {
      dreByBrand.set(r.brand_id, {
        receita: toNumber(r.receita_bruta),
        cmv_pct: toNumber(r.cmv_pct),
        prime_pct: toNumber(r.prime_cost_pct),
      });
    }

    // 3b) Fallback Meet & Eat: vendas_diarias (MTD) quando v_dre_consolidado está vazio
    // vendas_diarias = import PDV automático, sem brand_id — implicitamente Meet & Eat
    const meetEatBrand = brands.find((b) => b.slug === "meet-and-eat");
    if (meetEatBrand && !dreByBrand.has(meetEatBrand.id)) {
      const ops = createOperationsClient();
      if (ops) {
        const [y, m] = competencia.split("-");
        const year = parseInt(y ?? "1970", 10);
        const month = parseInt(m ?? "1", 10);
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, "0");
        const dateTo = `${year}-${pad(month)}-${lastDay}`;
        const { data: vendasMes } = await ops
          .from("vendas_diarias")
          .select("faturamento_bruto")
          .gte("data_venda", competencia)
          .lte("data_venda", dateTo)
          .returns<Array<{ faturamento_bruto: number | null }>>();
        const totalVendas = (vendasMes ?? []).reduce(
          (s, r) => s + (r.faturamento_bruto ?? 0),
          0,
        );
        if (totalVendas > 0) {
          dreByBrand.set(meetEatBrand.id, { receita: totalVendas, cmv_pct: null, prime_pct: null });
        }
      }
    }

    // 4) Eventos KPI da competência
    const { data: eventosData } = await supabase
      .from("v_eventos_kpi")
      .select("brand_id, total_eventos")
      .in("brand_id", brandIds)
      .eq("mes", competencia);
    const eventosByBrand = new Map<string, number>();
    for (const r of (eventosData ?? []) as Array<{
      brand_id: string;
      total_eventos: number | string | null;
    }>) {
      const n = toNumber(r.total_eventos);
      if (n != null) eventosByBrand.set(r.brand_id, n);
    }

    // 5) Headcount (estado atual)
    const { data: headData } = await supabase
      .from("v_headcount_por_marca")
      .select("brand_id, headcount_ativo")
      .in("brand_id", brandIds);
    const headByBrand = new Map<string, number>();
    for (const r of (headData ?? []) as Array<{
      brand_id: string;
      headcount_ativo: number | string | null;
    }>) {
      const n = toNumber(r.headcount_ativo);
      if (n != null) headByBrand.set(r.brand_id, n);
    }

    // 6) Monta resultado
    return brands.map((b) => {
      const dre = dreByBrand.get(b.id);
      const realizado: RealizadoSnapshot = {
        receita_realizada: dre?.receita ?? null,
        cmv_pct: dre?.cmv_pct ?? null,
        prime_cost_pct: dre?.prime_pct ?? null,
        ticket_medio: null,
        nps: null,
        headcount: headByBrand.get(b.id) ?? null,
        eventos: eventosByBrand.get(b.id) ?? null,
      };
      return {
        brand_id: b.id,
        brand_name: b.name,
        brand_slug: b.slug,
        brand_color: b.color ?? null,
        periodo,
        target: targetByBrand.get(b.id) ?? null,
        realizado,
      };
    });
  } catch (e) {
    console.error("[listMetasForPeriodo] exceção:", e);
    return [];
  }
}

/** Histórico de targets de uma brand (todos os períodos), ordenado periodo DESC. */
export async function listTargetsByBrand(
  brandId: string,
): Promise<BrandTarget[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(T_TARGETS)
      .select("*")
      .eq("brand_id", brandId)
      .order("periodo", { ascending: false });
    if (error) {
      console.error("[listTargetsByBrand]", error.message);
      return [];
    }
    return (data ?? []) as BrandTarget[];
  } catch (e) {
    console.error("[listTargetsByBrand] exceção:", e);
    return [];
  }
}

/** Pega target de uma brand+periodo (ou null). */
export async function getTarget(
  brandId: string,
  periodo: string,
): Promise<BrandTarget | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from(T_TARGETS)
      .select("*")
      .eq("brand_id", brandId)
      .eq("periodo", periodo)
      .maybeSingle();
    return (data as BrandTarget | null) ?? null;
  } catch {
    return null;
  }
}

/** Histórico de DRE (receita + cmv% + prime%) por mês — pra gráfico de evolução. */
export async function listDreHistorico(
  brandId: string,
  periodos: string[],
): Promise<
  Map<
    string,
    { receita: number | null; cmv_pct: number | null; prime_pct: number | null }
  >
> {
  const map = new Map<
    string,
    { receita: number | null; cmv_pct: number | null; prime_pct: number | null }
  >();
  try {
    if (periodos.length === 0) return map;
    const supabase = await createSupabaseServerClient();
    if (!supabase) return map;
    const competencias = periodos
      .map(periodoToDate)
      .filter((c): c is string => c != null);

    const { data } = await supabase
      .from("v_dre_consolidado")
      .select("competencia, receita_bruta, cmv_pct, prime_cost_pct")
      .eq("brand_id", brandId)
      .in("competencia", competencias);
    for (const r of (data ?? []) as Array<{
      competencia: string;
      receita_bruta: number | string | null;
      cmv_pct: number | string | null;
      prime_cost_pct: number | string | null;
    }>) {
      const periodo = r.competencia.slice(0, 7);
      map.set(periodo, {
        receita: toNumber(r.receita_bruta),
        cmv_pct: toNumber(r.cmv_pct),
        prime_pct: toNumber(r.prime_cost_pct),
      });
    }
  } catch (e) {
    console.error("[listDreHistorico] exceção:", e);
  }
  return map;
}

/** Cria ou atualiza (upsert) target via UNIQUE(brand_id, periodo). */
export async function upsertTarget(
  input: BrandTargetFormValues,
): Promise<ActionResult<BrandTarget>> {
  try {
    const parsed = brandTargetSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      brand_id: parsed.data.brand_id,
      unit_id: parsed.data.unit_id ?? null,
      periodo: parsed.data.periodo,
      receita_meta: parsed.data.receita_meta,
      cmv_meta_pct: parsed.data.cmv_meta_pct,
      prime_cost_meta_pct: parsed.data.prime_cost_meta_pct,
      ticket_medio_meta: parsed.data.ticket_medio_meta,
      nps_meta: parsed.data.nps_meta,
      headcount_meta: parsed.data.headcount_meta,
      eventos_meta: parsed.data.eventos_meta,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_TARGETS)
      .upsert(payload as never, { onConflict: "brand_id,periodo" })
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/inteligencia/metas");
    return { ok: true, data: data as BrandTarget };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateTarget(
  id: string,
  patch: BrandTargetUpdateValues,
): Promise<ActionResult<BrandTarget>> {
  try {
    const parsed = brandTargetUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(T_TARGETS)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/inteligencia/metas");
    return { ok: true, data: data as BrandTarget };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Lista notes de um target em ordem cronológica decrescente. */
export async function listTargetNotes(
  targetId: string,
): Promise<TargetNote[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(T_NOTES)
      .select("*")
      .eq("target_id", targetId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listTargetNotes]", error.message);
      return [];
    }
    return (data ?? []) as TargetNote[];
  } catch (e) {
    console.error("[listTargetNotes] exceção:", e);
    return [];
  }
}

export async function createTargetNote(
  input: TargetNoteFormValues,
): Promise<ActionResult<TargetNote>> {
  try {
    const parsed = targetNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      target_id: parsed.data.target_id,
      nota: parsed.data.nota,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_NOTES)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/inteligencia/metas");
    return { ok: true, data: data as TargetNote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
