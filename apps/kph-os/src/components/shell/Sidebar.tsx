"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ZoneLink } from "./ZoneLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_CONFIG, filterNavByCategories, type NavGroupConfig, type NavItemConfig } from "@/lib/nav-config";
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
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks, CalendarClock, Network, UserPlus, BarChart2, Calculator,
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
  CalendarClock, Network, UserPlus, BarChart2, Calculator,
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  Bookmark, Info, Globe, Award,
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
};

function resolveIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}

// ── Tipos internos (ícones resolvidos) ───────────────────────
type NavItem = { href?: string; label: string; icon: LucideIcon; defaultOpen?: boolean; children?: NavItem[] };
type NavGroup = {
  id: string;
  title: string | null;
  icon: LucideIcon | null;
  items: NavItem[];
  defaultOpen: boolean;
};

function resolveNavItem(it: NavItemConfig): NavItem {
  return {
    href: it.href,
    label: it.label,
    icon: resolveIcon(it.icon) ?? LayoutDashboard,
    defaultOpen: it.defaultOpen,
    children: it.children ? it.children.map(resolveNavItem) : undefined,
  };
}

function resolveGroups(raw: NavGroupConfig[]): NavGroup[] {
  return raw.map((g) => ({
    id: g.id,
    title: g.label,
    icon: resolveIcon(g.icon),
    defaultOpen: g.defaultOpen,
    items: g.items.map(resolveNavItem),
  }));
}

const NAV_GROUPS_RAW: NavGroup[] = resolveGroups(NAV_CONFIG);

const STORAGE_KEY = "kph_sidebar_groups";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unit, units, setUnit } = useUnit();

  // Filtra grupos do NAV_CONFIG pelas categorias do usuário.
  // - Founder: vê todos os grupos (bypass total).
  // - Não-founder: só vê grupos cuja categoria o user possui em user_categories.
  // - Sem categoria (default recém-criado): vê só o Dashboard (home).
  // Nota: isFounder() em @kph/auth/server é server-only (importa "server-only"),
  // então calculamos direto a partir de user.roles aqui no client.
  const founder = !!user?.roles.some((r) => r.role === "founder");
  const userCategories = user?.categories ?? [];
  const NAV_GROUPS = useMemo<NavGroup[]>(
    () => resolveGroups(filterNavByCategories(NAV_CONFIG, userCategories, founder)),
    [userCategories, founder],
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Confirmação de logout — modal simples evita clicar o botão Sair
  // sem querer ao navegar em sidebar estreita (1920×1080).
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    const syncSessionCookie = () => {
      const cookies = document.cookie.split(";").map((item) => item.trim());
      const auth = cookies.find((item) =>
        item.startsWith("sb-") && item.slice(0, item.indexOf("=")).includes("auth-token"),
      );
      if (auth) {
        window.localStorage.setItem("kph_auth_browser_backup", auth);
        return;
      }
      const backup = window.localStorage.getItem("kph_auth_browser_backup");
      if (backup?.startsWith("sb-") && backup.includes("auth-token=")) {
        document.cookie = `${backup}; Path=/; Max-Age=2592000; SameSite=Lax`;
      }
    };
    syncSessionCookie();
    const timer = window.setInterval(syncSessionCookie, 250);
    return () => window.clearInterval(timer);
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

  // Nome de exibição: prioriza display_name (user_metadata.display_name,
  // configurado em Auth → Users no painel Supabase). Fallback: e-mail.
  const displayName = user?.displayName?.trim() || null;
  const showName = displayName ?? user?.email ?? null;

  // Iniciais a partir do nome (ex: "Karine Azevedo" → "KA"). Fallback:
  // 2 primeiros caracteres do e-mail (status quo).
  const initials = showName
    ? (displayName
        ? displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]!.toUpperCase())
            .join("")
        : user!.email!.slice(0, 2).toUpperCase())
    : "?";

  // Linha única exibida no footer do sidebar. Trunca com ellipsis.
  const label = showName
    ? showName.length > 22
      ? showName.slice(0, 19) + "…"
      : showName
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
              fontSize: "0.625rem",
              color: "var(--text-3)",
              marginTop: 2,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Operações
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

        <SidebarNav
          pathname={pathname}
          groups={NAV_GROUPS}
          userRoles={user?.roles.map((r) => r.role) ?? []}
          isFounder={founder}
        />

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
              {label}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>
              {role}
            </div>
          </div>
          <button
            type="button"
            title="Sair"
            onClick={() => setSignOutConfirm(true)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6,
              color: "var(--text-3)", border: "none", cursor: "pointer",
              background: "transparent",
              transition: "color var(--t, 180ms ease), background var(--t, 180ms ease)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-danger, #FCA5A5)";
              e.currentTarget.style.background = "rgba(252,165,165,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-3)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Confirm de logout (evita clique acidental) ── */}
      {signOutConfirm && (
        <SignOutConfirm onCancel={() => setSignOutConfirm(false)} />
      )}
    </>
  );
}

/**
 * Modal de confirmação de logout.
 * Evita o problema clássico em sidebar estreita: clicar no item de menu
 * acerta o botão Sair por engano (em 1920×1080 o gap é mínimo).
 *
 * Renderizado fora da <aside> via portal pra não herdar overflow:hidden.
 */
function SignOutConfirm({ onCancel }: { onCancel: () => void }) {
  // ESC cancela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface, #1A1A18)",
          border: "1px solid var(--border-strong, rgba(245,240,232,0.16))",
          borderRadius: 12,
          padding: 24,
          maxWidth: 360, width: "100%",
          display: "flex", flexDirection: "column", gap: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div>
          <h3
            id="signout-title"
            className="font-heading"
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 18, fontWeight: 600, color: "var(--text, #F5F0E8)",
              margin: 0, marginBottom: 6,
            }}
          >
            Sair da conta?
          </h3>
          <p
            style={{
              fontSize: 13, color: "var(--text-3, #A09890)",
              margin: 0, lineHeight: 1.5,
            }}
          >
            Você precisará fazer login novamente para acessar o sistema.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--border-strong, rgba(245,240,232,0.16))",
              color: "var(--text, #F5F0E8)", cursor: "pointer",
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-2, #222220)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Cancelar
          </button>
          <Link
            href="/auth/sign-out"
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "var(--color-danger, #DC2626)",
              border: "none", textDecoration: "none",
              color: "#FFFFFF", cursor: "pointer",
              display: "inline-flex", alignItems: "center",
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#B91C1C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-danger, #DC2626)";
            }}
          >
            Sair
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub: nav com grupos colapsáveis ──────────────────────────
function SidebarNav({
  pathname,
  groups,
  userRoles,
  isFounder,
}: {
  pathname: string;
  groups: NavGroup[];
  userRoles: ReadonlyArray<string>;
  isFounder: boolean;
}) {
  /**
   * Filtro fino por item (campo `roles` no NAV_CONFIG).
   *
   * Aplicado AQUI pra founder continuar vendo tudo (inclusive itens
   * marcados com roles específicas). Itens sem `roles` passam pra qualquer
   * usuário. Categorias (módulo de produto) já foram aplicadas no pai.
   */
  const itemVisible = (it: NavItem): boolean => {
    const allowedRoles = (it as unknown as { roles?: string[] }).roles;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (isFounder) return true;
    return allowedRoles.some((r) => userRoles.includes(r));
  };

  const visibleGroups = useMemo<NavGroup[]>(
    () =>
      groups.map((g) => ({
        ...g,
        items: g.items.filter(itemVisible),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, userRoles, isFounder],
  );

  const allItems = useMemo(
    () =>
      visibleGroups.flatMap((g) =>
        g.items.flatMap((it) => {
          const base = it.href ? [{ href: it.href, groupId: g.id }] : [];
          const childItems = (it.children ?? []).flatMap((c) =>
            c.href ? [{ href: c.href, groupId: g.id }] : [],
          );
          return [...base, ...childItems];
        }),
      ),
    [visibleGroups],
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
    for (const g of visibleGroups) m[g.id] = g.defaultOpen;
    return m;
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of visibleGroups) {
      for (const it of g.items) {
        if (it.children && it.defaultOpen) m[it.label] = true;
      }
    }
    return m;
  });
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
    for (const g of visibleGroups) {
      for (const it of g.items) {
        if (it.children?.some((c) => c.href === activeHref)) {
          setOpenItems((prev) => (prev[it.label] ? prev : { ...prev, [it.label]: true }));
        }
      }
    }
  }, [activeHref, visibleGroups]);

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
      {visibleGroups.map((g) => {
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
                  const highlighted = childActive;
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
                          background: highlighted ? "var(--surface-2)" : "transparent",
                          border: "none",
                          color: highlighted ? "var(--text)" : "var(--text-2)",
                          fontSize: 13,
                          fontWeight: highlighted ? 600 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all var(--t)",
                        }}
                      >
                        {highlighted && (
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
                          strokeWidth={highlighted ? 2.2 : 1.8}
                          style={{ color: highlighted ? "var(--brand)" : "currentColor" }}
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
                          if (!child.href) return null;
                          const ChildIcon = child.icon;
                          const childIsActive = child.href === activeHref;
                          const ChildNavEl = ZoneLink;
                          return (
                            <ChildNavEl
                              key={child.href}
                              href={child.href}
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
                            </ChildNavEl>
                          );
                        })}
                    </div>
                  );
                }

                const active = it.href === activeHref;
                const NavEl = ZoneLink;
                return (
                  <NavEl
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
                  </NavEl>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
