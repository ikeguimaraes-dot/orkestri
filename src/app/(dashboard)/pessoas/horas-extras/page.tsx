import { Suspense } from "react";
import { listOvertimeByUnit, listEmployees } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { HorasExtrasClient } from "./horas-extras-client";

export const dynamic = "force-dynamic";

export default async function HorasExtrasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Horas Extras
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Horas Extras · Controle e aprovação
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Registro e aprovação de HE com cálculo automático de valor estimado (salário ÷ 220h × multiplicador).
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <HorasExtrasSection />
      </Suspense>
    </div>
  );
}

async function HorasExtrasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as horas extras.
      </div>
    );
  }
  const now = new Date();
  const [records, allEmployees] = await Promise.all([
    listOvertimeByUnit(unit.id, now.getMonth() + 1, now.getFullYear()),
    listEmployees(unit.id),
  ]);
  const employees = allEmployees
    .filter((e) => e.ativo)
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      sobrenome: e.sobrenome,
      funcao: e.funcao,
      salario_base: e.salario_base,
    }));

  return (
    <HorasExtrasClient
      unitId={unit.id}
      unitName={unit.name}
      records={records}
      employees={employees}
      defaultMes={now.getMonth() + 1}
      defaultAno={now.getFullYear()}
    />
  );
}
