"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  LogIn,
  LogOut as LogOutIcon,
  MapPin,
  Play,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  approveAllPendingPunches,
  approvePunch,
  rejectPunch,
} from "@/lib/pessoas/actions";
import {
  approvePunchesBulk,
  BULK_APPROVE_MAX,
} from "@/app/(dashboard)/pessoas/ponto/actions";
import {
  PUNCH_COLOR,
  PUNCH_LABEL,
  formatHHMM,
  formatMinutesAsHours,
} from "@/lib/pessoas/punch";
import { avatarColor, initials } from "@/lib/format";
import type { PunchDaySummary, PunchTipo, TimeClockPunch } from "@/types/pessoas";

const ICONS: Record<PunchTipo, React.ComponentType<{ size?: number }>> = {
  entrada: LogIn,
  intervalo_inicio: Coffee,
  intervalo_fim: Play,
  saida: LogOutIcon,
};

type StatusFilter = "todos" | "pendente" | "aprovado" | "rejeitado";

export function PunchTable({
  unitId,
  dataIso,
  summaries,
  totalPunches,
}: {
  unitId: string;
  dataIso: string;
  summaries: PunchDaySummary[];
  totalPunches: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return summaries;
    return summaries.filter((s) =>
      s.punches.some((p) =>
        statusFilter === "pendente"
          ? p.aprovado === null
          : statusFilter === "aprovado"
            ? p.aprovado === true
            : p.aprovado === false,
      ),
    );
  }, [summaries, statusFilter]);

  const totalPending = useMemo(
    () => summaries.reduce((sum, s) => sum + s.pending_count, 0),
    [summaries],
  );

  const onApprove = (id: string) => {
    startTransition(async () => {
      const res = await approvePunch(id);
      if (!res.ok) {
        alert(`Falha: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };
  const onReject = (id: string) => {
    if (!window.confirm("Rejeitar este ponto?")) return;
    startTransition(async () => {
      const res = await rejectPunch(id);
      if (!res.ok) {
        alert(`Falha: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };
  const onApproveAll = () => {
    if (totalPending === 0) return;
    if (!window.confirm(`Aprovar ${totalPending} ponto(s) pendente(s)?`)) return;
    startTransition(async () => {
      const res = await approveAllPendingPunches(unitId, dataIso);
      if (!res.ok) {
        alert(`Falha: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  // IDs de punches pendentes nos employees selecionados, capados em BULK_APPROVE_MAX
  const selectedPendingIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of summaries) {
      if (!selectedEmpIds.has(s.employee.id)) continue;
      for (const p of s.punches) {
        if (p.aprovado === null) ids.push(p.id);
      }
    }
    return ids;
  }, [summaries, selectedEmpIds]);

  const willApprove = Math.min(selectedPendingIds.length, BULK_APPROVE_MAX);
  const willSkip = selectedPendingIds.length - willApprove;

  function toggleSelection(empId: string) {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  const onApproveSelected = () => {
    if (selectedPendingIds.length === 0) return;
    const msg =
      willSkip > 0
        ? `Aprovar ${willApprove} pendente(s)? (${willSkip} ficarão de fora — limite de ${BULK_APPROVE_MAX} por vez)`
        : `Aprovar ${willApprove} ponto(s) pendente(s)?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await approvePunchesBulk(selectedPendingIds);
      if (!res.ok) {
        alert(`Falha: ${res.error}`);
        return;
      }
      setSelectedEmpIds(new Set());
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Select
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger style={{ minWidth: 160 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes ({totalPending})</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {summaries.length} colaborador{summaries.length === 1 ? "" : "es"} · {totalPunches}{" "}
            ponto{totalPunches === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {selectedEmpIds.size > 0 && (
            <Button
              onClick={onApproveSelected}
              disabled={selectedPendingIds.length === 0}
              variant="outline"
              title={
                willSkip > 0
                  ? `${selectedPendingIds.length} pendentes — aprovar ${willApprove} (limite ${BULK_APPROVE_MAX})`
                  : `Aprovar ${willApprove} pendentes selecionados`
              }
            >
              <Check className="mr-2 h-4 w-4" />
              Aprovar selecionados ({willApprove}
              {willSkip > 0 ? `/${selectedPendingIds.length}` : ""})
            </Button>
          )}
          <Button onClick={onApproveAll} disabled={totalPending === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Aprovar todos pendentes ({totalPending})
          </Button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 12,
            }}
          >
            Nenhum ponto registrado nesta data.
          </div>
        ) : (
          filtered.map((s) => (
            <EmployeeRow
              key={s.employee.id}
              summary={s}
              expanded={expandedId === s.employee.id}
              selected={selectedEmpIds.has(s.employee.id)}
              onSelect={() => toggleSelection(s.employee.id)}
              onToggle={() =>
                setExpandedId(expandedId === s.employee.id ? null : s.employee.id)
              }
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmployeeRow({
  summary,
  expanded,
  selected,
  onSelect,
  onToggle,
  onApprove,
  onReject,
}: {
  summary: PunchDaySummary;
  expanded: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const fullName = `${summary.employee.nome} ${summary.employee.sobrenome}`.trim();
  const color = avatarColor(fullName);
  const hasPending = summary.pending_count > 0;
  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        background: selected ? "color-mix(in srgb, var(--brand) 6%, transparent)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12 }}>
        <input
          type="checkbox"
          checked={selected}
          disabled={!hasPending}
          onChange={onSelect}
          aria-label={hasPending ? `Selecionar ${fullName}` : `${fullName} sem pendentes`}
          title={hasPending ? "Selecionar pra bulk approve" : "Sem pendentes"}
          style={{
            width: 16,
            height: 16,
            accentColor: "var(--brand)",
            cursor: hasPending ? "pointer" : "not-allowed",
            opacity: hasPending ? 1 : 0.3,
            flexShrink: 0,
          }}
        />
        <button
          onClick={onToggle}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 99,
              background: `color-mix(in srgb, ${color} 18%, transparent)`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(fullName)}
          </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {fullName}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
            {summary.employee.funcao} · {summary.punches.length} ponto
            {summary.punches.length === 1 ? "" : "s"}
            {summary.pending_count > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 6px",
                  borderRadius: 99,
                  background: "rgba(245,158,11,0.16)",
                  color: "#A16207",
                  fontWeight: 700,
                }}
              >
                {summary.pending_count} pendente{summary.pending_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -0.2,
            }}
          >
            {formatMinutesAsHours(summary.worked_minutes)}
          </span>
          {summary.break_minutes > 0 && (
            <span
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              + {formatMinutesAsHours(summary.break_minutes)} intervalo
            </span>
          )}
        </div>
        <span
          style={{
            color: "var(--text-3)",
            transition: "transform var(--t)",
            transform: expanded ? "rotate(0deg)" : "rotate(0deg)",
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        </button>
      </div>
      {expanded && (
        <div
          style={{
            padding: "0 16px 16px 64px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {summary.punches
            .slice()
            .sort(
              (a, b) =>
                new Date(a.timestamp_punch).getTime() -
                new Date(b.timestamp_punch).getTime(),
            )
            .map((p) => (
              <PunchRow key={p.id} punch={p} onApprove={onApprove} onReject={onReject} />
            ))}
        </div>
      )}
    </div>
  );
}

function PunchRow({
  punch,
  onApprove,
  onReject,
}: {
  punch: TimeClockPunch;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const tipo = punch.tipo as PunchTipo;
  const Icon = ICONS[tipo] ?? Clock;
  const c = PUNCH_COLOR[tipo] ?? "var(--text-3)";
  const status =
    punch.aprovado === true
      ? { label: "Aprovado", bg: "rgba(34,197,94,0.16)", fg: "#15803D" }
      : punch.aprovado === false
        ? { label: "Rejeitado", bg: "rgba(239,68,68,0.16)", fg: "#B91C1C" }
        : { label: "Pendente", bg: "rgba(245,158,11,0.16)", fg: "#A16207" };

  const hasGeo = punch.latitude !== null && punch.longitude !== null;
  const geoLabel =
    hasGeo && punch.latitude && punch.longitude
      ? `${Number(punch.latitude).toFixed(4)}, ${Number(punch.longitude).toFixed(4)}`
      : "sem GPS";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: "var(--surface-2, var(--surface))",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 99,
          background: `color-mix(in srgb, ${c} 18%, transparent)`,
          color: c,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
          {PUNCH_LABEL[tipo] ?? tipo}{" "}
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 700,
              color: "var(--text-2)",
            }}
          >
            {formatHHMM(punch.timestamp_punch)}
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={10} />
          {geoLabel}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 99,
          background: status.bg,
          color: status.fg,
        }}
      >
        {status.label}
      </span>
      {punch.aprovado === null && (
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onApprove(punch.id)}
            aria-label="Aprovar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(34,197,94,0.16)",
              color: "#15803D",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => onReject(punch.id)}
            aria-label="Rejeitar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(239,68,68,0.16)",
              color: "#B91C1C",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
