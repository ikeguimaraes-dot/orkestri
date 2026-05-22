import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EmployeeForm, employeeToFormDefaults } from "@/components/pessoas/EmployeeForm";
import { getEmployee } from "@/lib/pessoas/actions";
import { requireUser } from "@kph/auth/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditarColaboradorPage({ params }: Props) {
  await requireUser();
  // Next 16: params é Promise.
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const fullName = `${employee.nome} ${employee.sobrenome}`.trim();

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
        Editar {fullName}
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 24px" }}>
        Função:{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{employee.funcao}</span>
        {" · "}Status:{" "}
        <span
          style={{
            color: employee.ativo ? "#22C55E" : "var(--text-3)",
            fontWeight: 600,
          }}
        >
          {employee.ativo ? "Ativo" : "Inativo"}
        </span>
      </p>

      <EmployeeForm
        mode="edit"
        unitId={employee.unit_id}
        employeeId={employee.id}
        defaultValues={employeeToFormDefaults(employee)}
      />
    </div>
  );
}
