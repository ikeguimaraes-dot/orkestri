"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@kph/ui/button";
import { createOnboardingRun, type OnboardingTemplate } from "../actions";

type EmployeeStub = { id: string; nome: string; sobrenome: string; funcao: string };

export function NovoOnboardingClient({
  unitId,
  employees,
  templates,
}: {
  unitId: string;
  employees: EmployeeStub[];
  templates: (OnboardingTemplate & { tarefas: { id: string }[] })[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [dataInicio, setDataInicio] = useState(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const canSubmit =
    !pending && mounted && employeeId.length > 0 && templateId.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createOnboardingRun(unitId, employeeId, templateId, dataInicio);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/onboarding/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link
        href="/pessoas/onboarding"
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
        Onboarding
      </Link>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
              letterSpacing: -0.3,
            }}
          >
            Novo Onboarding
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>
            Selecione o colaborador e o template de integração.
          </p>
        </div>

        <Field label="Colaborador" required>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecionar colaborador…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nome} {emp.sobrenome} — {emp.funcao}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Template de onboarding" required>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={inputStyle}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.nome} ({tpl.tarefas.length} tarefa{tpl.tarefas.length !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </Field>

        {selectedTemplate?.descricao && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              padding: "10px 14px",
              background: "var(--surface-2)",
              borderRadius: 8,
              lineHeight: 1.5,
            }}
          >
            {selectedTemplate.descricao}
          </div>
        )}

        <Field label="Data de início">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            style={inputStyle}
          />
        </Field>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 8,
              fontSize: 12,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link href="/pessoas/onboarding" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Iniciar Onboarding
        </Button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
