"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import { Textarea } from "@kph/ui/textarea";
import { CriteriosEditor } from "@/components/avaliacoes/CriteriosEditor";
import { updatePerformanceTemplate } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import {
  PERIODICIDADE_LABEL,
  type PerformanceCriterio,
  type PerformancePeriodicidade,
  type PerformanceTemplate,
} from "@/lib/avaliacoes/types";
import type { BrandOption } from "@/lib/eventos/types";

const PERIODICIDADE_VALUES: PerformancePeriodicidade[] = [
  "mensal",
  "trimestral",
  "semestral",
  "anual",
];

export function TemplateAvaliacaoDetalheClient({
  template,
  brands,
}: {
  template: PerformanceTemplate;
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [nome, setNome] = useState(template.nome);
  const [descricao, setDescricao] = useState(template.descricao ?? "");
  const [funcao, setFuncao] = useState(template.funcao ?? "");
  const [periodicidade, setPeriodicidade] = useState<PerformancePeriodicidade>(
    template.periodicidade,
  );
  const [criterios, setCriterios] = useState<PerformanceCriterio[]>(
    Array.isArray(template.criterios) ? template.criterios : [],
  );
  const [ativo, setAtivo] = useState(template.ativo);

  const brandLabel = brands.find((b) => b.id === template.brand_id)?.name ?? "—";

  const canSubmit =
    !pending &&
    nome.trim().length > 0 &&
    criterios.every((c) => c.nome.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updatePerformanceTemplate(template.id, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        funcao: funcao.trim() || null,
        periodicidade,
        criterios,
        ativo,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 880, margin: "0 auto" }}>
      <Link
        href="/pessoas/avaliacoes/templates"
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

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
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
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
            Marca: <strong style={{ color: "var(--text-2)" }}>{brandLabel}</strong>
            {" · "}
            Periodicidade:{" "}
            <strong style={{ color: "var(--text-2)" }}>
              {PERIODICIDADE_LABEL[template.periodicidade]}
            </strong>
            {template.funcao && (
              <>
                {" · "}
                Função:{" "}
                <strong style={{ color: "var(--text-2)" }}>{template.funcao}</strong>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAtivo((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: ativo
              ? "rgba(34,197,94,0.10)"
              : "var(--surface-2)",
            border: `1px solid ${ativo ? "rgba(34,197,94,0.30)" : "var(--border)"}`,
            borderRadius: 8,
            color: ativo ? "#15803D" : "var(--text-2)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: ativo ? "#22C55E" : "var(--text-3)",
            }}
          />
          {ativo ? "Ativo" : "Inativo"}
        </button>
      </div>

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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Função alvo">
            <Input
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              placeholder="Ex: Garçom (vazio = todas)"
            />
          </Field>

          <Field label="Periodicidade" required>
            <Select
              value={periodicidade}
              onValueChange={(v) =>
                v && setPeriodicidade(v as PerformancePeriodicidade)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODICIDADE_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIODICIDADE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Nome do template" required wide>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>

          <Field label="Descrição" wide>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
            }}
          >
            Critérios de avaliação
          </h3>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              margin: "2px 0 0",
            }}
          >
            Notas (1–5) entram na média ponderada; sim/não e texto são informativos.
          </p>
        </div>
        <CriteriosEditor criterios={criterios} onChange={setCriterios} />
      </div>

      {error && (
        <div
          style={{
            marginBottom: 14,
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
      {saved && !error && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: "rgba(34,197,94,0.10)",
            border: "1px solid rgba(34,197,94,0.30)",
            borderRadius: 8,
            fontSize: 12,
            color: "#15803D",
          }}
        >
          Alterações salvas.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link
          href="/pessoas/avaliacoes/templates"
          className={buttonVariants({ variant: "outline" })}
        >
          Voltar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
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
        {required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
