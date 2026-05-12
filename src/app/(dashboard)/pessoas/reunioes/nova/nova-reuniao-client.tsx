"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createReuniao, type EmployeeStub } from "../actions";

type ActionItemInput = { descricao: string; responsavel_id: string; prazo: string };

const DURACOES = [
  { value: 30,  label: "30 min" },
  { value: 45,  label: "45 min" },
  { value: 60,  label: "1 hora" },
  { value: 90,  label: "1h30" },
];

function nomeCompleto(e: EmployeeStub): string {
  return `${e.nome} ${e.sobrenome}`.trim();
}

export function NovaReuniaoClient({
  unitId,
  employees,
}: {
  unitId: string;
  employees: EmployeeStub[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gestorId, setGestorId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [duracaoMin, setDuracaoMin] = useState(30);
  const [notas, setNotas] = useState("");
  const [actionItems, setActionItems] = useState<ActionItemInput[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  function addActionItem() {
    setActionItems((prev) => [...prev, { descricao: "", responsavel_id: "", prazo: "" }]);
  }

  function removeActionItem(idx: number) {
    setActionItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateActionItem(idx: number, field: keyof ActionItemInput, value: string) {
    setActionItems((prev) =>
      prev.map((ai, i) => (i === idx ? { ...ai, [field]: value } : ai)),
    );
  }

  const canSubmit =
    !pending &&
    mounted &&
    gestorId.length > 0 &&
    colaboradorId.length > 0 &&
    gestorId !== colaboradorId &&
    dataReuniao.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createReuniao({
        unit_id: unitId,
        gestor_id: gestorId,
        colaborador_id: colaboradorId,
        data_reuniao: dataReuniao,
        duracao_min: duracaoMin,
        notas,
        action_items: actionItems,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/pessoas/reunioes/${r.data.id}`);
      router.refresh();
    });
  }

  const colaboradorOptions = employees.filter((e) => e.id !== gestorId);
  const gestorOptions = employees.filter((e) => e.id !== colaboradorId);

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/pessoas/reunioes"
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
        Reuniões 1:1
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
            Agendar Reunião 1:1
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>
            Preencha os dados da reunião e adicione action items se necessário.
          </p>
        </div>

        {/* Participantes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Gestor" required>
            <select
              value={gestorId}
              onChange={(e) => {
                setGestorId(e.target.value);
                if (colaboradorId === e.target.value) setColaboradorId("");
              }}
              style={inputStyle}
            >
              <option value="">Selecionar…</option>
              {gestorOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {nomeCompleto(emp)} — {emp.funcao}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Colaborador" required>
            <select
              value={colaboradorId}
              onChange={(e) => {
                setColaboradorId(e.target.value);
                if (gestorId === e.target.value) setGestorId("");
              }}
              style={inputStyle}
            >
              <option value="">Selecionar…</option>
              {colaboradorOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {nomeCompleto(emp)} — {emp.funcao}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Data e duração */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 14,
          }}
        >
          <Field label="Data e hora" required>
            <input
              type="datetime-local"
              value={dataReuniao}
              onChange={(e) => setDataReuniao(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Duração">
            <select
              value={duracaoMin}
              onChange={(e) => setDuracaoMin(Number(e.target.value))}
              style={inputStyle}
            >
              {DURACOES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Notas / Pauta */}
        <Field label="Pauta / Notas iniciais">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Tópicos que serão discutidos na reunião…"
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </Field>

        {/* Action Items */}
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
              Action Items
            </span>
            <button
              type="button"
              onClick={addActionItem}
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

          {actionItems.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              Nenhum action item. Você pode adicioná-los agora ou após a reunião.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actionItems.map((ai, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 14px",
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
                      value={ai.descricao}
                      onChange={(e) => updateActionItem(idx, "descricao", e.target.value)}
                      placeholder="Descrição da ação"
                      style={inputStyle}
                    />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                      }}
                    >
                      <select
                        value={ai.responsavel_id}
                        onChange={(e) => updateActionItem(idx, "responsavel_id", e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Responsável (opcional)</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {nomeCompleto(emp)}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <label
                          style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}
                        >
                          Prazo:
                        </label>
                        <input
                          type="date"
                          value={ai.prazo}
                          onChange={(e) => updateActionItem(idx, "prazo", e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeActionItem(idx)}
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
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
        <Link
          href="/pessoas/reunioes"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Agendar Reunião
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
