"use client";

import { usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { useAuth } from "@kph/auth/context";
import { NotificationBell } from "@/components/shell/NotificationBell";

function firstName(email: string | null | undefined): string {
  if (!email) return "operador";
  const local = email.split("@")[0] ?? "";
  const first = local.split(".")[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "operador";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/operacao": "Operação",
  "/pessoas": "Pessoas",
  "/cardapio": "Cardápio",
  "/compras": "Compras",
  "/cliente": "Cliente & Experiência",
  "/inteligencia": "Inteligência",
  "/marca": "Marca & Cultura",
};

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = PATH_LABELS[pathname] ?? "KPH OS";
  const name = firstName(user?.email);

  return (
    <header className="shell-topbar" style={{
      height: 64, flexShrink: 0,
      display: "flex", alignItems: "center", gap: 16,
      padding: "0 20px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
    }}>
      <button
        className="shell-hamburger"
        onClick={() => window.dispatchEvent(new Event("kph:toggleSidebar"))}
        title="Abrir menu"
        style={{
          display: "none", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8,
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--text)", cursor: "pointer"
        }}
      >
        <Menu size={18} />
      </button>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="shell-topbar-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          {greeting()}, {name} · <span style={{ color: "var(--text-3)" }}>{title}</span>
        </div>
        <div className="shell-topbar-date" style={{ fontSize: 11, color: "var(--text-3)" }}>
          {fmtDate()}
        </div>
      </div>

      <button className="shell-topbar-search" title="Buscar (Cmd/Ctrl+K)" style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 8, color: "var(--text-3)", fontSize: 12, cursor: "pointer",
        transition: "border-color var(--t), color var(--t)",
      }}>
        <Search size={14} />
        <span>Buscar</span>
        <span style={{
          marginLeft: 8, padding: "1px 6px", background: "var(--surface-2)",
          border: "1px solid var(--border)", borderRadius: 4,
          fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-3)",
        }}>⌘K</span>
      </button>

      <NotificationBell />
    </header>
  );
}
