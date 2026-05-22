import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listRestaurantTables } from "./actions";
import { MapaClient } from "./mapa-client";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Mapa da Casa
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Mapa da Casa
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Status das mesas em tempo real. Clique em uma mesa para alterar o status. Reservas do dia são marcadas automaticamente.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <MapaSection />
      </Suspense>
    </div>
  );
}

async function MapaSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver o mapa.
      </div>
    );
  }
  const tables = await listRestaurantTables(unit.id);
  return <MapaClient unitId={unit.id} unitName={unit.name} tables={tables} />;
}
