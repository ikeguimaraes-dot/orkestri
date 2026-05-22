"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

import { Button, buttonVariants } from "@kph/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@kph/ui/dialog";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import { Textarea } from "@kph/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import { upsertTrainingRecord } from "@/app/(dashboard)/pessoas/treinamentos/actions";
import { formatDateBR } from "@/lib/format";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  effectiveStatus,
  type TrainingRecordWithEmployee,
  type TrainingStatus,
  type TrainingTemplate,
} from "@/lib/treinamentos/types";
import type { EmployeeStub } from "@kph/db/types/pessoas";

const STATUS_VALUES: TrainingStatus[] = [
  "pendente",
  "em_andamento",
  "concluido",
  "vencido",
];

export function TemplateDetalheClient({
  template,
  records,
  employees,
}: {
  template: TrainingTemplate;
  records: TrainingRecordWithEmployee[];
  employees: EmployeeStub[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  const [empId, setEmpId] = useState<string>("");
  const [status, setStatus] = useState<TrainingStatus>("pendente");
  const [dataInicio, setDataInicio] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let pendentes = 0;
    let em_andamento = 0;
    let concluidos = 0;
    let vencidos = 0;
    for (const r of records) {
      const eff = effectiveStatus(r, today);
      if (eff === "pendente") pendentes += 1;
      else if (eff === "em_andamento") em_andamento += 1;
      else if (eff === "concluido") concluidos += 1;
      else if (eff === "vencido") vencidos += 1;
    }
    return { pendentes, em_andamento, concluidos, vencidos, total: records.length };
  }, [records]);

  // Colabs ainda sem record desse template (pra dialog "adicionar")
  const empSemRecord = useMemo(() => {
    const set = new Set(records.map((r) => r.employee_id));
    return employees.filter((e) => !set.has(e.id));
  }, [employees, records]);

  function handleAdd() {
    setError(null);
    setEmpId("");
    setStatus("pendente");
    setDataInicio("");
    setDataConclusao("");
    setObs("");
    setShow(true);
  }

  function handleSave() {
    setError(null);
    if (!empId) {
      setError("Selecione um colaborador");
      return;
    }
    startTransition(async () => {
      const r = await upsertTrainingRecord({
        employee_id: empId,
        template_id: template.id,
        status,
        data_inicio: dataInicio || null,
        data_conclusao: dataConclusao || null,
        observacoes: obs.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShow(false);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Link
        href="/pessoas/treinamentos"
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
        Treinamentos
      </Link>

      {/* Header */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: "var(--text)",
                letterSpacing: -0.3,
              }}
            >
              {template.nome}
            </h1>
            {template.obrigatorio && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "rgba(239,68,68,0.16)",
                  color: "#B91C1C",
                  textTransform: "uppercase",
                }}
              >
                Obrigatório
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 99,
                background: template.ativo
                  ? "rgba(34,197,94,0.12)"
                  : "var(--surface-2)",
                color: template.ativo ? "#22C55E" : "var(--text-3)",
              }}
            >
              {template.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 8,
              fontSize: 12,
              color: "var(--text-3)",
              flexWrap: "wrap",
            }}
          >
            {template.funcao && (
              <span>
                <strong style={{ color: "var(--text-2)" }}>Função:</strong>{" "}
                {template.funcao}
              </span>
            )}
            {template.validade_dias != null && (
              <span>
                <strong style={{ color: "var(--text-2)" }}>Validade:</strong>{" "}
                {template.validade_dias} dia
                {template.validade_dias === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {template.descricao && (
            <p
              style={{
                fontSize: 13,
                color: "var(--text-2)",
                lineHeight: 1.55,
                marginTop: 14,
                marginBottom: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {template.descricao}
            </p>
          )}
        </div>
        <Button onClick={handleAdd} disabled={pending || empSemRecord.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar colaborador
        </Button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          marginBottom: 16,
        }}
      >
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Pendentes" value={String(stats.pendentes)} tone="neutral" />
        <Stat label="Em andamento" value={String(stats.em_andamento)} tone="info" />
        <Stat label="Concluídos" value={String(stats.concluidos)} tone="ok" />
        <Stat label="Vencidos" value={String(stats.vencidos)} tone="danger" />
      </div>

      {/* Records */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {records.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-3)",
            }}
          >
            Ninguém atribuído a este treinamento ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Conclusão</TableHead>
                <TableHead>Validade até</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const eff = effectiveStatus(r);
                const meta = STATUS_COLOR[eff];
                const fullName = r.employee
                  ? `${r.employee.nome} ${r.employee.sobrenome}`.trim()
                  : "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        {fullName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {r.employee?.funcao ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: meta.bg,
                          color: meta.fg,
                        }}
                      >
                        {STATUS_LABEL[eff]}
                      </span>
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.data_inicio ? formatDateBR(r.data_inicio) : "—"}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.data_conclusao ? formatDateBR(r.data_conclusao) : "—"}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: eff === "vencido" ? "#B91C1C" : "var(--text-2)",
                        fontWeight: eff === "vencido" ? 600 : 400,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.validade_ate
                        ? formatDateBR(r.validade_ate.slice(0, 10))
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: adicionar */}
      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir treinamento</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Colaborador">
              <Select value={empId} onValueChange={(v) => v && setEmpId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {empSemRecord.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} {e.sobrenome} · {e.funcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as TrainingStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Data início">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </Field>
              <Field label="Data conclusão">
                <Input
                  type="date"
                  value={dataConclusao}
                  onChange={(e) => setDataConclusao(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Observações">
              <Textarea
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </Field>
            {error && (
              <div
                style={{
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setShow(false)}
                className={buttonVariants({ variant: "outline" })}
              >
                Cancelar
              </button>
              <Button onClick={handleSave} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "info" | "danger";
}) {
  const fg =
    tone === "danger"
      ? "#B91C1C"
      : tone === "info"
      ? "#1D4ED8"
      : tone === "ok"
      ? "#15803D"
      : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: fg,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
