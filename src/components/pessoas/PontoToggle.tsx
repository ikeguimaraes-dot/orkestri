"use client";

// Toggle entre as duas views do módulo Ponto: aprovação de punches (diário)
// e resumo mensal. Usado no topo das duas páginas.

import Link from "next/link";

type View = "aprovacao" | "resumo" | "gestao";

export function PontoToggle({ active }: { active: View }) {
  function pill(view: View, label: string, href: string) {
    const isActive = view === active;
    return (
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 8,
          textDecoration: "none",
          background: isActive ? "var(--surface-2)" : "transparent",
          color: isActive ? "var(--text)" : "var(--text-3)",
          border: `1px solid ${isActive ? "var(--border-strong)" : "transparent"}`,
          transition: "all var(--t)",
        }}
      >
        {label}
      </Link>
    );
  }

  return (
    <div
      className="ponto-toggle"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflowX: "auto",
        maxWidth: "100%",
        scrollbarWidth: "none", // hide scrollbar Firefox
      }}
    >
      {pill("aprovacao", "Aprovação de punches", "/pessoas/ponto")}
      {pill("resumo", "Resumo mensal", "/pessoas/ponto/resumo")}
      {pill("gestao", "Gestão ao vivo", "/pessoas/ponto/gestao")}
    </div>
  );
}
