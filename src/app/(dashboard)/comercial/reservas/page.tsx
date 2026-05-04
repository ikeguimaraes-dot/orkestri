import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listReservations } from "./actions";
import { ReservasClient } from "./reservas-client";

export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Comercial · Reservas
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Reservas
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Controle de reservas da unit — confirmação, cancelamento e acompanhamento em tempo real.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <ReservasSection />
      </Suspense>
    </div>
  );
}

async function ReservasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as reservas.
      </div>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const reservas = await listReservations(unit.id, today);
  return <ReservasClient unitId={unit.id} unitName={unit.name} reservas={reservas} today={today} />;
}
