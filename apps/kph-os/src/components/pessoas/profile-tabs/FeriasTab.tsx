"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@kph/ui/button";
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
import {
  createVacation,
  deleteVacation,
  updateVacationStatus,
} from "@/lib/pessoas/actions";
import { formatDateBR } from "@/lib/format";
import type { Vacation, VacationStatus } from "@kph/db/types/pessoas";

const FORM_BG: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const STATUS_COLOR: Record<
  VacationStatus,
  { bg: string; fg: string; label: string }
> = {
  agendada: { bg: "rgba(59,130,246,0.16)", fg: "#1D4ED8", label: "Agendada" },
  em_andamento: {
    bg: "rgba(245,158,11,0.16)",
    fg: "#A16207",
    label: "Em andamento",
  },
  concluida: { bg: "rgba(34,197,94,0.16)", fg: "#15803D", label: "Concluída" },
  cancelada: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C", label: "Cancelada" },
};

function diffDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

export function FeriasTab({
  employeeId,
  unitId,
  records,
  currentUserId,
}: {
  employeeId: string;
  unitId: string;
  records: Vacation[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [abono, setAbono] = useState("0");
  const [doublePay, setDoublePay] = useState(false);
  const [notes, setNotes] = useState("");

  const days = diffDays(startDate, endDate);

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setAbono("0");
    setDoublePay(false);
    setNotes("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      setError("Período obrigatório.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("Data final deve ser ≥ data inicial.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createVacation({
        employee_id: employeeId,
        unit_id: unitId,
        start_date: startDate,
        end_date: endDate,
        days_taken: days,
        abono_days: parseInt(abono, 10) || 0,
        is_double_pay: doublePay,
        status: "agendada",
        notes: notes || null,
        created_by: currentUserId,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      setShowForm(false);
      router.refresh();
    });
  };

  const handleStatusChange = (id: string, status: VacationStatus) => {
    startTransition(async () => {
      const r = await updateVacationStatus(id, status);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Excluir esse período de férias?")) return;
    startTransition(async () => {
      const r = await deleteVacation(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {records.length} período{records.length === 1 ? "" : "s"}
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (showForm) reset();
            setShowForm((v) => !v);
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? " Cancelar" : " Agendar férias"}
        </Button>
      </div>

      {showForm && (
        <div style={FORM_BG}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <Field label="Início">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Fim">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            <Field label="Abono pecuniário (dias)">
              <Input
                type="number"
                min="0"
                max="10"
                value={abono}
                onChange={(e) => setAbono(e.target.value)}
              />
            </Field>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <input
              type="checkbox"
              checked={doublePay}
              onChange={(e) => setDoublePay(e.target.checked)}
            />
            Pagamento dobrado (férias vencidas após 12 meses)
          </label>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Total:{" "}
            <strong style={{ color: "var(--brand)" }}>
              {days} dia{days === 1 ? "" : "s"}
            </strong>
          </div>
          <Field label="Observações">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <div style={ERROR_BOX}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
            </Button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState>
          Sem férias agendadas. Cadastre o primeiro período aqui.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead className="text-right">Abono</TableHead>
              <TableHead>Dobrado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => {
              const c = STATUS_COLOR[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <strong>{formatDateBR(r.start_date)}</strong>
                    <span style={{ color: "var(--text-3)" }}> → </span>
                    <strong>{formatDateBR(r.end_date)}</strong>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "var(--brand)",
                    }}
                  >
                    {r.days_taken ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ color: "var(--text-3)" }}
                  >
                    {r.abono_days ?? 0}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-3)" }}>
                    {r.is_double_pay ? "Sim" : "Não"}
                  </TableCell>
                  <TableCell>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: c.bg,
                        color: c.fg,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {c.label}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        handleStatusChange(r.id, v as VacationStatus)
                      }
                    >
                      <SelectTrigger
                        style={{
                          height: 28,
                          fontSize: 11,
                          padding: "2px 8px",
                          width: 132,
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agendada">Agendada</SelectItem>
                        <SelectItem value="em_andamento">
                          Em andamento
                        </SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ ...DEL_BTN, marginLeft: 6 }}
                      title="Excluir"
                    >
                      <X size={12} />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--text-3)",
        fontSize: 13,
        background: "var(--surface)",
        border: "1px dashed var(--border)",
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

const ERROR_BOX: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.4)",
  borderRadius: 6,
  color: "var(--destructive)",
  fontSize: 12,
};

const DEL_BTN: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-3)",
  cursor: "pointer",
  padding: "4px 6px",
  display: "inline-flex",
  alignItems: "center",
};
