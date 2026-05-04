"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import type { ReservationRow } from "@/types/database";

export async function listReservations(unitId: string, data?: string): Promise<ReservationRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let query = (supabase.from("reservations" as never) as ReturnType<typeof supabase.from>)
      .select("*")
      .eq("unit_id", unitId)
      .order("data", { ascending: true })
      .order("hora", { ascending: true });
    if (data) query = query.eq("data", data);
    const { data: rows, error } = await query as unknown as { data: ReservationRow[] | null; error: { message: string } | null };
    if (error) { console.error("[listReservations]", error.message); return []; }
    return rows ?? [];
  } catch (e) { console.error("[listReservations] exceção:", e); return []; }
}

export async function createReservation(
  input: Omit<ReservationRow, "id" | "created_at" | "updated_at" | "confirmado_por" | "confirmado_em">,
): Promise<ActionResult<ReservationRow>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await (supabase.from("reservations" as never) as ReturnType<typeof supabase.from>)
      .insert(input as never)
      .select()
      .single() as unknown as { data: ReservationRow | null; error: { message: string } | null };
    if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar" };
    revalidatePath("/comercial/reservas");
    return { ok: true, data };
  } catch (e) { console.error("[createReservation] exceção:", e); return { ok: false, error: e instanceof Error ? e.message : "Erro" }; }
}

export async function updateReservationStatus(
  id: string,
  status: ReservationRow["status"],
  userId?: string | null,
): Promise<ActionResult<ReservationRow>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const patch: Record<string, unknown> = { status };
    if (status === "confirmada" && userId) {
      patch.confirmado_por = userId;
      patch.confirmado_em = new Date().toISOString();
    }
    const { data, error } = await (supabase.from("reservations" as never) as ReturnType<typeof supabase.from>)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single() as unknown as { data: ReservationRow | null; error: { message: string } | null };
    if (error || !data) { console.error("[updateReservationStatus]", error?.message); return { ok: false, error: error?.message ?? "Falha" }; }
    revalidatePath("/comercial/reservas");
    return { ok: true, data };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erro" }; }
}
