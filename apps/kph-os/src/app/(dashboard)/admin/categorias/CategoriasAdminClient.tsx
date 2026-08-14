"use client";

import { useMemo, useState, useTransition } from "react";
import { setUserCategories } from "./_actions";

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  isFounder: boolean;
};

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

type Props = {
  users: AdminUser[];
  categories: Category[];
  /** Map userId → array de categoryId já marcados */
  initialLinks: Record<string, string[]>;
};

export function CategoriasAdminClient({
  users,
  categories,
  initialLinks,
}: Props) {
  // Estado: selections por usuário (Set serializa em array).
  // Inicializa com initialLinks; ao salvar, atualiza estado e mostra toast.
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const u of users) {
      m[u.id] = new Set(initialLinks[u.id] ?? []);
    }
    return m;
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "ok" | "err"; msg: string; userId: string }
    | null
  >(null);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  function toggleCategory(userId: string, categoryId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[userId] ?? []);
      if (set.has(categoryId)) set.delete(categoryId);
      else set.add(categoryId);
      next[userId] = set;
      return next;
    });
    setFeedback(null);
  }

  function selectAll(userId: string) {
    setSelections((prev) => ({
      ...prev,
      [userId]: new Set(categories.map((c) => c.id)),
    }));
  }

  function selectNone(userId: string) {
    setSelections((prev) => ({ ...prev, [userId]: new Set() }));
  }

  function save(userId: string) {
    const ids = Array.from(selections[userId] ?? []);
    startTransition(async () => {
      const res = await setUserCategories(userId, ids);
      if (res.ok) {
        setFeedback({
          kind: "ok",
          msg: `Salvo (${ids.length} categoria${ids.length === 1 ? "" : "s"}).`,
          userId,
        });
      } else {
        setFeedback({ kind: "err", msg: res.error, userId });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 8,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {filteredUsers.length} de {users.length} usuário{users.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Lista */}
      {filteredUsers.map((u) => {
        const sel = selections[u.id] ?? new Set();
        const isExpanded = expandedUserId === u.id;
        const fb = feedback?.userId === u.id ? feedback : null;

        return (
          <div
            key={u.id}
            style={{
              padding: 16,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Header do usuário */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 99,
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {(u.displayName ?? u.email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {u.displayName ?? u.email ?? "Sem nome"}
                </div>
                {u.email && u.displayName && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.email}
                  </div>
                )}
              </div>
              {u.isFounder && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--brand)",
                    color: "#fff",
                  }}
                >
                  Founder
                </span>
              )}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {sel.size}/{categories.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setExpandedUserId(isExpanded ? null : u.id)
                }
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isExpanded ? "Fechar" : "Editar"}
              </button>
            </div>

            {/* Painel expandido */}
            {isExpanded && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Bulk actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => selectAll(u.id)}
                    disabled={u.isFounder}
                    style={bulkBtnStyle}
                  >
                    Marcar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => selectNone(u.id)}
                    disabled={u.isFounder}
                    style={bulkBtnStyle}
                  >
                    Limpar
                  </button>
                  {u.isFounder && (
                    <span style={{ fontSize: 11, color: "var(--text-3)", alignSelf: "center" }}>
                      Founders sempre vêem tudo (filtro bypassado).
                    </span>
                  )}
                </div>

                {/* Grid de checkboxes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 8,
                  }}
                >
                  {categories.map((c) => {
                    const checked = sel.has(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${checked ? "var(--brand)" : "var(--border)"}`,
                          background: checked ? "var(--brand-soft)" : "var(--bg)",
                          cursor: "pointer",
                          transition: "all 160ms ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(u.id, c.id)}
                          disabled={u.isFounder}
                          style={{
                            marginTop: 2,
                            accentColor: "var(--brand)",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text)",
                            }}
                          >
                            {c.name}
                          </div>
                          {c.description && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-3)",
                                marginTop: 2,
                                lineHeight: 1.4,
                              }}
                            >
                              {c.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Footer com botão Salvar + feedback */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => save(u.id)}
                    disabled={pending || u.isFounder}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--brand)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: pending ? "wait" : "pointer",
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    {pending ? "Salvando…" : "Salvar"}
                  </button>
                  {fb && (
                    <span
                      style={{
                        fontSize: 12,
                        color: fb.kind === "ok" ? "#22C55E" : "var(--color-danger, #FCA5A5)",
                      }}
                    >
                      {fb.kind === "ok" ? "✓ " : "✕ "}
                      {fb.msg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const bulkBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 12,
  cursor: "pointer",
};
