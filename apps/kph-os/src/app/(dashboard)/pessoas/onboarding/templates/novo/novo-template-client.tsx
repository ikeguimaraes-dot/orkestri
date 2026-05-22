"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@kph/ui/button";
import { createTemplate, type Responsavel } from "../../actions";

type TarefaInput = {
  titulo: string;
  descricao: string;
  responsavel: Responsavel;
  prazo_dias: number;
  ordem: number;
};

const RESP_OPTS: { value: Responsavel; label: string }[] = [
  { value: "rh",          label: "RH" },
  { value: "gestor",      label: "Gestor" },
  { value: "colaborador", label: "Colaborador" },
  { value: "ti",          label: "TI" },
];

const DEFAULT_TAREFAS: TarefaInput[] = [
  { titulo: "Assinar contrato de trabalho",       descricao: "", responsavel: "rh",          prazo_dias: 1,  ordem: 0 },
  { titulo: "Apresentar equipe e espaço físico",  descricao: "", responsavel: "gestor",       prazo_dias: 1,  ordem: 1 },
  { titulo: "Configurar acesso aos sistemas",     descricao: "", responsavel: "ti",           prazo_dias: 2,  ordem: 2 },
  { titulo: "Ler manual do colaborador",          descricao: "", responsavel: "colaborador",  prazo_dias: 3,  ordem: 3 },
];

export function NovoTemplateClient({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tarefas, setTarefas] = useState<TarefaInput[]>(DEFAULT_TAREFAS);

  useEffect(() => {
    setMounted(true);
  }, []);

  function addTarefa() {
    setTarefas((prev) => [
      ...prev,
      {
        titulo: "",
        descricao: "",
        responsavel: "rh",
        prazo_dias: 1,
        ordem: prev.length,
      },
    ]);
  }

  function removeTarefa(idx: number) {
    setTarefas((prev) =>
      prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, ordem: i })),
    );
  }

  function updateTarefa<K extends keyof TarefaInput>(
    idx: number,
    field: K,
    value: TarefaInput[K],
  ) {
    setTarefas((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    );
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setTarefas((prev) => {
      const next = [...prev];
      const tmp = next[idx - 1]!;
      next[idx - 1] = next[idx]!;
      next[idx] = tmp;
      return next.map((t, i) => ({ ...t, ordem: i }));
    });
  }

  function moveDown(idx: number) {
    setTarefas((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      const tmp = next[idx]!;
      next[idx] = next[idx + 1]!;
      next[idx + 1] = tmp;
      return next.map((t, i) => ({ ...t, ordem: i }));
    });
  }

  const canSubmit =
    !pending &&
    mounted &&
    nome.trim().length >= 2 &&
    tarefas.length > 0 &&
    tarefas.every((t) => t.titulo.trim().length > 0 && t.prazo_dias >= 1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createTemplate({
        unit_id: unitId,
        nome,
        descricao,
        tarefas,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/pessoas/onboarding/templates");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link
        href="/pessoas/onboarding/templates"
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
        Templates
      </Link>

      {/* Header card */}
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
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
              letterSpacing: -0.3,
            }}
          >
            Novo Template
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>
            Defina o processo de integração que será aplicado aos novos colaboradores.
          </p>
        </div>

        <Field label="Nome do template" required>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Onboarding Cozinha, Onboarding Gestores"
            style={inputStyle}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Breve descrição do processo de integração…"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>
      </div>

      {/* Tasks card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
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
            Tarefas <span style={{ color: "var(--destructive)" }}>*</span>
          </span>
          <button
            type="button"
            onClick={addTarefa}
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
            Adicionar
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tarefas.map((tarefa, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              {/* Order controls */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  paddingTop: 4,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  style={iconBtnStyle(idx === 0)}
                  title="Mover acima"
                >
                  <ArrowUp size={11} />
                </button>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    textAlign: "center",
                    lineHeight: 1,
                  }}
                >
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === tarefas.length - 1}
                  style={iconBtnStyle(idx === tarefas.length - 1)}
                  title="Mover abaixo"
                >
                  <ArrowDown size={11} />
                </button>
              </div>

              {/* Fields */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  value={tarefa.titulo}
                  onChange={(e) => updateTarefa(idx, "titulo", e.target.value)}
                  placeholder="Título da tarefa"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={tarefa.descricao}
                  onChange={(e) => updateTarefa(idx, "descricao", e.target.value)}
                  placeholder="Descrição (opcional)"
                  style={{ ...inputStyle, fontSize: 12 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={tarefa.responsavel}
                    onChange={(e) =>
                      updateTarefa(idx, "responsavel", e.target.value as Responsavel)
                    }
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    {RESP_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      Prazo (dias):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={tarefa.prazo_dias}
                      onChange={(e) =>
                        updateTarefa(idx, "prazo_dias", Math.max(1, parseInt(e.target.value) || 1))
                      }
                      style={{ ...inputStyle, width: 72 }}
                    />
                  </div>
                </div>
              </div>

              {/* Remove */}
              {tarefas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTarefa(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-3)",
                    padding: 4,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                  title="Remover tarefa"
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
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link
          href="/pessoas/onboarding/templates"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Template
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

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    padding: 2,
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "var(--border)" : "var(--text-3)",
    display: "flex",
    alignItems: "center",
    borderRadius: 4,
  };
}

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
