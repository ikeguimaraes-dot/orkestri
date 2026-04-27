"use client";

import { useMemo, useState } from "react";
import { CalendarX, Plus, ShieldAlert, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ScoreBar } from "@/components/pessoas/ScoreBar";
import { WarningDialog } from "@/components/pessoas/WarningDialog";
import { AbsenceDialog } from "@/components/pessoas/AbsenceDialog";

import {
  ABSENCE_LABEL,
  WARNING_LABEL,
  scoreColor,
  SCORE_COLORS,
} from "@/lib/pessoas/score";
import { avatarColor, formatDateBR, initials } from "@/lib/format";
import type {
  AbsenceTipo,
  AbsenceWithEmployee,
  EmployeeScore,
  EmployeeStub,
  WarningNivel,
  WarningWithEmployee,
} from "@/types/pessoas";

const NIVEL_COLOR: Record<WarningNivel, { bg: string; fg: string }> = {
  verbal: { bg: "rgba(245,158,11,0.16)", fg: "#A16207" },
  escrita: { bg: "rgba(249,115,22,0.16)", fg: "#C2410C" },
  suspensao: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C" },
};

const ABSENCE_COLOR: Record<AbsenceTipo, { bg: string; fg: string }> = {
  injustificada: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C" },
  justificada: { bg: "rgba(59,130,246,0.16)", fg: "#1D4ED8" },
  atestado: { bg: "rgba(34,197,94,0.16)", fg: "#15803D" },
  falta_abono: { bg: "var(--muted)", fg: "var(--muted-foreground)" },
};

type ModalState =
  | { kind: "none" }
  | { kind: "warning"; employeeId?: string }
  | { kind: "absence"; employeeId?: string };

export function DisciplinaTabs({
  unitName,
  warnings,
  absences,
  scores,
  employees,
}: {
  unitName: string;
  warnings: WarningWithEmployee[];
  absences: AbsenceWithEmployee[];
  scores: EmployeeScore[];
  employees: EmployeeStub[];
}) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const selected = useMemo(
    () => scores.find((s) => s.employee.id === selectedEmpId) ?? null,
    [scores, selectedEmpId],
  );

  return (
    <>
      <Tabs defaultValue="warnings">
        <TabsList variant="line">
          <TabsTrigger value="warnings">
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            Advertências ({warnings.length})
          </TabsTrigger>
          <TabsTrigger value="absences">
            <CalendarX className="mr-1.5 h-3.5 w-3.5" />
            Faltas ({absences.length})
          </TabsTrigger>
          <TabsTrigger value="score">
            <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
            Score Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warnings">
          <SectionToolbar
            label={`${unitName} · ${warnings.length} advertência${warnings.length === 1 ? "" : "s"}`}
            actionLabel="Nova advertência"
            onAction={() => setModal({ kind: "warning" })}
          />
          <WarningsTable warnings={warnings} />
        </TabsContent>

        <TabsContent value="absences">
          <SectionToolbar
            label={`${unitName} · ${absences.length} falta${absences.length === 1 ? "" : "s"}`}
            actionLabel="Registrar falta"
            onAction={() => setModal({ kind: "absence" })}
          />
          <AbsencesTable absences={absences} />
        </TabsContent>

        <TabsContent value="score">
          <ScoreTable scores={scores} onSelect={(id) => setSelectedEmpId(id)} />
        </TabsContent>
      </Tabs>

      {modal.kind === "warning" && (
        <WarningDialog
          employees={employees}
          {...(modal.employeeId !== undefined ? { initialEmployeeId: modal.employeeId } : {})}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "absence" && (
        <AbsenceDialog
          employees={employees}
          {...(modal.employeeId !== undefined ? { initialEmployeeId: modal.employeeId } : {})}
          onClose={() => setModal({ kind: "none" })}
        />
      )}

      {/* Drawer-ish overlay com detalhe do score (simples, sem lib de drawer) */}
      {selected && (
        <ScoreDetailOverlay
          row={selected}
          onClose={() => setSelectedEmpId(null)}
        />
      )}
    </>
  );
}

// ── Subcomponentes de UI ───────────────────────────────────────

function SectionToolbar({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "16px 0 12px",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</span>
      <Button onClick={onAction}>
        <Plus className="mr-2 h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  );
}

function WarningsTable({ warnings }: { warnings: WarningWithEmployee[] }) {
  if (warnings.length === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert size={20} />}
        title="Nenhuma advertência registrada"
        desc="Documente verbal/escrita/suspensão pra blindar a casa em rescisões."
      />
    );
  }
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            <Th>Colaborador</Th>
            <Th>Nível</Th>
            <Th>Descrição</Th>
            <Th>Data</Th>
            <Th align="right">Impacto</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warnings.map((w) => {
            const emp = w.employee;
            const fullName = emp ? `${emp.nome} ${emp.sobrenome}` : "—";
            const c = NIVEL_COLOR[w.nivel as WarningNivel] ?? {
              bg: "var(--muted)",
              fg: "var(--text)",
            };
            return (
              <TableRow key={w.id}>
                <TableCell>
                  <NameCell name={fullName} sub={emp?.funcao ?? ""} />
                </TableCell>
                <TableCell>
                  <Pill bg={c.bg} fg={c.fg}>
                    {WARNING_LABEL[w.nivel as WarningNivel] ?? w.nivel}
                  </Pill>
                </TableCell>
                <TableCell>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{w.descricao}</span>
                </TableCell>
                <TableCell>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                    {formatDateBR(w.data)}
                  </span>
                </TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 12, color: "var(--destructive)" }}>
                    {w.score_impact}
                  </strong>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function AbsencesTable({ absences }: { absences: AbsenceWithEmployee[] }) {
  if (absences.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX size={20} />}
        title="Nenhuma falta registrada"
        desc="Registre faltas com tipo e motivo — score só desce em injustificadas."
      />
    );
  }
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            <Th>Colaborador</Th>
            <Th>Tipo</Th>
            <Th>Motivo</Th>
            <Th>Data</Th>
            <Th align="right">Impacto</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {absences.map((a) => {
            const emp = a.employee;
            const fullName = emp ? `${emp.nome} ${emp.sobrenome}` : "—";
            const c = ABSENCE_COLOR[a.tipo as AbsenceTipo] ?? {
              bg: "var(--muted)",
              fg: "var(--text)",
            };
            return (
              <TableRow key={a.id}>
                <TableCell>
                  <NameCell name={fullName} sub={emp?.funcao ?? ""} />
                </TableCell>
                <TableCell>
                  <Pill bg={c.bg} fg={c.fg}>
                    {ABSENCE_LABEL[a.tipo as AbsenceTipo] ?? a.tipo}
                  </Pill>
                </TableCell>
                <TableCell>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {a.motivo ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                    {formatDateBR(a.data)}
                  </span>
                </TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <strong
                    style={{
                      fontSize: 12,
                      color: a.score_impact < 0 ? "var(--destructive)" : "var(--text-3)",
                    }}
                  >
                    {a.score_impact === 0 ? "—" : a.score_impact}
                  </strong>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function ScoreTable({
  scores,
  onSelect,
}: {
  scores: EmployeeScore[];
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<"todos" | "verde" | "amarelo" | "vermelho">("todos");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scores.filter((s) => {
      const z = scoreColor(s.score);
      if (zoneFilter === "verde" && z !== "green") return false;
      if (zoneFilter === "amarelo" && z !== "yellow") return false;
      if (zoneFilter === "vermelho" && z !== "red") return false;
      if (!q) return true;
      const name = `${s.employee.nome} ${s.employee.sobrenome}`.toLowerCase();
      return name.includes(q) || (s.employee.funcao ?? "").toLowerCase().includes(q);
    });
  }, [scores, search, zoneFilter]);

  // Distribuição por zona pra o cartão de resumo
  const dist = useMemo(() => {
    const r = { green: 0, yellow: 0, red: 0 };
    for (const s of scores) r[scoreColor(s.score)]++;
    return r;
  }, [scores]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        <ZoneCard label="Verde · > 80" count={dist.green} color={SCORE_COLORS.green.fg} />
        <ZoneCard label="Amarelo · 60-80" count={dist.yellow} color={SCORE_COLORS.yellow.fg} />
        <ZoneCard label="Vermelho · < 60" count={dist.red} color={SCORE_COLORS.red.fg} />
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(200px, 1fr) auto" }}>
        <Input
          placeholder="Buscar nome ou função…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={zoneFilter} onValueChange={(v) => v && setZoneFilter(v as typeof zoneFilter)}>
          <SelectTrigger style={{ minWidth: 140 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas zonas</SelectItem>
            <SelectItem value="verde">Verde</SelectItem>
            <SelectItem value="amarelo">Amarelo</SelectItem>
            <SelectItem value="vermelho">Vermelho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <Th>Colaborador</Th>
              <Th>Score</Th>
              <Th align="right">Adv</Th>
              <Th align="right">Faltas</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} style={emptyTd}>
                  Nenhum colaborador na zona/filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const fullName = `${s.employee.nome} ${s.employee.sobrenome}`.trim();
                return (
                  <TableRow
                    key={s.employee.id}
                    onClick={() => onSelect(s.employee.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <NameCell name={fullName} sub={s.employee.funcao ?? ""} />
                    </TableCell>
                    <TableCell>
                      <ScoreBar
                        score={s.score}
                        warnings={s.warnings_count}
                        absences={s.absences_count}
                      />
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontSize: 12, color: s.warnings_count > 0 ? "var(--destructive)" : "var(--text-3)" }}>
                        {s.warnings_count}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontSize: 12, color: s.absences_count > 0 ? "var(--destructive)" : "var(--text-3)" }}>
                        {s.absences_count}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function ScoreDetailOverlay({
  row,
  onClose,
}: {
  row: EmployeeScore;
  onClose: () => void;
}) {
  const fullName = `${row.employee.nome} ${row.employee.sobrenome}`.trim();
  const c = SCORE_COLORS[scoreColor(row.score)];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          padding: "22px 24px",
          maxWidth: 460,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Score
          </div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: "4px 0 0",
              color: "var(--text)",
            }}
          >
            {fullName}
          </h3>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {row.employee.funcao ?? "—"}
          </span>
        </div>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            background: c.bg,
            border: `1px solid ${c.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, color: c.fg, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            Score atual
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: c.fg,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {row.score}
            <span style={{ fontSize: 14, opacity: 0.7 }}>/100</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <span style={{ color: "var(--text-3)" }}>
            Adv: <strong style={{ color: "var(--text)" }}>{row.warnings_count}</strong>
          </span>
          <span style={{ color: "var(--text-3)" }}>
            Faltas: <strong style={{ color: "var(--text)" }}>{row.absences_count}</strong>
          </span>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
          Score começa em 100. Cada advertência verbal vale −10, escrita −25,
          suspensão −50. Falta injustificada: −5. Score nunca passa de 100 nem
          fica abaixo de 0.
        </p>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

function NameCell({ name, sub }: { name: string; sub: string }) {
  const color = avatarColor(name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 99,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initials(name)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{name}</span>
        {sub && (
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

function ZoneCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <TableHead style={align === "right" ? { textAlign: "right" } : undefined}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {children}
      </span>
    </TableHead>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{title}</div>
      <p style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 380, margin: 0, lineHeight: 1.55 }}>
        {desc}
      </p>
    </div>
  );
}

const emptyTd: React.CSSProperties = {
  textAlign: "center",
  padding: "32px 16px",
  color: "var(--text-3)",
  fontSize: 12,
};
