"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  // shell
  ChevronDown, ChevronRight, Check, LogOut,
  // dashboard
  LayoutDashboard,
  // operacao
  TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  // compras
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  // financeiro
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  // financeiro DRE submenu
  Zap, Settings, Wrench, Landmark, BadgeDollarSign,
  // pessoas
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks, CalendarClock, Network, UserPlus, BarChart2,
  // comercial
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  // marca
  Bookmark, Info, Globe, Award,
  // inteligencia
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, useUnit } from "@kph/auth/context";

// ── Icon map: nome string → componente Lucide ─────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  Zap, Settings, Wrench, Landmark, BadgeDollarSign,
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks,
  CalendarClock, Network, UserPlus, BarChart2,
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  Bookmark, Info, Globe, Award,
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
};

function resolveIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}

// ── Tipos internos (ícones resolvidos) ───────────────────────
type NavItem = { href?: string; label: string; icon: LucideIcon; children?: NavItem[] };
type NavGroup = {
  id: string;
  title: string | null;
  icon: LucideIcon | null;
  items: NavItem[];
  defaultOpen: boolean;
};

// ── Tipos da API ─────────────────────────────────────────────
type ApiNavItem = { href?: string; label: string; icon: string; children?: ApiNavItem[] };
type ApiNavGroup = {
  id: string;
  label: string | null;
  icon: string | null;
  defaultOpen: boolean;
  items: ApiNavItem[];
};

function resolveNavItem(it: ApiNavItem): NavItem {
  return {
    href: it.href,
    label: it.label,
    icon: resolveIcon(it.icon) ?? LayoutDashboard,
    children: it.children ? it.children.map(resolveNavItem) : undefined,
  };
}

function resolveGroups(raw: ApiNavGroup[]): NavGroup[] {
  return raw.map((g) => ({
    id: g.id,
    title: g.label,
    icon: resolveIcon(g.icon),
    defaultOpen: g.defaultOpen,
    items: g.items.map(resolveNavItem),
  }));
}

// ── Fallback mínimo usado se o fetch falhar ───────────────────
const FALLBACK_GROUPS: NavGroup[] = [
  {
    id: "home",
    title: null,
    icon: null,
    defaultOpen: true,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
];

const STORAGE_KEY = "kph_sidebar_groups";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unit, units, setUnit } = useUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navGroups, setNavGroups] = useState<NavGroup[] | null>(null);

  useEffect(() => {
    fetch("/api/nav")
      .then((r) => r.json())
      .then((d: { groups: ApiNavGroup[] }) => setNavGroups(resolveGroups(d.groups)))
      .catch(() => setNavGroups(FALLBACK_GROUPS));
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    window.addEventListener("kph:toggleSidebar", onToggle);
    return () => window.removeEventListener("kph:toggleSidebar", onToggle);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ?? "?";
  const emailShort = user?.email
    ? user.email.length > 22
      ? user.email.slice(0, 19) + "…"
      : user.email
    : "—";
  const role = user?.roles[0]?.role ?? "—";

  return (
    <>
      <div
        className={`shell-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`shell-sidebar ${mobileOpen ? "open" : ""}`}
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

        {navGroups === null ? (
          <NavSkeleton />
        ) : (
          <SidebarNav pathname={pathname} groups={navGroups} />
        )}

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
    </>
  );
}

// ── Skeleton de carregamento ──────────────────────────────────
function NavSkeleton() {
  return (
    <nav style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      {[80, 60, 70, 65, 75].map((w, i) => (
        <div
          key={i}
          style={{
            height: 32, borderRadius: 8,
            background: "var(--surface-2)",
            width: `${w}%`,
            opacity: 0.5,
          }}
        />
      ))}
    </nav>
  );
}

// ── Sub: nav com grupos colapsáveis ──────────────────────────
function SidebarNav({ pathname, groups }: { pathname: string; groups: NavGroup[] }) {
  const allItems = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.flatMap((it) => {
          const base = it.href ? [{ href: it.href, groupId: g.id }] : [];
          const childItems = (it.children ?? []).flatMap((c) =>
            c.href ? [{ href: c.href, groupId: g.id }] : [],
          );
          return [...base, ...childItems];
        }),
      ),
    [groups],
  );

  const activeHref = useMemo(() => {
    let bestHref: string | null = null;
    let bestLen = -1;
    for (const it of allItems) {
      const matches = pathname === it.href || pathname.startsWith(it.href + "/");
      if (matches && it.href.length > bestLen) {
        bestHref = it.href;
        bestLen = it.href.length;
      }
    }
    return bestHref;
  }, [pathname, allItems]);

  const activeGroupId = useMemo(() => {
    if (!activeHref) return null;
    return allItems.find((it) => it.href === activeHref)?.groupId ?? null;
  }, [activeHref, allItems]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of groups) m[g.id] = g.defaultOpen;
    return m;
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setOpenMap((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignora corrupção
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenMap((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  // Auto-abre o item pai quando um filho está ativo
  useEffect(() => {
    if (!activeHref) return;
    for (const g of groups) {
      for (const it of g.items) {
        if (it.children?.some((c) => c.href === activeHref)) {
          setOpenItems((prev) => (prev[it.label] ? prev : { ...prev, [it.label]: true }));
        }
      }
    }
  }, [activeHref, groups]);

  function toggleGroup(id: string) {
    setOpenMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignora QuotaExceeded
        }
      }
      return next;
    });
  }

  function toggleItem(label: string) {
    setOpenItems((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <nav
      style={{
        flex: 1,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflowY: "auto",
      }}
    >
      {groups.map((g) => {
        const isOpen = openMap[g.id] ?? g.defaultOpen;
        return (
          <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {g.title && (
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                aria-expanded={isOpen}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "10px 8px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {g.icon && (
                  <g.icon size={11} style={{ color: "var(--text-3)" }} />
                )}
                <span style={{ flex: 1 }}>{g.title}</span>
                <ChevronRight
                  size={12}
                  style={{
                    color: "var(--text-3)",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: hydrated ? "transform var(--t)" : "none",
                  }}
                />
              </button>
            )}
            {isOpen &&
              g.items.map((it) => {
                const Icon = it.icon;

                if (it.children) {
                  const itemOpen = openItems[it.label] ?? false;
                  const childActive = it.children.some((c) => c.href === activeHref);
                  return (
                    <div key={it.label}>
                      <button
                        type="button"
                        onClick={() => toggleItem(it.label)}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "9px 12px",
                          borderRadius: 8,
                          width: "100%",
                          background: childActive && !itemOpen ? "var(--surface-2)" : "transparent",
                          border: "none",
                          color: childActive ? "var(--text)" : "var(--text-2)",
                          fontSize: 13,
                          fontWeight: childActive ? 600 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all var(--t)",
                        }}
                      >
                        {childActive && !itemOpen && (
                          <span
                            style={{
                              position: "absolute",
                              left: -12,
                              top: 6,
                              bottom: 6,
                              width: 3,
                              background: "var(--brand)",
                              borderRadius: "0 4px 4px 0",
                            }}
                          />
                        )}
                        <Icon
                          size={16}
                          strokeWidth={childActive ? 2.2 : 1.8}
                          style={{ color: childActive ? "var(--brand)" : "currentColor" }}
                        />
                        <span style={{ flex: 1 }}>{it.label}</span>
                        <ChevronRight
                          size={12}
                          style={{
                            color: "var(--text-3)",
                            transform: itemOpen ? "rotate(90deg)" : "none",
                            transition: hydrated ? "transform var(--t)" : "none",
                          }}
                        />
                      </button>
                      {itemOpen &&
                        it.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childIsActive = child.href === activeHref;
                          return (
                            <Link
                              key={child.href}
                              href={child.href!}
                              style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "7px 12px 7px 28px",
                                borderRadius: 8,
                                textDecoration: "none",
                                color: childIsActive ? "var(--text)" : "var(--text-2)",
                                background: childIsActive ? "var(--surface-2)" : "transparent",
                                fontSize: 12,
                                fontWeight: childIsActive ? 600 : 400,
                                transition: "all var(--t)",
                              }}
                            >
                              {childIsActive && (
                                <span
                                  style={{
                                    position: "absolute",
                                    left: -12,
                                    top: 4,
                                    bottom: 4,
                                    width: 3,
                                    background: "var(--brand)",
                                    borderRadius: "0 4px 4px 0",
                                  }}
                                />
                              )}
                              <ChildIcon
                                size={14}
                                strokeWidth={childIsActive ? 2.2 : 1.8}
                                style={{ color: childIsActive ? "var(--brand)" : "currentColor" }}
                              />
                              <span style={{ flex: 1 }}>{child.label}</span>
                            </Link>
                          );
                        })}
                    </div>
                  );
                }

                const active = it.href === activeHref;
                return (
                  <Link
                    key={it.href}
                    href={it.href!}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: active ? "var(--text)" : "var(--text-2)",
                      background: active ? "var(--surface-2)" : "transparent",
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      transition: "all var(--t)",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: -12,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          background: "var(--brand)",
                          borderRadius: "0 4px 4px 0",
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
              })}
          </div>
        );
      })}
    </nav>
  );
}
