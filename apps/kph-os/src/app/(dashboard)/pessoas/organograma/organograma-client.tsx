"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EmployeeNode } from "./actions";

// ── Tree building ──────────────────────────────────────────────

type TreeNode = EmployeeNode & { children: TreeNode[] };

function buildTree(employees: EmployeeNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const emp of employees) {
    map.set(emp.id, { ...emp, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const emp of employees) {
    const node = map.get(emp.id)!;
    if (emp.manager_id && map.has(emp.manager_id)) {
      map.get(emp.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sortChildren(n: TreeNode) {
    n.children.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    n.children.forEach(sortChildren);
  }
  roots.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  roots.forEach(sortChildren);
  return roots;
}

// ── Constants ─────────────────────────────────────────────────

const V_GAP = 28;    // px — vertical space between parent and children row
const H_PAD = 12;   // px — horizontal padding per child column
const LINE  = "var(--border)";

// ── Node avatar ───────────────────────────────────────────────

function Avatar({ node }: { node: TreeNode }) {
  const initials =
    (node.nome?.[0] ?? "") + (node.sobrenome?.[0] ?? "");

  if (node.photo_url) {
    return (
      <img
        src={node.photo_url}
        alt={`${node.nome} ${node.sobrenome}`}
        width={48}
        height={48}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          margin: "0 auto 8px",
          border: "2px solid var(--border)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "var(--brand-soft)",
        color: "var(--brand)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 15,
        margin: "0 auto 8px",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Node card ─────────────────────────────────────────────────

function NodeCard({
  node,
  hasChildren,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={hasChildren ? onToggle : undefined}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px 18px",
        textAlign: "center",
        width: 168,
        cursor: hasChildren ? "pointer" : "default",
        userSelect: "none",
        position: "relative",
        transition: "box-shadow var(--t), border-color var(--t)",
        flexShrink: 0,
      }}
    >
      <Avatar node={node} />
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text)",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {node.nome} {node.sobrenome}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
        {node.funcao}
      </div>

      {/* Expand/collapse badge */}
      {hasChildren && (
        <div
          style={{
            position: "absolute",
            bottom: -11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            lineHeight: 1,
            color: "var(--text-3)",
            fontWeight: 700,
            zIndex: 1,
          }}
        >
          {expanded ? "−" : node.children.length.toString()}
        </div>
      )}
    </div>
  );
}

// ── Recursive org node ────────────────────────────────────────

function OrgNode({ node }: { node: TreeNode }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const showChildren = hasChildren && expanded;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <NodeCard
        node={node}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />

      {showChildren && (
        <>
          {/* Vertical line from bottom of card to horizontal connector bar */}
          <div
            style={{
              width: 2,
              height: V_GAP,
              background: LINE,
              flexShrink: 0,
            }}
          />

          {/* Children row — each column owns its portion of the horizontal bar */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {node.children.map((child, i) => {
              const isFirst = i === 0;
              const isLast = i === node.children.length - 1;
              const single = node.children.length === 1;

              return (
                <div
                  key={child.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingLeft: H_PAD,
                    paddingRight: H_PAD,
                  }}
                >
                  {/*
                   * Connector box:
                   *   — horizontal bar at top: spans left/right depending on position
                   *   — vertical drop from top (horizontal bar) to bottom (child card)
                   */}
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: V_GAP,
                      flexShrink: 0,
                    }}
                  >
                    {/* Vertical drop */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "calc(50% - 1px)",
                        width: 2,
                        height: "100%",
                        background: LINE,
                      }}
                    />
                    {/* Horizontal left half — connects to previous sibling */}
                    {!single && !isFirst && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "calc(50% - 1px)",
                          height: 2,
                          background: LINE,
                        }}
                      />
                    )}
                    {/* Horizontal right half — connects to next sibling */}
                    {!single && !isLast && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: "calc(50% + 1px)",
                          width: "calc(50% - 1px)",
                          height: 2,
                          background: LINE,
                        }}
                      />
                    )}
                  </div>

                  {/* Recursive child */}
                  <OrgNode node={child} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Root client component ─────────────────────────────────────

export function OrganogramaClient({
  employees,
}: {
  employees: EmployeeNode[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (employees.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Nenhum colaborador ativo nesta unit.{" "}
        <Link
          href="/pessoas/organograma/configurar"
          style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
        >
          Configurar hierarquia
        </Link>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div style={{ color: "var(--text-3)", fontSize: 13, padding: "32px 0" }}>
        Carregando organograma…
      </div>
    );
  }

  const roots = buildTree(employees);
  const orphans = employees.filter(
    (e) => !e.manager_id || !employees.some((m) => m.id === e.manager_id),
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "32px 24px",
        overflowX: "auto",
        overflowY: "visible",
      }}
    >
      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 28,
          fontSize: 12,
          color: "var(--text-3)",
          flexWrap: "wrap",
        }}
      >
        <span>
          <strong style={{ color: "var(--text)" }}>{employees.length}</strong> colaboradores
        </span>
        <span>
          <strong style={{ color: "var(--text)" }}>
            {employees.filter((e) => e.manager_id && employees.some((m) => m.id === e.manager_id)).length}
          </strong>{" "}
          com gestor definido
        </span>
        <span>
          <strong style={{ color: "var(--text)" }}>{orphans.length}</strong> sem gestor
        </span>
        <Link
          href="/pessoas/organograma/configurar"
          style={{ color: "var(--brand)", textDecoration: "none", marginLeft: "auto" }}
        >
          Editar hierarquia →
        </Link>
      </div>

      {/* Tree */}
      <div
        style={{
          display: "flex",
          gap: 48,
          alignItems: "flex-start",
          justifyContent: roots.length === 1 ? "center" : "flex-start",
          minWidth: "max-content",
          paddingBottom: 8,
        }}
      >
        {roots.map((root) => (
          <OrgNode key={root.id} node={root} />
        ))}
      </div>

      {/* No-hierarchy hint */}
      {roots.length === employees.length && employees.length > 1 && (
        <div
          style={{
            marginTop: 24,
            padding: "10px 14px",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 8,
            fontSize: 12,
            color: "#92400E",
          }}
        >
          Nenhuma hierarquia configurada. Todos os colaboradores aparecem como raiz.{" "}
          <Link
            href="/pessoas/organograma/configurar"
            style={{ color: "#92400E", fontWeight: 600 }}
          >
            Configurar agora →
          </Link>
        </div>
      )}
    </div>
  );
}
