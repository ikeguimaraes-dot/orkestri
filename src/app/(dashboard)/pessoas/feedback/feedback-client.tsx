"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Plus, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDateBR } from "@/lib/format";
import type { FeedbackWithNames, FeedbackTipo, FeedbackCategoria } from "./actions";

const TIPO_META: Record<FeedbackTipo, { label: string; bg: string; fg: string; dot: string }> = {
  positivo:      { label: "Positivo",      bg: "rgba(34,197,94,0.12)",  fg: "#15803D", dot: "#22C55E" },
  desenvolvimento: { label: "Desenvolvimento", bg: "rgba(245,158,11,0.12)", fg: "#A16207", dot: "#F59E0B" },
};

const CATEGORIA_LABEL: Record<FeedbackCategoria, string> = {
  atendimento:       "Atendimento",
  trabalho_em_equipe: "Trabalho em Equipe",
  lideranca:         "Liderança",
  pontualidade:      "Pontualidade",
  tecnico:           "Técnico",
  comportamento:     "Comportamento",
  outro:             "Outro",
};

type Tab = "recebidos" | "enviados";

export function FeedbackClient({
  feedbacksRecebidos,
  feedbacksEnviados,
  hasEmployee,
}: {
  feedbacksRecebidos: FeedbackWithNames[];
  feedbacksEnviados: FeedbackWithNames[];
  hasEmployee: boolean;
}) {
  const [tab, setTab] = useState<Tab>("recebidos");
  const [tipoFilter, setTipoFilter] = useState<FeedbackTipo | "all">("all");
  const [search, setSearch] = useState("");

  const items = tab === "recebidos" ? feedbacksRecebidos : feedbacksEnviados;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((f) => {
      if (tipoFilter !== "all" && f.tipo !== tipoFilter) return false;
      if (q) {
        const name = (tab === "recebidos" ? f.de_nome : f.para_nome) ?? "";
        if (
          !name.toLowerCase().includes(q) &&
          !f.mensagem.toLowerCase().includes(q) &&
          !CATEGORIA_LABEL[f.categoria].toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, tipoFilter, search, tab]);

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
        }}
      >
        {(["recebidos", "enviados"] as Tab[]).map((t) => {
          const count = t === "recebidos" ? feedbacksRecebidos.length : feedbacksEnviados.length;
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setSearch(""); setTipoFilter("all"); }}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text)" : "var(--text-3)",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -1,
                transition: "all var(--t)",
              }}
            >
              {t === "recebidos" ? "Recebidos" : "Enviados"}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 99,
                  background: active ? "var(--brand-soft)" : "var(--surface-2)",
                  color: active ? "var(--brand)" : "var(--text-3)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar por nome, mensagem…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select value={tipoFilter} onValueChange={(v) => v && setTipoFilter(v as FeedbackTipo | "all")}>
          <SelectTrigger style={{ minWidth: 160 }}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="positivo">Positivo</SelectItem>
            <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
          </SelectContent>
        </Select>
        {hasEmployee && (
          <Link
            href="/pessoas/feedback/novo"
            className={buttonVariants({ variant: "default" })}
            style={{ whiteSpace: "nowrap" }}
          >
            <Plus size={15} style={{ marginRight: 6 }} />
            Dar feedback
          </Link>
        )}
      </div>

      {/* Lista de cards */}
      {items.length === 0 ? (
        <EmptyState tab={tab} hasEmployee={hasEmployee} />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhum feedback com esses filtros.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((f) => (
            <FeedbackCard key={f.id} feedback={f} tab={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback: f, tab }: { feedback: FeedbackWithNames; tab: Tab }) {
  const meta = TIPO_META[f.tipo];
  const showName = tab === "recebidos"
    ? (f.anonimo ? "Anônimo" : (f.de_nome ?? "—"))
    : (f.para_nome ?? "—");
  const nameLabel = tab === "recebidos" ? "De" : "Para";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        gap: 14,
      }}
    >
      {/* Indicador de tipo */}
      <div
        style={{
          width: 4,
          borderRadius: 99,
          background: meta.dot,
          flexShrink: 0,
          alignSelf: "stretch",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Linha de meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 99,
              background: meta.bg,
              color: meta.fg,
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 99,
              background: "var(--surface-2)",
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            {CATEGORIA_LABEL[f.categoria]}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {formatDateBR(f.created_at)}
          </span>
        </div>

        {/* Mensagem */}
        <p
          style={{
            fontSize: 13,
            color: "var(--text)",
            margin: "0 0 8px",
            lineHeight: 1.6,
          }}
        >
          {f.mensagem}
        </p>

        {/* De / Para */}
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{nameLabel}: </span>
          {showName}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab, hasEmployee }: { tab: Tab; hasEmployee: boolean }) {
  return (
    <div
      style={{
        padding: "56px 20px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
        }}
      >
        <MessageCircle size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        {tab === "recebidos" ? "Nenhum feedback recebido" : "Nenhum feedback enviado"}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 14px" }}>
        {tab === "recebidos"
          ? "Você ainda não recebeu feedbacks de colegas."
          : "Você ainda não enviou feedbacks."}
      </p>
      {hasEmployee && (
        <Link
          href="/pessoas/feedback/novo"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus size={14} style={{ marginRight: 6 }} />
          Dar feedback a um colega
        </Link>
      )}
    </div>
  );
}
