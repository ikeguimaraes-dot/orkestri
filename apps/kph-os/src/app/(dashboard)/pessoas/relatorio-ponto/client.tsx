"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  FileBarChart2, Upload, ChevronUp, ChevronDown, X,
  AlertTriangle, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import {
  importPontoMensal,
  getPontoMensal,
  listPontoPeriodos,
} from "@/lib/pessoas/ponto-mensal-actions";
import type { PontoMensalRow, PontoMensalInput } from "@/lib/pessoas/ponto-mensal-actions";

// ── Types ────────────────────────────────────────────────────────────────────

interface PontoRow {
  matricula: string;
  nome: string;
  cpf: string;
  cargo: string;
  data_admissao: string;
  departamento: string;
  periodo: string;
  adicional_noturno: string;
  afastamentos_horas: string;
  afastamentos_dias: number;
  banco_horas_acumulado: string;
  banco_horas_mes: string;
  compensacao_bh: string;
  confraternizacao: string;
  falta_injustificada_horas: string;
  falta_injustificada_dias: number;
  ferias_horas: string;
  ferias_dias: number;
  feriodos_dias: number;
  feriados_dias: number;
  folga_domingo: string;
  folga_feriado: string;
  horas_previstas: string;
  horas_trabalhadas: string;
  horas_negativas: string;
  horas_positivas: string;
  inss_horas: string;
  inss_dias: number;
  licenca_paternidade_horas: string;
  licenca_paternidade_dias: number;
  saldo: string;
  abonado_horas: string;
  abonado_dias: number;
  atestado_medico: string;
  regime: string;
  demissao: string;
  nascimento: string;
  filial: string;
  is_total: boolean;
}

type SortKey = keyof PontoRow;
type SortDir = "asc" | "desc";

// ── CSV parser ────────────────────────────────────────────────────────────────

function parsePontoCSV(text: string): PontoRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const rows: PontoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(";");
    if (cols.length < 5) continue;

    const g = (idx: number) => (cols[idx] ?? "").trim();
    const n = (idx: number) => {
      const v = parseInt(g(idx), 10);
      return isNaN(v) ? 0 : v;
    };

    rows.push({
      matricula: g(0),
      nome: g(1),
      cpf: g(2),
      cargo: g(3),
      data_admissao: g(4),
      demissao: g(5),
      nascimento: g(6),
      departamento: g(7),
      filial: g(8),
      regime: g(9),
      abonado_horas: g(10),
      abonado_dias: n(11),
      atestado_medico: g(12),
      adicional_noturno: g(13),
      afastamentos_horas: g(14),
      afastamentos_dias: n(15),
      banco_horas_acumulado: g(16),
      banco_horas_mes: g(17),
      compensacao_bh: g(18),
      confraternizacao: g(19),
      falta_injustificada_horas: g(20),
      falta_injustificada_dias: n(21),
      ferias_horas: g(22),
      ferias_dias: n(23),
      feriados_dias: n(24),
      feriodos_dias: n(24),
      folga_domingo: g(25),
      folga_feriado: g(26),
      horas_previstas: g(27),
      horas_trabalhadas: g(28),
      horas_negativas: g(29),
      horas_positivas: g(30),
      inss_horas: g(31),
      inss_dias: n(32),
      licenca_paternidade_horas: g(33),
      licenca_paternidade_dias: n(34),
      periodo: g(35),
      saldo: g(36),
      is_total: g(0) === "",
    });
  }

  return rows;
}

function dbRowToPontoRow(r: PontoMensalRow): PontoRow {
  return {
    matricula: r.matricula ?? "",
    nome: r.nome,
    cpf: r.cpf ?? "",
    cargo: r.cargo ?? "",
    data_admissao: r.data_admissao ?? "",
    departamento: r.departamento ?? "",
    periodo: r.periodo,
    adicional_noturno: r.adicional_noturno ?? "",
    afastamentos_horas: r.afastamentos_horas ?? "",
    afastamentos_dias: r.afastamentos_dias,
    banco_horas_acumulado: r.banco_horas_acumulado ?? "",
    banco_horas_mes: r.banco_horas_mes ?? "",
    compensacao_bh: r.compensacao_bh ?? "",
    confraternizacao: r.confraternizacao ?? "",
    falta_injustificada_horas: r.falta_injustificada_horas ?? "",
    falta_injustificada_dias: r.falta_injustificada_dias,
    ferias_horas: r.ferias_horas ?? "",
    ferias_dias: r.ferias_dias,
    feriados_dias: r.feriados_dias,
    feriodos_dias: r.feriados_dias,
    folga_domingo: r.folga_domingo ?? "",
    folga_feriado: r.folga_feriado ?? "",
    horas_previstas: r.horas_previstas ?? "",
    horas_trabalhadas: r.horas_trabalhadas ?? "",
    horas_negativas: r.horas_negativas ?? "",
    horas_positivas: r.horas_positivas ?? "",
    inss_horas: r.inss_horas ?? "",
    inss_dias: r.inss_dias,
    licenca_paternidade_horas: r.licenca_paternidade_horas ?? "",
    licenca_paternidade_dias: r.licenca_paternidade_dias,
    saldo: r.saldo ?? "",
    abonado_horas: r.abonado_horas ?? "",
    abonado_dias: r.abonado_dias,
    atestado_medico: r.atestado_medico ?? "",
    // campos não persistidos — ficam vazios ao ler do banco
    regime: "",
    nascimento: "",
    filial: "",
    demissao: r.data_demissao ?? "",
    // totais detectados por matrícula vazia (não há coluna is_total na tabela)
    is_total: !r.matricula || r.matricula === "",
  };
}

function pontoRowToInput(r: PontoRow): PontoMensalInput {
  return {
    matricula: r.matricula,
    nome: r.nome,
    cpf: r.cpf,
    cargo: r.cargo,
    departamento: r.departamento,
    data_admissao: r.data_admissao,
    data_demissao: r.demissao,
    horas_previstas: r.horas_previstas,
    horas_trabalhadas: r.horas_trabalhadas,
    horas_negativas: r.horas_negativas,
    horas_positivas: r.horas_positivas,
    saldo: r.saldo,
    banco_horas_acumulado: r.banco_horas_acumulado,
    banco_horas_mes: r.banco_horas_mes,
    compensacao_bh: r.compensacao_bh,
    adicional_noturno: r.adicional_noturno,
    falta_injustificada_horas: r.falta_injustificada_horas,
    falta_injustificada_dias: r.falta_injustificada_dias,
    atestado_medico: r.atestado_medico,
    abonado_horas: r.abonado_horas,
    abonado_dias: r.abonado_dias,
    afastamentos_horas: r.afastamentos_horas,
    afastamentos_dias: r.afastamentos_dias,
    inss_horas: r.inss_horas,
    inss_dias: r.inss_dias,
    ferias_horas: r.ferias_horas,
    ferias_dias: r.ferias_dias,
    licenca_paternidade_horas: r.licenca_paternidade_horas,
    licenca_paternidade_dias: r.licenca_paternidade_dias,
    folga_domingo: r.folga_domingo,
    folga_feriado: r.folga_feriado,
    feriados_dias: r.feriados_dias,
    confraternizacao: r.confraternizacao,
  };
}

// ── Time math helpers ─────────────────────────────────────────────────────────

function hhmm2min(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/:00$/, "");
  const parts = clean.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  if (isNaN(h)) return 0;
  return (h || 0) * 60 + (m || 0);
}

function min2hhhmm(total: number): string {
  const h = Math.floor(Math.abs(total) / 60);
  const m = Math.abs(total) % 60;
  const sign = total < 0 ? "-" : "";
  return `${sign}${String(h).padStart(3, "0")}:${String(m).padStart(2, "0")}`;
}

function isNegHours(s: string): boolean {
  if (!s || s === "00:00" || s === "00:00:00") return false;
  return true;
}

// ── Alert banner ──────────────────────────────────────────────────────────────

const ALERT_LIMIT = 12;

function AlertBanner({
  tipo,
  items,
  expanded,
  onToggle,
}: {
  tipo: "faltas" | "negativas";
  items: PontoRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isFaltas = tipo === "faltas";
  const titleColor = isFaltas ? "#DC2626" : "#A16207";
  const visible = expanded ? items : items.slice(0, ALERT_LIMIT);
  const hasMore = items.length > ALERT_LIMIT;

  function badgeColor(row: PontoRow) {
    if (isFaltas) return "#DC2626";
    return hhmm2min(row.horas_negativas) >= 600 ? "#DC2626" : "#A16207";
  }
  function badgeBg(row: PontoRow) {
    if (isFaltas) return "rgba(239,68,68,0.18)";
    return hhmm2min(row.horas_negativas) >= 600 ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)";
  }
  function badgeText(row: PontoRow) {
    if (isFaltas)
      return `${row.falta_injustificada_dias} dia${row.falta_injustificada_dias > 1 ? "s" : ""}`;
    return `${row.horas_negativas}h`;
  }

  return (
    <div
      style={{
        background: isFaltas ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
        border: `1px solid ${isFaltas ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {isFaltas
          ? <AlertCircle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
          : <AlertTriangle size={16} style={{ color: "#A16207", flexShrink: 0 }} />
        }
        <span style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>
          {isFaltas ? "Faltas injustificadas detectadas" : "Horas negativas no mês"}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            background: isFaltas ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)",
            color: titleColor,
            borderRadius: 20,
            padding: "2px 8px",
          }}
        >
          {items.length} colaborador{items.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Grid 3 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {visible.map((row, i) => (
          <div
            key={(row.matricula || "x") + i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 6, borderRadius: 7, padding: "6px 10px",
              background: isFaltas ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
              border: `1px solid ${isFaltas ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"}`,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, minWidth: 0,
              }}
            >
              {row.nome}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 700,
                color: badgeColor(row), background: badgeBg(row),
                borderRadius: 12, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {badgeText(row)}
            </span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={onToggle}
          style={{
            marginTop: 8, background: "none", border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            color: titleColor, padding: "4px 0",
          }}
        >
          {expanded ? "Mostrar menos" : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, warn, danger,
}: {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
  danger?: boolean;
}) {
  const bg = danger
    ? "rgba(239,68,68,0.08)"
    : warn
    ? "rgba(245,158,11,0.08)"
    : "var(--surface)";
  const color = danger ? "#DC2626" : warn ? "#A16207" : "var(--text)";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : warn ? "rgba(245,158,11,0.25)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Sortable header ───────────────────────────────────────────────────────────

function Th({
  label, sortKey, current, dir, onSort, style,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  style?: React.CSSProperties;
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
        textAlign: "left",
        ...style,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
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

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 8,
          paddingBottom: 4,
          borderBottom: "2px solid var(--brand-soft)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Drawer({ row, onClose }: { row: PontoRow; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40,
        }}
      />
      <aside
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          zIndex: 41, overflowY: "auto", padding: "24px 20px",
          display: "flex", flexDirection: "column", gap: 0,
        }}
      >
        <div
          style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {row.nome || "Totais"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              {row.cargo}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", padding: 4, borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <DrawerSection title="Identificação">
          <DetailRow label="Matrícula" value={row.matricula} />
          <DetailRow label="CPF" value={row.cpf} />
          <DetailRow label="Cargo" value={row.cargo} />
          <DetailRow label="Admissão" value={row.data_admissao} />
          <DetailRow label="Departamento" value={row.departamento} />
          <DetailRow label="Filial" value={row.filial} />
          <DetailRow label="Regime" value={row.regime} />
          {row.demissao && <DetailRow label="Demissão" value={row.demissao} />}
          {row.nascimento && <DetailRow label="Nascimento" value={row.nascimento} />}
        </DrawerSection>

        <DrawerSection title="Período">
          <DetailRow label="Período" value={row.periodo} />
          <DetailRow label="Horas Previstas" value={row.horas_previstas} />
          <DetailRow label="Horas Trabalhadas" value={row.horas_trabalhadas} />
          <DetailRow label="Horas Negativas" value={row.horas_negativas} />
          <DetailRow label="Horas Positivas" value={row.horas_positivas} />
          <DetailRow label="Saldo" value={row.saldo} />
        </DrawerSection>

        <DrawerSection title="Banco de Horas">
          <DetailRow label="Acumulado" value={row.banco_horas_acumulado} />
          <DetailRow label="No Mês" value={row.banco_horas_mes} />
          <DetailRow label="Compensação BH" value={row.compensacao_bh} />
        </DrawerSection>

        <DrawerSection title="Ausências">
          <DetailRow label="Falta Injustificada (h)" value={row.falta_injustificada_horas} />
          <DetailRow label="Falta Injustificada (dias)" value={row.falta_injustificada_dias || ""} />
          <DetailRow label="Atestado Médico" value={row.atestado_medico} />
          <DetailRow label="Abonado (h)" value={row.abonado_horas} />
          <DetailRow label="Abonado (dias)" value={row.abonado_dias || ""} />
          <DetailRow label="Afastamentos (h)" value={row.afastamentos_horas} />
          <DetailRow label="Afastamentos (dias)" value={row.afastamentos_dias || ""} />
          <DetailRow label="INSS (h)" value={row.inss_horas} />
          <DetailRow label="INSS (dias)" value={row.inss_dias || ""} />
          <DetailRow label="Férias (h)" value={row.ferias_horas} />
          <DetailRow label="Férias (dias)" value={row.ferias_dias || ""} />
          <DetailRow label="Licença Paternidade (h)" value={row.licenca_paternidade_horas} />
          <DetailRow label="Licença Paternidade (dias)" value={row.licenca_paternidade_dias || ""} />
        </DrawerSection>

        <DrawerSection title="Extras">
          <DetailRow label="Adicional Noturno" value={row.adicional_noturno} />
          <DetailRow label="Folga Domingo" value={row.folga_domingo} />
          <DetailRow label="Folga Feriado" value={row.folga_feriado} />
          <DetailRow label="Feriados (dias)" value={row.feriados_dias || ""} />
          <DetailRow label="Confraternização" value={row.confraternizacao} />
        </DrawerSection>
      </aside>
    </>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function PontoMensalClient({
  unitId,
  unitName,
  initialPeriodos,
}: {
  unitId: string;
  unitName: string;
  initialPeriodos: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [periodos, setPeriodos] = useState<string[]>(initialPeriodos);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string | null>(
    initialPeriodos[0] ?? null,
  );
  const [rows, setRows] = useState<PontoRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("Todos");
  const [selected, setSelected] = useState<PontoRow | null>(null);
  const [expandedFaltas, setExpandedFaltas] = useState(false);
  const [expandedNegativas, setExpandedNegativas] = useState(false);

  // Load rows from DB when period changes
  useEffect(() => {
    if (!selectedPeriodo) { setRows([]); return; }
    setLoadingRows(true);
    getPontoMensal(unitId, selectedPeriodo).then((dbRows) => {
      setRows(dbRows.map(dbRowToPontoRow));
      setLoadingRows(false);
    }).catch(() => setLoadingRows(false));
  }, [unitId, selectedPeriodo]);

  const parseFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportMsg(null);
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    // Totvs BR exporta Windows-1252 por padrão — tenta primeiro.
    // Se houver replacement char (U+FFFD), o arquivo é UTF-8 e retenta.
    let text = new TextDecoder("windows-1252").decode(buffer);
    if (text.includes("�")) {
      text = new TextDecoder("utf-8").decode(buffer);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }

    const parsed = parsePontoCSV(text);
    if (parsed.length === 0) {
      setImporting(false);
      setImportMsg({ ok: false, text: "Nenhuma linha encontrada no CSV." });
      return;
    }

    const periodo = parsed.find((r) => !r.is_total)?.periodo ?? "";
    if (!periodo) {
      setImporting(false);
      setImportMsg({ ok: false, text: "Não foi possível detectar o período." });
      return;
    }

    const result = await importPontoMensal(unitId, periodo, parsed.map(pontoRowToInput));

    if (!result.ok) {
      setImporting(false);
      setImportMsg({ ok: false, text: result.error });
      return;
    }

    // Refresh period list and auto-select new period
    const newPeriodos = await listPontoPeriodos(unitId);
    setPeriodos(newPeriodos);
    setSelectedPeriodo(periodo);
    setSortKey("nome");
    setSortDir("asc");
    setSearch("");
    setDeptFilter("Todos");
    setImporting(false);
    setImportMsg({ ok: true, text: `${result.data.count} registros importados para ${periodo}` });
  }, [unitId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  // ── Derived data

  const colaboradores = rows.filter((r) => !r.is_total);
  const totalRow = rows.find((r) => r.is_total);
  const periodo = selectedPeriodo ?? "";

  const totalTrabalhadas = useMemo(
    () => colaboradores.reduce((s, r) => s + hhmm2min(r.horas_trabalhadas), 0),
    [colaboradores],
  );
  const totalPrevistas = useMemo(
    () => colaboradores.reduce((s, r) => s + hhmm2min(r.horas_previstas), 0),
    [colaboradores],
  );
  const totalFaltas = useMemo(
    () => colaboradores.reduce((s, r) => s + r.falta_injustificada_dias, 0),
    [colaboradores],
  );

  // FIX 2 — Excluir afastados do mês inteiro (≥20 dias) do cálculo de %
  // e calcular média das % individuais (não total/total que distorce)
  const pctCumprimento = useMemo(() => {
    const ativos = colaboradores.filter(
      (r) => r.afastamentos_dias < 20 && r.ferias_dias < 20,
    );
    const pcts = ativos
      .filter((r) => hhmm2min(r.horas_previstas) > 0)
      .map((r) => (hhmm2min(r.horas_trabalhadas) / hhmm2min(r.horas_previstas)) * 100);
    if (pcts.length === 0) return "—";
    return (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1);
  }, [colaboradores]);

  const comFaltas = colaboradores.filter((r) => r.falta_injustificada_dias > 0);
  const comNegativas = colaboradores.filter((r) => isNegHours(r.horas_negativas));

  // ── Departments

  const deptos = useMemo(() => {
    const s = new Set(colaboradores.map((r) => r.departamento).filter(Boolean));
    return ["Todos", ...Array.from(s).sort()];
  }, [colaboradores]);

  // ── Sorting + filtering

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = colaboradores;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.nome.toLowerCase().includes(q));
    }
    if (deptFilter !== "Todos") {
      list = list.filter((r) => r.departamento === deptFilter);
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        let cmp = 0;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), "pt-BR");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [colaboradores, search, deptFilter, sortKey, sortDir]);

  const thProps = { current: sortKey, dir: sortDir, onSort: handleSort };

  function pctColor(worked: string, previsto: string) {
    const w = hhmm2min(worked);
    const p = hhmm2min(previsto);
    if (p === 0) return "var(--text-3)";
    const pct = (w / p) * 100;
    if (pct >= 95) return "#16A34A";
    if (pct >= 80) return "#A16207";
    return "#DC2626";
  }

  function pctValue(worked: string, previsto: string) {
    const w = hhmm2min(worked);
    const p = hhmm2min(previsto);
    if (p === 0) return "—";
    return ((w / p) * 100).toFixed(1) + "%";
  }

  function saldoColor(saldo: string) {
    if (!saldo || saldo === "00:00" || saldo === "00:00:00") return "var(--text-3)";
    if (saldo.startsWith("-")) return "#DC2626";
    return "#16A34A";
  }

  const hasData = rows.length > 0;
  const hasPeriodos = periodos.length > 0;

  return (
    <>
      {/* Header */}
      <header style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.6,
            textTransform: "uppercase", color: "var(--text-3)",
          }}
        >
          Pessoas · Relatório de Ponto
        </div>
        <h1
          style={{
            fontSize: 26, fontWeight: 700, margin: "6px 0 0",
            color: "var(--text)", letterSpacing: -0.4,
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <FileBarChart2 size={22} style={{ color: "var(--brand)" }} />
          Relatório de Ponto
        </h1>
      </header>

      {/* Seletor de períodos salvos */}
      {hasPeriodos && (
        <div
          style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            marginBottom: 16, alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginRight: 4 }}>
            Períodos salvos:
          </span>
          {periodos.map((p) => (
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
                transition: "all 0.1s",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => !importing && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!importing) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
          borderRadius: 12,
          padding: hasPeriodos ? "14px 20px" : "48px 24px",
          textAlign: "center",
          cursor: importing ? "wait" : "pointer",
          background: dragging ? "var(--brand-soft)" : "var(--surface)",
          transition: "border-color 0.15s, background 0.15s",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: hasPeriodos ? "row" : "column",
          gap: 12,
          opacity: importing ? 0.7 : 1,
        }}
      >
        {importing
          ? <Loader2 size={18} style={{ color: "var(--brand)", flexShrink: 0, animation: "spin 1s linear infinite" }} />
          : <Upload size={hasPeriodos ? 18 : 28} style={{ color: dragging ? "var(--brand)" : "var(--text-3)", flexShrink: 0 }} />
        }
        <div>
          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: hasPeriodos ? 14 : 16 }}>
            {importing
              ? `Importando ${fileName ?? "CSV"}…`
              : hasPeriodos
              ? "Importar novo período"
              : "Arraste o CSV do Totvs aqui ou clique para selecionar"}
          </div>
          {!hasPeriodos && !importing && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              Aceita arquivos .csv exportados do Totvs (Windows-1252 / ISO-8859-1)
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Feedback de importação */}
      {importMsg && (
        <div
          style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "10px 14px", borderRadius: 8, marginBottom: 16,
            background: importMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${importMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(239,68,68,0.25)"}`,
          }}
        >
          {importMsg.ok
            ? <CheckCircle2 size={15} style={{ color: "#16A34A", flexShrink: 0 }} />
            : <AlertCircle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
          }
          <span style={{ fontSize: 13, color: importMsg.ok ? "#16A34A" : "#DC2626", fontWeight: 600 }}>
            {importMsg.text}
          </span>
          <button
            onClick={() => setImportMsg(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {loadingRows && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={24} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {hasData && !loadingRows && (
        <>
          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <KpiCard label="Colaboradores" value={colaboradores.length} />
            <KpiCard
              label="H. Trabalhadas (total)"
              value={min2hhhmm(totalTrabalhadas)}
            />
            <KpiCard
              label="H. Previstas (total)"
              value={min2hhhmm(totalPrevistas)}
            />
            <KpiCard
              label="% Cumprimento (ativos)"
              value={pctCumprimento !== "—" ? pctCumprimento + "%" : "—"}
              sub={pctCumprimento !== "—" ? "excl. afastados/férias integrais" : undefined}
              warn={pctCumprimento !== "—" && parseFloat(pctCumprimento) < 80}
              danger={pctCumprimento !== "—" && parseFloat(pctCumprimento) < 70}
            />
            <KpiCard
              label="Faltas Injustificadas"
              value={totalFaltas + " dias"}
              danger={totalFaltas > 0}
            />
            <KpiCard label="Período" value={periodo || "—"} sub={unitName} />
          </div>

          {/* Alertas */}
          {comFaltas.length > 0 && (
            <AlertBanner
              tipo="faltas"
              items={comFaltas}
              expanded={expandedFaltas}
              onToggle={() => setExpandedFaltas((v) => !v)}
            />
          )}

          {comNegativas.length > 0 && (
            <AlertBanner
              tipo="negativas"
              items={comNegativas}
              expanded={expandedNegativas}
              onToggle={() => setExpandedNegativas((v) => !v)}
            />
          )}

          {/* Filtros */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
              padding: "10px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
          >
            <input
              type="text"
              placeholder="Buscar colaborador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: "1 1 200px",
                padding: "7px 10px",
                fontSize: 13,
                border: "1px solid var(--border)",
                borderRadius: 7,
                background: "var(--surface-2)",
                color: "var(--text)",
                outline: "none",
              }}
            />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                border: "1px solid var(--border)",
                borderRadius: 7,
                background: "var(--surface-2)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {deptos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {(search || deptFilter !== "Todos") && (
              <button
                onClick={() => { setSearch(""); setDeptFilter("Todos"); }}
                style={{
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  background: "var(--surface-2)",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <X size={12} /> Limpar filtros
              </button>
            )}
            <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
              {colaboradores[0]?.filial || unitName} · {periodo} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Tabela */}
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
                    <Th label="Depto" sortKey="departamento" {...thProps} />
                    <Th label="H. Prev." sortKey="horas_previstas" {...thProps} />
                    <Th label="H. Trab." sortKey="horas_trabalhadas" {...thProps} />
                    <Th label="%" sortKey="horas_trabalhadas" {...thProps} />
                    <Th label="H. Pos." sortKey="horas_positivas" {...thProps} />
                    <Th label="H. Neg." sortKey="horas_negativas" {...thProps} />
                    <Th label="Faltas" sortKey="falta_injustificada_dias" {...thProps} />
                    <Th label="Banco Ac." sortKey="banco_horas_acumulado" {...thProps} />
                    <Th label="Saldo" sortKey="saldo" {...thProps} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr
                      key={(row.matricula || "total") + i}
                      onClick={() => setSelected(row)}
                      style={{
                        cursor: "pointer",
                        background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--surface-3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")
                      }
                    >
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{row.nome}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{row.cargo}</div>
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {row.departamento}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
                        {row.horas_previstas}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
                        {row.horas_trabalhadas}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: pctColor(row.horas_trabalhadas, row.horas_previstas) }}>
                        {pctValue(row.horas_trabalhadas, row.horas_previstas)}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
                        {row.horas_positivas}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", color: isNegHours(row.horas_negativas) ? "#DC2626" : "var(--text-3)" }}>
                        {row.horas_negativas || "—"}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", textAlign: "center", fontWeight: row.falta_injustificada_dias > 0 ? 700 : 400, color: row.falta_injustificada_dias > 0 ? "#DC2626" : "var(--text-3)" }}>
                        {row.falta_injustificada_dias || "—"}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}>
                        {row.banco_horas_acumulado}
                      </td>
                      <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: saldoColor(row.saldo) }}>
                        {row.saldo || "—"}
                      </td>
                    </tr>
                  ))}

                  {/* Linha de totais */}
                  {totalRow && (
                    <tr
                      onClick={() => setSelected(totalRow)}
                      style={{ cursor: "pointer", background: "var(--surface-3)", fontWeight: 700 }}
                    >
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 12, letterSpacing: 0.5 }}>
                          TOTAIS
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }} />
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                        {totalRow.horas_previstas}
                      </td>
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                        {totalRow.horas_trabalhadas}
                      </td>
                      <td style={{ padding: "10px 12px" }} />
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                        {totalRow.horas_positivas}
                      </td>
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums", color: isNegHours(totalRow.horas_negativas) ? "#DC2626" : "var(--text-3)" }}>
                        {totalRow.horas_negativas || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {totalRow.falta_injustificada_dias || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                        {totalRow.banco_horas_acumulado}
                      </td>
                      <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums", color: saldoColor(totalRow.saldo) }}>
                        {totalRow.saldo || "—"}
                      </td>
                    </tr>
                  )}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                        Nenhum resultado encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Estado vazio — sem períodos e sem dados */}
      {!hasPeriodos && !hasData && !loadingRows && !importing && (
        <div
          style={{
            textAlign: "center", padding: "48px 24px",
            color: "var(--text-3)", fontSize: 13,
          }}
        >
          <FileBarChart2 size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>Nenhum relatório importado ainda.</div>
          <div style={{ marginTop: 4 }}>Arraste o CSV do Totvs acima para começar.</div>
        </div>
      )}

      {/* Drawer */}
      {selected && <Drawer row={selected} onClose={() => setSelected(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
// redeploy
