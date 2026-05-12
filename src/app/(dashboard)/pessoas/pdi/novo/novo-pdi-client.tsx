"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createPdi } from "../actions";

type MetaInput = { descricao: string; prazo: string };

export function NovoPdiClient({
  unitId,
  employeeId,
  employeeNome,
}: {
  unitId: string;
  employeeId: string;
  employeeNome: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [metas, setMetas] = useState<MetaInput[]>([{ descricao: "", prazo: "" }]);

  function addMeta() {
    setMetas((prev) => [...prev, { descricao: "", prazo: "" }]);
  }

  function removeMeta(idx: number) {
    setMetas((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMeta(idx: number, field: keyof MetaInput, value: string) {
    setMetas((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  const metasValidas = metas.every((m) => m.descricao.trim().length > 0 && m.prazo.length > 0);
  const canSubmit =
    !pending &&
    titulo.trim().length >= 3 &&
    dataInicio.length > 0 &&
    dataFim.length > 0 &&
    dataFim > dataInicio &&
    metas.length > 0 &&
    metasValidas;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createPdi({
        unit_id: unitId,
        employee_id: employeeId,
        titulo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        metas,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/pessoas/pdi");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/pessoas/pdi"
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
        PDI
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
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text)", letterSpacing: -0.3 }}>
            Novo PDI
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>
            Colaborador: <strong>{employeeNome}</strong>
          </p>
        </div>

        <Field label="Título do PDI" required>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Desenvolvimento em liderança e gestão de times"
            style={inputStyle}
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Data de início" required>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Data de término" required>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Metas dinâmicas */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-2)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Metas <span style={{ color: "var(--destructive)" }}>*</span>
            </span>
            <button
              type="button"
              onClick={addMeta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "var(--brand)",
                background: "var(--brand-soft)",
                border: "1px solid transparent",
                borderRadius: 6,
                padding: "4px 10px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={13} />
              Adicionar meta
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metas.map((meta, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "14px 14px",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    minWidth: 20,
                    paddingTop: 10,
                  }}
                >
                  {idx + 1}.
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="text"
                    value={meta.descricao}
                    onChange={(e) => updateMeta(idx, "descricao", e.target.value)}
                    placeholder="Descrição da meta"
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      Prazo:
                    </label>
                    <input
                      type="date"
                      value={meta.prazo}
                      onChange={(e) => updateMeta(idx, "prazo", e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>
                {metas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMeta(idx)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-3)",
                      padding: 4,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Remover meta"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

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
        <Link href="/pessoas/pdi" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar PDI
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
