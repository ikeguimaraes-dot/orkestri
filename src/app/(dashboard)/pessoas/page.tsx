import Link from "next/link";
import {
  CalendarClock, Clock3, Receipt, ShieldAlert, UserCog, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/server";

type SubModule = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  status: "em-construcao" | "ativo";
};

const SUB_MODULES: ReadonlyArray<SubModule> = [
  {
    href: "/pessoas/colaboradores",
    label: "Colaboradores",
    desc: "Cadastro completo eSocial: CPF, RG, PIS, CTPS, endereço, dependentes.",
    icon: UserCog,
    status: "ativo",
  },
  {
    href: "/pessoas/escala",
    label: "Escala",
    desc: "Drag-and-drop denso, labor cost realtime ao mover turno.",
    icon: CalendarClock,
    status: "ativo",
  },
  {
    href: "/pessoas/holerites",
    label: "Holerites",
    desc: "Cálculo CLT + Sinthoresp + DSR sobre gorjeta. PDF on-demand.",
    icon: Receipt,
    status: "ativo",
  },
  {
    href: "/pessoas/disciplina",
    label: "Score & Disciplina",
    desc: "Advertências verbal/escrita/suspensão + faltas tipadas + score gamificado.",
    icon: ShieldAlert,
    status: "ativo",
  },
  {
    href: "/pessoas/ponto",
    label: "Ponto",
    desc: "PWA com câmera + geolocalização. Aprovação pelo gerente.",
    icon: Clock3,
    status: "em-construcao",
  },
];

export default async function PessoasPage() {
  const user = await requireUser();

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.6,
            textTransform: "uppercase", color: "var(--brand)",
          }}
        >
          Fase 1 · Em construção
        </div>
        <h1
          style={{
            fontSize: 30, fontWeight: 700, margin: "8px 0 6px",
            color: "var(--text)", letterSpacing: -0.5,
          }}
        >
          Pessoas
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 640 }}>
          Escala, ponto, holerite e cadastro de colaboradores. Todo o módulo é
          unit-scoped — você só vê dados da unidade selecionada na sidebar.
          Schema base já existe no Supabase: {" "}
          <code
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 11, color: "var(--brand)",
            }}
          >
            employees, shifts, time_clock_punches, time_bank_balance, payslips, cct_versions
          </code>.
        </p>
      </header>

      <div
        style={{
          display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {SUB_MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              style={{
                position: "relative",
                padding: "20px 18px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                textDecoration: "none",
                color: "var(--text)",
                transition: "border-color var(--t), background var(--t)",
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "var(--brand-soft)", color: "var(--brand)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                <ArrowUpRight
                  size={14}
                  style={{ marginLeft: "auto", color: "var(--text-3)" }}
                />
              </div>
              <p
                style={{
                  margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55,
                }}
              >
                {m.desc}
              </p>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: 0.8, textTransform: "uppercase",
                  color: m.status === "ativo" ? "#22C55E" : "var(--text-3)",
                }}
              >
                {m.status === "ativo" ? "Ativo" : "Em construção"}
              </div>
            </Link>
          );
        })}
      </div>

      <footer
        style={{
          marginTop: 36, padding: "18px 20px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, fontSize: 12, color: "var(--text-2)", lineHeight: 1.6,
        }}
      >
        <div
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
            color: "var(--text-3)", marginBottom: 6,
          }}
        >
          Acesso
        </div>
        Logado como{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{user.email}</span>{" "}
        com role{" "}
        <span style={{ color: "var(--brand)", fontWeight: 600 }}>
          {user.roles[0]?.role ?? "—"}
        </span>
        . RLS aplica unit-scope automaticamente em todas as queries.
      </footer>
    </div>
  );
}
