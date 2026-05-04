import { Suspense } from "react";
import { listOvertimeByUnit, listEmployees } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { HorasExtrasClient } from "./horas-extras-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ mes?: string; ano?: string }>;

export default async function HorasExtrasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const mes = parseMes(sp.mes) ?? now.getMonth() + 1;
  const ano = parseAno(sp.ano) ?? now.getFullYear();

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
          Registro e aprovação com cálculo automático de valor estimado (salário ÷ 220h × multiplicador).
        </p>
      </header>

      <PeriodFilter mes={mes} ano={ano} />

      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 12 }}>Carregando…</div>}>
        <HorasExtrasSection mes={mes} ano={ano} />
      </Suspense>
    </div>
  );
}

async function HorasExtrasSection({ mes, ano }: { mes: number; ano: number }) {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13, marginTop: 12 }}>
        Selecione uma unit no topo para ver as horas extras.
      </div>
    );
  }
  const [records, allEmployees] = await Promise.all([
    listOvertimeByUnit(unit.id, mes, ano),
    listEmployees(unit.id),
  ]);
  const employees = allEmployees
    .filter((e) => e.ativo)
    .map((e) => ({ id: e.id, nome: e.nome, sobrenome: e.sobrenome, funcao: e.funcao, salario_base: e.salario_base }));

  return (
    <HorasExtrasClient
      unitId={unit.id}
      unitName={unit.name}
      records={records}
      employees={employees}
      defaultMes={mes}
      defaultAno={ano}
    />
  );
}

function PeriodFilter({ mes, ano }: { mes: number; ano: number }) {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const anos = [ano - 1, ano, ano + 1];
  return (
    <form method="get" style={{ display: "flex", gap: 8, marginBottom: 12, padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-3)", marginRight: 4 }}>Período</span>
      <select name="mes" defaultValue={mes} style={selectStyle}>
        {meses.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}
      </select>
      <select name="ano" defaultValue={ano} style={selectStyle}>
        {anos.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button type="submit" style={btnStyle}>Aplicar</button>
    </form>
  );
}

const selectStyle: React.CSSProperties = { height: 28, padding: "0 8px", background: "var(--background)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 };
const btnStyle: React.CSSProperties = { height: 28, padding: "0 12px", background: "var(--brand)", color: "var(--primary-foreground)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" };

function parseMes(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}
function parseAno(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2020 && n <= 2100 ? n : null;
}
