"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Loader2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
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

export function PayslipDetail({
  payslip,
  isFounder,
}: {
  payslip: PayslipWithEmployee;
  isFounder: boolean;
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
      if (!res.ok) {
        alert(`Falha ao aprovar: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handlePay = () => {
    startTransition(async () => {
      const res = await markPayslipPaid(payslip.id);
      if (!res.ok) {
        alert(`Falha ao marcar como pago: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <Link
        href="/pessoas/holerites"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={14} />
        Voltar para holerites
      </Link>

      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 22,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Holerite · {competenciaLabel(payslip.competencia)}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-playfair, var(--font-geist-sans))",
              fontSize: 30,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "var(--text)",
              letterSpacing: -0.5,
            }}
          >
            {employeeName}
          </h1>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            {payslip.employee?.funcao ?? "—"} ·{" "}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 99,
                background: STATUS_COLOR[status].bg,
                color: STATUS_COLOR[status].fg,
                marginLeft: 4,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {status === "rascunho" && (
            <Button onClick={handleApprove} disabled={isPending} variant="outline">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Aprovar
            </Button>
          )}
          {status === "aprovado" && isFounder && (
            <Button onClick={handlePay} disabled={isPending} variant="outline">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CircleDollarSign className="mr-2 h-4 w-4" />
              )}
              Marcar como pago
            </Button>
          )}
          <a
            href={`/api/holerites/${payslip.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants()}
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar PDF
          </a>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
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

      <div
        style={{
          marginTop: 20,
          padding: "22px 26px",
          background: "var(--brand-soft)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Líquido a receber
        </div>
        <div
          style={{
            fontFamily: "var(--font-playfair, var(--font-geist-sans))",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--brand)",
            letterSpacing: -0.8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatBRL(payslip.liquido)}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Line({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const n = typeof value === "string" ? Number(value) : value;
  const isZero = !Number.isFinite(n) || n === 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <span style={{ color: isZero ? "var(--text-3)" : "var(--text-2)" }}>{label}</span>
      <span
        style={{
          color: isZero ? "var(--text-3)" : "var(--text)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: isZero ? 400 : 500,
        }}
      >
        {formatBRL(value)}
      </span>
    </div>
  );
}

function Total({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
        paddingTop: 10,
        borderTop: `1px solid ${color}`,
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--text)" }}>{label}</span>
      <span
        style={{
          color,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
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
