import { requireUser } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/supabase/server";
import { UnidadesClient } from "./unidades-client";

export const dynamic = "force-dynamic";

type UnitRow = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
};

export default async function ConfiguracaoUnidadesPage() {
  const user = await requireUser();

  const service = createServiceClient();
  if (!service) return <p>Serviço indisponível.</p>;

  // Busca unidades acessíveis pelo usuário
  let units: UnitRow[] = [];

  const isFounderUser = user.roles.some((r) => r.role === "founder");

  if (isFounderUser) {
    // Founder vê todas as unidades ativas
    const { data } = await service
      .from("units")
      .select("id, name, address, latitude, longitude, geofence_radius_m")
      .eq("active", true)
      .order("name")
      .returns<UnitRow[]>();
    units = data ?? [];
  } else {
    // Usuário comum: busca unit_ids via user_roles
    const { data: roles } = await service
      .from("user_roles")
      .select("unit_id")
      .eq("user_id", user.id);

    const unitIds = (roles ?? [])
      .map((r: { unit_id: string | null }) => r.unit_id)
      .filter((id): id is string => id != null);

    if (unitIds.length > 0) {
      const { data } = await service
        .from("units")
        .select("id, name, address, latitude, longitude, geofence_radius_m")
        .in("id", unitIds)
        .eq("active", true)
        .order("name")
        .returns<UnitRow[]>();
      units = data ?? [];
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Configurações
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 6px",
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          Geofencing de Unidades
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            maxWidth: 560,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Configure as coordenadas e o raio de cada unidade. Quando um colaborador
          bate ponto dentro do raio, o registro é aprovado automaticamente. Fora do
          raio, cai na fila de aprovação manual.
        </p>
      </header>

      {units.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--text-3)",
          }}
        >
          Nenhuma unidade encontrada para seu acesso.
        </div>
      ) : (
        <UnidadesClient units={units} />
      )}
    </div>
  );
}
