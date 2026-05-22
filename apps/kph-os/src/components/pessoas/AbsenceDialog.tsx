"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Loader2 } from "lucide-react";

import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import { Label } from "@kph/ui/label";
import { Textarea } from "@kph/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kph/ui/dialog";

import { createAbsence } from "@/lib/pessoas/actions";
import { ABSENCE_LABEL, deltaForAbsence } from "@/lib/pessoas/score";
import type { AbsenceTipo, EmployeeStub } from "@kph/db/types/pessoas";

const TIPOS: AbsenceTipo[] = ["injustificada", "justificada", "atestado", "falta_abono"];

export function AbsenceDialog({
  employees,
  initialEmployeeId,
  onClose,
}: {
  employees: EmployeeStub[];
  initialEmployeeId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(
    initialEmployeeId ?? employees[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<AbsenceTipo>("injustificada");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [atestadoPath, setAtestadoPath] = useState("");

  const valid = employeeId && tipo && data;
  const delta = deltaForAbsence(tipo);

  const handleSubmit = () => {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const res = await createAbsence({
        employee_id: employeeId,
        data,
        tipo,
        motivo: motivo.trim() || null,
        atestado_path: atestadoPath.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <CalendarX size={18} style={{ color: "var(--destructive)" }} />
              Registrar falta
            </span>
          </DialogTitle>
          <DialogDescription>
            Faltas justificadas / atestadas não impactam o score.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Colaborador">
            <Select value={employeeId} onValueChange={(v) => v && setEmployeeId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.sobrenome} · {e.funcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data">
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Field>
            <Field label="Tipo">
              <Select value={tipo} onValueChange={(v) => v && setTipo(v as AbsenceTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ABSENCE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Motivo (opcional)">
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Detalhes da falta…"
            />
          </Field>

          {tipo === "atestado" && (
            <Field label="Atestado (URL ou caminho — opcional)">
              <Input
                value={atestadoPath}
                onChange={(e) => setAtestadoPath(e.target.value)}
                placeholder="storage/atestados/2026-04/..."
              />
            </Field>
          )}

          <ImpactPreview delta={delta} />
        </div>

        {error && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 6,
              color: "var(--destructive)",
              fontSize: 11,
            }}
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar falta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <Label
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function ImpactPreview({ delta }: { delta: number }) {
  const isNeg = delta < 0;
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        background: isNeg ? "rgba(239,68,68,0.08)" : "var(--muted)",
        border: `1px solid ${isNeg ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
        fontSize: 11,
        color: isNeg ? "var(--destructive)" : "var(--text-3)",
        display: "flex",
        justifyContent: "space-between",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>Impacto no score</span>
      <strong>{delta === 0 ? "—" : `${delta} pts`}</strong>
    </div>
  );
}
