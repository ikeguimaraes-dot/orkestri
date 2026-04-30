"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

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
  createTransportVoucher,
  deleteTransportVoucher,
} from "@/lib/pessoas/actions";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { TransportVoucher } from "@/types/pessoas";

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

export function VtTab({
  employeeId,
  unitId,
  records,
}: {
  employeeId: string;
  unitId: string;
  records: TransportVoucher[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState("");
  const [diasUteis, setDiasUteis] = useState("22");
  const [valorDiario, setValorDiario] = useState("");
  const [operadora, setOperadora] = useState("");
  const [obs, setObs] = useState("");

  // CLT 1985: desconto até 6% do salário; aqui calculamos só o bruto
  // — o desconto vem do front (ou da regra do RH) na prática.
  const totalBruto = (Number(diasUteis) || 0) * (Number(valorDiario) || 0);

  const reset = () => {
    setPeriodo("");
    setDiasUteis("22");
    setValorDiario("");
    setOperadora("");
    setObs("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!periodo || !valorDiario) {
      setError("Período e valor diário são obrigatórios.");
      return;
    }
    const periodoNorm = periodo.length === 7 ? `${periodo}-01` : periodo;
    setError(null);
    startTransition(async () => {
      const r = await createTransportVoucher({
        employee_id: employeeId,
        unit_id: unitId,
        periodo: periodoNorm,
        dias_uteis: parseInt(diasUteis, 10) || 0,
        valor_diario: Number(valorDiario),
        total_bruto: totalBruto,
        desconto_funcionario: 0, // RH ajusta depois (até 6% salário)
        valor_empresa: totalBruto,
        operadora: operadora || null,
        observacoes: obs || null,
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

  const handleDelete = (id: string) => {
    if (!window.confirm("Excluir esse VT?")) return;
    startTransition(async () => {
      const r = await deleteTransportVoucher(id);
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
          {records.length} período{records.length === 1 ? "" : "s"} de VT
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (showForm) reset();
            setShowForm((v) => !v);
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? " Cancelar" : " Novo período"}
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
            <Field label="Mês">
              <Select
                value={periodo.slice(5, 7)}
                onValueChange={(m) =>
                  setPeriodo(`${periodo.slice(0, 4) || new Date().getFullYear().toString()}-${m}`)
                }
              >
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((nome, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ano">
              <Select
                value={periodo.slice(0, 4)}
                onValueChange={(a) =>
                  setPeriodo(`${a}-${periodo.slice(5, 7) || "01"}`)
                }
              >
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  {["2024","2025","2026","2027"].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Dias úteis">
              <Input
                type="number"
                value={diasUteis}
                onChange={(e) => setDiasUteis(e.target.value)}
              />
            </Field>
            <Field label="Valor diário (R$)">
              <Input
                type="number"
                step="0.01"
                value={valorDiario}
                onChange={(e) => setValorDiario(e.target.value)}
                placeholder="9,40"
              />
            </Field>
            <Field label="Operadora">
              <Input
                value={operadora}
                onChange={(e) => setOperadora(e.target.value)}
                placeholder="Ex: Bilhete Único"
              />
            </Field>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Total bruto:{" "}
            <strong style={{ color: "var(--brand)" }}>{formatBRL(totalBruto)}</strong>
            <span style={{ marginLeft: 12 }}>
              Desconto funcionário (até 6%) é ajustado depois.
            </span>
          </div>
          <Field label="Observações">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
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
        <EmptyState>Sem VT registrado. Cadastre o primeiro período.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead className="text-right">Valor / dia</TableHead>
              <TableHead className="text-right">Total bruto</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Empresa</TableHead>
              <TableHead>Operadora</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  {formatDateBR(r.periodo)}
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.dias_uteis}
                </TableCell>
                <TableCell className="text-right">
                  {formatBRL(r.valor_diario)}
                </TableCell>
                <TableCell className="text-right">
                  {formatBRL(r.total_bruto)}
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{ color: "var(--text-3)" }}
                >
                  {formatBRL(r.desconto_funcionario)}
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{ fontWeight: 600, color: "var(--brand)" }}
                >
                  {formatBRL(r.valor_empresa)}
                </TableCell>
                <TableCell style={{ color: "var(--text-3)" }}>
                  {r.operadora ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={DEL_BTN}
                    aria-label="Excluir"
                  >
                    <X size={14} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
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
