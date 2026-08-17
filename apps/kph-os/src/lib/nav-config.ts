export type NavItemConfig = {
  href?: string;
  label: string;
  icon: string;
  defaultOpen?: boolean;
  roles?: string[];
  children?: NavItemConfig[];
};

export type NavGroupConfig = {
  id: string;
  label: string | null;
  icon: string | null;
  defaultOpen: boolean;
  /**
   * Slug da categoria (fk → categories.slug) que libera este grupo no sidebar.
   *
   * Quando ausente, o grupo é considerado "sempre visível" (ex: 'home' = Dashboard).
   * Quando presente, o grupo só aparece se o usuário tiver a categoria
   * correspondente em user_categories (ou se for founder).
   */
  category?: string;
  items: NavItemConfig[];
};

/**
 * Fonte única da navegação global do KPH OS.
 * Todas as zonas consomem esta estrutura por /api/nav.
 */
export const NAV_CONFIG: NavGroupConfig[] = [
  {
    id: "home",
    label: null,
    icon: null,
    defaultOpen: true,
    items: [{ label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" }],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: "TrendingUp",
    category: "operacao",
    defaultOpen: false,
    items: [
      { label: "Visão Geral", href: "/operacao", icon: "LayoutDashboard" },
      { label: "Relatório", href: "/operacao/relatorio", icon: "FileBarChart2" },
      { label: "Mapa da Casa", href: "/operacao/mapa", icon: "MapPin" },
      { label: "Performance", href: "/operacao/performance", icon: "Activity" },
      { label: "Vendedores", href: "/operacao/vendedores", icon: "UserCheck" },
      { label: "Auditorias", href: "/operacao/auditorias", icon: "ClipboardList" },
      { label: "Eventos", href: "/operacao/eventos", icon: "CalendarDays", roles: ["gm", "founder", "comercial"] },
      { label: "Manutenção", href: "/operacao/manutencao", icon: "Wrench", roles: ["operacao", "founder", "administrativo"] },
      { label: "Pedidos", href: "/operacao/pedidos", icon: "ShoppingCart", roles: ["operacao", "founder", "administrativo"] },
      { label: "Formulário de Recrutamento", href: "/operacao/pessoas/formulario-recrutamento", icon: "ClipboardList", roles: ["pessoas", "gm", "founder"] },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: "ShoppingCart",
    category: "compras",
    defaultOpen: false,
    items: [
      { label: "Pedidos", href: "/compras", icon: "ShoppingCart" },
      { label: "Cardápio", href: "/cardapio", icon: "BookOpen" },
      { label: "Ingredientes", href: "/compras/ingredientes", icon: "Carrot" },
      { label: "Estoque", href: "/compras/estoque", icon: "Package" },
      { label: "Logística", href: "/compras/logistica", icon: "Truck" },
      { label: "Fornecedores", href: "/compras/fornecedores", icon: "Building2" },
      { label: "Cotações", href: "/compras/cotacoes", icon: "FileText" },
      { label: "Recebimento", href: "/compras/recebimento", icon: "PackageCheck" },
      { label: "Análise CMV", href: "/compras/analise", icon: "PieChart" },
      { label: "Feedback Produto", href: "/compras/feedback", icon: "Star" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "Wallet",
    category: "financeiro",
    defaultOpen: false,
    items: [
      { label: "Cockpit", href: "/financeiro", icon: "Gauge" },
      { label: "Fluxo de Caixa", href: "/financeiro/fluxo", icon: "ArrowLeftRight" },
      {
        label: "DRE",
        icon: "Sheet",
        defaultOpen: true,
        children: [
          { label: "DRE Gerencial", href: "/financeiro/dre", icon: "LayoutDashboard" },
          { label: "Gerencial", href: "/financeiro/dre/gerencial", icon: "Gauge" },
          { label: "Receita", href: "/financeiro/dre/receita", icon: "TrendingUp" },
          { label: "Análise de Vendas", href: "/financeiro/dre/receita/analise-vendas", icon: "BarChart3" },
          { label: "Classificação", href: "/financeiro/dre/classificacao", icon: "ListChecks" },
          { label: "Folha", href: "/financeiro/dre/folha", icon: "Users" },
          { label: "CMV", href: "/financeiro/dre/cmv", icon: "ShoppingCart" },
          { label: "Ocupação", href: "/financeiro/dre/ocupacao", icon: "Building2" },
          { label: "Utilidades", href: "/financeiro/dre/utilidades", icon: "Zap" },
          { label: "Operação", href: "/financeiro/dre/operacao", icon: "Settings" },
          { label: "Manutenção", href: "/financeiro/dre/manutencao", icon: "Wrench" },
          { label: "Administrativo", href: "/financeiro/dre/administrativo", icon: "Briefcase" },
          { label: "Marketing", href: "/financeiro/dre/marketing", icon: "Megaphone" },
          { label: "Impostos", href: "/financeiro/dre/impostos", icon: "Landmark" },
          { label: "Despesas Financeiras", href: "/financeiro/dre/despesas-financeiras", icon: "BadgeDollarSign" },
        ],
      },
      { label: "Contratos", href: "/financeiro/contratos", icon: "FileText" },
      { label: "Contas a Pagar", href: "/financeiro/pagar", icon: "CreditCard" },
      { label: "Contas a Receber", href: "/financeiro/receber", icon: "Banknote" },
      { label: "Aprovações", href: "/financeiro/aprovacoes", icon: "CheckSquare" },
      { label: "Conciliação", href: "/financeiro/conciliacao", icon: "RefreshCw" },
      { label: "Orçamento", href: "/financeiro/orcamento", icon: "PiggyBank" },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    icon: "Users",
    category: "pessoas",
    defaultOpen: false,
    items: [
      { label: "Visão Geral", href: "/pessoas", icon: "LayoutDashboard" },
      { label: "Aprovações", href: "/pessoas/aprovacoes", icon: "CheckSquare" },
      {
        label: "Recrutamento",
        icon: "Briefcase",
        children: [
          { label: "Vagas", href: "/pessoas/vagas", icon: "Briefcase" },
          { label: "Pipeline", href: "/pessoas/recrutamento", icon: "Users" },
          { label: "Banco de Talentos", href: "/pessoas/recrutamento/banco-talentos", icon: "UserPlus" },
          { label: "Quadro Ideal", href: "/pessoas/recrutamento/quadro-ideal", icon: "LayoutGrid" },
          { label: "Importar CVs", href: "/pessoas/recrutamento/importar-cvs", icon: "Upload" },
        ],
      },
      {
        label: "DP",
        icon: "User",
        children: [
          { label: "Colaboradores", href: "/pessoas/colaboradores", icon: "User" },
          { label: "Ponto", href: "/pessoas/ponto", icon: "Clock" },
          { label: "Espelho de Ponto", href: "/pessoas/ponto/espelho", icon: "FileBarChart2" },
          { label: "Ajustes de Ponto", href: "/pessoas/ponto/aprovacoes", icon: "ClipboardCheck" },
          { label: "Faltas", href: "/pessoas/faltas", icon: "CalendarX2" },
          { label: "Horas Extras", href: "/pessoas/horas-extras", icon: "Timer" },
          { label: "Banco de Horas", href: "/pessoas/banco-de-horas", icon: "Clock" },
          { label: "Escala", href: "/pessoas/escala", icon: "CalendarDays" },
          { label: "Férias", href: "/pessoas/ferias", icon: "Plane" },
          { label: "Atestados", href: "/pessoas/atestados", icon: "ClipboardCheck" },
          { label: "Holerites", href: "/pessoas/holerites", icon: "Receipt" },
          { label: "Gorjetas", href: "/pessoas/gorjetas", icon: "DollarSign" },
          { label: "Vale Transporte", href: "/pessoas/vale-transporte", icon: "Bus" },
          { label: "Documentos", href: "/pessoas/documentos", icon: "FolderOpen" },
          { label: "Headcount", href: "/pessoas/headcount", icon: "BarChart3" },
          { label: "Cargos & Salários", href: "/pessoas/cargos-salarios", icon: "DollarSign" },
          { label: "Importar Dados", href: "/pessoas/importacao", icon: "Upload" },
        ],
      },
      {
        label: "DHO",
        icon: "GraduationCap",
        children: [
          { label: "Onboarding", href: "/pessoas/onboarding", icon: "UserPlus" },
          { label: "Treinamentos", href: "/pessoas/treinamentos", icon: "GraduationCap" },
          { label: "Avaliações", href: "/pessoas/avaliacoes", icon: "ClipboardCheck" },
          { label: "Ciclos 360°", href: "/pessoas/avaliacoes/ciclos", icon: "Repeat2" },
          { label: "Matriz 9Box", href: "/pessoas/avaliacoes/9box", icon: "LayoutGrid" },
          { label: "PDI", href: "/pessoas/pdi", icon: "ListChecks" },
          { label: "Reuniões 1:1", href: "/pessoas/reunioes", icon: "CalendarClock" },
          { label: "Feedback", href: "/pessoas/feedback", icon: "MessageCircle" },
          { label: "Disciplina & Score", href: "/pessoas/disciplina", icon: "ShieldAlert" },
          { label: "Organograma", href: "/pessoas/organograma", icon: "Network" },
        ],
      },
      { label: "Pesquisas de Clima", href: "/pessoas/clima", icon: "BarChart3" },
      {
        label: "Agentes",
        icon: "Bot",
        children: [
          { label: "Visão Geral", href: "/pessoas/agentes", icon: "LayoutDashboard" },
          { label: "Maya", href: "/pessoas/agentes/maya", icon: "Bot" },
          { label: "Theo", href: "/pessoas/agentes/theo", icon: "Bot" },
        ],
      },
      { label: "Fechamento de Folha", href: "/pessoas/contabilidade", icon: "Calculator" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: "Handshake",
    category: "comercial",
    defaultOpen: false,
    items: [
      { label: "Visão Geral", href: "/comercial", icon: "LayoutDashboard" },
      { label: "CRM Clientes", href: "/cliente", icon: "MessageSquare" },
      { label: "Reservas", href: "/comercial/reservas", icon: "CalendarCheck" },
      { label: "Eventos / OS", href: "/eventos", icon: "CalendarDays" },
      { label: "Serena", href: "/comercial/serena", icon: "Bot" },
      { label: "Campanhas", href: "/campanhas", icon: "Megaphone" },
      { label: "Funil", href: "/comercial/funil", icon: "Filter" },
    ],
  },
  {
    id: "marca",
    label: "Marca",
    icon: "Bookmark",
    defaultOpen: false,
    items: [
      { label: "Visão Geral", href: "/marca", icon: "LayoutDashboard" },
      { label: "Diretório", href: "/marcas", icon: "Building2" },
      { label: "BrandBook", href: "/marca/brandbook", icon: "BookOpen" },
      { label: "Quem Somos", href: "/marca/quem-somos", icon: "Info" },
      { label: "Site & Canais", href: "/marca/canais", icon: "Globe" },
      { label: "Reputação", href: "/marca/reputacao", icon: "Award" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: "ShieldAlert",
    defaultOpen: false,
    items: [
      { label: "Categorias & Acesso", href: "/admin/categorias", icon: "ShieldAlert", roles: ["founder"] },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    icon: "Brain",
    category: "inteligencia",
    defaultOpen: false,
    items: [
      { label: "Visão Geral", href: "/inteligencia", icon: "LayoutDashboard" },
      { label: "Inbox", href: "/inteligencia/inbox", icon: "MessageCircle" },
      { label: "Metas", href: "/inteligencia/metas", icon: "Target" },
      { label: "WBR", href: "/inteligencia/wbr", icon: "LineChart" },
      { label: "Cross-módulo", href: "/inteligencia/cross", icon: "Layers" },
      { label: "Adoção", href: "/inteligencia/adocao", icon: "Activity" },
      { label: "Bugs & Feedback", href: "/inteligencia/feedback", icon: "Bug" },
      { label: "Roadmap", href: "/inteligencia/roadmap", icon: "Map" },
      { label: "Orquestrador", href: "/orquestrador", icon: "Workflow" },
    ],
  },
];

/**
 * Filtra os grupos da navegação pelas categorias que o usuário possui.
 *
 * Regras:
 *   1. Grupos SEM `category` definida (ex: 'home') sempre passam.
 *   2. Grupos COM `category` passam se o usuário tiver aquela categoria,
 *      ou se for founder (vê tudo, sem precisar popular user_categories).
 *   3. Lista de categorias vazia + não-founder ⇒ vê só os grupos sem category
 *      (i.e. só o Dashboard). É o default seguro pra quem acabou de ser
 *      cadastrado e ainda não recebeu módulos.
 *
 * Função pura — testável e reusável por outros consumidores do NAV_CONFIG
 * (ex: CommandPalette, MobileShell, etc.).
 */
export function filterNavByCategories(
  config: NavGroupConfig[],
  userCategories: string[],
  isFounder: boolean,
): NavGroupConfig[] {
  const set = new Set(userCategories);
  return config.filter((g) => {
    if (!g.category) return true;        // home / sempre visível
    if (isFounder) return true;          // bypass total
    return set.has(g.category);
  });
}
