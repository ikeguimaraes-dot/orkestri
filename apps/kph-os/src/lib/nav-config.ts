export type NavItemConfig = {
  href?: string;
  label: string;
  icon: string;
  defaultOpen?: boolean;
  children?: NavItemConfig[];
};

export type NavGroupConfig = {
  id: string;
  label: string | null;
  icon: string | null;
  defaultOpen: boolean;
  items: NavItemConfig[];
};

export const NAV_CONFIG: NavGroupConfig[] = [
  {
    id: "home",
    label: null,
    icon: null,
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: "TrendingUp",
    defaultOpen: false,
    items: [
      { label: "Mapa da Casa",  href: "/operacao/mapa",        icon: "MapPin" },
      { label: "Performance",   href: "/operacao/performance",  icon: "Activity" },
      { label: "Vendedores",    href: "/operacao/vendedores",   icon: "UserCheck" },
      { label: "Auditorias",    href: "/operacao/auditorias",   icon: "ClipboardList" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: "ShoppingCart",
    defaultOpen: false,
    items: [
      { label: "Cardápio",          href: "/cardapio",             icon: "BookOpen" },
      { label: "Ingredientes",      href: "/compras/ingredientes", icon: "Carrot" },
      { label: "Pedidos",           href: "/compras",              icon: "ShoppingCart" },
      { label: "Estoque",           href: "/compras/estoque",      icon: "Package" },
      { label: "Logística",         href: "/compras/logistica",    icon: "Truck" },
      { label: "Fornecedores",      href: "/compras/fornecedores", icon: "Building2" },
      { label: "Cotações",          href: "/compras/cotacoes",     icon: "FileText" },
      { label: "Recebimento",       href: "/compras/recebimento",  icon: "PackageCheck" },
      { label: "Análise CMV",       href: "/compras/analise",      icon: "PieChart" },
      { label: "Feedback Produto",  href: "/compras/feedback",     icon: "Star" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "Wallet",
    defaultOpen: false,
    items: [
      { label: "Cockpit",           href: "/financeiro",             icon: "Gauge" },
      { label: "Fluxo de Caixa",    href: "/financeiro/fluxo",       icon: "ArrowLeftRight" },
      { label: "DRE", icon: "Sheet", defaultOpen: true, children: [
        { label: "Receita",           icon: "TrendingUp",      href: "/financeiro/dre/receita" },
        { label: "Folha",             icon: "Users",           href: "/financeiro/dre/folha" },
        { label: "CMV",               icon: "ShoppingCart",    href: "/financeiro/dre/cmv" },
        { label: "Ocupação",          icon: "Building2",       href: "/financeiro/dre/ocupacao" },
        { label: "Utilidades",        icon: "Zap",             href: "/financeiro/dre/utilidades" },
        { label: "Operação",          icon: "Settings",        href: "/financeiro/dre/operacao" },
        { label: "Manutenção",        icon: "Wrench",          href: "/financeiro/dre/manutencao" },
        { label: "Administrativo",    icon: "Briefcase",       href: "/financeiro/dre/administrativo" },
        { label: "Marketing",         icon: "Megaphone",       href: "/financeiro/dre/marketing" },
        { label: "Taxas de Cartão",   icon: "CreditCard",      href: "/financeiro/dre/taxas-cartao" },
        { label: "Impostos",          icon: "Landmark",        href: "/financeiro/dre/impostos" },
        { label: "Desp. Financeiras", icon: "BadgeDollarSign", href: "/financeiro/dre/despesas-financeiras" },
        { label: "Budget",            icon: "PiggyBank",       href: "/financeiro/dre/budget" },
      ] },
      { label: "Relatório de Produtos", href: "/financeiro/produtos",  icon: "Package" },
      { label: "Contas a Pagar",    href: "/financeiro/pagar",       icon: "CreditCard" },
      { label: "Contas a Receber",  href: "/financeiro/receber",     icon: "Banknote" },
      { label: "Aprovações",        href: "/financeiro/aprovacoes",  icon: "CheckSquare" },
      { label: "Conciliação",       href: "/financeiro/conciliacao", icon: "RefreshCw" },
      { label: "Orçamento",         href: "/financeiro/orcamento",   icon: "PiggyBank" },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    icon: "Users",
    defaultOpen: true,
    items: [
      { label: "Headcount",          href: "/pessoas/headcount",       icon: "BarChart3" },
      { label: "Colaboradores",      href: "/pessoas/colaboradores",   icon: "User" },
      { label: "Recrutamento",       href: "/recrutamento/vagas",      icon: "Briefcase" },
      { label: "Escala",             href: "/pessoas/escala",          icon: "CalendarDays" },
      { label: "Ponto",              href: "/pessoas/ponto",           icon: "Clock" },
      { label: "Férias",             href: "/pessoas/ferias",          icon: "Plane" },
      { label: "Faltas",             href: "/pessoas/faltas",          icon: "CalendarX2" },
      { label: "Horas Extras",       href: "/pessoas/horas-extras",    icon: "Timer" },
      { label: "Disciplina & Score", href: "/pessoas/disciplina",      icon: "ShieldAlert" },
      { label: "Holerites",          href: "/pessoas/holerites",       icon: "Receipt" },
      { label: "Gorjetas",           href: "/pessoas/gorjetas",        icon: "DollarSign" },
      { label: "Vale Transporte",    href: "/pessoas/vale-transporte", icon: "Bus" },
      { label: "Treinamentos",       href: "/pessoas/treinamentos",    icon: "GraduationCap" },
      { label: "Avaliações",         href: "/pessoas/avaliacoes",        icon: "ClipboardCheck" },
      { label: "Ciclos 360°",        href: "/pessoas/avaliacoes/ciclos", icon: "Repeat2" },
      { label: "Matriz 9Box",        href: "/pessoas/avaliacoes/9box",   icon: "LayoutGrid" },
      { label: "PDI",                href: "/pessoas/pdi",               icon: "ListChecks" },
      { label: "Analytics",          href: "/pessoas/analytics",         icon: "BarChart2" },
      { label: "Reuniões 1:1",       href: "/pessoas/reunioes",          icon: "CalendarClock" },
      { label: "Organograma",        href: "/pessoas/organograma",       icon: "Network" },
      { label: "Onboarding",         href: "/pessoas/onboarding",        icon: "UserPlus" },
      { label: "Feedback",           href: "/pessoas/feedback",          icon: "MessageCircle" },
      { label: "Documentos",         href: "/pessoas/documentos",        icon: "FolderOpen" },
      { label: "Importar Dados",     href: "/pessoas/importacao",        icon: "Upload" },
      { label: "Relatório de Ponto", href: "/pessoas/relatorio-ponto",  icon: "FileBarChart2" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: "Handshake",
    defaultOpen: false,
    items: [
      { label: "CRM Clientes", href: "/cliente",            icon: "MessageSquare" },
      { label: "Reservas",     href: "/comercial/reservas", icon: "CalendarCheck" },
      { label: "Eventos / OS", href: "/eventos",            icon: "CalendarDays" },
      { label: "Serena",       href: "/comercial/serena",   icon: "Bot" },
      { label: "Campanhas",    href: "/campanhas",          icon: "Megaphone" },
      { label: "Funil",        href: "/comercial/funil",    icon: "Filter" },
    ],
  },
  {
    id: "marca",
    label: "Marca",
    icon: "Bookmark",
    defaultOpen: false,
    items: [
      { label: "Diretório",     href: "/marcas",           icon: "Building2" },
      { label: "BrandBook",     href: "/marca/brandbook",  icon: "BookOpen" },
      { label: "Quem Somos",    href: "/marca/quem-somos", icon: "Info" },
      { label: "Site & Canais", href: "/marca/canais",     icon: "Globe" },
      { label: "Reputação",     href: "/marca/reputacao",  icon: "Award" },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    icon: "Brain",
    defaultOpen: false,
    items: [
      { label: "Metas",           href: "/inteligencia/metas",    icon: "Target" },
      { label: "WBR",             href: "/inteligencia/wbr",      icon: "LineChart" },
      { label: "Cross-módulo",    href: "/inteligencia/cross",    icon: "Layers" },
      { label: "Adoção",          href: "/inteligencia/adocao",   icon: "Activity" },
      { label: "Bugs & Feedback", href: "/inteligencia/feedback", icon: "Bug" },
      { label: "Roadmap",         href: "/inteligencia/roadmap",  icon: "Map" },
      { label: "Orquestrador",    href: "/orquestrador",          icon: "Workflow" },
    ],
  },
];
