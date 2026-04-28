"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import {
  cmvSeverity,
  primeSeverity,
  receitaSeverity,
  type Severity,
  type WbrBrandKpi,
  type WbrPayload,
} from "@/lib/inteligencia/wbr";

const SEV_BG: Record<Severity, string> = {
  ok: "rgba(34,197,94,0.16)",
  warn: "rgba(245,158,11,0.16)",
  danger: "rgba(239,68,68,0.16)",
};
const SEV_FG: Record<Severity, string> = {
  ok: "#15803D",
  warn: "#A16207",
  danger: "#B91C1C",
};

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

function shiftDateIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function WbrClient({
  refDate,
  payload,
}: {
  refDate: string;
  payload: WbrPayload | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setRef(newRef: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ref", newRef);
    router.push(`/inteligencia/wbr?${params.toString()}`);
  }

  if (!payload) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>
          Não foi possível carregar os dados.
        </p>
      </div>
    );
  }

  const periodLabel = `${formatDateBR(payload.weekStart)} – ${formatDateBR(payload.weekEnd)}`;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Link
        href="/inteligencia"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Inteligência
      </Link>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Inteligência · WBR
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Weekly Business Review
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Semana <strong style={{ color: "var(--text-2)" }}>{periodLabel}</strong>
            {" · "}referência {payload.monthCompetencia.slice(0, 7)}
          </p>
        </div>

        {/* Week navigator */}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setRef(shiftDateIso(refDate, -7))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={refDate}
            onChange={(e) => setRef(e.target.value)}
            style={{
              fontSize: 12,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              padding: "4px 6px",
            }}
          />
          <button
            type="button"
            onClick={() => setRef(shiftDateIso(refDate, 7))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRef(new Date().toISOString().slice(0, 10))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoje
          </button>
        </div>
      </header>

      {/* KPIs do grupo */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 18,
        }}
      >
        <KpiCard
          label="Receita semana"
          value={formatBRL(payload.total_receita)}
          icon={<TrendingUp size={14} />}
        />
        <KpiCard
          label="Eventos semana"
          value={String(payload.total_eventos)}
          icon={<CalendarDays size={14} />}
        />
        <KpiCard
          label="Headcount ativo"
          value={String(payload.total_headcount)}
          icon={<Users size={14} />}
        />
        <KpiCard
          label="Alertas críticos"
          value={String(payload.total_alertas_criticos)}
          icon={<AlertTriangle size={14} />}
          tone={payload.total_alertas_criticos > 0 ? "danger" : "ok"}
        />
      </div>

      {/* Tabela por marca */}
      {payload.brands.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--text-3)",
          }}
        >
          Nenhuma marca acessível. Verifique permissões.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {payload.brands.map((b) => (
            <BrandCard key={b.brand_id} kpi={b} />
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          marginTop: 18,
          lineHeight: 1.55,
        }}
      >
        Receita realizada vem de <code>cash_flow_entries</code> filtrado por
        data_lancamento da semana. Receita projetada é o mensal proporcional
        (÷4,33). CMV%, prime cost e EBITDA são snapshots do mês corrente
        (v_dre_consolidado). Headcount, eventos e alertas são instantâneos.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const fg =
    tone === "danger"
      ? "#B91C1C"
      : tone === "warn"
      ? "#A16207"
      : tone === "ok"
      ? "#15803D"
      : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: fg,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BrandCard({ kpi }: { kpi: WbrBrandKpi }) {
  const sevReceita = receitaSeverity(kpi.receita_gap_pct);
  const sevCmv = cmvSeverity(kpi.cmv_pct, kpi.cmv_meta);
  const sevPrime = primeSeverity(kpi.prime_cost_pct, kpi.prime_cost_meta);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 28,
              borderRadius: 4,
              background: kpi.brand_color ?? "var(--brand)",
            }}
          />
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
              letterSpacing: -0.3,
            }}
          >
            {kpi.brand_name}
          </h2>
          {kpi.alertas_criticos > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                background: SEV_BG.danger,
                color: SEV_FG.danger,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={11} />
              {kpi.alertas_criticos} crítico{kpi.alertas_criticos === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <Metric
          label="Receita realizada"
          value={formatBRL(kpi.receita_realizada)}
          severity="ok"
          hint={`vs projetado ${formatBRL(kpi.receita_projetada)}`}
        />
        <Metric
          label="Gap projeção"
          value={
            kpi.receita_gap_pct == null
              ? "—"
              : `${kpi.receita_gap_pct >= 0 ? "+" : ""}${kpi.receita_gap_pct}%`
          }
          severity={sevReceita}
          hint={`${formatBRL(kpi.receita_gap_abs)} abs.`}
        />
        <Metric
          label="CMV%"
          value={kpi.cmv_pct == null ? "—" : `${kpi.cmv_pct}%`}
          severity={sevCmv}
          hint={kpi.cmv_meta != null ? `meta ${kpi.cmv_meta}%` : "sem meta"}
        />
        <Metric
          label="Prime cost"
          value={kpi.prime_cost_pct == null ? "—" : `${kpi.prime_cost_pct}%`}
          severity={sevPrime}
          hint={
            kpi.prime_cost_meta != null
              ? `meta ${kpi.prime_cost_meta}%`
              : "sem meta"
          }
        />
        <Metric
          label="EBITDA%"
          value={kpi.ebitda_pct == null ? "—" : `${kpi.ebitda_pct}%`}
          severity={
            kpi.ebitda_pct == null ? "ok" : kpi.ebitda_pct >= 18 ? "ok" : kpi.ebitda_pct >= 10 ? "warn" : "danger"
          }
          hint="snapshot mês"
        />
        <Metric
          label="Headcount"
          value={String(kpi.headcount_ativo)}
          severity="ok"
          hint="ativo"
        />
        <Metric
          label="Eventos"
          value={String(kpi.eventos_total)}
          severity="ok"
          hint={`${kpi.eventos_concluidos} concl. · ${kpi.eventos_em_andamento} and. · ${kpi.eventos_pendentes} pend.`}
        />
        <Metric
          label="Alertas (todos)"
          value={String(kpi.alertas_total)}
          severity={
            kpi.alertas_criticos > 0
              ? "danger"
              : kpi.alertas_total > 0
              ? "warn"
              : "ok"
          }
          hint={`${kpi.alertas_criticos} crítico${kpi.alertas_criticos === 1 ? "" : "s"}`}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  severity,
  hint,
}: {
  label: string;
  value: string;
  severity: Severity;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: SEV_BG[severity],
        border: `1px solid ${SEV_FG[severity]}33`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SEV_FG[severity],
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 2,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
