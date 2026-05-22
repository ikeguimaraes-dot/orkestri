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
import { createPerformanceTemplate } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import {
  PERIODICIDADE_LABEL,
  type PerformanceCriterio,
  type PerformancePeriodicidade,
} from "@/lib/avaliacoes/types";
import type { BrandOption } from "@/lib/eventos/types";

const PERIODICIDADE_VALUES: PerformancePeriodicidade[] = [
  "mensal",
  "trimestral",
  "semestral",
  "anual",
];

export function NovoTemplateAvaliacaoClient({
  brands,
}: {
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [funcao, setFuncao] = useState("");
  const [periodicidade, setPeriodicidade] =
    useState<PerformancePeriodicidade>("trimestral");
  const [criterios, setCriterios] = useState<PerformanceCriterio[]>([]);

  const canSubmit =
    !pending &&
    brandId.length > 0 &&
    nome.trim().length > 0 &&
    criterios.every((c) => c.nome.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createPerformanceTemplate({
        brand_id: brandId,
        unit_id: null,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        funcao: funcao.trim() || null,
        periodicidade,
        criterios,
        ativo: true,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/avaliacoes/templates/${r.data.id}`);
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
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
            letterSpacing: -0.3,
          }}
        >
          Novo template de avaliação
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 18px" }}>
          Define um modelo de avaliação por marca e função, com critérios e periodicidade.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Marca" required>
            <Select value={brandId} onValueChange={(v) => v && setBrandId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

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
              placeholder="Ex: Avaliação trimestral – Garçons"
            />
          </Field>

          <Field label="Descrição" wide>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Objetivos, contexto, instruções pro avaliador…"
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
            Cada critério tem peso e tipo. Notas (1–5) entram na média ponderada;
            sim/não e texto são informativos.
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

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link
          href="/pessoas/avaliacoes/templates"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar template
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
