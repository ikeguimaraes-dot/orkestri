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
import { createTrainingTemplate } from "@/app/(dashboard)/pessoas/treinamentos/actions";
import type { BrandOption } from "@/lib/eventos/types";

export function NovoTemplateClient({
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
  const [obrigatorio, setObrigatorio] = useState(false);
  const [validadeDias, setValidadeDias] = useState<string>("");

  const canSubmit = !pending && brandId.length > 0 && nome.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createTrainingTemplate({
        brand_id: brandId,
        unit_id: null,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        funcao: funcao.trim() || null,
        obrigatorio,
        validade_dias: validadeDias ? Number(validadeDias) : null,
        ativo: true,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/treinamentos/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/pessoas/treinamentos"
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
        Treinamentos
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
          Novo template
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 18px" }}>
          Define um treinamento padrão pra ser aplicado a colaboradores.
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

          <Field label="Nome do treinamento" required wide>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Onboarding KPH"
            />
          </Field>

          <Field label="Descrição" wide>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Conteúdo, objetivos, materiais…"
            />
          </Field>

          <Field label="Validade (dias)">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
              placeholder="Vazio = sem validade"
            />
          </Field>

          <Field label="Obrigatório">
            <button
              type="button"
              onClick={() => setObrigatorio((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: obrigatorio
                  ? "rgba(239,68,68,0.10)"
                  : "var(--surface-2)",
                border: `1px solid ${obrigatorio ? "rgba(239,68,68,0.30)" : "var(--border)"}`,
                borderRadius: 8,
                color: obrigatorio ? "#B91C1C" : "var(--text-2)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: obrigatorio ? "#EF4444" : "var(--text-3)",
                }}
              />
              {obrigatorio ? "Obrigatório" : "Opcional"}
            </button>
          </Field>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
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
        <Link
          href="/pessoas/treinamentos"
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
