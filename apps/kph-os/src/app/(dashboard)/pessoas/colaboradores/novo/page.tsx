import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmployeeForm } from "@/components/pessoas/EmployeeForm";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";

export const dynamic = "force-dynamic";

export default async function NovoColaboradorPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link
        href="/pessoas/colaboradores"
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
        <ArrowLeft size={14} /> Voltar
      </Link>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          margin: 0,
          color: "var(--text)",
          letterSpacing: -0.4,
        }}
      >
        Novo colaborador
      </h1>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: "6px 0 24px",
        }}
      >
        Cadastro vai pra unidade{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {unit?.name ?? "—"}
        </span>
        . Troca pelo seletor da sidebar antes de salvar se quiser outra.
      </p>

      {unit ? (
        <EmployeeForm mode="create" unitId={unit.id} />
      ) : (
        <div
          style={{
            padding: "32px 20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Sem unidade selecionada. Escolhe uma na sidebar antes de cadastrar.
        </div>
      )}
    </div>
  );
}
