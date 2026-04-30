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
import { createTipsRecord, deleteTipsRecord } from "@/lib/pessoas/actions";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { TipsRecord } from "@/types/pessoas";

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

export function GorjetasTab({
  employeeId,
  unitId,
  records,
}: {
  employeeId: string;
  unitId: string;
  records: TipsRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — sempre vazio ao abrir.
  const [periodo, setPeriodo] = useState(""); // YYYY-MM-DD do dia 1
  const [valorPonto, setValorPonto] = useState("");
  const [totalPontos, setTotalPontos] = useState("");
  const [abatimento, setAbatimento] = useState("0");
  const [obs, setObs] = useState("");

  const reset = () => {
    setPeriodo("");
    setValorPonto("");
    setTotalPontos("");
    setAbatimento("0");
    setObs("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!periodo || !valorPonto || !totalPontos) {
      setError("Período, valor do ponto e total de pontos são obrigatórios.");
      return;
    }
    const periodoNorm = periodo.length === 7 ? `${periodo}-01` : periodo;
    setError(null);
    startTransition(async () => {
      const r = await createTipsRecord({
        employee_id: employeeId,
        unit_id: unitId,
        periodo: periodoNorm,
        valor_ponto: Number(valorPonto),
        total_pontos: parseInt(totalPontos, 10),
        abatimento_pontos: parseInt(abatimento, 10) || 0,
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
    if (!window.confirm("Excluir esse período de gorjeta?")) return;
    startTransition(async () => {
      const r = await deleteTipsRecord(id);
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
          {records.length} período{records.length === 1 ? "" : "s"} registrado
          {records.length === 1 ? "" : "s"}
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
            <Field label="Valor do ponto (R$)">
              <Input
                type="number"
                step="0.0001"
                value={valorPonto}
                onChange={(e) => setValorPonto(e.target.value)}
                placeholder="Ex: 12,50"
              />
            </Field>
            <Field label="Total de pontos">
              <Input
                type="number"
                step="1"
                value={totalPontos}
                onChange={(e) => setTotalPontos(e.target.value)}
              />
            </Field>
            <Field label="Abatimento de pontos">
              <Input
                type="number"
                step="1"
                value={abatimento}
                onChange={(e) => setAbatimento(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Observações">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
          {error && (
            <div style={ERROR_BOX}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState>
          Sem registros de gorjeta. Cadastre o primeiro período para começar a
          calcular pontos líquidos.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Valor / ponto</TableHead>
              <TableHead className="text-right">Pontos</TableHead>
              <TableHead className="text-right">Abat.</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  {formatDateBR(r.periodo)}
                </TableCell>
                <TableCell className="text-right">
                  {formatBRL(r.valor_ponto)}
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.total_pontos}
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text-3)",
                  }}
                >
                  {r.abatimento_pontos}
                </TableCell>
                <TableCell className="text-right">
                  <span style={LIQUIDO_BADGE}>{r.pontos_liquidos}</span>
                </TableCell>
                <TableCell
                  className="text-right"
                  style={{ fontWeight: 600, color: "var(--brand)" }}
                >
                  {formatBRL(Number(r.valor_ponto) * r.pontos_liquidos)}
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

const LIQUIDO_BADGE: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  background: "var(--brand-soft)",
  color: "var(--brand)",
  fontWeight: 700,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
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
