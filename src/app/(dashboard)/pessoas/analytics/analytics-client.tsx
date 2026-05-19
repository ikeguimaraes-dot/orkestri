"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsData } from "./actions";

const BLUE = "#3B82F6";
const GREEN = "#22C55E";
const RED = "#EF4444";
const PURPLE = "#8B5CF6";
const MUTED = "#94A3B8";

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasTth = data.tth !== null && data.tth.length > 0;

  if (!mounted) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
          gap: 16,
        }}
      >
        {[1, 2, 3, ...(hasTth ? [4] : [])].map((i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              height: 320,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
        gap: 16,
      }}
    >
      {/* 1. Turnover mensal */}
      <ChartCard
        title="Turnover mensal"
        subtitle="Admissões vs demissões nos últimos 12 meses"
        empty={data.turnover.every((d) => d.admissoes === 0 && d.demissoes === 0)}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.turnover} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="admissoes" name="Admissões" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="demissoes" name="Demissões" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Absenteísmo por unidade */}
      <ChartCard
        title="Absenteísmo por unidade"
        subtitle="Total de faltas registradas nos últimos 12 meses"
        empty={data.absenteismo.length === 0}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data.absenteismo}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: MUTED }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="unit"
              tick={{ fontSize: 11, fill: MUTED }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="faltas" name="Faltas" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Headcount histórico */}
      <ChartCard
        title="Headcount histórico"
        subtitle="Colaboradores ativos ao final de cada mês"
        empty={data.headcount.every((d) => d.headcount === 0)}
        wide={!hasTth}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.headcount} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="headcount"
              name="Headcount"
              stroke={PURPLE}
              strokeWidth={2.5}
              dot={{ r: 3, fill: PURPLE, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Time-to-hire (omite se sem dados) */}
      {hasTth && (
        <ChartCard
          title="Time-to-hire"
          subtitle="Média de dias até aprovação do candidato"
          empty={false}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.tth!} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} unit="d" />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val) => [`${val ?? 0} dias`, "TTH médio"]}
              />
              <Line
                type="monotone"
                dataKey="dias"
                name="TTH médio"
                stroke={BLUE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: BLUE, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  empty,
  wide,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  empty: boolean;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{subtitle}</div>
      </div>
      {empty ? (
        <div
          style={{
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface-2)",
            borderRadius: 8,
          }}
        >
          Sem dados no período
        </div>
      ) : (
        children
      )}
    </div>
  );
}
