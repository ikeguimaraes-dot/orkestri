"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GorjetaPeriodo = {
  id: string;
  unit_id: string;
  periodo: string;
  quinzena: number;
  data_inicio: string;
  data_fim: string;
  receita_bruta: number;
  imposto_pct: number;
  valor_liquido: number;
  total_pontos: number;
  valor_ponto: number;
  importado_em: string;
  created_at: string;
};

export type GorjetaDia = {
  id: string;
  unit_id: string;
  periodo_id: string | null;
  employee_id: string | null;
  nome: string;
  cargo: string | null;
  data: string;
  pontos: number;
  presente: boolean;
  valor_calculado: number;
};

export type GorjetaCargoPonto = {
  id: string;
  unit_id: string;
  cargo: string;
  pontos: number;
  ativo: boolean;
};

export type GorjetaImportPayload = {
  periodo: string;
  quinzena: 1 | 2;
  data_inicio: string;
  data_fim: string;
  receita_bruta: number;
  imposto_pct: number;
  total_pontos: number;
  colaboradores: {
    nome: string;
    cargo: string;
    dias: {
      data: string;
      valor_calculado: number;
      presente: boolean;
    }[];
  }[];
};

// ── Actions ───────────────────────────────────────────────────────────────────

export async function getGorjetaPeriodos(unitId: string): Promise<GorjetaPeriodo[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("gorjeta_periodos")
      .select("*")
      .eq("unit_id", unitId)
      .order("data_inicio", { ascending: false });
    return (data ?? []) as GorjetaPeriodo[];
  } catch { return []; }
}

export async function getGorjetaDias(periodoIds: string[]): Promise<GorjetaDia[]> {
  try {
    if (periodoIds.length === 0) return [];
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("gorjeta_dias")
      .select("*")
      .in("periodo_id", periodoIds)
      .order("data", { ascending: true });
    return (data ?? []) as GorjetaDia[];
  } catch { return []; }
}

export async function getGorjetaColaborador(
  unitId: string,
  nome: string,
  periodoStr: string,
): Promise<GorjetaDia[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: periodos } = await sb
      .from("gorjeta_periodos")
      .select("id")
      .eq("unit_id", unitId)
      .eq("periodo", periodoStr);
    if (!periodos?.length) return [];
    const ids = (periodos as { id: string }[]).map((p) => p.id);
    const { data } = await sb
      .from("gorjeta_dias")
      .select("*")
      .in("periodo_id", ids)
      .eq("nome", nome)
      .order("data", { ascending: true });
    return (data ?? []) as GorjetaDia[];
  } catch { return []; }
}

export async function getCargoPontos(unitId: string): Promise<GorjetaCargoPonto[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("gorjeta_cargo_pontos")
      .select("*")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("cargo", { ascending: true });
    return (data ?? []) as GorjetaCargoPonto[];
  } catch { return []; }
}

export async function upsertCargoPonto(
  unitId: string,
  cargo: string,
  pontos: number,
): Promise<ActionResult<GorjetaCargoPonto>> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .from("gorjeta_cargo_pontos")
      .upsert(
        { unit_id: unitId, cargo, pontos, ativo: true },
        { onConflict: "unit_id,cargo" },
      )
      .select()
      .single();
    if (error) return { ok: false, error: (error as { message: string }).message };
    revalidatePath("/pessoas/gorjetas");
    return { ok: true, data: data as GorjetaCargoPonto };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function importGorjetaExcel(
  unitId: string,
  payload: GorjetaImportPayload,
): Promise<ActionResult<{ count: number }>> {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Fetch cargo → pontos map for this unit
    const { data: cpData } = await sb
      .from("gorjeta_cargo_pontos")
      .select("cargo,pontos")
      .eq("unit_id", unitId);
    const cargoMap = new Map<string, number>();
    for (const cp of (cpData ?? [])) {
      cargoMap.set(cp.cargo as string, Number(cp.pontos));
    }

    // Upsert gorjeta_periodos
    const { data: periodo, error: pErr } = await sb
      .from("gorjeta_periodos")
      .upsert(
        {
          unit_id: unitId,
          periodo: payload.periodo,
          quinzena: payload.quinzena,
          data_inicio: payload.data_inicio,
          data_fim: payload.data_fim,
          receita_bruta: payload.receita_bruta,
          imposto_pct: payload.imposto_pct,
          total_pontos: payload.total_pontos,
          importado_em: new Date().toISOString(),
        },
        { onConflict: "unit_id,periodo,quinzena" },
      )
      .select("id")
      .single();

    if (pErr) return { ok: false, error: (pErr as { message: string }).message };
    const periodoId = (periodo as { id: string }).id;

    // Delete existing dias for this period before re-inserting
    await sb.from("gorjeta_dias").delete().eq("periodo_id", periodoId);

    // Build insert rows
    const diasRows = payload.colaboradores.flatMap((colab) =>
      colab.dias.map((dia) => ({
        unit_id: unitId,
        periodo_id: periodoId,
        nome: colab.nome,
        cargo: colab.cargo || null,
        data: dia.data,
        pontos: cargoMap.get(colab.cargo) ?? 0,
        presente: dia.presente,
        valor_calculado: dia.valor_calculado,
      })),
    );

    if (diasRows.length > 0) {
      const { error: dErr } = await sb.from("gorjeta_dias").insert(diasRows);
      if (dErr) return { ok: false, error: (dErr as { message: string }).message };
    }

    revalidatePath("/pessoas/gorjetas");
    return { ok: true, data: { count: diasRows.length } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
