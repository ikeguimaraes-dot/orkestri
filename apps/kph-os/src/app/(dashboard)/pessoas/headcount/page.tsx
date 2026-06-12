import { requireUser } from "@kph/auth/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { InsightPanel } from "@/components/intelligence/InsightPanel";
import { applyScoreCap, type ProposalRisk } from "@kph/core";

type PessoasInsight = {
  id: string;
  insight_text: string;
  semana: string;
  dados_referencia: { score?: number; breakdown?: Record<string, number | null> } | null;
  gerado_por: string;
  created_at: string;
};

type OfficialScore = {
  score_oficial: number;
  cap_razao: string | null;
  score_raw: number;
};

/**
 * Calcula o score oficial de Pessoas aplicando a política de teto do kernel.
 * Lê o score bruto de kph_intelligence_scores e os riscos pendentes de kph_learning_proposals.
 * Grava score_oficial + cap_razao de volta no banco para consistência com o painel central.
 */
async function getOfficialPessoasScore(): Promise<OfficialScore | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const [scoreRes, proposalsRes] = await Promise.all([
      (supabase as any)
        .from("kph_intelligence_scores")
        .select("score, semana")
        .eq("modulo", "pessoas")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("kph_learning_proposals")
        .select("id, severidade, titulo, status")
        .eq("modulo", "pessoas")
        .in("status", ["pending", "open"])
        .not("severidade", "is", null),
    ]);

    if (!scoreRes.data) return null;

    const rawScore: number = scoreRes.data.score ?? 0;
    const proposals: ProposalRisk[] = proposalsRes.data ?? [];
    const capResult = applyScoreCap(rawScore, proposals);

    // Grava score_oficial no banco (best-effort, sem bloquear)
    if (scoreRes.data.semana) {
      (supabase as any)
        .from("kph_intelligence_scores")
        .update({ score_oficial: capResult.score_oficial, cap_razao: capResult.cap_razao })
        .eq("modulo", "pessoas")
        .eq("semana", scoreRes.data.semana)
        .then(() => {});
    }

    return { score_oficial: capResult.score_oficial, cap_razao: capResult.cap_razao, score_raw: rawScore };
  } catch {
    return null;
  }
}

async function getLatestPessoasInsight(): Promise<PessoasInsight | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await (supabase as any)
      .from("kph_insights")
      .select("id, insight_text, semana, dados_referencia, gerado_por, created_at")
      .eq("modulo", "pessoas")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as PessoasInsight) ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

type HeadcountRow = {
  brand_id?: string;
  brand_name?: string;
  headcount_ativo?: number;
  folha_bruta?: number;
  admissoes_mes?: number;
  demissoes_mes?: number;
};

async function getHeadcount(): Promise<HeadcountRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("v_headcount_por_marca")
      .select("brand_id, brand_name, headcount_ativo, folha_bruta, admissoes_mes, demissoes_mes")
      .order("headcount_ativo", { ascending: false });
    return (data ?? []) as HeadcountRow[];
  } catch {
    return [];
  }
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function HeadcountPage() {
  await requireUser();
  const [rows, agentInsight, officialScore] = await Promise.all([
    getHeadcount(),
    getLatestPessoasInsight(),
    getOfficialPessoasScore(),
  ]);

  const totalAtivo = rows.reduce((s, r) => s + (r.headcount_ativo ?? 0), 0);
  const totalFolha = rows.reduce((s, r) => s + (r.folha_bruta ?? 0), 0);
  const totalAdmissoes = rows.reduce((s, r) => s + (r.admissoes_mes ?? 0), 0);
  const totalDemissoes = rows.reduce((s, r) => s + (r.demissoes_mes ?? 0), 0);
  const turnover = totalAtivo > 0 ? ((totalDemissoes / totalAtivo) * 100).toFixed(1) : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: -0.6, margin: 0 }}>
          Pessoas
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          Headcount e movimentação de colaboradores CLT
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Headcount ativo" value={String(totalAtivo)} />
        <KpiCard label="Folha bruta (mês)" value={BRL.format(totalFolha)} />
        <KpiCard label="Admissões (mês)" value={String(totalAdmissoes)} ok={totalAdmissoes > 0} />
        <KpiCard
          label="Demissões (mês)"
          value={`${totalDemissoes}${turnover ? ` (${turnover}%)` : ""}`}
          alert={Number(turnover) > 5}
        />
      </div>

      {rows.length > 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                {["Marca", "Headcount Ativo", "Folha Bruta", "Admissões", "Demissões"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: h === "Marca" ? "left" : "right",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.brand_id ?? i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>
                    {r.brand_name ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                    {r.headcount_ativo ?? 0}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                    {BRL.format(r.folha_bruta ?? 0)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: (r.admissoes_mes ?? 0) > 0 ? "#22C55E" : "var(--text-3)" }}>
                    {r.admissoes_mes ?? 0}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: (r.demissoes_mes ?? 0) > 0 ? "#EF4444" : "var(--text-3)" }}>
                    {r.demissoes_mes ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: 14 }}>
          Sem dados de headcount disponíveis. Verifique a integração com o módulo de RH.
        </div>
      )}

      {agentInsight ? (
        <AgentInsightBanner insight={agentInsight} officialScore={officialScore} />
      ) : (
        <InsightPanel
          module="pessoas"
          context={{
            headcount_total: totalAtivo,
            folha_bruta_total: totalFolha,
            admissoes_mes: totalAdmissoes,
            demissoes_mes: totalDemissoes,
            turnover_pct: turnover != null ? Number(turnover) : null,
            por_marca: rows.map((r) => ({
              marca: r.brand_name,
              headcount: r.headcount_ativo,
              admissoes: r.admissoes_mes,
              demissoes: r.demissoes_mes,
            })),
          }}
          title="Insight de Pessoas"
        />
      )}
    </div>
  );
}

function AgentInsightBanner({
  insight,
  officialScore,
}: {
  insight: PessoasInsight;
  officialScore: OfficialScore | null;
}) {
  // Score oficial (com teto) tem prioridade; fallback para score bruto do insight
  const displayScore = officialScore?.score_oficial ?? insight.dados_referencia?.score ?? null;
  const capRazao = officialScore?.cap_razao ?? null;
  const isCapped = capRazao != null;

  const accentColor = isCapped ? "#C4622D" : "#B8975A";
  const scoreColor =
    displayScore == null ? "var(--text-3)" :
    displayScore >= 80 ? "#B8975A" :
    displayScore >= 60 ? "#A16207" :
    "#C4622D";

  const semanaFormatted = insight.semana
    ? new Date(insight.semana + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 10,
        padding: "18px 22px",
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-3)" }}>
            Insight de Pessoas
          </span>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(184,151,90,0.14)", color: "#B8975A", fontWeight: 700 }}>
            Agente IA
          </span>
          {isCapped && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(196,98,45,0.14)", color: "#C4622D", fontWeight: 700 }}>
              TETO APLICADO
            </span>
          )}
          {semanaFormatted && (
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>semana de {semanaFormatted}</span>
          )}
        </div>
        {displayScore != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor, letterSpacing: -0.4 }}>{displayScore}</span>
            <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 3 }}>/100</span>
          </div>
        )}
      </div>

      {capRazao && (
        <div
          style={{
            fontSize: 11,
            color: "#C4622D",
            background: "rgba(196,98,45,0.08)",
            border: "1px solid rgba(196,98,45,0.2)",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          {capRazao}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
        {insight.insight_text}
      </p>
    </div>
  );
}

function KpiCard({ label, value, ok, alert }: { label: string; value: string; ok?: boolean; alert?: boolean }) {
  const color = alert ? "#C4622D" : ok ? "#B8975A" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : ok ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-3)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}
