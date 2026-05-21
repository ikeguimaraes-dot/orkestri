"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteConversation } from "./actions";
import type { AgentConversation, AgentMessage } from "./actions";

type AgentTab = "all" | "theo" | "maya";

export default function AgentesClient({
  conversations,
}: {
  conversations: AgentConversation[];
}) {
  const [tab, setTab] = useState<AgentTab>("all");
  const [selected, setSelected] = useState<AgentConversation | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = conversations.filter((c) => {
    if (tab === "all") return true;
    if (tab === "theo") return c.agent_name.toLowerCase().includes("theo");
    return c.agent_name.toLowerCase().includes("maya");
  });

  function handleDelete() {
    if (!selected) return;
    startTransition(async () => {
      const r = await deleteConversation(selected.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Conversa encerrada");
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["all", "theo", "maya"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: tab === t ? "var(--brand)" : "transparent",
              color: tab === t ? "#fff" : "var(--text-2)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background var(--t), color var(--t)",
            }}
          >
            {t === "all" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Telefone", "Agente", "Última mensagem", "Data", "Msgs"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-3)",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--text-3)",
                    fontSize: 13,
                  }}
                >
                  Nenhuma conversa encontrada
                </td>
              </tr>
            ) : (
              filtered.map((conv) => {
                const msgs = conv.messages as AgentMessage[];
                const lastMsg = msgs[msgs.length - 1];
                const preview =
                  lastMsg?.content != null
                    ? lastMsg.content.slice(0, 70) +
                      (lastMsg.content.length > 70 ? "…" : "")
                    : "—";
                return (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    preview={preview}
                    msgCount={msgs.length}
                    onClick={() => setSelected(conv)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Conversation sheet */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <SheetContent
          style={{
            width: 480,
            maxWidth: "95vw",
            display: "flex",
            flexDirection: "column",
            padding: 0,
            gap: 0,
          }}
        >
          <SheetHeader
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <SheetTitle style={{ fontSize: 15, fontWeight: 700 }}>
              Conversa
            </SheetTitle>
            {selected && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--text-3)",
                  flexWrap: "wrap",
                }}
              >
                <span>📱 {selected.phone}</span>
                <span>
                  <AgentBadge name={selected.agent_name} />
                </span>
                <span>
                  💬 {(selected.messages as AgentMessage[]).length} mensagens
                </span>
              </div>
            )}
          </SheetHeader>

          {/* Messages scroll area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {selected &&
              (selected.messages as AgentMessage[]).map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
          </div>

          {/* Footer action */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleDelete}
              disabled={isPending}
              style={{
                width: "100%",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #ef4444",
                background: "transparent",
                color: "#ef4444",
                fontSize: 13,
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                transition: "background var(--t)",
              }}
            >
              {isPending ? "Encerrando…" : "Encerrar conversa"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ConversationRow({
  conv,
  preview,
  msgCount,
  onClick,
}: {
  conv: AgentConversation;
  preview: string;
  msgCount: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: "1px solid var(--border-subtle, var(--border))",
        cursor: "pointer",
        background: hovered ? "var(--surface-2)" : "transparent",
        transition: "background var(--t)",
      }}
    >
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--text)",
          whiteSpace: "nowrap",
        }}
      >
        {conv.phone}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <AgentBadge name={conv.agent_name} />
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--text-2)",
          maxWidth: 320,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {preview}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--text-3)",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(conv.updated_at)}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--text-2)",
          textAlign: "right",
        }}
      >
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <MessageCircle size={11} style={{ color: "var(--text-3)" }} />
          {msgCount}
        </span>
      </td>
    </tr>
  );
}

function AgentBadge({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const color = lower.includes("theo")
    ? "#3b82f6"
    : lower.includes("maya")
    ? "#8b5cf6"
    : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        background: `${color}18`,
        color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
    >
      {name}
    </span>
  );
}

function ChatBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "8px 12px",
          borderRadius: isUser
            ? "12px 12px 2px 12px"
            : "12px 12px 12px 2px",
          background: isUser ? "var(--brand)" : "var(--surface-2)",
          color: isUser ? "#fff" : "var(--text)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <p style={{ margin: 0, wordBreak: "break-word" }}>{message.content}</p>
        {message.timestamp && (
          <div
            style={{
              fontSize: 10,
              opacity: 0.65,
              marginTop: 4,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
