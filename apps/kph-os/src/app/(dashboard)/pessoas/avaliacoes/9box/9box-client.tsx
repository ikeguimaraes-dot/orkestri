"use client";

import { useState, useEffect, useTransition } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import { calcular9Box, type NineBoxResult, type AvaliacaoCiclo, type CicloStatus } from "@/app/(dashboard)/pessoas/avaliacoes/actions";

const QUADRANT_LABELS: Record<number, { label: string; cor: string }> = {
  1: { label: "Baixo performer", cor: "rgba(239,68,68,0.12)" },
  2: { label: "Inconsistente", cor: "rgba(245,158,11,0.10)" },
  3: { label: "Enigma", cor: "rgba(245,158,11,0.10)" },
  4: { label: "Em desenvolvimento", cor: "rgba(59,130,246,0.10)" },
  5: { label: "Sólido", cor: "rgba(59,130,246,0.10)" },
  6: { label: "Alto potencial", cor: "rgba(16,185,129,0.10)" },
  7: { label: "Especialista", cor: "rgba(59,130,246,0.10)" },
  8: { label: "Alta performance", cor: "rgba(16,185,129,0.10)" },
  9: { label: "Estrela", cor: "rgba(16,185,129,0.18)" },
};

type CicloLite = Pick<AvaliacaoCiclo, "id" | "nome" | "status">;

const STATUS_LABEL: Record<CicloStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

interface TooltipPayload {
  payload: NineBoxResult;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const q = QUADRANT_LABELS[d.quadrante];
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "var(--shadow-lg)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {d.nome} {d.sobrenome}
      </div>
      <div style={{ color: "var(--text-3)", marginBottom: 6 }}>{d.funcao}</div>
      <div style={{ display: "flex", gap: 12 }}>
        <span style={{ color: "var(--text-2)" }}>
          Desempenho: <strong style={{ color: "var(--text)" }}>{d.x.toFixed(2)}</strong>
        </span>
        <span style={{ color: "var(--text-2)" }}>
          Potencial: <strong style={{ color: "var(--text)" }}>{d.y.toFixed(2)}</strong>
        </span>
      </div>
      {q && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--brand)",
          }}
        >
          Q{d.quadrante} · {q.label}
        </div>
      )}
    </div>
  );
}

export function NineBoxClient({ ciclos }: { ciclos: CicloLite[] }) {
  const [mounted, setMounted] = useState(false);
  const [cicloId, setCicloId] = useState<string>("none");
  const [results, setResults] = useState<NineBoxResult[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (cicloId === "none") {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const data = await calcular9Box(cicloId);
      setResults(data);
    });
  }, [cicloId]);

  if (!mounted) return null;

  return (
    <div>
      <div style={{ marginBottom: 16, maxWidth: 300 }}>
        <Select value={cicloId} onValueChange={(v) => v && setCicloId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar ciclo…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Selecionar ciclo…</SelectItem>
            {ciclos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} · {STATUS_LABEL[c.status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cicloId === "none" ? (
        <div
          style={{
            padding: "56px 20px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Selecione um ciclo 360° para visualizar a matriz.
        </div>
      ) : pending ? (
        <div
          style={{
            padding: "56px 20px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Calculando…
        </div>
      ) : results.length === 0 ? (
        <div
          style={{
            padding: "56px 20px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhuma avaliação concluída neste ciclo ainda.
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px 20px",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Matriz 9Box
            </h3>
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0" }}>
              Eixo X: desempenho médio (avaliação de pares/gestores) · Eixo Y: potencial (autoavaliação)
            </p>
          </div>

          <ResponsiveContainer width="100%" height={480}>
            <ScatterChart
              margin={{ top: 20, right: 30, bottom: 40, left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

              <XAxis
                type="number"
                dataKey="x"
                name="Desempenho"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                label={{
                  value: "Desempenho",
                  position: "insideBottom",
                  offset: -10,
                  style: { fontSize: 12, fill: "var(--text-3)" },
                }}
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                stroke="var(--border)"
              />

              <YAxis
                type="number"
                dataKey="y"
                name="Potencial"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                label={{
                  value: "Potencial",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: { fontSize: 12, fill: "var(--text-3)" },
                }}
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                stroke="var(--border)"
              />

              {/* Linhas de divisão dos quadrantes */}
              <ReferenceLine x={2.25} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine x={3.75} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine y={2.25} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine y={3.75} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 2" />

              <Tooltip content={<CustomTooltip />} />

              <Scatter
                data={results}
                fill="var(--brand)"
                opacity={0.85}
                r={7}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Legenda de quadrantes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 8,
              marginTop: 20,
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((q) => {
              const info = QUADRANT_LABELS[q]!;
              return (
                <div
                  key={q}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: info.cor,
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--brand)",
                      minWidth: 18,
                    }}
                  >
                    Q{q}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{info.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                    {results.filter((r) => r.quadrante === q).length}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
