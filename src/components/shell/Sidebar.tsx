"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Wallet, Users, BookOpen, ShoppingCart,
  MessageSquare, Brain, Megaphone, CalendarDays,
  Plane, Briefcase, Building2,
  ChevronDown, Check, LogOut,
} from "lucide-react";
import { useAuth, useUnit } from "@/lib/auth/context";

// Marcas usa Building2 agora (Megaphone foi pra Campanhas — comunicação interna).
const NAV = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/financeiro",    label: "Financeiro",    icon: Wallet },
  { href: "/pessoas",       label: "Pessoas",       icon: Users },
  { href: "/pessoas/ferias", label: "Férias",       icon: Plane },
  { href: "/cardapio",      label: "Cardápio",      icon: BookOpen },
  { href: "/compras",       label: "Compras",       icon: ShoppingCart },
  { href: "/cliente",       label: "Cliente",       icon: MessageSquare },
  { href: "/inteligencia",  label: "Inteligência",  icon: Brain },
  { href: "/marcas",        label: "Marcas",        icon: Building2 },
  { href: "/eventos",       label: "Eventos",       icon: CalendarDays },
  { href: "/campanhas",     label: "Campanhas",     icon: Megaphone },
  { href: "/recrutamento/vagas", label: "Recrutamento", icon: Briefcase },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unit, units, setUnit } = useUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ?? "?";
  const emailShort = user?.email
    ? user.email.length > 22
      ? user.email.slice(0, 19) + "…"
      : user.email
    : "—";
  const role = user?.roles[0]?.role ?? "—";

  return (
    <aside
      style={{
        width: 240, flexShrink: 0,
        background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.5 }}>
          KPH <span style={{ color: "var(--brand)" }}>OS</span>
        </div>
        <div
          style={{
            fontSize: 10, color: "var(--text-3)", marginTop: 2,
            letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600,
          }}
        >
          Operations
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={units.length === 0}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10,
              padding: "9px 12px", color: "var(--text)", fontSize: 13, fontWeight: 600,
              cursor: units.length ? "pointer" : "default",
              transition: "border-color var(--t)",
            }}
          >
            <span
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 0,
              }}
            >
              <span style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, letterSpacing: 0.8 }}>
                UNIDADE
              </span>
              <span
                style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                }}
              >
                {unit?.name ?? (units.length ? "Selecionar…" : "Sem acesso")}
              </span>
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--text-3)",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform var(--t)",
              }}
            />
          </button>
          {open && units.length > 0 && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                background: "var(--surface-2)", border: "1px solid var(--border-strong)",
                borderRadius: 10, padding: 4, boxShadow: "var(--shadow-lg)",
              }}
            >
              {units.map((u) => {
                const active = u.id === unit?.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUnit(u.id);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, padding: "9px 10px",
                      background: active ? "var(--surface-3)" : "transparent",
                      border: "none", borderRadius: 6, color: "var(--text)",
                      fontSize: 13, fontWeight: 500, cursor: "pointer",
                      textAlign: "left", transition: "background var(--t)",
                    }}
                  >
                    <span>{u.name}</span>
                    {active && <Check size={14} style={{ color: "var(--brand)" }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav
        style={{
          flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column",
          gap: 1, overflowY: "auto",
        }}
      >
        {(() => {
          // Pinta APENAS o item de match mais específico (ex: em /pessoas/ferias
          // só "Férias" fica ativo, não "Pessoas").
          let bestIdx = -1;
          let bestLen = -1;
          NAV.forEach((it, i) => {
            const matches =
              it.href === "/"
                ? pathname === "/"
                : pathname === it.href || pathname.startsWith(it.href + "/");
            if (matches && it.href.length > bestLen) {
              bestIdx = i;
              bestLen = it.href.length;
            }
          });
          return NAV.map((it, i) => {
            const Icon = it.icon;
            const active = i === bestIdx;
            return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 12px", borderRadius: 8,
                textDecoration: "none",
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--surface-2)" : "transparent",
                fontSize: 13, fontWeight: active ? 600 : 500,
                transition: "all var(--t)",
              }}
            >
              {active && (
                <span
                  style={{
                    position: "absolute", left: -12, top: 6, bottom: 6, width: 3,
                    background: "var(--brand)", borderRadius: "0 4px 4px 0",
                  }}
                />
              )}
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.8}
                style={{ color: active ? "var(--brand)" : "currentColor" }}
              />
              <span style={{ flex: 1 }}>{it.label}</span>
            </Link>
          );
          });
        })()}
      </nav>

      <div
        style={{
          padding: "12px 14px", borderTop: "1px solid var(--sidebar-border)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 99, background: "var(--brand-soft)",
              color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 12,
            }}
          >
            {initials}
          </div>
          <span
            style={{
              position: "absolute", right: -1, bottom: -1,
              width: 10, height: 10, borderRadius: 99,
              background: "#22C55E", border: "2px solid var(--sidebar)",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12, fontWeight: 600, color: "var(--text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {emailShort}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
            {role}
          </div>
        </div>
        <Link
          href="/auth/sign-out"
          title="Sair"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 6,
            color: "var(--text-3)", textDecoration: "none",
            transition: "color var(--t), background var(--t)",
          }}
        >
          <LogOut size={14} />
        </Link>
      </div>
    </aside>
  );
}
