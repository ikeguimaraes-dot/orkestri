import { Suspense } from "react";

import { GestaoClient } from "./gestao-client";
import { PontoToggle } from "@/components/pessoas/PontoToggle";
import { createServiceClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { avatarColor, initials } from "@/lib/format";
import {
  calcWorkHours,
  formatHHMM,
  formatMinutesAsHours,
  PUNCH_COLOR,
  PUNCH_LABEL,
  nextPunchTipo,
} from "@/lib/pessoas/punch";
import type { TimeClockPunch, PunchTipo } from "@kph/db/types/pessoas";

export const dynamic = "force-dynamic";

// ── Tipos locais ──────────────────────────────────────────────────────────────

type GestaoStatus = "trabalhando" | "em_pausa" | "encerrado" | "ausente";

type EmployeeGestao = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
  foto_url: string | null;
  status: GestaoStatus;
  punches: TimeClockPunch[];
  worked_minutes: number;
  break_minutes: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(punches: TimeClockPunch[]): GestaoStatus {
  if (punches.length === 0) return "ausente";
  const last = punches[punches.length - 1]!;
  switch (last.tipo as PunchTipo) {
    case "entrada":
    case "intervalo_fim":
      return "trabalhando";
    case "intervalo_inicio":
      return "em_pausa";
    case "saida":
      return "encerrado";
    default:
      return "ausente";
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidIso(v: string | undefined): boolean {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function formatDateBR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getGestaoPonto(
  unitId: string,
  dataIso: string,
): Promise<EmployeeGestao[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const start = `${dataIso}T00:00:00Z`;
  const end = `${dataIso}T23:59:59.999Z`;

  // 1) Colaboradores ativos da unidade (inclui foto_url)
  const { data: empData, error: empErr } = await supabase
    .from("employees")
    .select("id, nome, sobrenome, funcao, foto_url")
    .eq("unit_id", unitId)
    .eq("ativo", true)
    .order("nome");

  if (empErr || !empData || empData.length === 0) return [];

  const empIds = empData.map((e: { id: string }) => e.id);

  // 2) Todos os punches do dia para esses colaboradores
  const { data: punchData } = await supabase
    .from("time_clock_punches")
    .select("*")
    .in("employee_id", empIds)
    .gte("timestamp_punch", start)
    .lte("timestamp_punch", end)
    .order("timestamp_punch", { ascending: true });

  // 3) Agrupa punches por colaborador
  const punchesByEmployee = new Map<string, TimeClockPunch[]>();
  for (const p of (punchData ?? []) as TimeClockPunch[]) {
    const arr = punchesByEmployee.get(p.employee_id) ?? [];
    arr.push(p);
    punchesByEmployee.set(p.employee_id, arr);
  }

  // 4) Mescla: todos os employees, com ou sem punch
  return empData.map(
    (e: {
      id: string;
      nome: string;
      sobrenome: string;
      funcao: string;
      foto_url: string | null;
    }) => {
      const punches = punchesByEmployee.get(e.id) ?? [];
      const { worked_minutes, break_minutes } = calcWorkHours(punches);
      return {
        ...e,
        status: deriveStatus(punches),
        punches,
        worked_minutes,
        break_minutes,
      };
    },
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ data?: string }>;

export default async function GestaoPontoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const sp = await searchParams;
  const dataIso = isValidIso(sp.data) ? sp.data! : todayIso();
  const isHoje = dataIso === todayIso();

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 22,
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
            Pessoas · Ponto
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 12px",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Ponto
          </h1>
          <PontoToggle active="gestao" />
        </div>
        <DateFilter currentIso={dataIso} />
      </header>

      <Suspense fallback={<GestaoSkeleton />}>
        <GestaoSection dataIso={dataIso} isHoje={isHoje} />
      </Suspense>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

async function GestaoSection({
  dataIso,
  isHoje,
}: {
  dataIso: string;
  isHoje: boolean;
}) {
  const unit = await getCurrentUnit();

  if (!unit) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          fontSize: 13,
          color: "var(--text-3)",
        }}
      >
        Selecione uma unidade na sidebar.
      </div>
    );
  }

  const rows = await getGestaoPonto(unit.id, dataIso);

  const presentes = rows.filter(
    (r) => r.status === "trabalhando" || r.status === "em_pausa",
  ).length;
  const em_pausa = rows.filter((r) => r.status === "em_pausa").length;
  const encerrados = rows.filter((r) => r.status === "encerrado").length;
  const ausentes = rows.filter((r) => r.status === "ausente").length;

  return (
    <GestaoClient isHoje={isHoje}>
      {/* Cabeçalho da data */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: "0 0 14px",
        }}
      >
        Folha de{" "}
        <span
          style={{
            color: "var(--text)",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDateBR(dataIso)}
        </span>{" "}
        — {unit.name}
      </p>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <KpiCard label="Presentes agora" value={presentes} color="#22C55E" />
        <KpiCard label="Em pausa" value={em_pausa} color="#F59E0B" />
        <KpiCard label="Encerrados" value={encerrados} color="#6B7280" />
        <KpiCard label="Ausentes" value={ausentes} color="#EF4444" />
      </div>

      {/* Linhas por colaborador */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-3)",
            }}
          >
            Nenhum colaborador ativo nesta unidade.
          </div>
        ) : (
          rows.map((row, i) => (
            <EmployeeRow
              key={row.id}
              row={row}
              isLast={i === rows.length - 1}
            />
          ))
        )}
      </div>
    </GestaoClient>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const STATUS_CONFIG: Record<
  GestaoStatus,
  { label: string; bg: string; color: string }
> = {
  trabalhando: { label: "Trabalhando", bg: "rgba(34,197,94,0.14)", color: "#16A34A" },
  em_pausa: { label: "Em pausa", bg: "rgba(245,158,11,0.14)", color: "#D97706" },
  encerrado: { label: "Encerrado", bg: "rgba(107,114,128,0.14)", color: "#6B7280" },
  ausente: { label: "Ausente", bg: "rgba(239,68,68,0.12)", color: "#DC2626" },
};

function EmployeeRow({
  row,
  isLast,
}: {
  row: EmployeeGestao;
  isLast: boolean;
}) {
  const color = avatarColor(row.nome);
  const statusCfg = STATUS_CONFIG[row.status];
  const nextExpected = nextPunchTipo(row.punches);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 99,
          flexShrink: 0,
          overflow: "hidden",
          background: row.foto_url
            ? "transparent"
            : `color-mix(in srgb, ${color} 22%, transparent)`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {row.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.foto_url}
            alt={row.nome}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials(`${row.nome} ${row.sobrenome}`)
        )}
      </div>

      {/* Nome + função */}
      <div style={{ minWidth: 140, flex: "0 0 140px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            lineHeight: 1.2,
          }}
        >
          {row.nome} {row.sobrenome}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {row.funcao}
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          flex: "0 0 auto",
          padding: "4px 10px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          background: statusCfg.bg,
          color: statusCfg.color,
          whiteSpace: "nowrap",
        }}
      >
        {statusCfg.label}
      </div>

      {/* Timeline de punches */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {row.punches.length === 0 ? (
          <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
            Sem registros
          </span>
        ) : (
          row.punches.map((p, i) => {
            const tipo = p.tipo as PunchTipo;
            const c = PUNCH_COLOR[tipo];
            const label = PUNCH_LABEL[tipo];
            const isAprovado = p.aprovado === true;
            const isPendente = p.aprovado === null;
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {i > 0 && (
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>→</span>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: c,
                    }}
                  >
                    {label === "Início do intervalo" ? "Pausa" : label === "Fim do intervalo" ? "Retorno" : label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text)",
                      letterSpacing: -0.3,
                    }}
                  >
                    {formatHHMM(p.timestamp_punch)}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: isAprovado ? "#22C55E" : isPendente ? "var(--text-3)" : "#EF4444",
                    }}
                  >
                    {isAprovado ? "✓" : isPendente ? "·" : "✕"}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Próximo punch esperado (greyed) */}
        {nextExpected && row.punches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>→</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                opacity: 0.35,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: PUNCH_COLOR[nextExpected],
                }}
              >
                {nextExpected === "intervalo_inicio" ? "Pausa" : nextExpected === "intervalo_fim" ? "Retorno" : nextExpected === "saida" ? "Saída" : "Entrada"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  letterSpacing: -0.3,
                }}
              >
                --:--
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tempo trabalhado */}
      {row.status !== "ausente" && (
        <div style={{ flex: "0 0 auto", textAlign: "right" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            {formatMinutesAsHours(row.worked_minutes)}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600, letterSpacing: 0.6 }}>
            TRABALHADO
          </div>
        </div>
      )}
    </div>
  );
}

function DateFilter({ currentIso }: { currentIso: string }) {
  return (
    <form
      method="get"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        Data
      </span>
      <input
        type="date"
        name="data"
        defaultValue={currentIso}
        style={{
          flex: 1,
          height: 28,
          padding: "0 8px",
          background: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 12,
        }}
      />
      <button
        type="submit"
        style={{
          height: 28,
          padding: "0 12px",
          background: "var(--brand)",
          color: "var(--primary-foreground)",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Aplicar
      </button>
    </form>
  );
}

function GestaoSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 10,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 72,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 64,
              background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
              borderBottom: i < 5 ? "1px solid var(--border)" : "none",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}
