"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  createCiclo,
  type AvaliacaoParticipante,
} from "@/app/(dashboard)/pessoas/avaliacoes/actions";

type EmployeeLite = { id: string; nome: string; sobrenome: string; funcao: string };
type TemplateLite = { id: string; nome: string };

type ParticipanteRow = {
  avaliado_id: string;
  avaliador_id: string;
  tipo_avaliador: AvaliacaoParticipante["tipo_avaliador"];
};

const TIPO_LABEL: Record<AvaliacaoParticipante["tipo_avaliador"], string> = {
  autoavaliacao: "Autoavaliação",
  par: "Par",
  gestor: "Gestor",
  liderado: "Liderado",
};

export function NovoCicloClient({
  unitId,
  unitNome,
  employees,
  templates,
}: {
  unitId: string;
  unitNome: string;
  employees: EmployeeLite[];
  templates: TemplateLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [templateId, setTemplateId] = useState<string>("none");
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
  const [avaliadoId, setAvaliadoId] = useState("");
  const [avaliadorId, setAvaliadorId] = useState("");
  const [tipoAvaliador, setTipoAvaliador] =
    useState<AvaliacaoParticipante["tipo_avaliador"]>("gestor");

  function addParticipante() {
    if (!avaliadoId || !avaliadorId) return;
    const dup = participantes.some(
      (p) => p.avaliado_id === avaliadoId && p.avaliador_id === avaliadorId,
    );
    if (dup) {
      setError("Esse par avaliado/avaliador já foi adicionado.");
      return;
    }
    setError(null);
    setParticipantes((prev) => [
      ...prev,
      { avaliado_id: avaliadoId, avaliador_id: avaliadorId, tipo_avaliador: tipoAvaliador },
    ]);
  }

  function removeParticipante(idx: number) {
    setParticipantes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Nome do ciclo obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createCiclo({
        unit_id: unitId,
        nome: nome.trim(),
        template_id: templateId === "none" ? null : templateId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        participantes,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/avaliacoes/ciclos/${r.data.id}`);
    });
  }

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.nome} ${e.sobrenome}` : id;
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: "0 auto" }}>
      <Link
        href="/pessoas/avaliacoes/ciclos"
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
        Ciclos 360°
      </Link>

      {/* Dados do ciclo */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "var(--text)", letterSpacing: -0.3 }}>
          Novo ciclo 360° · {unitNome}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Nome do ciclo" required wide>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Avaliação 360° Q2 2026"
            />
          </Field>

          <Field label="Template (opcional)">
            <Select value={templateId} onValueChange={(v) => v && setTemplateId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Data início" required>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </Field>

          <Field label="Data fim" required>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Participantes */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>
          Participantes
        </h3>
        <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 14px" }}>
          Defina quem avalia quem. Um colaborador pode ter múltiplos avaliadores com tipos diferentes.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto auto",
            gap: 8,
            alignItems: "end",
            marginBottom: 12,
          }}
        >
          <Field label="Avaliado">
            <Select value={avaliadoId} onValueChange={(v) => v && setAvaliadoId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.sobrenome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Avaliador">
            <Select value={avaliadorId} onValueChange={(v) => v && setAvaliadorId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.sobrenome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tipo">
            <Select
              value={tipoAvaliador}
              onValueChange={(v) =>
                v && setTipoAvaliador(v as AvaliacaoParticipante["tipo_avaliador"])
              }
            >
              <SelectTrigger style={{ minWidth: 140 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as AvaliacaoParticipante["tipo_avaliador"][]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {TIPO_LABEL[k]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>

          <div style={{ paddingBottom: 1 }}>
            <Button
              type="button"
              variant="outline"
              onClick={addParticipante}
              disabled={!avaliadoId || !avaliadorId}
            >
              <Plus size={14} className="mr-1" />
              Adicionar
            </Button>
          </div>
        </div>

        {participantes.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <Th>Avaliado</Th>
                  <Th>Avaliador</Th>
                  <Th>Tipo</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => (
                  <tr
                    key={i}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <Td>{empName(p.avaliado_id)}</Td>
                    <Td>{empName(p.avaliador_id)}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: "var(--brand-soft)",
                          color: "var(--brand)",
                        }}
                      >
                        {TIPO_LABEL[p.tipo_avaliador]}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => removeParticipante(i)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: 4,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {participantes.length === 0 && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-3)",
              background: "var(--surface-2)",
              borderRadius: 8,
            }}
          >
            Nenhum participante adicionado. Você pode adicionar depois no detalhe do ciclo.
          </div>
        )}
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
          href="/pessoas/avaliacoes/ciclos"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={pending || !nome.trim()}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar ciclo
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "8px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "9px 12px", fontSize: 13, color: "var(--text)" }}>
      {children}
    </td>
  );
}
