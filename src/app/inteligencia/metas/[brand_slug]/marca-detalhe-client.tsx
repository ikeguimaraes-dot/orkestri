"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import { upsertTarget } from "../actions";
import {
  formatBRL,
  formatPct,
  type BrandTarget,
} from "@/lib/metas/types";

type EvolucaoPoint = {
  periodo: string;
  meta: number | null;
  realizado: number | null;
};

export function MarcaDetalheClient({
  brand,
  periodo,
  periodoOptions,
  target,
  history,
  evolucao,
}: {
  brand: { id: string; name: string; slug: string; color: string | null };
  periodo: string;
  periodoOptions: string[];
  target: BrandTarget | null;
  history: BrandTarget[];
  evolucao: EvolucaoPoint[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form state — vem do target existente ou vazio
  const [receita, setReceita] = useState<string>("");
  const [cmv, setCmv] = useState<string>("");
  const [prime, setPrime] = useState<string>("");
  const [ticket, setTicket] = useState<string>("");
  const [nps, setNps] = useState<string>("");
  const [headcount, setHeadcount] = useState<string>("");
  const [eventos, setEventos] = useState<string>("");

  // Re-hidrata quando target muda (server re-renderiza ao trocar período)
  useEffect(() => {
    setReceita(target?.receita_meta ?? "");
    setCmv(target?.cmv_meta_pct ?? "");
    setPrime(target?.prime_cost_meta_pct ?? "");
    setTicket(target?.ticket_medio_meta ?? "");
    setNps(target?.nps_meta ?? "");
    setHeadcount(target?.headcount_meta != null ? String(target.headcount_meta) : "");
    setEventos(target?.eventos_meta != null ? String(target.eventos_meta) : "");
    setSaved(false);
    setError(null);
  }, [target]);

  function changePeriodo(p: string | null) {
    if (!p || p === periodo) return;
    router.push(
      `/inteligencia/metas/${brand.slug}?periodo=${encodeURIComponent(p)}`,
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await upsertTarget({
        brand_id: brand.id,
        unit_id: null,
        periodo,
        receita_meta: receita || null,
        cmv_meta_pct: cmv || null,
        prime_cost_meta_pct: prime || null,
        ticket_medio_meta: ticket || null,
        nps_meta: nps || null,
        headcount_meta: headcount || null,
        eventos_meta: eventos || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Link
        href="/inteligencia/metas"
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
        Metas
      </Link>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: brand.color ?? "var(--text-3)",
            }}
          />
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: "var(--text)",
                letterSpacing: -0.3,
              }}
            >
              {brand.name}
            </h1>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              Metas e atingimento por período
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Período</span>
          <Select value={periodo} onValueChange={changePeriodo}>
            <SelectTrigger style={{ minWidth: 130 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodoOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <EvolucaoChart points={evolucao} brandColor={brand.color} />

      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            marginTop: 16,
            marginBottom: 16,
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
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                margin: 0,
                color: "var(--text)",
              }}
            >
              Definir metas — {periodo}
            </h3>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              Vazio = sem meta definida
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <Field label="Receita (R$)">
              <Input
                type="number"
                inputMode="decimal"
                step="100"
                min="0"
                value={receita}
                onChange={(e) => setReceita(e.target.value)}
                placeholder="350000"
              />
            </Field>
            <Field label="CMV (%)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                value={cmv}
                onChange={(e) => setCmv(e.target.value)}
                placeholder="32.0"
              />
            </Field>
            <Field label="Prime cost (%)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                value={prime}
                onChange={(e) => setPrime(e.target.value)}
                placeholder="60.0"
              />
            </Field>
            <Field label="Ticket médio (R$)">
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                placeholder="180"
              />
            </Field>
            <Field label="NPS">
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                max="100"
                value={nps}
                onChange={(e) => setNps(e.target.value)}
                placeholder="70"
              />
            </Field>
            <Field label="Headcount">
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="42"
              />
            </Field>
            <Field label="Eventos">
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={eventos}
                onChange={(e) => setEventos(e.target.value)}
                placeholder="12"
              />
            </Field>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                background: "rgba(239,68,68,0.10)",
                border: "1px solid rgba(239,68,68,0.30)",
                borderRadius: 6,
                fontSize: 11,
                color: "#B91C1C",
              }}
            >
              {error}
            </div>
          )}
          {saved && !error && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.30)",
                borderRadius: 6,
                fontSize: 11,
                color: "#15803D",
              }}
            >
              Metas salvas pra {periodo}.
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar metas
            </Button>
          </div>
        </div>
      </form>

      <HistoryTable history={history} />
    </div>
  );
}

function HistoryTable({ history }: { history: BrandTarget[] }) {
  if (history.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        Histórico de metas
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead>Receita</TableHead>
            <TableHead>CMV</TableHead>
            <TableHead>Prime cost</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead>NPS</TableHead>
            <TableHead>Headcount</TableHead>
            <TableHead>Eventos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((t) => (
            <TableRow key={t.id}>
              <TableCell
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {t.periodo}
              </TableCell>
              <TableCell style={cellNum}>{formatBRL(t.receita_meta)}</TableCell>
              <TableCell style={cellNum}>{formatPct(t.cmv_meta_pct)}</TableCell>
              <TableCell style={cellNum}>
                {formatPct(t.prime_cost_meta_pct)}
              </TableCell>
              <TableCell style={cellNum}>{formatBRL(t.ticket_medio_meta)}</TableCell>
              <TableCell style={cellNum}>
                {t.nps_meta == null ? "—" : Number(t.nps_meta).toFixed(0)}
              </TableCell>
              <TableCell style={cellNum}>
                {t.headcount_meta ?? "—"}
              </TableCell>
              <TableCell style={cellNum}>
                {t.eventos_meta ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const cellNum: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-2)",
  fontVariantNumeric: "tabular-nums",
};

/**
 * Gráfico SVG de evolução: barras de meta + linha de realizado por mês.
 * Escala automática (max entre meta e realizado de toda série).
 */
function EvolucaoChart({
  points,
  brandColor,
}: {
  points: EvolucaoPoint[];
  brandColor: string | null;
}) {
  const hasData = points.some((p) => p.meta != null || p.realizado != null);
  if (!hasData) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 12,
        }}
      >
        Sem dados de receita nos últimos 12 meses pra exibir gráfico.
      </div>
    );
  }

  const W = 880;
  const H = 220;
  const PAD_T = 16;
  const PAD_B = 32;
  const PAD_L = 60;
  const PAD_R = 16;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Escala
  const max =
    Math.max(
      ...points.map((p) => Math.max(p.meta ?? 0, p.realizado ?? 0)),
      1,
    ) * 1.1;

  const slot = innerW / points.length;
  const barW = Math.max(8, Math.min(28, slot * 0.45));

  function yFor(v: number) {
    return PAD_T + innerH - (v / max) * innerH;
  }

  // Linha do realizado (apenas pontos com valor)
  const pathPts = points
    .map((p, idx) => {
      if (p.realizado == null) return null;
      const x = PAD_L + slot * idx + slot / 2;
      const y = yFor(p.realizado);
      return { x, y };
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  const linePath =
    pathPts.length === 0
      ? ""
      : pathPts
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13, color: "var(--text)" }}>
          Receita: meta vs realizado (últimos 12 meses)
        </strong>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            display: "inline-flex",
            gap: 14,
          }}
        >
          <LegendDot color="var(--brand-soft)" outline="var(--brand)" label="Meta" />
          <LegendDot
            color={brandColor ?? "var(--brand)"}
            outline={brandColor ?? "var(--brand)"}
            label="Realizado"
            line
          />
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Eixo Y: 0, 25%, 50%, 75%, 100% */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => {
          const v = max * g;
          const y = yFor(v);
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={g === 0 ? "0" : "3 3"}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-3)"
              >
                {fmtAxis(v)}
              </text>
            </g>
          );
        })}

        {/* Barras de meta */}
        {points.map((p, idx) => {
          if (p.meta == null) return null;
          const x = PAD_L + slot * idx + slot / 2 - barW / 2;
          const y = yFor(p.meta);
          const h = PAD_T + innerH - y;
          return (
            <rect
              key={`m-${p.periodo}`}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill="var(--brand-soft)"
              stroke="var(--brand)"
              strokeWidth={1}
            />
          );
        })}

        {/* Linha do realizado */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={brandColor ?? "var(--brand)"}
            strokeWidth={2}
          />
        )}
        {pathPts.map((pt, i) => (
          <circle
            key={`r-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill={brandColor ?? "var(--brand)"}
          />
        ))}

        {/* Labels eixo X */}
        {points.map((p, idx) => {
          const x = PAD_L + slot * idx + slot / 2;
          return (
            <text
              key={`x-${p.periodo}`}
              x={x}
              y={H - 12}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-3)"
            >
              {p.periodo.slice(2)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function LegendDot({
  color,
  outline,
  label,
  line,
}: {
  color: string;
  outline: string;
  label: string;
  line?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 14,
          height: line ? 2 : 8,
          borderRadius: line ? 1 : 2,
          background: color,
          border: line ? "none" : `1px solid ${outline}`,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function fmtAxis(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
