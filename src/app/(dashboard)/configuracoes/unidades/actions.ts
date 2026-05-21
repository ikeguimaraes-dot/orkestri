"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireUser, isFounder } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";

export type UpdateGeofenceInput = {
  unitId: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
};

export async function updateUnitGeofence(
  input: UpdateGeofenceInput,
): Promise<ActionResult<void>> {
  const user = await requireUser();

  // Apenas founder pode alterar configurações de unidades
  if (!isFounder(user)) {
    // GMs também podem configurar a própria unidade — verificar role
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Serviço indisponível" };

    const { data: roles } = await service
      .from("user_roles")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("unit_id", input.unitId);

    if (!roles || roles.length === 0) {
      return { ok: false, error: "Sem permissão para editar esta unidade" };
    }
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: "Serviço indisponível" };

  const { error } = await service
    .from("units")
    .update({
      latitude: input.latitude,
      longitude: input.longitude,
      geofence_radius_m: input.geofenceRadiusM,
    } as never)
    .eq("id", input.unitId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
