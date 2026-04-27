"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveOvertime,
  createOvertimeRecord,
  deleteOvertimeRecord,
} from "@/lib/pessoas/actions";
import { formatDateBR } from "@/lib/format";
import type { OvertimeRecord, OvertimeType } from "@/types/pessoas";

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

const TYPE_LABEL: Record<OvertimeType, string> = {
  "50": "HE 50%",
  "100": "HE 100%",
  banco: "Banco horas",
};

export function HorasExtrasTab({
  employeeId,
  unitId,
  records,
  currentUserId,
}: {
  employeeId: string;
  unitId: string;
  records: OvertimeRecord[];
  /** Para registrar quem aprovou — vem do Server Component pai. */
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [type, setType] = useState<OvertimeType>("50");
  const [reason, setReason] = useState("");

  const reset = () => {
    setDate("");
    setHours("");
    setType("50");
    setReason("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!date || !hours) {
      setError("Data e horas são obrigatórios.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createOvertimeRecord({
        employee_id: employeeId,
        unit_id: unitId,
        date,
        hours: Number(hours),
        type,
        reason: reason || null,
        source: "manual",
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

  const handleApprove = (id: string, approved: boolean) => {
    startTransition(async () => {
      const r = await approveOvertime(id, approved, currentUserId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Excluir essa hora extra?")) return;
    startTransition(async () => {
      const r = await deleteOvertimeRecord(id);
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
          {records.length} registro{records.length === 1 ? "" : "s"} de HE
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (showForm) reset();
            setShowForm((v) => !v);
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? " Cancelar" : " Nova HE"}
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
            <Field label="Data">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Horas">
              <Input
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="2"
              />
            </Field>
            <Field label="Tipo">
              <Select value={type} onValueChange={(v) => setType(v as OvertimeType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">HE 50%</SelectItem>
                  <SelectItem value="100">HE 100%</SelectItem>
                  <SelectItem value="banco">Banco de horas</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Motivo">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: cobertura escala, evento privado…"
            />
          </Field>
          {error && <div style={ERROR_BOX}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState>
          Sem horas extras registradas. Cadastra a primeira pra começar a
          aprovação.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => {
              const statusColor =
                r.approved === true
                  ? { bg: "rgba(34,197,94,0.16)", fg: "#15803D", label: "Aprovada" }
                  : r.approved === false
                    ? { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C", label: "Rejeitada" }
                    : { bg: "rgba(245,158,11,0.16)", fg: "#A16207", label: "Pendente" };
              return (
                <TableRow key={r.id}>
                  <TableCell style={{ fontWeight: 600 }}>
                    {formatDateBR(r.date)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "var(--brand)",
                    }}
                  >
                    {Number(r.hours).toFixed(2)}h
                  </TableCell>
                  <TableCell>{TYPE_LABEL[r.type]}</TableCell>
                  <TableCell style={{ color: "var(--text-3)" }}>
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-3)", fontSize: 11 }}>
                    {r.source === "totvs" ? "Totvs" : "Manual"}
                  </TableCell>
                  <TableCell>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: statusColor.bg,
                        color: statusColor.fg,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {statusColor.label}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {r.approved !== true && (
                      <button
                        onClick={() => handleApprove(r.id, true)}
                        style={ACT_BTN_OK}
                        title="Aprovar"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    {r.approved !== false && (
                      <button
                        onClick={() => handleApprove(r.id, false)}
                        style={{ ...ACT_BTN, marginLeft: 4 }}
                        title="Rejeitar"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ ...ACT_BTN, marginLeft: 4 }}
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

const ACT_BTN: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-3)",
  cursor: "pointer",
  padding: "4px 6px",
  display: "inline-flex",
  alignItems: "center",
};

const ACT_BTN_OK: React.CSSProperties = {
  ...ACT_BTN,
  borderColor: "rgba(34,197,94,0.4)",
  color: "#15803D",
};
