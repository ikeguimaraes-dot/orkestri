"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import { formatBRL } from "@/lib/format";
import type {
  Period,
  HeadcountStats,
  DistribuicaoMarca,
  DistribuicaoFuncao,
  DistribuicaoDepartamento,
  Movimentacao,
  VagaAberta,
  BrandOption,
} from "@/lib/pessoas/headcount-actions";

const SECTION: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "20px 24px",
  marginTop: 20,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 16,
  letterSpacing: -0.2,
};

const TH: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  padding: "0 12px 10px 0",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
};

const TD: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-2)",
  padding: "10px 12px 10px 0",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

const PERIOD_LABELS: Record<Period, string> = {
  mes: "Mês Corrente",
  trimestre: "Último Trimestre",
  ano: "Ano Corrente",
};

function formatDateBR(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  delta?: number;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const valueColor =
    tone === "ok"
      ? "#15803D"
      : tone === "warn"
        ? "#A16207"
        : tone === "danger"
          ? "#B91C1C"
          : "var(--text)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: 0.7,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: valueColor,
          marginTop: 8,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            marginTop: 4,
          }}
        >
          {subtitle}
        </div>
      )}
      {delta !== undefined && delta !== 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 600,
            color: delta > 0 ? "#15803D" : "#B91C1C",
            background: delta > 0 ? "rgba(21,128,61,0.08)" : "rgba(185,28,28,0.08)",
            borderRadius: 999,
            padding: "2px 8px",
            marginTop: 6,
          }}
        >
          {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {delta > 0 ? "+" : ""}
          {delta} vs período anterior
        </div>
      )}
      {delta === 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-3)",
            background: "var(--surface-2)",
            borderRadius: 999,
            padding: "2px 8px",
            marginTop: 6,
          }}
        >
          <Minus size={11} />
          sem variação
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function HeadcountClient({
  period,
  brandId,
  brands,
  stats,
  marcas,
  funcoes,
  departamentos,
  movimentacoes,
  vagas,
}: {
  period: Period;
  brandId: string;
  brands: BrandOption[];
  stats: HeadcountStats;
  marcas: DistribuicaoMarca[];
  funcoes: DistribuicaoFuncao[];
  departamentos: DistribuicaoDepartamento[];
  movimentacoes: Movimentacao[];
  vagas: VagaAberta[];
}) {
  const router = useRouter();

  function navigate(newPeriod: Period, newBrandId: string) {
    const params = new URLSearchParams();
    params.set("period", newPeriod);
    if (newBrandId) params.set("brandId", newBrandId);
    router.push(`/pessoas/headcount?${params.toString()}`);
  }

  const turnoverTone =
    stats.turnover > 10 ? "danger" : stats.turnover >= 5 ? "warn" : "ok";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── Header ── */}
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Headcount
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
          Headcount
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px" }}>
          Visão executiva do quadro de pessoas
        </p>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ width: 200 }}>
            <Select
              value={period}
              onValueChange={(v) => navigate(v as Period, brandId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês Corrente</SelectItem>
                <SelectItem value="trimestre">Último Trimestre</SelectItem>
                <SelectItem value="ano">Ano Corrente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ width: 220 }}>
            <Select
              value={brandId || "__all__"}
              onValueChange={(v) =>
                navigate(period, v === "__all__" ? "" : (v ?? ""))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as marcas</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* ── KPIs ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          label="Total ativo"
          value={stats.totalAtivo}
          subtitle="colaboradores ativos"
          icon={<Users size={12} />}
          delta={stats.variacao}
        />
        <KpiCard
          label="Admissões"
          value={stats.admissoes}
          subtitle={`admissões em ${PERIOD_LABELS[period].toLowerCase()}`}
          icon={<UserPlus size={12} />}
          tone="ok"
        />
        <KpiCard
          label="Demissões"
          value={stats.demissoes}
          subtitle={`demissões em ${PERIOD_LABELS[period].toLowerCase()}`}
          icon={<UserMinus size={12} />}
          tone={stats.demissoes > 0 ? "warn" : "neutral"}
        />
        <KpiCard
          label="Turnover"
          value={`${stats.turnover.toFixed(1)}%`}
          subtitle="rotatividade no período"
          icon={<TrendingUp size={12} />}
          tone={turnoverTone}
        />
      </div>

      {/* ── Seção 1: Distribuição por marca/unidade ── */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Distribuição por Marca / Unidade</div>
        {marcas.length === 0 ? (
          <Empty>Nenhum colaborador ativo encontrado.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Marca</th>
                <th style={TH}>Unidade</th>
                <th style={{ ...TH, textAlign: "right" }}>Ativos</th>
                <th style={{ ...TH, textAlign: "right" }}>Folha bruta</th>
                <th style={{ ...TH, textAlign: "right" }}>% grupo</th>
              </tr>
            </thead>
            <tbody>
              {marcas.map((row) => (
                <tr key={`${row.brandId}-${row.unitId}`}>
                  <td style={TD}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--text)",
                        fontSize: 12,
                      }}
                    >
                      {row.brandName}
                    </span>
                  </td>
                  <td style={TD}>{row.unitName}</td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>
                    {row.ativos}
                  </td>
                  <td
                    style={{
                      ...TD,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatBRL(row.folhaBruta)}
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-3)",
                      }}
                    >
                      {row.percentual}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Seção 2: Top funções ── */}
      <div style={{ ...SECTION, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <div style={SECTION_TITLE}>Top 10 Funções</div>
          {funcoes.length === 0 ? (
            <Empty>Sem dados.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {funcoes.map((f) => (
                <div key={f.funcao}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        fontWeight: 500,
                      }}
                    >
                      {f.funcao}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {f.qtd} · {f.percentual}% · {formatBRL(f.salarioMedio)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "var(--surface-2)",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(f.percentual * 3, 100)}%`,
                        background: "var(--brand)",
                        borderRadius: 99,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Seção 3: Departamentos ── */}
        <div>
          <div style={SECTION_TITLE}>Distribuição por Departamento</div>
          {departamentos.length === 0 ? (
            <Empty>Sem dados de departamento.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {departamentos.map((d) => (
                <div key={d.departamento}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        fontWeight: 500,
                      }}
                    >
                      {d.departamento}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {d.qtd} · {d.percentual}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: "var(--surface-2)",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(d.percentual * 3, 100)}%`,
                        background: "var(--brand)",
                        borderRadius: 99,
                        opacity: 0.65,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Seção 4: Movimentações recentes ── */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>
          Movimentações Recentes
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-3)",
              marginLeft: 8,
            }}
          >
            {PERIOD_LABELS[period].toLowerCase()}
          </span>
        </div>
        {movimentacoes.length === 0 ? (
          <Empty>Nenhuma movimentação no período selecionado.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Data</th>
                <th style={TH}>Tipo</th>
                <th style={TH}>Colaborador</th>
                <th style={TH}>Função</th>
                <th style={TH}>Marca</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m, i) => (
                <tr key={i}>
                  <td
                    style={{
                      ...TD,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-3)",
                      fontSize: 12,
                    }}
                  >
                    {formatDateBR(m.data)}
                  </td>
                  <td style={TD}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          m.tipo === "admissao"
                            ? "rgba(21,128,61,0.1)"
                            : "rgba(185,28,28,0.1)",
                        color:
                          m.tipo === "admissao" ? "#15803D" : "#B91C1C",
                      }}
                    >
                      {m.tipo === "admissao" ? "Admissão" : "Demissão"}
                    </span>
                  </td>
                  <td style={{ ...TD, fontWeight: 600, color: "var(--text)" }}>
                    {m.nome}
                  </td>
                  <td style={{ ...TD, fontSize: 12 }}>{m.funcao}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{m.brandName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Seção 5: Vagas em aberto ── */}
      <div style={SECTION}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={SECTION_TITLE}>Vagas em Aberto</div>
          <Link
            href="/recrutamento/vagas"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--brand)",
              textDecoration: "none",
            }}
          >
            Ver todas →
          </Link>
        </div>
        {vagas.length === 0 ? (
          <Empty>Nenhuma vaga em aberto.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Função / Vaga</th>
                <th style={TH}>Marca</th>
                <th style={{ ...TH, textAlign: "right" }}>Dias em aberto</th>
                <th style={{ ...TH, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {vagas.map((v) => (
                <tr key={v.id}>
                  <td style={{ ...TD, fontWeight: 600, color: "var(--text)" }}>
                    {v.funcao}
                  </td>
                  <td style={TD}>{v.brandName}</td>
                  <td
                    style={{
                      ...TD,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: v.diasAberta > 30 ? "#B91C1C" : "var(--text-2)",
                      fontWeight: v.diasAberta > 30 ? 600 : 400,
                    }}
                  >
                    {v.diasAberta}d
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <Link
                      href={`/recrutamento/vagas/${v.id}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--brand)",
                        textDecoration: "none",
                      }}
                    >
                      Ver candidatos →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        fontSize: 13,
        color: "var(--text-3)",
        background: "var(--surface-2)",
        borderRadius: 8,
        border: "1px dashed var(--border)",
      }}
    >
      {children}
    </div>
  );
}
