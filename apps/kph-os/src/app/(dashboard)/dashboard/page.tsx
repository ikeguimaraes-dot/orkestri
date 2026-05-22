import { Suspense } from "react";

import { requireUser } from "@kph/auth/server";
import {
  getAlertas,
  getAniversariantes,
  getHeadcountGrupo,
  getKpisMesAtual,
  getProximosEventos,
  getResumoGrupo,
} from "./actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { MarcaPerformanceCard } from "@/components/dashboard/MarcaPerformanceCard";
import { ProximosEventosTimeline } from "@/components/dashboard/ProximosEventosTimeline";
import { AlertasPanel } from "@/components/dashboard/AlertasPanel";
import { AniversariantesCard } from "@/components/dashboard/AniversariantesCard";
import {
  currencyFmt,
  currencyFullFmt,
  dataExtenso,
  nomeDoUsuario,
  saudacao,
} from "@/lib/dashboard/utils";
import type { HeadcountMarcaRow } from "@kph/db/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const nome = nomeDoUsuario(user.email) ?? "Operador";
  const greet = saudacao();
  const dia = dataExtenso();

  const [resumo, kpis, headcount, proximos, alertas, aniversariantes] = await Promise.all([
    getResumoGrupo(),
    getKpisMesAtual(),
    getHeadcountGrupo(),
    getProximosEventos(10),
    getAlertas(),
    getAniversariantes(),
  ]);

  if (resumo.total_marcas_ativas === 0) {
    return <EmptyDashboard nome={nome} greet={greet} dia={dia} />;
  }

  // Index headcount por brand_id pra passar pro card de performance.
  const headByBrand = new Map<string, HeadcountMarcaRow>();
  for (const h of headcount.por_marca) headByBrand.set(h.brand_id, h);

  // Ordena KPIs por receita prevista descendente; marcas sem mês caem no fim.
  const kpisOrdenados = [...kpis].sort((a, b) => {
    const rA = a.mes_atual?.receita_prevista ?? 0;
    const rB = b.mes_atual?.receita_prevista ?? 0;
    return rB - rA;
  });

  const pctRealizadoGrupo =
    resumo.receita_prevista_mes > 0
      ? (resumo.receita_realizada_mes / resumo.receita_prevista_mes) * 100
      : 0;

  // Agrega contagens por status no grupo (atualmente só dos kpis com mes_atual).
  const breakdown = kpis.reduce(
    (acc, k) => {
      const m = k.mes_atual;
      if (!m) return acc;
      acc.aprovados += Number(m.eventos_aprovados ?? 0);
      acc.em_andamento += Number(m.eventos_em_andamento ?? 0);
      acc.pendentes += Number(m.eventos_pendentes ?? 0);
      return acc;
    },
    { aprovados: 0, em_andamento: 0, pendentes: 0 },
  );

  const top3Alertas = alertas.slice(0, 3);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto" }}>
      {/* SEÇÃO 1 — Header executivo */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: -0.6,
              margin: 0,
            }}
          >
            {greet}, {nome}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-3)",
              marginTop: 6,
            }}
          >
            Grupo KPH · {dia} · {resumo.total_marcas_ativas} marcas ativas
          </p>
        </div>

        {resumo.alertas_criticos > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.40)",
              color: "#EF4444",
              borderRadius: 99,
            }}
          >
            ! {resumo.alertas_criticos} alerta
            {resumo.alertas_criticos > 1 ? "s" : ""} crítico
            {resumo.alertas_criticos > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {/* SEÇÃO 2 — KPI cards do grupo */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Receita prevista (mês)"
          value={currencyFullFmt.format(resumo.receita_prevista_mes)}
          sub={`${currencyFmt.format(resumo.receita_realizada_mes)} realizado · ${Math.round(pctRealizadoGrupo)}%`}
        >
          <ProgressBar
            value={resumo.receita_realizada_mes}
            max={Math.max(resumo.receita_prevista_mes, 1)}
          />
        </KpiCard>

        <KpiCard
          label="Eventos no mês"
          value={resumo.total_eventos_mes}
          sub={`${resumo.eventos_proximos_7d} nos próximos 7 dias`}
        >
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-2)" }}>
            <BreakdownDot color="#22C55E" label="Aprovados" value={breakdown.aprovados} />
            <BreakdownDot color="#3B82F6" label="Em andamento" value={breakdown.em_andamento} />
            <BreakdownDot color="#EAB308" label="Pendentes" value={breakdown.pendentes} />
          </div>
        </KpiCard>

        <KpiCard
          label="Headcount grupo"
          value={resumo.headcount_total}
          sub={`Folha bruta ${currencyFmt.format(resumo.folha_bruta_total)}`}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <CountBadge color="#22C55E" label="admissões" value={headcount.total.admissoes_mes} />
            <CountBadge color="#EF4444" label="demissões" value={headcount.total.demissoes_mes} />
          </div>
        </KpiCard>

        {(() => {
          const primeCost =
            resumo.receita_realizada_mes > 0
              ? Math.round((resumo.folha_bruta_total / resumo.receita_realizada_mes) * 10000) / 100
              : null;
          const pcColor =
            primeCost == null
              ? "var(--text-3)"
              : primeCost > 35
              ? "#B91C1C"
              : primeCost >= 30
              ? "#A16207"
              : "#15803D";
          return (
            <KpiCard
              label="Prime cost (folha/receita)"
              value={primeCost != null ? `${primeCost}%` : "—"}
              sub={
                primeCost == null
                  ? "Sem receita lançada"
                  : primeCost < 30
                  ? "Eficiência ótima (<30%)"
                  : primeCost < 35
                  ? "Atenção (30–35%)"
                  : "Crítico (>35%)"
              }
              accent={pcColor}
            />
          );
        })()}

        <KpiCard
          label="Alertas operacionais"
          value={alertas.length}
          sub={
            resumo.alertas_criticos > 0
              ? `${resumo.alertas_criticos} crítico${resumo.alertas_criticos > 1 ? "s" : ""}`
              : "Sem críticos"
          }
        >
          {top3Alertas.length === 0 ? (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Tudo certo.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {top3Alertas.map((a, i) => (
                <div
                  key={`${a.tipo_alerta}:${a.resource_id}:${i}`}
                  style={{
                    fontSize: 11,
                    color: "var(--text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={a.mensagem}
                >
                  <span
                    aria-hidden
                    style={{
                      color: a.severidade === "error" ? "#EF4444" : "#EAB308",
                      fontWeight: 700,
                    }}
                  >
                    {a.severidade === "error" ? "!" : "⚠"}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.mensagem}
                  </span>
                </div>
              ))}
              {alertas.length > 3 && (
                <a
                  href="#alertas"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "var(--brand)",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  Ver todos →
                </a>
              )}
            </div>
          )}
        </KpiCard>
      </section>

      {/* SEÇÃO 3 — Performance por marca */}
      <SectionTitle>Performance por marca</SectionTitle>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {kpisOrdenados.length === 0 ? (
          <div
            style={{
              padding: 28,
              textAlign: "center",
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 14,
              fontSize: 13,
              color: "var(--text-3)",
              gridColumn: "1 / -1",
            }}
          >
            Nenhuma marca registrou eventos ainda.
          </div>
        ) : (
          kpisOrdenados.map((k) => (
            <MarcaPerformanceCard
              key={k.brand_id}
              kpi={k}
              headcount={headByBrand.get(k.brand_id) ?? null}
            />
          ))
        )}
      </section>

      {/* SEÇÃO 4 — Próximos eventos */}
      <SectionTitle>Próximos eventos</SectionTitle>
      <Suspense fallback={<TimelineSkeleton />}>
        <ProximosEventosTimeline eventos={proximos} alertas={alertas} />
      </Suspense>
      <div style={{ height: 28 }} />

      {/* SEÇÃO 5 — Aniversários + Alertas */}
      <div
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          alignItems: "start",
          marginBottom: 28,
        }}
      >
        <AniversariantesCard aniversariantes={aniversariantes} />
        <div>
          <SectionTitle id="alertas">Alertas operacionais</SectionTitle>
          <AlertasPanel alertas={alertas} />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes locais ──────────────────────────────────────

function SectionTitle({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--text-3)",
        margin: "4px 0 10px",
      }}
    >
      {children}
    </h2>
  );
}

function BreakdownDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: 99, background: color }}
      />
      {value}
    </span>
  );
}

function CountBadge({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span
      title={`${value} ${label} no mês`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: "2px 8px",
        borderRadius: 99,
        background: `${color}1A`,
        color,
        border: `1px solid ${color}55`,
        textTransform: "uppercase",
      }}
    >
      {value} {label}
    </span>
  );
}

function TimelineSkeleton() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 22,
        fontSize: 12,
        color: "var(--text-3)",
      }}
    >
      Carregando…
    </div>
  );
}

function EmptyDashboard({
  nome,
  greet,
  dia,
}: {
  nome: string;
  greet: string;
  dia: string;
}) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.5,
            margin: 0,
          }}
        >
          {greet}, {nome}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          Grupo KPH · {dia}
        </p>
      </header>

      <div
        style={{
          padding: "60px 32px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
            marginBottom: 8,
          }}
        >
          Nenhuma marca acessível no seu perfil
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-3)",
            maxWidth: 460,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Você ainda não tem permissão pra nenhuma marca do grupo. Peça pro
          founder cadastrar seu acesso em <code>user_roles</code> ou abra um
          chamado.
        </p>
      </div>
    </div>
  );
}
