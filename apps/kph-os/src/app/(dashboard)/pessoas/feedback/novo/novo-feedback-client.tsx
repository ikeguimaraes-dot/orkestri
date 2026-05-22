"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@kph/ui/button";
import { Textarea } from "@kph/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import { createFeedback } from "../actions";
import type { EmployeeStub, FeedbackTipo, FeedbackCategoria } from "../actions";

const CATEGORIAS: { value: FeedbackCategoria; label: string }[] = [
  { value: "atendimento",        label: "Atendimento" },
  { value: "trabalho_em_equipe", label: "Trabalho em Equipe" },
  { value: "lideranca",          label: "Liderança" },
  { value: "pontualidade",       label: "Pontualidade" },
  { value: "tecnico",            label: "Técnico" },
  { value: "comportamento",      label: "Comportamento" },
  { value: "outro",              label: "Outro" },
];

export function NovoFeedbackClient({
  unitId,
  myEmployeeId,
  colaboradores,
}: {
  unitId: string;
  myEmployeeId: string;
  colaboradores: EmployeeStub[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [paraEmployeeId, setParaEmployeeId] = useState<string>("");
  const [tipo, setTipo] = useState<FeedbackTipo | "">("");
  const [categoria, setCategoria] = useState<FeedbackCategoria | "">("");
  const [mensagem, setMensagem] = useState("");
  const [anonimo, setAnonimo] = useState(false);

  const mensagemOk = mensagem.trim().length >= 20;
  const canSubmit =
    !pending &&
    paraEmployeeId.length > 0 &&
    tipo.length > 0 &&
    categoria.length > 0 &&
    mensagemOk;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !tipo || !categoria) return;
    setError(null);
    startTransition(async () => {
      const r = await createFeedback({
        unit_id: unitId,
        de_employee_id: myEmployeeId,
        para_employee_id: paraEmployeeId,
        tipo: tipo as FeedbackTipo,
        categoria: categoria as FeedbackCategoria,
        mensagem,
        anonimo,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/pessoas/feedback");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/pessoas/feedback"
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
        Feedback
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
          Novo feedback
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 18px" }}>
          Feedbacks construtivos ajudam o time a crescer.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Para quem" required>
            <Select value={paraEmployeeId} onValueChange={(v) => v && setParaEmployeeId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.sobrenome}
                    {c.funcao ? ` · ${c.funcao}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tipo" required>
            <Select value={tipo} onValueChange={(v) => v && setTipo(v as FeedbackTipo)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de feedback" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positivo">Positivo</SelectItem>
                <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Categoria" required>
            <Select value={categoria} onValueChange={(v) => v && setCategoria(v as FeedbackCategoria)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Mensagem" required wide>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              placeholder="Descreva o feedback de forma clara e específica… (mínimo 20 caracteres)"
            />
            <span
              style={{
                fontSize: 11,
                color: mensagemOk ? "var(--text-3)" : "var(--destructive)",
                marginTop: 4,
              }}
            >
              {mensagem.trim().length} / 20 mínimo
            </span>
          </Field>

          <Field label="Enviar anonimamente">
            <button
              type="button"
              onClick={() => setAnonimo((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: anonimo ? "var(--brand-soft)" : "var(--surface-2)",
                border: `1px solid ${anonimo ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 8,
                color: anonimo ? "var(--brand)" : "var(--text-2)",
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
                  background: anonimo ? "var(--brand)" : "var(--text-3)",
                }}
              />
              {anonimo ? "Anônimo" : "Identificado"}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {anonimo
                ? "Seu nome não será exibido para o destinatário."
                : "Seu nome será exibido para o destinatário."}
            </span>
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
          href="/pessoas/feedback"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar feedback
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
