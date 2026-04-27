"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { createWarning } from "@/lib/pessoas/actions";
import { WARNING_LABEL, deltaForWarning } from "@/lib/pessoas/score";
import type { EmployeeStub, WarningNivel } from "@/types/pessoas";

const NIVEIS: WarningNivel[] = ["verbal", "escrita", "suspensao"];

export function WarningDialog({
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
  const [nivel, setNivel] = useState<WarningNivel>("escrita");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [documentoPath, setDocumentoPath] = useState("");

  const valid = employeeId && nivel && descricao.trim().length >= 5 && data;
  const delta = deltaForWarning(nivel);

  const handleSubmit = () => {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const res = await createWarning({
        employee_id: employeeId,
        nivel,
        descricao: descricao.trim(),
        data,
        documento_path: documentoPath.trim() || null,
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
              <ShieldAlert size={18} style={{ color: "var(--destructive)" }} />
              Nova advertência
            </span>
          </DialogTitle>
          <DialogDescription>
            Documento formal CLT. O score do colaborador é ajustado automaticamente.
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
            <Field label="Nível">
              <Select value={nivel} onValueChange={(v) => v && setNivel(v as WarningNivel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {WARNING_LABEL[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Descrição (mínimo 5 caracteres)">
            <Textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Motivo, ocorrência, contexto…"
            />
          </Field>

          <Field label="Documento (URL ou caminho — opcional)">
            <Input
              value={documentoPath}
              onChange={(e) => setDocumentoPath(e.target.value)}
              placeholder="storage/warnings/2026-04/..."
            />
          </Field>

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
            Aplicar advertência
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
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.4)",
        fontSize: 11,
        color: "var(--destructive)",
        display: "flex",
        justifyContent: "space-between",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>Impacto no score</span>
      <strong>{delta} pts</strong>
    </div>
  );
}
