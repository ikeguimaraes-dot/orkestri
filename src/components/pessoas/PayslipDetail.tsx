"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Printer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { approvePayslip, markPayslipPaid } from "@/lib/pessoas/actions";
import { formatBRL } from "@/lib/format";
import type { PayslipStatus, PayslipWithEmployee } from "@/types/pessoas";

const STATUS_LABEL: Record<PayslipStatus, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  pago: "Pago",
};

const STATUS_COLOR: Record<PayslipStatus, { bg: string; fg: string }> = {
  rascunho: { bg: "var(--muted)", fg: "var(--muted-foreground)" },
  aprovado: { bg: "rgba(59,130,246,0.12)", fg: "#1D4ED8" },
  pago: { bg: "rgba(34,197,94,0.12)", fg: "#15803D" },
};

const PROVENTOS_GREEN = "#15803D";
const DESCONTOS_RED = "#B91C1C";

type EmployeeExtra = {
  cpf: string | null;
  pis: string | null;
  data_admissao: string;
  departamento: string | null;
} | null;

export function PayslipDetail({
  payslip,
  isFounder,
  employeeExtra,
  unit,
  brand,
}: {
  payslip: PayslipWithEmployee;
  isFounder: boolean;
  employeeExtra?: EmployeeExtra;
  unit?: { name: string; address: string | null } | null;
  brand?: { name: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const status = (payslip.status as PayslipStatus) ?? "rascunho";
  const employeeName = payslip.employee
    ? `${payslip.employee.nome} ${payslip.employee.sobrenome}`.trim()
    : "—";

  const totalProventos =
    Number(payslip.salario_base) +
    Number(payslip.horas_extras) +
    Number(payslip.adicional_noturno) +
    Number(payslip.gorjeta) +
    Number(payslip.dsr_gorjeta) +
    Number(payslip.outros_acrescimos);

  const totalDescontos =
    Number(payslip.desconto_inss) +
    Number(payslip.desconto_irrf) +
    Number(payslip.desconto_vale_transporte) +
    Number(payslip.desconto_vale_refeicao) +
    Number(payslip.outros_descontos);

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approvePayslip(payslip.id);
      if (!res.ok) { alert(`Falha ao aprovar: ${res.error}`); return; }
      router.refresh();
    });
  };

  const handlePay = () => {
    startTransition(async () => {
      const res = await markPayslipPaid(payslip.id);
      if (!res.ok) { alert(`Falha ao marcar como pago: ${res.error}`); return; }
      router.refresh();
    });
  };

  const today = new Date().toLocaleDateString("pt-BR");
  const geradoEm = new Date().toLocaleString("pt-BR");

  return (
    <div id="holerite-print" style={{ maxWidth: 820, margin: "0 auto" }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #holerite-print, #holerite-print * { visibility: visible !important; }
          #holerite-print {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            padding: 28px 36px;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          * { box-shadow: none !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Nav — oculto na impressão */}
      <Link
        href="/pessoas/holerites"
        className="no-print"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--text-3)", textDecoration: "none", marginBottom: 14,
        }}
      >
        <ArrowLeft size={14} />
        Voltar para holerites
      </Link>

      {/* ── Cabeçalho da empresa ─────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          marginBottom: 16,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: -0.3 }}>
            {brand?.name ?? "—"}
          </div>
          {unit && (
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
              {unit.name}
              {unit.address && (
                <span style={{ color: "var(--text-3)" }}> · {unit.address}</span>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
            CNPJ: ___________________________
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
              textTransform: "uppercase", color: "var(--text-3)",
            }}
          >
            Holerite · {competenciaLabel(payslip.competencia)}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
            ID: {payslip.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Header com nome + ações ─────────────────────────── */}
      <header
        style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 16, gap: 16, flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-playfair, var(--font-geist-sans))",
              fontSize: 30, fontWeight: 700, margin: "0 0 4px",
              color: "var(--text)", letterSpacing: -0.5,
            }}
          >
            {employeeName}
          </h1>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            {payslip.employee?.funcao ?? "—"} ·{" "}
            <span
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                background: STATUS_COLOR[status].bg, color: STATUS_COLOR[status].fg, marginLeft: 4,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {status === "rascunho" && (
            <Button onClick={handleApprove} disabled={isPending} variant="outline">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Aprovar
            </Button>
          )}
          {status === "aprovado" && isFounder && (
            <Button onClick={handlePay} disabled={isPending} variant="outline">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleDollarSign className="mr-2 h-4 w-4" />}
              Marcar como pago
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </header>

      {/* ── Dados do colaborador ────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "6px 16px",
          padding: "12px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <DataField label="CPF" value={formatDoc(employeeExtra?.cpf, "cpf")} />
        <DataField label="PIS / NIS" value={formatDoc(employeeExtra?.pis, "pis")} />
        <DataField
          label="Admissão"
          value={
            employeeExtra?.data_admissao
              ? new Date(employeeExtra.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")
              : "—"
          }
        />
        <DataField label="Departamento" value={employeeExtra?.departamento ?? "—"} />
        <DataField
          label="Salário base / ref."
          value={`${formatBRL(payslip.salario_base)} / 220h`}
        />
        <DataField label="Competência" value={competenciaLabel(payslip.competencia)} />
      </div>

      {/* ── Proventos + Descontos ────────────────────────────── */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Proventos" color={PROVENTOS_GREEN}>
          <Line label="Salário-base" value={payslip.salario_base} />
          <Line label="Horas extras" value={payslip.horas_extras} />
          <Line label="Adicional noturno" value={payslip.adicional_noturno} />
          <Line label="Gorjeta" value={payslip.gorjeta} />
          <Line label="DSR sobre gorjeta" value={payslip.dsr_gorjeta} />
          <Line label="Outros acréscimos" value={payslip.outros_acrescimos} />
          <Total label="Total proventos" value={totalProventos} color={PROVENTOS_GREEN} />
        </Card>
        <Card title="Descontos" color={DESCONTOS_RED}>
          <Line label="INSS" value={payslip.desconto_inss} />
          <Line label="IRRF" value={payslip.desconto_irrf} />
          <Line label="Vale-transporte" value={payslip.desconto_vale_transporte} />
          <Line label="Vale-refeição" value={payslip.desconto_vale_refeicao} />
          <Line label="Outros descontos" value={payslip.outros_descontos} />
          <Total label="Total descontos" value={totalDescontos} color={DESCONTOS_RED} />
        </Card>
      </div>

      {/* ── Líquido ─────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 20,
          padding: "22px 26px",
          background: "var(--brand-soft)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.6,
            textTransform: "uppercase", color: "var(--text-3)",
          }}
        >
          Líquido a receber
        </div>
        <div
          style={{
            fontFamily: "var(--font-playfair, var(--font-geist-sans))",
            fontSize: 36, fontWeight: 700, color: "var(--brand)",
            letterSpacing: -0.8, fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatBRL(payslip.liquido)}
        </div>
      </div>

      {/* ── Assinaturas (somente impressão) ─────────────────── */}
      <div
        className="print-only"
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginBottom: 28 }}>
          Declaro ter recebido o pagamento referente ao período acima.
        </p>
        <div style={{ display: "flex", gap: 40 }}>
          <SignatureBlock label={`Assinatura do Colaborador\n${employeeName}`} date={today} />
          <SignatureBlock label="Assinatura RH / Responsável" date={today} />
        </div>
      </div>

      {/* ── Rodapé (somente impressão) ──────────────────────── */}
      <div
        className="print-only"
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 9,
          color: "#9ca3af",
        }}
      >
        <span>Documento gerado pelo KPH OS em {geradoEm}</span>
        <span>{brand?.name ?? ""} · {unit?.name ?? ""}</span>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--text-3)" }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function SignatureBlock({ label, date }: { label: string; date: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          borderBottom: "1px solid #374151",
          marginBottom: 6,
          height: 40,
        }}
      />
      <div style={{ fontSize: 10, color: "#374151", whiteSpace: "pre-line", lineHeight: 1.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
        Data: {date}
      </div>
    </div>
  );
}

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 18px", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 12,
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
          textTransform: "uppercase", color, marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string | number }) {
  const n = typeof value === "string" ? Number(value) : value;
  const isZero = !Number.isFinite(n) || n === 0;
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12,
      }}
    >
      <span style={{ color: isZero ? "var(--text-3)" : "var(--text-2)" }}>{label}</span>
      <span
        style={{
          color: isZero ? "var(--text-3)" : "var(--text)",
          fontVariantNumeric: "tabular-nums", fontWeight: isZero ? 400 : 500,
        }}
      >
        {formatBRL(value)}
      </span>
    </div>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 4, paddingTop: 10, borderTop: `1px solid ${color}`, fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--text)" }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

function competenciaLabel(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[m - 1] ?? ""}/${y}`;
}

function formatDoc(value: string | null | undefined, type: "cpf" | "pis"): string {
  if (!value) return "___________________________";
  const digits = value.replace(/\D/g, "");
  if (type === "cpf" && digits.length === 11) {
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  }
  if (type === "pis" && digits.length === 11) {
    return `${digits.slice(0,3)}.${digits.slice(3,8)}.${digits.slice(8,10)}-${digits.slice(10)}`;
  }
  return value;
}
