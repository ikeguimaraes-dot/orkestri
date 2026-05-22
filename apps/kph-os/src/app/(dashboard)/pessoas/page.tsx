import Link from "next/link";
import {
  CalendarClock, Clock3, Receipt, ShieldAlert, UserCog, ArrowUpRight,
  ClipboardList, Timer, UserMinus, FileText, Palmtree, PieChart,
  Coins, Bus, UploadCloud, Star, GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@kph/auth/server";

type SubModule = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  status: "em-construcao" | "ativo";
};

type Category = {
  title: string;
  items: SubModule[];
};

const CATEGORIES: ReadonlyArray<Category> = [
  {
    title: "Gestão de Jornada & Escala",
    items: [
      {
        href: "/pessoas/ponto",
        label: "Ponto",
        desc: "PWA com câmera + geolocalização. Aprovação pelo gerente.",
        icon: Clock3,
        status: "ativo",
      },
      {
        href: "/pessoas/relatorio-ponto",
        label: "Relatório de Ponto",
        desc: "Espelho de ponto, inconsistências e fechamento.",
        icon: ClipboardList,
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
        href: "/pessoas/horas-extras",
        label: "Horas Extras",
        desc: "Acompanhamento e aprovação de horas adicionais.",
        icon: Timer,
        status: "ativo",
      },
      {
        href: "/pessoas/faltas",
        label: "Faltas",
        desc: "Registro e justificativa de ausências e atrasos.",
        icon: UserMinus,
        status: "ativo",
      },
    ],
  },
  {
    title: "Gestão de Pessoal",
    items: [
      {
        href: "/pessoas/colaboradores",
        label: "Colaboradores",
        desc: "Cadastro completo eSocial: CPF, RG, PIS, CTPS, endereço.",
        icon: UserCog,
        status: "ativo",
      },
      {
        href: "/pessoas/documentos",
        label: "Documentos",
        desc: "Gestão de contratos, exames admissionais e atestados.",
        icon: FileText,
        status: "ativo",
      },
      {
        href: "/pessoas/ferias",
        label: "Férias",
        desc: "Controle de períodos aquisitivos e concessão.",
        icon: Palmtree,
        status: "ativo",
      },
      {
        href: "/pessoas/headcount",
        label: "Headcount",
        desc: "Visão geral do quadro de vagas e turnover.",
        icon: PieChart,
        status: "ativo",
      },
    ],
  },
  {
    title: "Financeiro & Remuneração",
    items: [
      {
        href: "/pessoas/holerites",
        label: "Holerites",
        desc: "Cálculo CLT + Sinthoresp + DSR sobre gorjeta. PDF on-demand.",
        icon: Receipt,
        status: "ativo",
      },
      {
        href: "/pessoas/gorjetas",
        label: "Gorjetas",
        desc: "Rateio de taxas de serviço e caixinha.",
        icon: Coins,
        status: "ativo",
      },
      {
        href: "/pessoas/vale-transporte",
        label: "Vale Transporte",
        desc: "Gestão de rotas e integração com operadoras.",
        icon: Bus,
        status: "ativo",
      },
      {
        href: "/pessoas/importacao",
        label: "Importação",
        desc: "Importação de dados de folha e sistemas legados.",
        icon: UploadCloud,
        status: "ativo",
      },
    ],
  },
  {
    title: "Desenvolvimento & Performance",
    items: [
      {
        href: "/pessoas/avaliacoes",
        label: "Avaliações",
        desc: "Avaliação de desempenho e feedback contínuo.",
        icon: Star,
        status: "ativo",
      },
      {
        href: "/pessoas/treinamentos",
        label: "Treinamentos",
        desc: "Capacitação, certificações e onboarding.",
        icon: GraduationCap,
        status: "ativo",
      },
      {
        href: "/pessoas/disciplina",
        label: "Score & Disciplina",
        desc: "Advertências verbal/escrita/suspensão + faltas tipadas.",
        icon: ShieldAlert,
        status: "ativo",
      },
    ],
  },
];

export default async function PessoasPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-10">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--brand)]">
          Visão Geral
        </div>
        <h1 className="mb-3 text-[32px] font-bold tracking-[-0.5px] text-[var(--text)]">
          Pessoas
        </h1>
        <p className="max-w-[720px] text-[14px] leading-[1.6] text-[var(--text-2)]">
          Gestão completa do ciclo de vida dos colaboradores. Todo o módulo é
          unit-scoped — você só vê dados da unidade selecionada na sidebar.
          Schema base já existe no Supabase para escalabilidade e segurança.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        {CATEGORIES.map((category) => (
          <section key={category.title}>
            <h2 className="mb-5 flex items-center gap-2 text-[18px] font-semibold text-[var(--text)]">
              <div className="h-4 w-1 rounded-[2px] bg-[var(--brand)]" />
              {category.title}
            </h2>
            
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {category.items.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="group relative flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] no-underline transition-all duration-200 hover:-translate-y-[2px] hover:border-[var(--brand-soft)] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                          <Icon size={18} />
                        </span>
                        <span className="text-[15px] font-semibold">{m.label}</span>
                      </div>
                      <ArrowUpRight
                        size={16}
                        className="text-[var(--text-3)] transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px] group-hover:text-[var(--brand)]"
                      />
                    </div>
                    <p className="m-0 flex-1 text-[13px] leading-[1.5] text-[var(--text-2)]">
                      {m.desc}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: m.status === "ativo" ? "#22C55E" : "var(--text-3)" }}
                      />
                      <span style={{ color: m.status === "ativo" ? "#22C55E" : "var(--text-3)" }}>
                        {m.status === "ativo" ? "Ativo" : "Em construção"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-16 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 text-[13px] leading-[1.6] text-[var(--text-2)]">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[var(--text-3)]">
          Acesso & Segurança
        </div>
        Logado como <span className="font-semibold text-[var(--text)]">{user.email}</span> com role <span className="font-semibold text-[var(--brand)]">{user.roles[0]?.role ?? "—"}</span>. RLS aplica unit-scope automaticamente em todas as queries no Supabase.
      </footer>
    </div>
  );
}
