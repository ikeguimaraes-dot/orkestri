"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  DollarSign, Upload, Settings, ChevronUp, ChevronDown,
  X, CheckCircle2, AlertCircle, Loader2, Edit3, Check, Star,
} from "lucide-react";
import {
  getGorjetaDias,
  upsertCargoPonto,
  importGorjetaExcel,
} from "@/lib/pessoas/gorjeta-actions";
import type {
  GorjetaPeriodo,
  GorjetaDia,
  GorjetaCargoPonto,
  GorjetaImportPayload,
} from "@/lib/pessoas/gorjeta-actions";
import { formatBRL } from "@/lib/format";

// ── Constants ─────────────────────────────────────────────────────────────────

const MESES_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const DEFAULT_CARGOS: Array<{ cargo: string; pontos: number }> = [
  { cargo: "Gerente", pontos: 25 },
  { cargo: "Maître CLT", pontos: 12 },
  { cargo: "Maître PJ", pontos: 12 },
  { cargo: "Chefe de Fila", pontos: 10 },
  { cargo: "Sub-Chefe de Cozinha", pontos: 13 },
  { cargo: "Parrileiro Lider", pontos: 13 },
  { cargo: "Cozinheiro Lider", pontos: 7 },
  { cargo: "Bartender I", pontos: 7 },
  { cargo: "Bartender II", pontos: 5 },
  { cargo: "Barback", pontos: 4 },
  { cargo: "Garçom I", pontos: 7 },
  { cargo: "Garçom I.8", pontos: 8 },
  { cargo: "Garçom II", pontos: 6 },
  { cargo: "Cumim", pontos: 4 },
  { cargo: "Cozinheiro I", pontos: 7 },
  { cargo: "Cozinheiro II", pontos: 5 },
  { cargo: "Parrileiro I", pontos: 7 },
  { cargo: "Parrileiro II", pontos: 5 },
  { cargo: "Auxiliar de Cozinha", pontos: 4 },
  { cargo: "Ajudante de Cozinha", pontos: 4 },
  { cargo: "Auxiliar de Limpeza", pontos: 3 },
  { cargo: "Auxiliar de Limpeza II", pontos: 3 },
  { cargo: "Estoquista", pontos: 4 },
  { cargo: "Confeiteiro", pontos: 5 },
];

// ── Excel parser ──────────────────────────────────────────────────────────────

type ParsedExcel = {
  payload: GorjetaImportPayload;
  previewColabs: Array<{ nome: string; cargo: string; total: number; dias: number }>;
};

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function parseGorjetaExcel(file: File): Promise<ParsedExcel | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let XLSX: any;
  try {
    XLSX = await import("xlsx");
  } catch {
    return { error: "Biblioteca xlsx não disponível. Recarregue a página." };
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

  const sheetName =
    wb.SheetNames.find((n: string) => /valor/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) return { error: "Nenhuma aba encontrada no arquivo." };

  const ws = wb.Sheets[sheetName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row: first row with >= 5 Date objects
  let headerRowIdx = -1;
  const dateColMap: Array<{ colIdx: number; dateStr: string }> = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    const dateCols: Array<{ colIdx: number; dateStr: string }> = [];
    for (let j = 0; j < row.length; j++) {
      if (row[j] instanceof Date) {
        dateCols.push({ colIdx: j, dateStr: isoLocal(row[j] as Date) });
      }
    }
    if (dateCols.length >= 5) {
      headerRowIdx = i;
      dateColMap.push(...dateCols);
      break;
    }
  }

  if (dateColMap.length === 0) {
    return {
      error:
        "Nenhuma data encontrada no arquivo. Verifique se as células de data estão formatadas como data no Excel.",
    };
  }

  const toNum = (v: unknown): number => (typeof v === "number" ? v : 0);
  const firstDateColIdx = dateColMap[0]?.colIdx ?? 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let receitaRow: any[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let impostosRow: any[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pontosRow: any[] | null = null;
  const colabRows: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row: any[];
    nome: string;
    cargo: string;
  }> = [];

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    const label = String(row[0] ?? "").trim().toUpperCase();
    if (!label) continue;
    if (label.includes("VALOR TOTAL POR DIA") || label.includes("VALOR DO DIA")) {
      receitaRow = row;
      continue;
    }
    if (label.includes("IMPOSTOS") || label.includes("IMPOSTO")) {
      impostosRow = row;
      continue;
    }
    if (label.includes("TOTAL DE PONTOS") || label.includes("PONTOS DO DIA")) {
      pontosRow = row;
      continue;
    }
    if (
      label.startsWith("TOTAL") ||
      label.startsWith("SUBTOTAL") ||
      label.startsWith("MÉDIA") ||
      label.startsWith("MEDIA")
    )
      continue;

    const hasDayValues = dateColMap.some((d) => toNum(row[d.colIdx]) > 0);
    if (!hasDayValues) continue;

    const nome = String(row[0] ?? "").trim();
    const cargo = firstDateColIdx >= 2 ? String(row[1] ?? "").trim() : "";
    colabRows.push({ row, nome, cargo });
  }

  if (colabRows.length === 0) {
    return { error: "Nenhum colaborador encontrado no arquivo." };
  }

  // Date range
  const dateObjs = dateColMap.map((d) => {
    const parts = d.dateStr.split("-").map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(y, m - 1, day);
  });
  const minDate = dateObjs[0] ?? new Date();
  const maxDate = dateObjs[dateObjs.length - 1] ?? new Date();

  // Quinzena detection: Q2 = days 11–25, Q1 = days 26–10 (spans months)
  const firstDay = minDate.getDate();
  const lastDay = maxDate.getDate();
  const quinzena: 1 | 2 = firstDay >= 11 && lastDay <= 25 ? 2 : 1;

  // Period label uses the last date's month
  const periodo = `${MESES_PT[maxDate.getMonth()]}/${String(maxDate.getFullYear()).slice(2)}`;

  // Summary rows
  const totalReceita = receitaRow
    ? dateColMap.reduce((s, d) => s + toNum(receitaRow![d.colIdx]), 0)
    : 0;
  const totalImpostos = impostosRow
    ? dateColMap.reduce((s, d) => s + toNum(impostosRow![d.colIdx]), 0)
    : 0;
  const imposto_pct =
    totalReceita > 0 ? Math.round((totalImpostos / totalReceita) * 100) : 20;
  const total_pontos = pontosRow
    ? dateColMap.reduce((s, d) => s + toNum(pontosRow![d.colIdx]), 0)
    : 0;

  const colaboradores = colabRows.map(({ row, nome, cargo }) => ({
    nome,
    cargo,
    dias: dateColMap.map((d) => {
      const val = toNum(row[d.colIdx]);
      return { data: d.dateStr, valor_calculado: val, presente: val > 0 };
    }),
  }));

  const previewColabs = colaboradores
    .map((c) => ({
      nome: c.nome,
      cargo: c.cargo,
      total: c.dias.reduce((s, d) => s + d.valor_calculado, 0),
      dias: c.dias.filter((d) => d.presente).length,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    payload: {
      periodo,
      quinzena,
      data_inicio: isoLocal(minDate),
      data_fim: isoLocal(maxDate),
      receita_bruta: totalReceita,
      imposto_pct,
      total_pontos,
      colaboradores,
    },
    previewColabs,
  };
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Sortable Th ───────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
  style,
  align = "left",
}: {
  label: string;
  sortKey: string;
  current: string | null;
  dir: SortDir;
  onSort: (k: string) => void;
  style?: React.CSSProperties;
  align?: "left" | "right";
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        padding: "9px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: active ? "var(--brand)" : "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        whiteSpace: "nowrap",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        textAlign: align,
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          width: "100%",
        }}
      >
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronDown size={12} style={{ opacity: 0.3 }} />
        )}
      </span>
    </th>
  );
}

// ── Collaborator drawer ───────────────────────────────────────────────────────

function ColabDrawer({
  nome,
  cargo,
  dias,
  periodos,
  onClose,
}: {
  nome: string;
  cargo: string;
  dias: GorjetaDia[];
  periodos: GorjetaPeriodo[];
  onClose: () => void;
}) {
  const periodoMap = useMemo(() => {
    const m = new Map<string, number>(); // periodoId → quinzena
    for (const p of periodos) m.set(p.id, p.quinzena);
    return m;
  }, [periodos]);

  const colabDias = dias
    .filter((d) => d.nome === nome)
    .sort((a, b) => a.data.localeCompare(b.data));

  const q1Total = colabDias
    .filter((d) => periodoMap.get(d.periodo_id ?? "") === 1)
    .reduce((s, d) => s + d.valor_calculado, 0);
  const q2Total = colabDias
    .filter((d) => periodoMap.get(d.periodo_id ?? "") === 2)
    .reduce((s, d) => s + d.valor_calculado, 0);
  const geral = q1Total + q2Total;

  const dateLabel = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 41,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {nome}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              {cargo || "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Totals summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {[
            { label: "1ª Quinzena", value: q1Total },
            { label: "2ª Quinzena", value: q2Total },
            { label: "Total", value: geral },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {formatBRL(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Day-by-day table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Data", "Quinz.", "Pts", "Presente", "Gorjeta"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "7px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      textAlign: i >= 2 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colabDias.map((dia, i) => {
                const quinz = periodoMap.get(dia.periodo_id ?? "") ?? 0;
                return (
                  <tr
                    key={dia.id}
                    style={{
                      background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    }}
                  >
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
                      {dateLabel(dia.data)}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--text-3)", textAlign: "right" }}>
                      {quinz > 0 ? `${quinz}ª` : "—"}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {dia.pontos > 0 ? dia.pontos : "—"}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", textAlign: "right", color: dia.presente ? "#16A34A" : "#DC2626" }}>
                      {dia.presente ? "Sim" : "Não"}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: dia.valor_calculado > 0 ? "var(--text)" : "var(--text-3)" }}>
                      {dia.valor_calculado > 0 ? formatBRL(dia.valor_calculado) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </aside>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GorjetasClient({
  unitId,
  unitName,
  initialPeriodos,
  initialCargoPontos,
}: {
  unitId: string;
  unitName: string;
  initialPeriodos: GorjetaPeriodo[];
  initialCargoPontos: GorjetaCargoPonto[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [periodos, setPeriodos] = useState<GorjetaPeriodo[]>(initialPeriodos);
  const [cargoPontos, setCargoPontos] = useState<GorjetaCargoPonto[]>(initialCargoPontos);
  const [activeTab, setActiveTab] = useState<"resumo" | "config" | "importar">("resumo");
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(
    initialPeriodos[0]?.periodo ?? null,
  );
  const [quinzenaFilter, setQuinzenaFilter] = useState<0 | 1 | 2>(0);
  const [dias, setDias] = useState<GorjetaDia[]>([]);
  const [loadingDias, setLoadingDias] = useState(false);
  const [drawerNome, setDrawerNome] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Config tab state
  const [editingCargo, setEditingCargo] = useState<string | null>(null);
  const [editPontos, setEditPontos] = useState<string>("");
  const [savingCargo, setSavingCargo] = useState<string | null>(null);
  // Import tab state
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Load dias when period/quinzena changes
  useEffect(() => {
    if (!selectedPeriodo) { setDias([]); return; }
    const matchIds = periodos
      .filter(
        (p) =>
          p.periodo === selectedPeriodo &&
          (quinzenaFilter === 0 || p.quinzena === quinzenaFilter),
      )
      .map((p) => p.id);
    if (matchIds.length === 0) { setDias([]); return; }
    setLoadingDias(true);
    getGorjetaDias(matchIds)
      .then((d) => { setDias(d); setLoadingDias(false); })
      .catch(() => setLoadingDias(false));
  }, [selectedPeriodo, quinzenaFilter, periodos]);

  // ── Derived

  const uniquePeriodos = useMemo(() => {
    const seen = new Set<string>();
    return periodos
      .filter((p) => { if (seen.has(p.periodo)) return false; seen.add(p.periodo); return true; })
      .map((p) => p.periodo);
  }, [periodos]);

  const selectedPeriodosData = useMemo(
    () =>
      periodos.filter(
        (p) =>
          p.periodo === selectedPeriodo &&
          (quinzenaFilter === 0 || p.quinzena === quinzenaFilter),
      ),
    [periodos, selectedPeriodo, quinzenaFilter],
  );

  const kpis = useMemo(() => {
    const totalBruto = selectedPeriodosData.reduce((s, p) => s + Number(p.receita_bruta), 0);
    const totalLiquido = selectedPeriodosData.reduce((s, p) => s + Number(p.valor_liquido), 0);
    const totalPontos = selectedPeriodosData.reduce((s, p) => s + Number(p.total_pontos), 0);
    const valorMedioPonto = totalPontos > 0 ? totalLiquido / totalPontos : 0;
    const numColaboradores = new Set(
      dias.filter((d) => d.valor_calculado > 0).map((d) => d.nome),
    ).size;
    return { totalBruto, totalLiquido, valorMedioPonto, numColaboradores };
  }, [selectedPeriodosData, dias]);

  const periodoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of periodos) m.set(p.id, p.quinzena);
    return m;
  }, [periodos]);

  const colaboradoresResumo = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; cargo: string; pontos: number; q1: number; q2: number; presencas: number }
    >();
    for (const dia of dias) {
      if (!dia.presente || dia.valor_calculado <= 0) continue;
      const q = periodoMap.get(dia.periodo_id ?? "") ?? 0;
      if (!map.has(dia.nome)) {
        map.set(dia.nome, {
          nome: dia.nome,
          cargo: dia.cargo ?? "",
          pontos: dia.pontos,
          q1: 0,
          q2: 0,
          presencas: 0,
        });
      }
      const e = map.get(dia.nome)!;
      if (q === 1) e.q1 += dia.valor_calculado;
      else if (q === 2) e.q2 += dia.valor_calculado;
      e.presencas++;
    }
    let list = Array.from(map.values()).map((e) => ({ ...e, total: e.q1 + e.q2 }));
    list = [...list].sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [dias, periodoMap, sortKey, sortDir]);

  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const thProps = { current: sortKey, dir: sortDir, onSort: handleSort };

  // ── Config tab: merged default + DB cargos

  const configRows = useMemo(() => {
    const dbMap = new Map(cargoPontos.map((c) => [c.cargo, c.pontos]));
    return DEFAULT_CARGOS.map((d) => ({
      cargo: d.cargo,
      pontos: dbMap.has(d.cargo) ? (dbMap.get(d.cargo) ?? d.pontos) : d.pontos,
      saved: dbMap.has(d.cargo),
    }));
  }, [cargoPontos]);

  const handleSaveCargo = useCallback(
    async (cargo: string, pontos: number) => {
      setSavingCargo(cargo);
      const result = await upsertCargoPonto(unitId, cargo, pontos);
      if (result.ok) {
        setCargoPontos((prev) => {
          const exists = prev.find((c) => c.cargo === cargo);
          if (exists) return prev.map((c) => (c.cargo === cargo ? { ...c, pontos } : c));
          return [...prev, result.data];
        });
      }
      setEditingCargo(null);
      setSavingCargo(null);
    },
    [unitId],
  );

  // ── Excel parse + import

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setParsed(null);
    setImportMsg(null);
    setFileName(file.name);
    const result = await parseGorjetaExcel(file);
    setParsing(false);
    if ("error" in result) {
      setImportMsg({ ok: false, text: result.error });
    } else {
      setParsed(result);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImportConfirm = useCallback(async () => {
    if (!parsed) return;
    setImporting(true);
    const result = await importGorjetaExcel(unitId, parsed.payload);
    if (!result.ok) {
      setImportMsg({ ok: false, text: result.error });
      setImporting(false);
      return;
    }
    // Refresh periods and auto-select
    const { getGorjetaPeriodos: refresh } = await import(
      "@/lib/pessoas/gorjeta-actions"
    );
    const newPeriodos = await refresh(unitId);
    setPeriodos(newPeriodos);
    setSelectedPeriodo(parsed.payload.periodo);
    setQuinzenaFilter(parsed.payload.quinzena);
    setParsed(null);
    setFileName(null);
    setImporting(false);
    setImportMsg({
      ok: true,
      text: `${result.data.count} registros importados — ${parsed.payload.periodo} ${parsed.payload.quinzena}ª quinzena`,
    });
    setActiveTab("resumo");
  }, [parsed, unitId]);

  const drawerColab = drawerNome
    ? (colaboradoresResumo.find((c) => c.nome === drawerNome) ?? null)
    : null;

  // ── Render

  return (
    <>
      {/* Header */}
      <header style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Gorjetas
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 0",
            color: "var(--text)",
            letterSpacing: -0.4,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <DollarSign size={22} style={{ color: "var(--brand)" }} />
          Gorjetas · Sistema de Pontos
        </h1>
      </header>

      {/* Period selector */}
      {uniquePeriodos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginRight: 4 }}>
            Períodos:
          </span>
          {uniquePeriodos.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriodo(p)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                border: `1px solid ${selectedPeriodo === p ? "var(--brand)" : "var(--border)"}`,
                background: selectedPeriodo === p ? "var(--brand-soft)" : "var(--surface-2)",
                color: selectedPeriodo === p ? "var(--brand)" : "var(--text-2)",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
          <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
            {([0, 1, 2] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuinzenaFilter(q)}
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 20,
                  border: `1px solid ${quinzenaFilter === q ? "var(--brand)" : "var(--border)"}`,
                  background: quinzenaFilter === q ? "var(--brand-soft)" : "var(--surface-2)",
                  color: quinzenaFilter === q ? "var(--brand)" : "var(--text-2)",
                  cursor: "pointer",
                }}
              >
                {q === 0 ? "Ambas" : `${q}ª`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      {(dias.length > 0 || selectedPeriodosData.length > 0) && !loadingDias && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <KpiCard
            label="Receita Bruta"
            value={formatBRL(kpis.totalBruto)}
            icon={<DollarSign size={11} />}
          />
          <KpiCard
            label="Total Líquido"
            value={formatBRL(kpis.totalLiquido)}
            sub={`após ${selectedPeriodosData[0]?.imposto_pct ?? 20}% impostos`}
            icon={<DollarSign size={11} />}
          />
          <KpiCard
            label="Valor Médio / Ponto"
            value={formatBRL(kpis.valorMedioPonto)}
            icon={<Star size={11} />}
          />
          <KpiCard
            label="Colaboradores"
            value={kpis.numColaboradores}
            sub={`${selectedPeriodo ?? ""} · ${unitName}`}
          />
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        {(
          [
            { key: "resumo", label: "Resumo", icon: <DollarSign size={13} /> },
            { key: "config", label: "Configuração de Pontos", icon: <Settings size={13} /> },
            { key: "importar", label: "Importar", icon: <Upload size={13} /> },
          ] as const
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderBottom: `2px solid ${activeTab === key ? "var(--brand)" : "transparent"}`,
              background: "none",
              color: activeTab === key ? "var(--brand)" : "var(--text-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.1s",
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumo ─────────────────────────────────────────────────────── */}

      {activeTab === "resumo" && (
        <>
          {loadingDias && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {!loadingDias && colaboradoresResumo.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              <DollarSign size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <div>Nenhum dado para o período selecionado.</div>
              <div style={{ marginTop: 4 }}>
                Importe uma planilha na aba{" "}
                <button
                  onClick={() => setActiveTab("importar")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontWeight: 600, fontSize: 13, padding: 0 }}
                >
                  Importar
                </button>.
              </div>
            </div>
          )}

          {!loadingDias && colaboradoresResumo.length > 0 && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <Th label="Colaborador" sortKey="nome" {...thProps} style={{ minWidth: 180 }} />
                      <Th label="Cargo" sortKey="cargo" {...thProps} />
                      <Th label="Pts" sortKey="pontos" {...thProps} align="right" />
                      <Th label="1ª Quinz." sortKey="q1" {...thProps} align="right" />
                      <Th label="2ª Quinz." sortKey="q2" {...thProps} align="right" />
                      <Th label="Total" sortKey="total" {...thProps} align="right" />
                      <Th label="Presenças" sortKey="presencas" {...thProps} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradoresResumo.map((colab, i) => (
                      <tr
                        key={colab.nome + i}
                        onClick={() => setDrawerNome(colab.nome)}
                        style={{
                          cursor: "pointer",
                          background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "var(--surface-3)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")
                        }
                      >
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>{colab.nome}</div>
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-2)" }}>
                          {colab.cargo || "—"}
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                          {colab.pontos > 0 ? colab.pontos : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: colab.q1 > 0 ? "var(--text)" : "var(--text-3)" }}>
                          {colab.q1 > 0 ? formatBRL(colab.q1) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: colab.q2 > 0 ? "var(--text)" : "var(--text-3)" }}>
                          {colab.q2 > 0 ? formatBRL(colab.q2) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--brand)" }}>
                          {formatBRL(colab.total)}
                        </td>
                        <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", color: "var(--text-3)" }}>
                          {colab.presencas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Config ─────────────────────────────────────────────────────── */}

      {activeTab === "config" && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--text-3)",
            }}
          >
            Configure os pontos por cargo. Esses valores são usados no cálculo da gorjeta ao importar.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Cargo", "Pontos", "Status", ""].map((h, i) => (
                  <th
                    key={h + i}
                    style={{
                      padding: "9px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                      textAlign: i >= 1 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configRows.map((row, i) => {
                const isEditing = editingCargo === row.cargo;
                const isSaving = savingCargo === row.cargo;
                return (
                  <tr
                    key={row.cargo}
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)" }}
                  >
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", fontWeight: 500, color: "var(--text)" }}>
                      {row.cargo}
                    </td>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPontos}
                          onChange={(e) => setEditPontos(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCargo(row.cargo, Number(editPontos));
                            if (e.key === "Escape") setEditingCargo(null);
                          }}
                          autoFocus
                          style={{
                            width: 64,
                            textAlign: "right",
                            padding: "4px 8px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "1px solid var(--brand)",
                            borderRadius: 6,
                            background: "var(--surface)",
                            color: "var(--text)",
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {row.pontos}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: row.saved ? "#16A34A" : "var(--text-3)",
                          background: row.saved ? "rgba(22,163,74,0.1)" : "var(--surface-3)",
                          borderRadius: 12,
                          padding: "2px 8px",
                        }}
                      >
                        {row.saved ? "Salvo" : "Padrão"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      {isSaving ? (
                        <Loader2 size={14} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
                      ) : isEditing ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleSaveCargo(row.cargo, Number(editPontos))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#16A34A", padding: 2 }}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => setEditingCargo(null)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCargo(row.cargo);
                            setEditPontos(String(row.pontos));
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Importar ────────────────────────────────────────────────────── */}

      {activeTab === "importar" && (
        <div>
          {/* Drop zone */}
          <div
            onClick={() => !parsing && !importing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!parsing && !importing) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
              borderRadius: 12,
              padding: parsed ? "14px 20px" : "48px 24px",
              textAlign: "center",
              cursor: parsing || importing ? "wait" : "pointer",
              background: dragging ? "var(--brand-soft)" : "var(--surface)",
              transition: "border-color 0.15s, background 0.15s",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: parsed ? "row" : "column",
              gap: 12,
              opacity: parsing || importing ? 0.7 : 1,
            }}
          >
            {parsing || importing ? (
              <Loader2 size={18} style={{ color: "var(--brand)", flexShrink: 0, animation: "spin 1s linear infinite" }} />
            ) : (
              <Upload size={parsed ? 18 : 28} style={{ color: dragging ? "var(--brand)" : "var(--text-3)", flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontWeight: 600, color: "var(--text)", fontSize: parsed ? 14 : 16 }}>
                {parsing
                  ? `Processando ${fileName ?? "arquivo"}…`
                  : importing
                  ? "Importando…"
                  : parsed
                  ? `Reimportar / trocar arquivo`
                  : "Arraste o Excel do Totvs (.xlsx) aqui ou clique para selecionar"}
              </div>
              {!parsed && !parsing && !importing && (
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
                  Aba "VALORES" — linhas VALOR TOTAL POR DIA · IMPOSTOS · TOTAL DE PONTOS DO DIA
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Import feedback */}
          {importMsg && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
                background: importMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${importMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              {importMsg.ok ? (
                <CheckCircle2 size={15} style={{ color: "#16A34A", flexShrink: 0 }} />
              ) : (
                <AlertCircle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: 13,
                  color: importMsg.ok ? "#16A34A" : "#DC2626",
                  fontWeight: 600,
                }}
              >
                {importMsg.text}
              </span>
              <button
                onClick={() => setImportMsg(null)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-3)",
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Preview */}
          {parsed && !importing && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    Preview — {parsed.payload.periodo} · {parsed.payload.quinzena}ª quinzena
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    {parsed.payload.data_inicio} → {parsed.payload.data_fim} ·{" "}
                    {parsed.previewColabs.length} colaboradores ·{" "}
                    Receita {formatBRL(parsed.payload.receita_bruta)} ·{" "}
                    Impostos {parsed.payload.imposto_pct}%
                  </div>
                </div>
                <button
                  onClick={handleImportConfirm}
                  style={{
                    padding: "9px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--brand)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Confirmar importação
                </button>
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  maxHeight: 400,
                  overflowY: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Nome", "Cargo", "Dias presente", "Total gorjeta"].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text-3)",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            background: "var(--surface-2)",
                            borderBottom: "1px solid var(--border)",
                            textAlign: i >= 2 ? "right" : "left",
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.previewColabs.map((c, i) => (
                      <tr
                        key={c.nome + i}
                        style={{
                          background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        }}
                      >
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid var(--border)", fontWeight: 600, color: "var(--text)" }}>
                          {c.nome}
                        </td>
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-2)" }}>
                          {c.cargo || "—"}
                        </td>
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", color: "var(--text-3)" }}>
                          {c.dias}
                        </td>
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--brand)" }}>
                          {formatBRL(c.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerNome && drawerColab && (
        <ColabDrawer
          nome={drawerNome}
          cargo={drawerColab.cargo}
          dias={dias}
          periodos={periodos}
          onClose={() => setDrawerNome(null)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
