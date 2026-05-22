"use client";

import { useMemo, useState, useTransition } from "react";
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
import { createPerformanceReview } from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import {
  PERIODICIDADE_LABEL,
  calcNotaGeral,
  formatNota,
  type PerformanceCriterio,
  type PerformancePeriodicidade,
  type PerformanceReviewStatus,
} from "@/lib/avaliacoes/types";

type EmployeeLite = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string;
};

type TemplateLite = {
  id: string;
  nome: string;
  descricao: string | null;
  funcao: string | null;
  periodicidade: PerformancePeriodicidade;
  criterios: PerformanceCriterio[];
};

function suggestPeriodo(p: PerformancePeriodicidade): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (p === "anual") return `${y}`;
  if (p === "semestral") return `${y}-S${m <= 6 ? 1 : 2}`;
  if (p === "trimestral") {
    const q = Math.ceil(m / 3);
    return `${y}-Q${q}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function NovaAvaliacaoClient({
  employee,
  templates,
}: {
  employee: EmployeeLite;
  templates: TemplateLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const [periodo, setPeriodo] = useState<string>(() =>
    template ? suggestPeriodo(template.periodicidade) : "",
  );
  const [dataAvaliacao, setDataAvaliacao] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState<PerformanceReviewStatus>("rascunho");

  // Respostas indexadas por criterio.id. Inicializa vazio quando troca de template.
  const [respostas, setRespostas] = useState<
    Record<string, string | number | boolean | null>
  >({});

  const [pontosFortes, setPontosFortes] = useState("");
  const [pontosMelhoria, setPontosMelhoria] = useState("");
  const [planoAcao, setPlanoAcao] = useState("");

  // Quando troca template, reseta respostas + sugere período novo.
  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setRespostas({});
    const t = templates.find((x) => x.id === id);
    if (t) setPeriodo(suggestPeriodo(t.periodicidade));
  }

  function setResposta(critId: string, value: string | number | boolean | null) {
    setRespostas((prev) => ({ ...prev, [critId]: value }));
  }

  const notaGeral = useMemo(() => {
    if (!template) return null;
    return calcNotaGeral(template.criterios, respostas);
  }, [template, respostas]);

  const canSubmit =
    !pending &&
    template !== null &&
    periodo.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !template) return;
    setError(null);
    startTransition(async () => {
      const r = await createPerformanceReview({
        employee_id: employee.id,
        template_id: template.id,
        periodo: periodo.trim(),
        status,
        nota_geral: notaGeral,
        respostas,
        pontos_fortes: pontosFortes.trim() || null,
        pontos_melhoria: pontosMelhoria.trim() || null,
        plano_acao: planoAcao.trim() || null,
        data_avaliacao: dataAvaliacao || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/colaboradores/${employee.id}?tab=avaliacoes`);
      router.refresh();
    });
  }

  if (templates.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href={`/pessoas/colaboradores/${employee.id}`}
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
          Perfil de {employee.nome}
        </Link>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Sem templates compatíveis
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 16px" }}>
            Não há templates ativos para a função{" "}
            <strong>{employee.funcao}</strong> da marca deste colaborador.
            Crie um template antes de iniciar uma avaliação.
          </p>
          <Link
            href="/pessoas/avaliacoes/templates/novo"
            className={buttonVariants()}
          >
            Criar template
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 880, margin: "0 auto" }}>
      <Link
        href={`/pessoas/colaboradores/${employee.id}`}
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
        Perfil de {employee.nome} {employee.sobrenome}
      </Link>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
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
          Nova avaliação · {employee.nome} {employee.sobrenome}
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 16px" }}>
          Função: <strong style={{ color: "var(--text-2)" }}>{employee.funcao}</strong>
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Template" required wide>
            <Select
              value={templateId}
              onValueChange={(v) => v && handleTemplateChange(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} · {PERIODICIDADE_LABEL[t.periodicidade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Período" required>
            <Input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ex: 2026-Q1"
            />
          </Field>

          <Field label="Data da avaliação">
            <Input
              type="date"
              value={dataAvaliacao}
              onChange={(e) => setDataAvaliacao(e.target.value)}
            />
          </Field>

          <Field label="Status" required>
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v as PerformanceReviewStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {template && template.criterios.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--text)",
                }}
              >
                Critérios
              </h3>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>
                Notas de 1 a 5; pesos do template definem a média ponderada.
              </p>
            </div>
            <NotaPreview nota={notaGeral} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {template.criterios.map((c) => (
              <CriterioInput
                key={c.id}
                criterio={c}
                value={respostas[c.id]}
                onChange={(v) => setResposta(c.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: "0 0 14px",
            color: "var(--text)",
          }}
        >
          Comentários
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
          }}
        >
          <Field label="Pontos fortes">
            <Textarea
              rows={3}
              value={pontosFortes}
              onChange={(e) => setPontosFortes(e.target.value)}
              placeholder="O que o colaborador faz bem…"
            />
          </Field>
          <Field label="Pontos de melhoria">
            <Textarea
              rows={3}
              value={pontosMelhoria}
              onChange={(e) => setPontosMelhoria(e.target.value)}
              placeholder="Áreas pra desenvolver…"
            />
          </Field>
          <Field label="Plano de ação">
            <Textarea
              rows={3}
              value={planoAcao}
              onChange={(e) => setPlanoAcao(e.target.value)}
              placeholder="Próximos passos, treinamentos, metas…"
            />
          </Field>
        </div>
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
          href={`/pessoas/colaboradores/${employee.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar avaliação
        </Button>
      </div>
    </form>
  );
}

function CriterioInput({
  criterio,
  value,
  onChange,
}: {
  criterio: PerformanceCriterio;
  value: string | number | boolean | null | undefined;
  onChange: (v: string | number | boolean | null) => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {criterio.nome}
          </div>
          {criterio.descricao && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {criterio.descricao}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 99,
            background: "var(--brand-soft)",
            color: "var(--brand)",
            whiteSpace: "nowrap",
          }}
        >
          peso {criterio.peso}
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        {criterio.tipo === "nota_1_5" && (
          <NotaInput
            value={typeof value === "number" ? value : null}
            onChange={onChange}
          />
        )}
        {criterio.tipo === "sim_nao" && (
          <SimNaoInput
            value={typeof value === "boolean" ? value : null}
            onChange={onChange}
          />
        )}
        {criterio.tipo === "texto" && (
          <Textarea
            rows={2}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Comentário…"
          />
        )}
      </div>
    </div>
  );
}

function NotaInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            type="button"
            key={n}
            onClick={() => onChange(active ? null : n)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
              background: active ? "var(--brand)" : "var(--surface)",
              color: active ? "#fff" : "var(--text)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all var(--t)",
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function SimNaoInput({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  function pill(label: string, sel: boolean, on: () => void, color: string) {
    return (
      <button
        type="button"
        onClick={on}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: `1px solid ${sel ? color : "var(--border)"}`,
          background: sel
            ? `color-mix(in srgb, ${color} 18%, transparent)`
            : "var(--surface)",
          color: sel ? color : "var(--text-2)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {pill("Sim", value === true, () => onChange(value === true ? null : true), "#22C55E")}
      {pill("Não", value === false, () => onChange(value === false ? null : false), "#EF4444")}
    </div>
  );
}

function NotaPreview({ nota }: { nota: number | null }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        padding: "6px 14px",
        background: "var(--brand-soft)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--brand)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        Nota geral
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--brand)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {formatNota(nota)}
      </span>
    </div>
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
