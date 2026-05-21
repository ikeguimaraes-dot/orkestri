# KPH OS — Guia Permanente do Claude Code

> Leia este arquivo inteiro antes de fazer qualquer coisa. É a memória completa do projeto.
> Última atualização: 2026-05-21 (PR #36 fix/ponto-validacao-server).

---

## 1. VISÃO GERAL

**KPH OS** é o ERP de hospitalidade multi-tenant da KPH Participações — holding que opera restaurantes e eventos em São Paulo. O sistema centraliza RH, financeiro, compras, operação, comercial e marca para todas as unidades do grupo.

- **URL de produção:** https://kph-os.vercel.app
- **Repositório:** github.com/ikeguimaraes-dot/kph-os (privado)
- **Supabase project ID:** iqgrvptrtphvbmvrqntm
- **Supabase URL:** https://iqgrvptrtphvbmvrqntm.supabase.co

**Princípio central do Orquestrador HOS:** nenhuma automação de IA age em produção sem aprovação humana. Agentes detectam → criam `hos_runs` → humano aprova ou rejeita → ação é executada.

### Marcas operadas
meet-eat · madonna-cucina · match-point · the-forge · klauss · pipokae · pipou-academy · sushi-muu · rojo · burguer · trato

---

## 2. STACK TÉCNICA

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19.2.4, TypeScript strict |
| Estilos | Tailwind v4 (sem config, usa `@import "tailwindcss"`) |
| Banco | Supabase (PostgreSQL + RLS + Storage) |
| Auth | Supabase Auth (email/senha) + bypass UUID para dev |
| Deploy | Vercel Pro — push para `main` = deploy automático |
| IA | Claude API — `claude-sonnet-4-20250514` |
| Notificações | Discord (webhook + bot ClaudeBridge) |
| Gráficos | Recharts ^3 |
| Ícones | Lucide React ^1 |
| PDF | @react-pdf/renderer ^4 |
| Forms | React Hook Form + Zod v4 |
| CI/CD | GitHub Actions + Vercel |
| Tabelas | @tanstack/react-table ^8 |
| Busca/Comandos | cmdk ^1 |
| Toasts | sonner ^2 |
| Temas | next-themes ^0.4 |

### Dependências completas (package.json)

```json
{
  "@base-ui/react": "^1.4.1",
  "@hookform/resolvers": "^5.2.2",
  "@react-pdf/renderer": "^4.5.1",
  "@supabase/ssr": "^0.10.2",
  "@supabase/supabase-js": "^2.104.1",
  "@tanstack/react-query": "^5.100.5",
  "@tanstack/react-table": "^8.21.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^4.1.0",
  "discord-interactions": "^4.4.0",
  "lucide-react": "^1.11.0",
  "next": "16.2.4",
  "next-themes": "^0.4.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "react-hook-form": "^7.74.0",
  "react-markdown": "^10.1.0",
  "recharts": "^3.8.1",
  "shadcn": "^4.5.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0",
  "tw-animate-css": "^1.4.0",
  "xlsx": "^0.18.5",
  "zod": "^4.3.6"
}
```

### TypeScript config crítica (tsconfig.json)

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true
}
```

`noUncheckedIndexedAccess` = acessar `array[i]` retorna `T | undefined`. Use `array[i]!` quando você sabe que o índice existe, ou `array[i] ?? defaultValue`.

---

## 3. IDs IMPORTANTES

```
Bypass UUID:        00000000-0000-0000-0000-000000000001  (bypass@kph.os — role founder)
Ike UUID:           ac559fa1-f10b-4ec4-9f4b-fafbc881a884
KPH group ID:       0ed2ef3a-39e8-4c95-ad2d-63a5d2b06c70
Meet & Eat unit ID: 674eac8c-5a38-4a42-aa60-0a666387909b
```

**NUNCA** usar a string literal `"bypass"` como `user_id` — PostgreSQL rejeita o cast para UUID. O bypass user foi seedado em `039_seed_bypass_user.sql`.

---

## 4. ARQUITETURA

### Hierarquia organizacional

```
groups (KPH Participações)
  └── brands (Meet & Eat, Madonna Cucina, Klauss, ...)
        └── units (Meet & Eat - Moema, Madonna - Itaim, ...)
              └── employees (colaboradores)
```

### Estrutura de pastas completa

```
src/
  app/
    (auth)/
      login/                      ← página de login
    (dashboard)/                  ← layout autenticado com Sidebar
      dashboard/                  ← página inicial com KPIs
        actions.ts                ← getKpiData, getAlertas
      campanhas/                  ← campanhas de marketing
        actions.ts
        campanhas-client.tsx
      cardapio/                   ← cardápio digital com ficha técnica
        [id]/                     ← detalhe + editar
        novo/
        actions.ts
      cliente/                    ← CRM de clientes
        [id]/                     ← detalhe do cliente
        novo/
        actions.ts
      comercial/
        funil/                    ← funil de vendas (Kanban)
        reservas/                 ← gestão de reservas
          actions.ts
        serena/                   ← integração com agente IA Serena
      compras/                    ← pedidos + fornecedores + estoque + cotações
        [id]/                     ← detalhe de pedido
        analise/                  ← análise de compras
        cotacoes/                 ← cotações de preço
          actions.ts
        estoque/                  ← movimentação de estoque
        fornecedores/             ← cadastro de fornecedores
        ingredientes/             ← cadastro de ingredientes
        logistica/                ← logística
        novo/                     ← novo pedido
        recebimento/              ← recebimento de pedidos
        actions.ts
      eventos/                    ← O.S. de eventos (brigada, menu, etc.)
        [id]/                     ← detalhe + editar
        novo/
        actions.ts
      financeiro/                 ← DRE, fluxo, contas a pagar/receber, CMV
        [brand_slug]/             ← financeiro por marca
          cmv/
          lancamento/
        aprovacoes/
        conciliacao/
        dre/
        fluxo/                    ← REAL: workday_resumo + metas_projecoes (PDV)
        orcamento/
        pagar/                    ← REAL: titulos_a_pagar (TOTVS)
        receber/
        actions.ts                ← KPH OS Supabase
        actions-operations.ts     ← Supabase de Operações (Meet & Eat)
      inteligencia/
        adocao/                   ← adoção do sistema
        cross/                    ← cross-sell / análise cruzada
        feedback/                 ← feedback de inteligência
        metas/                    ← KPIs por marca/período
          [brand_slug]/
          actions.ts
        roadmap/                  ← roadmap interno
        wbr/                      ← Weekly Business Review
      marca/                      ← brandbook, canais, reputação
        brandbook/
        canais/
        quem-somos/
        reputacao/
      marcas/                     ← diretório de marcas com links externos
      operacao/
        auditorias/               ← checklists de qualidade
          actions.ts
        mapa/                     ← mapa de mesas em tempo real
          actions.ts
        performance/              ← KPIs de operação
          actions.ts
        vendedores/               ← ranking de vendedores
      orquestrador/               ← painel HOS (runs, insights, aprovações)
        [id]/                     ← detalhe do run
        insights/
      pessoas/
        avaliacoes/               ← avaliação de desempenho
          9box/                   ← matriz 9Box
          ciclos/                 ← ciclos 360°
            [id]/
            novo/
          novo/[employeeId]/      ← nova avaliação
          templates/              ← templates de critérios
            [id]/
            novo/
          actions.ts
        colaboradores/            ← CRUD colaboradores
          [id]/                   ← perfil detalhado por abas
          [id]/editar/
          novo/
        disciplina/               ← advertências + score
        documentos/               ← documentos trabalhistas
        escala/                   ← grade de turnos mensal
        faltas/                   ← registro de faltas
          actions.ts
        feedback/                 ← feedback contínuo
          novo/
          actions.ts
        ferias/                   ← gestão de férias
        gorjetas/                 ← sistema de pontos por cargo
          actions.ts
        headcount/                ← análise de headcount
        holerites/                ← geração e visualização de holerites
          [id]/
        horas-extras/             ← controle de HE
          actions.ts
        importacao/               ← importação CSV do Totvs
        onboarding/               ← runs de onboarding
          [id]/
          novo/
          templates/
            novo/
          actions.ts
        organograma/              ← árvore hierárquica (manager_id)
          configurar/
          actions.ts
        pdi/                      ← Plano de Desenvolvimento Individual
          [id]/
          novo/
          actions.ts
        ponto/                    ← registro de ponto + resumo + gestão ao vivo
          gestao/                 ← gestão ao vivo (presença em tempo real)
            page.tsx
            gestao-client.tsx     ← auto-refresh 30s via router.refresh()
          resumo/
          actions.ts
        relatorio-ponto/          ← relatório mensal importado do Totvs
        reunioes/                 ← Reuniões 1:1
          [id]/
          nova/
          actions.ts
        treinamentos/             ← templates + registros de treinamento
          [id]/
          novo/
          actions.ts
        vale-transporte/          ← controle de VT
      recrutamento/
        candidatos/[id]/          ← detalhe de candidato
        vagas/                    ← pipeline de vagas
          [id]/
        actions.ts
    api/
      auth-debug/                 ← debug de sessão
      discord/
        interactions/             ← slash commands /aprovar /rejeitar /hos
        register/                 ← registro de comandos no Discord
      holerites/[id]/pdf/         ← geração de PDF do holerite
      holerites/generate/         ← gera holerite programaticamente
      orchestrator/
        cron/compliance/          ← cron 0 8 * * *
        cron/ferias/              ← cron 0 8 * * 1
        cron/folha/               ← cron 0 8 25 * *
        cron/onboarding/          ← cron 0 9 * * *
        cron/score/               ← cron 30 8 * * 1
        cron/banco-horas/         ← cron 45 8 * * 1
        escalate/                 ← cron */30 * * * *
        github-webhook/           ← recebe eventos de PR do GitHub
        qa-callback/              ← recebe resultado dos smoke tests
        webhook/                  ← recebe deployment_status do Vercel
      ponto/punch/                ← endpoint do app mobile para bater ponto
    auth/
      callback/                   ← callback OAuth do Supabase
      sign-out/                   ← logout
    ponto/                        ← app de ponto (layout isolado, sem sidebar)
  components/
    avaliacoes/
      CriteriosEditor.tsx         ← form dinâmico de critérios de avaliação
    dashboard/
      AlertasPanel.tsx · AniversariantesCard.tsx · KpiCard.tsx
      MarcaPerformanceCard.tsx · ProgressBar.tsx
      ProximosEventosTimeline.tsx · VariacaoBadge.tsx
    eventos/
      BrigadaSection.tsx · CollapsibleSection.tsx · EventActions.tsx
      EventDetail.tsx · EventForm.tsx · EventosFilters.tsx
      EventosTable.tsx · LayoutUpload.tsx · MenuSection.tsx
      ResumoHeader.tsx · StatusBadge.tsx
    financeiro/
      AprovacaoActions.tsx · CmvCreateForm.tsx · DreCard.tsx
      GapTable.tsx · LancamentoForm.tsx · SeverityBadge.tsx
    pessoas/
      AbsenceDialog.tsx · DisciplinaTabs.tsx · EmployeeForm.tsx
      EmployeeTable.tsx · EscalaGrid.tsx · EscalaMonthView.tsx
      GenerateButton.tsx · PayslipDetail.tsx · PayslipPdf.tsx
      PayslipsTable.tsx · PontoToggle.tsx · PunchTable.tsx
      ScoreBar.tsx · WarningDialog.tsx
      profile-tabs/
        AvaliacoesTab.tsx · DocumentosTab.tsx · FeriasTab.tsx
        GorjetasTab.tsx · HorasExtrasTab.tsx · TreinamentosTab.tsx · VtTab.tsx
    ponto/
      CameraCapture.tsx           ← captura de foto para ponto
      PontoApp.tsx                ← app web mobile de ponto
      useGeolocation.ts           ← hook de geolocalização
    shell/
      NotificationBell.tsx        ← sino com polling
      Sidebar.tsx                 ← navegação principal com grupos colapsáveis
      TopBar.tsx                  ← barra superior com breadcrumb
    ui/                           ← shadcn/ui components
      avatar.tsx · badge.tsx · button.tsx · card.tsx · command.tsx
      dialog.tsx · dropdown-menu.tsx · input.tsx · input-group.tsx
      label.tsx · select.tsx · sheet.tsx · sonner.tsx · table.tsx
      tabs.tsx · textarea.tsx · tooltip.tsx
  lib/
    auth/
      context.tsx                 ← AuthProvider, useAuth(), useUnit()
      server.ts                   ← requireUser(), getCurrentUser(), requireRole(), isFounder()
      unit.ts                     ← getCurrentUnit()
    avaliacoes/ · campanhas/ · cardapio/ · cliente/ · compras/
    dashboard/ · eventos/ · financeiro/ · inteligencia/
    metas/ · notifications/ · recrutamento/ · treinamentos/
      (cada um com schema.ts e types.ts)
    discord/
      notify.ts                   ← sendDiscordMessage() via webhook
      verify.ts                   ← verificação Ed25519 de requests
    orquestrador/
      actions.ts                  ← createRun, submitRunDecision, autoApproveRun, etc.
      commander.ts                ← executeCommander (Discord conversacional)
      agents/
        code-review.ts · compliance-documental.ts
        ferias-monitor.ts · folha-validator.ts · onboarding-checker.ts
        score-monitor.ts · banco-horas-monitor.ts
    pessoas/
      actions.ts                  ← CRUD employees, payslips, etc.
      clt.ts                      ← calcINSS, calcIRRF, calcFGTS (CLT 2024)
      csv-parser.ts               ← parser CSV do Totvs
      document-actions.ts         ← upload/download Storage
      headcount-actions.ts
      import-actions.ts           ← importação ponto_mensal
      labor.ts                    ← hoursWorked, timeToMinutes
      ponto-actions.ts            ← registrarPunch + PunchActionResult (minutosRestantes)
      ponto-mensal-actions.ts
      punch.ts                    ← nextPunchTipo, PUNCH_LABEL, PUNCH_COLOR, calcWorkHours, formatHHMM, formatMinutesAsHours
      schema.ts                   ← schemas Zod de RH
      score-monthly.ts
      score.ts                    ← SCORE_BASE, WARNING_DELTA, ABSENCE_DELTA
    supabase/
      client.ts                   ← getBrowserClient()
      operations-client.ts        ← createOperationsClient(), createOperationsAnonClient() — banco Meet & Eat
      proxy.ts                    ← middleware helper para refresh de token
      server.ts                   ← createSupabaseServerClient(), createServiceClient()
    export.ts                     ← downloadCsv() — exporta CSV com BOM UTF-8
    format.ts                     ← formatBRL, formatDateBR, initials, avatarColor
    result.ts                     ← ActionResult<T>
    utils.ts                      ← cn() (tailwind-merge + clsx)
  types/
    compras-ingredientes.ts
    database.ts                   ← tipos gerados pelo Supabase CLI
    operations-database.ts        ← tipos manuais do banco Meet & Eat (12 tabelas workday + titulos)
    index.ts
    pessoas.ts                    ← tipos adicionais de RH
```

---

## 5. PADRÕES OBRIGATÓRIOS

### 5.1 Clientes Supabase

```typescript
// ✅ CORRETO: Server Actions e Route Handlers — usa service role, bypassa RLS
import { createServiceClient } from "@/lib/supabase/server";
const supabase = createServiceClient(); // síncrono, retorna SupabaseClient | null

// ✅ CORRETO: Server Components — usa sessão do cookie, RLS aplica
import { createSupabaseServerClient } from "@/lib/supabase/server";
const supabase = await createSupabaseServerClient(); // assíncrono

// ❌ NUNCA usar createSupabaseServerClient() em Server Actions para mutações
// ❌ NUNCA expor SUPABASE_SERVICE_ROLE_KEY em componentes client
```

**Regra de ouro:** `createServiceClient()` em tudo que escreve no banco. `createSupabaseServerClient()` em tudo que só lê e precisa do contexto de sessão.

**Atenção:** `createServiceClient()` retorna `SupabaseClient | null`. Sempre checar:
```typescript
if (!supabase) return { ok: false, error: "Serviço indisponível" };
```

### 5.2 Params em Next.js 16

```typescript
// ✅ CORRETO — params é Promise em Next.js 16
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}

// ✅ searchParams também
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { page = "1", status } = await searchParams;
}

// ❌ ERRADO — Next.js 16 quebra se não fizer await
export default async function Page({ params }: { params: { id: string } }) { ... }
```

### 5.3 Hydration guard

Componentes client que usam dados dinâmicos ou APIs SSR-sensíveis:

```typescript
"use client";
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
if (!mounted) return null; // ou skeleton
```

### 5.4 ActionResult — padrão para Server Actions

```typescript
// src/lib/result.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Em Server Actions:
"use server";
export async function createSomething(input: Input): Promise<ActionResult<string>> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Serviço indisponível" };
    const { data, error } = await supabase.from("tabela").insert({ ... } as never).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// No cliente:
const r = await createSomething(input);
if (!r.ok) { setError(r.error); return; }
router.push("/sucesso");
```

### 5.5 Cast `as never` em inserts

```typescript
// Tabelas com tipos complexos:
await supabase.from("tabela").insert({ campo: valor } as never);

// Tabelas não tipadas (não estão em database.ts):
await (supabase as any).from("tabela_nova").insert({ campo: valor });
```

### 5.6 getAuthorizedUnitIds — segurança multi-unit

Todo Server Action que lê ou escreve dados de unit deve verificar autorização:

```typescript
async function getAuthorizedUnitIds(): Promise<string[] | null> {
  const user = await requireUser();
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("unit_id")
    .eq("user_id", user.id);
  const unitIds = (roles ?? [])
    .map((r: any) => r.unit_id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
  return unitIds.length > 0 ? unitIds : null; // null = sem restrição (founder)
}

// Uso:
const unitIds = await getAuthorizedUnitIds();
let query = supabase.from("tabela").select("*");
if (unitIds) query = query.in("unit_id", unitIds);
```

Retorna `null` quando o user é founder (sem restrição).

### 5.7 Timezone

```typescript
const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
```

Datas de competência: sempre `YYYY-MM-DD` (DATE) no banco. Nunca DateTime onde Date basta.

### 5.8 Componentes client

Todo componente com `useState`, `useEffect`, `useRouter`, `onClick`, etc. DEVE ter `"use client"` na primeira linha.

### 5.9 export const dynamic

Páginas que leem dados do banco (Server Components):

```typescript
export const dynamic = "force-dynamic";
```

Sem isso, Next.js pode fazer cache estático e servir dados desatualizados.

### 5.10 Suspense em Server Components

```tsx
import { Suspense } from "react";
export default async function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <DadosLentos />
    </Suspense>
  );
}
```

### 5.11 Padrão CSS / Tailwind v4

O projeto usa **Tailwind v4** com `@import "tailwindcss"` — **sem `tailwind.config.ts`**. Customizações vão em `globals.css` via `@theme inline` e `:root` CSS vars. Estilos inline com `style={{ ... }}` são comuns e aceitos — não refatorar para classes sem motivo.

---

## 6. AUTENTICAÇÃO

### Fluxo SSR completo

1. **Middleware** (`src/lib/supabase/proxy.ts`) — valida JWT em toda request, injeta `x-middleware-set-cookie` se token foi renovado
2. **`requireUser()`** — lê sessão via cookie. Se sem sessão, retorna o bypass user — **AUTH DESATIVADO para dev**
3. **`getCurrentUnit()`** — lê cookie `kph_unit_id` para saber qual unidade está selecionada
4. **`AuthProvider`** — Client Component no layout do dashboard. Recebe user + units do servidor, persiste `unitId` em localStorage + cookie. Expõe `useAuth()` e `useUnit()`

### requireUser() em modo dev

```typescript
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  // UUID fixo seedado em 039_seed_bypass_user.sql
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "bypass@kph.os",
    roles: [{ role: "founder" as RoleName, unitId: null, brandId: null, groupId: null }],
  };
}
```

### getCurrentUser() — detalhes internos

- Usa `cache` do React para memoizar durante uma render pass
- Chama `supabase.auth.getSession()` (lê JWT do cookie localmente, sem rede)
- Busca roles via `user_roles JOIN roles!inner(name)`
- **NUNCA engolir** exceções `NEXT_REDIRECT` ou `DYNAMIC_SERVER_USAGE`

### Roles disponíveis (tabela `roles`)

| Role | Descrição |
|------|-----------|
| founder | Fundador — acesso total |
| cfo | CFO — financeiro + relatórios |
| gm | Gerente Geral — unidade completa |
| pessoas | RH — módulo pessoas |
| chef | Chef — cardápio + estoque |
| comprador | Compras — fornecedores + estoque |
| colaborador | Colaborador — acesso básico |
| socio_readonly | Sócio — somente leitura |
| comercial | Comercial — vendas + eventos |
| operacional | Operacional — execução de eventos |

### Helpers RBAC (PostgreSQL — SECURITY DEFINER)

- `kph_is_founder()` — true se o usuário tem role founder
- `kph_has_role_for_unit(p_unit_id)` — true se tem acesso à unidade (direta, brand ou group)
- `kph_has_role_for_brand(p_brand_id)` — true se tem acesso à marca
- `kph_has_role_for_group(p_group_id)` — true se tem acesso ao grupo
- `kph_is_founder_or_cfo()` — founder ou CFO

**Fix em 026:** `kph_has_role_for_unit` corrigida para brand-level users acessarem units da sua brand.

---

## 7. BANCO DE DADOS — SCHEMA COMPLETO

### Migrations (001–062)

| Migration | Descrição |
|-----------|-----------|
| 001_base_schema | groups, brands, units, roles, user_roles, audit_log + helpers RBAC |
| 002_rls | Políticas RLS para grupos, marcas, unidades, user_roles, audit_log |
| 003_pessoas | employees, shifts, time_clock_punches, time_bank_balance, payslips, cct_versions |
| 004_payslips_policies | Políticas RLS adicionais para payslips |
| 005_employees_expand | Colunas extras em employees (foto_url, bio, etc.) |
| 006_ponto_policies | Políticas RLS para ponto (self-select: colaborador vê próprio ponto) |
| 007_marcas_hos | brands operacionais (11 marcas), brand_links (portais externos) |
| 008_events | events, event_staff, event_menu_items, event_attachments, restaurant_tables |
| 008_self_select_ponto | Policy colaborador ver próprio ponto via employee_auth |
| 009_dashboard_views | Views: v_dre_consolidado, v_eventos_kpi, v_headcount_por_marca |
| 010_financeiro | financial_periods, lancamentos, cost_entries + views DRE/gap/CMV |
| 011_employees_rh_expansion | +23 colunas em employees + 6 tabelas: vacations, absences, overtime_records, transport_vouchers, warnings, job_openings |
| 019_compras | purchase_orders, purchase_order_items, suppliers, stock_movements |
| 020_clientes | clients (CRM) |
| 021_treinamentos | training_templates, training_records (validade via snapshot) |
| 022_avaliacoes | performance_templates (critérios JSONB), performance_reviews |
| 023_metas | brand_targets, target_notes |
| 024_notificacoes | notifications (INSERT apenas via service_role) |
| 025_ficha_tecnica | recipe_items, recipe_notes (DEPRECATED — substituída por 028) |
| 026_fix_rls_multi_unit | Fix kph_has_role_for_unit — brand-level user acessa units da brand |
| 027_employee_documents | employee_documents (bucket Storage: 'employee-documents') |
| 028_ingredientes | ingredients, ingredient_price_history, recipe_items, recipe_notes (refactor) |
| 029_quality_checklists | quality_checklists, checklist_records |
| 030_restaurant_tables | restaurant_tables com status/área |
| 031_reservations | reservations (mesa + pax + origem + status) |
| 032_price_quotes | price_quotes, price_quote_items |
| 033_orchestrator | hos_jobs, hos_runs, hos_approvals + RLS + trigger updated_at |
| 034_ponto_mensal | ponto_mensal (1 linha/colaborador/período, importado do Totvs) |
| 035_gorjetas | gorjeta_cargo_pontos, gorjeta_periodos, gorjeta_dias v1 (substituída por 036) |
| 035_hos_insights | hos_insights (relatórios semanais gerados pela Claude API) |
| 036_gorjetas_v2 | Gorjetas v2 — DROP + recreate das 3 tabelas (modelo pontos por dia) |
| 037_controle_vagas | +colunas em job_openings: status, recrutador, sla_dias, motivo |
| 038_hos_runs_rls_update | Adiciona WITH CHECK na policy UPDATE de hos_runs |
| 039_seed_bypass_user | Seed do bypass UUID em auth.users (fix FK para hos_approvals) |
| 040_hos_runs_archived_at | ADD COLUMN archived_at + index parcial + arquiva runs antigos |
| 041_hos_jobs_auto_approve | ADD COLUMN auto_approve; TRUE para qa_preview e code_review |
| 042_code_review_no_auto | Reverte: code_review → auto_approve = FALSE |
| 043_employee_auth | employee_auth (auth mobile: CPF + password_hash, sem auth.users) |
| 044_mobile_views | View tips_records (agregação gorjeta para app mobile) |
| 045_theo_tickets | theo_tickets (tickets SAC Theo via WhatsApp) |
| 046_hos_runs_deployment_id | ADD COLUMN deployment_id + UNIQUE INDEX (deduplicação Vercel) |
| 047_candidates | candidates (pipeline R&S web) |
| 048_candidatos_maya | candidatos_maya (leads WhatsApp Maya, separado do pipeline web) |
| 049_compliance_documental | Seed hos_job: compliance_documental |
| 050_hos_runs_title | ADD COLUMN title em hos_runs |
| 051_ferias_monitor | Seed hos_job: ferias_monitor |
| 052_folha_validator | Seed hos_job: folha_validator |
| 053_onboarding_checker | Expande CHECK em employee_documents.tipo (+foto_3x4) + seed onboarding_checker |
| 054_feedbacks | feedbacks (feedback contínuo entre colaboradores) |
| 055_avaliacoes_360_9box | +tipo_avaliador +anonimo em performance_reviews + avaliacao_ciclos + avaliacao_participantes |
| 056_pdi | pdis + pdi_metas |
| 057_reunioes_1on1 | reunioes_1on1 + reuniao_action_items |
| 058_organograma | ALTER employees ADD COLUMN manager_id UUID REFERENCES employees(id) |
| 059_onboarding | onboarding_templates + onboarding_tarefas + onboarding_runs + onboarding_checklist |
| 060_hos_app_documents | (verificar conteúdo — arquivo presente no repo, aplicação a confirmar) |
| 061_score_banco_horas_monitors | Seed hos_jobs: score_monitor + banco_horas_monitor (ON CONFLICT DO NOTHING) |
| 062_punch_photos_bucket | Bucket Storage `punch-photos` (privado, 5 MB, jpeg/png/webp) + RLS SELECT managers + RLS SELECT colaborador próprio. Upload/delete exclusivo do service_role. Path: `{employee_uuid}/{timestamp_ms}.jpg` |

### Tabelas por domínio

#### Core multi-tenant
```sql
groups(id, name, slug)
brands(id, group_id, name, slug, color, active)
units(id, brand_id, name, address, whatsapp_number, active)
roles(id, name, description)
user_roles(id, user_id, role_id, unit_id, brand_id, group_id)
audit_log(id, user_id, action, resource, resource_id, old_data, new_data)
brand_links(id, brand_id, kind, url, label, ordem)
notifications(id, user_id, tipo, titulo, mensagem, link, lida, created_at)
```

#### RH — colaboradores
```sql
employees(
  id, unit_id, user_id, nome, sobrenome, cpf, funcao,
  salario_base, data_admissao, data_demissao, ativo,
  banco, agencia, conta, tipo_conta, pix,
  manager_id,          -- 058: organograma
  foto_url, bio,       -- 005
  -- 011: celular, email, endereco, cep, rg, cnh,
  --      data_nascimento, genero, estado_civil, filhos, escolaridade,
  --      tipo_contrato, carga_horaria, sindicato, ctps_expedicao, ...
)
shifts(id, employee_id, unit_id, data, hora_inicio, hora_fim, tipo, labor_cost)
time_clock_punches(id, employee_id, tipo, timestamp_punch, latitude, longitude, aprovado)
time_bank_balance(id, employee_id, saldo_minutos, ultimo_calculo)
payslips(id, employee_id, competencia, salario_base, horas_extras, gorjeta, liquido, status, pdf_url)
vacations(id, employee_id, data_inicio, data_fim, status, tipo)
absences(id, employee_id, data, tipo, motivo, justificada)
overtime_records(id, employee_id, data, horas, aprovado)
transport_vouchers(id, employee_id, competencia, valor, dias)
warnings(id, employee_id, tipo, descricao, gravidade, data)
employee_documents(id, employee_id, tipo CHECK(...), nome, file_path, file_size, mime_type, data_emissao, data_validade, uploaded_by)
employee_auth(id, employee_id, cpf UNIQUE, password_hash, is_active, last_login)
ponto_mensal(id, unit_id, employee_id, matricula, nome, cpf, cargo, departamento, periodo, ...)
feedbacks(id, unit_id, de_employee_id, para_employee_id, tipo, categoria, mensagem, anonimo)
```

**Tipos válidos em employee_documents.tipo:**
aso_admissional, aso_periodico, aso_demissional, ctps, rg, cpf, cnh, comprovante_residencia,
titulo_eleitor, reservista, pis_pasep, certidao_nascimento, certidao_casamento,
comprovante_escolaridade, certificado_curso, epi_recibo, uniforme_recibo,
contrato_trabalho, contrato_aditivo, rescisao, termo_quitacao, atestado_medico,
declaracao, outro, **foto_3x4** (adicionado em 053)

#### Gorjetas
```sql
gorjeta_cargo_pontos(id, unit_id, cargo, pontos INTEGER, ativo)  -- unit_id=NULL = template global
gorjeta_periodos(id, unit_id, inicio, fim, valor_total, encerrado)
gorjeta_dias(id, periodo_id, employee_id, data, pontos, valor_calculado)
-- View para app mobile:
tips_records(id, employee_id, periodo, total_pontos, pontos_liquidos, valor_ponto, valor)
```

#### Avaliação e desenvolvimento
```sql
performance_templates(id, brand_id, unit_id, nome, criterios JSONB, ativo)
performance_reviews(id, employee_id, template_id, nota_geral, respostas JSONB,
  tipo_avaliador CHECK IN('autoavaliacao','par','gestor','liderado'), anonimo)
avaliacao_ciclos(id, unit_id, nome, template_id, status CHECK IN('aberto','em_andamento','encerrado'),
  data_inicio, data_fim, created_by)
avaliacao_participantes(id, ciclo_id, avaliado_id, avaliador_id, tipo_avaliador, status, review_id)
pdis(id, unit_id, employee_id, titulo,
  status CHECK IN('ativo','concluido','cancelado'), data_inicio, data_fim, avaliacao_id, created_by)
pdi_metas(id, pdi_id, descricao, prazo,
  status CHECK IN('pendente','em_andamento','concluida','cancelada'), progresso INT 0-100)
reunioes_1on1(id, unit_id, gestor_id, colaborador_id, data_reuniao, duracao_min,
  status CHECK IN('agendada','realizada','cancelada'), notas, created_by)
reuniao_action_items(id, reuniao_id, descricao, responsavel_id, prazo,
  status CHECK IN('pendente','concluido','cancelado'))
```

#### Treinamentos
```sql
training_templates(id, brand_id, unit_id, nome, categoria, validade_dias, conteudo)
training_records(id, employee_id, template_id, data_conclusao, validade_dias_snapshot,
  validade_ate GENERATED, instrutor)
```

#### Onboarding (059)
```sql
onboarding_templates(id, unit_id, nome, descricao, ativo)
onboarding_tarefas(id, template_id, titulo, descricao,
  responsavel CHECK IN('rh','gestor','colaborador','ti'), prazo_dias, ordem)
onboarding_runs(id, unit_id, employee_id, template_id,
  status CHECK IN('em_andamento','concluido','cancelado'), data_inicio)
onboarding_checklist(id, run_id, tarefa_id,
  status CHECK IN('pendente','concluido','ignorado'), concluido_em, concluido_por)
```

#### Recrutamento
```sql
job_openings(id, unit_id, titulo, funcao,
  status CHECK IN('aberta','fechada','congelada'), recrutador, sla_dias, motivo, ...)
candidates(id, nome, telefone, area_interesse, cargo_interesse,
  status CHECK IN('novo','triagem','entrevista','aprovado','reprovado','desistiu'), source)
candidatos_maya(id, nome, telefone, area_interesse, cargo_interesse, status, source)
```

#### Orquestrador HOS
```sql
hos_jobs(id, name, slug UNIQUE, description, auto_approve BOOLEAN, is_active)
hos_runs(id, job_id, status, payload JSONB, logs JSONB, result_data JSONB,
  title, deployment_id, archived_at, created_at, updated_at)
hos_approvals(id, run_id, user_id, decision CHECK IN('approve','reject'), feedback, created_at)
hos_insights(id, period_start, period_end, report_md, metrics JSONB, created_at)
```

**Status do hos_runs:** `pending → running → awaiting_approval → approved | rejected | failed`

#### Agentes WhatsApp
```sql
theo_tickets(id, employee_id, categoria, descricao, status, created_at, updated_at)
-- Nota: agent_conversations e agent_metrics ficam nos repos Maya/Theo (não neste banco)
```

#### Compras e financeiro
```sql
purchase_orders(id, unit_id, supplier_id, numero, status, valor_total, data_pedido)
purchase_order_items(id, order_id, ingredient_id, quantidade, preco_unitario, total GENERATED)
suppliers(id, unit_id, nome, cnpj, contato, categoria)
ingredients(id, group_id, codigo, nome, categoria, unidade_padrao, custo_padrao, ativo)
ingredient_price_history(id, ingredient_id, supplier_id, preco, data)
price_quotes(id, unit_id, supplier_id, periodo, status, titulo)
price_quote_items(id, quote_id, descricao, unidade, quantidade, preco_unitario, total GENERATED)
stock_movements(id, unit_id, ingredient_id, tipo, quantidade, motivo)
lancamentos(id, brand_id, unit_id, natureza, regime, categoria, valor, competencia, aprovado)
financial_periods(id, brand_id, competencia, receita_total, despesa_total, cmv_total)
```

#### Operação e comercial
```sql
quality_checklists(id, unit_id, nome, area, turno, items JSONB, ativo)
checklist_records(id, checklist_id, unit_id, data, turno, responsavel_id, respostas JSONB, score_pct)
restaurant_tables(id, unit_id, numero, capacidade, area, status, ativo)
-- area: 'salao'|'varanda'|'bar'|'vip'|'externa'
-- status: 'livre'|'ocupada'|'reservada'|'bloqueada'
reservations(id, unit_id, data, hora, pax, status, origem, cliente_nome, cliente_telefone, confirmado_por)
-- status: 'pendente'|'confirmada'|'cancelada'|'no_show'|'finalizada'
-- origem: 'whatsapp'|'telefone'|'email'|'tagme'|'presencial'|'instagram'
clients(id, brand_id, unit_id, nome, email, telefone, empresa, origem, segmento)
events(id, unit_id, brand_id, nome, data_inicio, hora_inicio, hora_fim, num_convidados, status, valor_total, ...)
event_staff(id, event_id, employee_id, funcao, confirmado)
event_menu_items(id, event_id, nome, quantidade, preco_unitario)
event_attachments(id, event_id, nome, file_path)
```

#### Views criadas
```sql
v_eventos_kpi            -- KPIs de eventos por marca/mês (security_invoker=true)
v_headcount_por_marca    -- Headcount ativo + movimentações do mês
v_dre_consolidado        -- DRE consolidado por marca/período
tips_records             -- Gorjeta por colaborador/mês (para app mobile HOS)
```

---

## 8. ORQUESTRADOR HOS

### O que é

Sistema de governança de agentes IA. **Human-in-the-loop:** agente detecta → cria `hos_run` → humano aprova ou rejeita (painel web ou Discord) → ação executada ou descartada.

### Jobs ativos em produção

| slug | nome | auto_approve | trigger |
|------|------|-------------|---------|
| qa_preview | QA Playwright | TRUE | GitHub Actions deployment |
| code_review | Code Review PR | FALSE | GitHub webhook pull_request |
| deploy_prod | Deploy Production | FALSE | Vercel webhook deployment.succeeded |
| compliance_documental | Compliance Documental | FALSE | cron 0 8 * * * |
| ferias_monitor | Férias Monitor | FALSE | cron 0 8 * * 1 (segunda) |
| folha_validator | Folha Validator | FALSE | cron 0 8 25 * * (dia 25) |
| onboarding_checker | Onboarding Checker | FALSE | cron 0 9 * * * |
| score_monitor | Score Monitor | FALSE | cron 30 8 * * 1 (segunda 8:30 UTC) |
| banco_horas_monitor | Banco de Horas Monitor | FALSE | cron 45 8 * * 1 (segunda 8:45 UTC) |

### Crons Vercel (vercel.json)

```json
[
  { "path": "/api/orchestrator/escalate",        "schedule": "*/30 * * * *" },
  { "path": "/api/orchestrator/cron/compliance", "schedule": "0 8 * * *" },
  { "path": "/api/orchestrator/cron/ferias",     "schedule": "0 8 * * 1" },
  { "path": "/api/orchestrator/cron/folha",      "schedule": "0 8 25 * *" },
  { "path": "/api/orchestrator/cron/onboarding", "schedule": "0 9 * * *" },
  { "path": "/api/orchestrator/cron/score",      "schedule": "30 8 * * 1" },
  { "path": "/api/orchestrator/cron/banco-horas","schedule": "45 8 * * 1" }
]
```

### Discord

- **App ID:** 1498287829464256563 · **Bot:** ClaudeBridge
- **Comandos slash:** `/aprovar run_id:UUID` · `/rejeitar run_id:UUID` · `/hos`
- **Canal:** #orquestrador (webhook em `DISCORD_WEBHOOK_URL`)
- **Verificação:** Ed25519 via `discord-interactions` + `src/lib/discord/verify.ts`

### Funções do orquestrador (`src/lib/orquestrador/actions.ts`)

```typescript
createRun(jobSlug, payload)               // cria run com status 'running'
autoApproveRun(runId)                     // aprovação automática (usa bypass UUID)
submitRunDecision(runId, decision, feedback) // aprovação/rejeição humana
submitRunDecisionFromDiscord(runId, decision, discordUser) // via Discord
updateRunLogs(runId, resultData)          // atualiza result_data
markRunFailed(runId, reason)              // marca como failed
generateWeeklyInsight()                   // gera relatório semanal via Claude API
listInsights()                            // lista últimos 10 insights
listOrchestratorRuns()                    // lista runs ativos (não arquivados)
getRunDetails(id)                         // run + approvals
mockCreateRun(jobSlug)                    // cria run fake para teste
```

### Integração onboarding → orquestrador

Quando um `onboarding_run` é criado, resolve o `hos_run` pendente do `onboarding_checker` para aquele employee:

```typescript
await supabase.from("hos_runs")
  .update({ status: "approved", result_data: { ... } })
  .eq("job_id", job.id)
  .in("status", ["pending", "awaiting_approval"])
  .filter("payload->>'employee_id'", "eq", employeeId);
```

### Escalação de runs

`/api/orchestrator/escalate` (cron 30min) notifica no Discord quando um run fica sem aprovação por 2h, 4h ou 8h. Tiers progressivos.

---

## 9. MÓDULOS — RESUMO POR ROTA

### Módulo Pessoas

| Rota | Módulo | Tabelas |
|------|--------|---------|
| /pessoas/colaboradores | CRUD colaboradores | employees |
| /pessoas/headcount | Análise de headcount | employees |
| /pessoas/escala | Grade de turnos | shifts |
| /pessoas/ponto | Registro de ponto (aprovação de punches) | time_clock_punches |
| /pessoas/ponto/gestao | Gestão ao vivo — presença em tempo real, auto-refresh 30s | time_clock_punches, employees |
| /pessoas/ferias | Férias | vacations |
| /pessoas/faltas | Faltas | absences |
| /pessoas/horas-extras | Horas extras | overtime_records |
| /pessoas/disciplina | Advertências + score | warnings |
| /pessoas/holerites | Holerites PDF | payslips |
| /pessoas/gorjetas | Sistema de pontos gorjeta | gorjeta_* |
| /pessoas/vale-transporte | Vale transporte | transport_vouchers |
| /pessoas/treinamentos | Templates + registros | training_templates, training_records |
| /pessoas/avaliacoes | Avaliações de desempenho | performance_templates, performance_reviews |
| /pessoas/avaliacoes/ciclos | Ciclos 360° | avaliacao_ciclos, avaliacao_participantes |
| /pessoas/avaliacoes/9box | Matriz 9Box | performance_reviews |
| /pessoas/pdi | PDI + metas | pdis, pdi_metas |
| /pessoas/analytics | People Analytics (turnover, absenteísmo, headcount, time-to-hire) | employees, absences, vacations, job_openings |
| /pessoas/reunioes | Reuniões 1:1 | reunioes_1on1, reuniao_action_items |
| /pessoas/organograma | Árvore hierárquica CSS-only | employees (manager_id) |
| /pessoas/onboarding | Runs de onboarding | onboarding_runs, onboarding_checklist |
| /pessoas/onboarding/templates | Templates reutilizáveis | onboarding_templates, onboarding_tarefas |
| /pessoas/feedback | Feedback contínuo | feedbacks |
| /pessoas/documentos | Docs trabalhistas | employee_documents (Storage) |
| /pessoas/importacao | Import CSV Totvs | ponto_mensal |
| /pessoas/relatorio-ponto | Relatório de ponto | ponto_mensal |

### Outros módulos

| Rota | Módulo | Tabelas |
|------|--------|---------|
| /dashboard | KPIs gerais | views de agregação |
| /campanhas | Campanhas de marketing | — |
| /cardapio | Cardápio + ficha técnica | ingredients, recipe_items |
| /cliente | CRM de clientes | clients |
| /comercial/funil | Funil de vendas Kanban | — |
| /comercial/reservas | Reservas de mesa | reservations |
| /compras | Pedidos + fornecedores | purchase_orders, suppliers |
| /compras/cotacoes | Cotações | price_quotes |
| /compras/ingredientes | Cadastro ingredientes | ingredients |
| /eventos | O.S. de eventos | events, event_staff, event_menu_items |
| /financeiro | Hub financeiro — KPIs por marca | lancamentos, financial_periods (KPH OS) |
| /financeiro/fluxo | Fluxo de Caixa PDV real (workday) | workday_resumo, metas_projecoes (ops) |
| /financeiro/pagar | Contas a Pagar TOTVS | titulos_a_pagar (ops) |
| /financeiro/[brand_slug] | DRE por marca + lançamentos manuais | financial_periods, cash_flow_entries (KPH OS) |
| /inteligencia/metas | KPIs por marca | brand_targets |
| /inteligencia/wbr | Weekly Business Review | — |
| /marca | Brandbook e canais | brand_links |
| /marcas | Diretório de marcas | brands, brand_links |
| /operacao/auditorias | Checklists | quality_checklists, checklist_records |
| /operacao/mapa | Mapa de mesas | restaurant_tables |
| /orquestrador | Painel HOS | hos_runs, hos_jobs, hos_approvals |
| /recrutamento | Pipeline R&S | job_openings, candidates |

---

## 10. VARIÁVEIS DE AMBIENTE

| Variável | Onde usar | Descrição |
|----------|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Chave anon (RLS aplica) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Bypassa RLS — **NUNCA** no client bundle |
| `ANTHROPIC_API_KEY` | Server Only | Claude API para agentes e insights |
| `DISCORD_PUBLIC_KEY` | Server Only | Verificação Ed25519 de slash commands |
| `DISCORD_BOT_TOKEN` | Server Only | Token do bot ClaudeBridge |
| `DISCORD_APP_ID` | Server Only | 1498287829464256563 |
| `DISCORD_WEBHOOK_URL` | Server Only | Webhook do canal #orquestrador |
| `GITHUB_TOKEN` | Server Only | PAT para code review (lê diff, posta comment) |
| `GITHUB_WEBHOOK_SECRET` | Server Only | Verificação HMAC de webhooks do GitHub |
| `CRON_SECRET` | Server Only | Header `Authorization: Bearer $CRON_SECRET` nos crons Vercel |
| `QA_CALLBACK_SECRET` | Server Only | Autenticação do callback QA Playwright |
| `NEXT_PUBLIC_APP_URL` | Client + Server | URL base (https://kph-os.vercel.app em prod) |
| `OPERATIONS_SUPABASE_URL` | Server Only | Supabase Meet & Eat (laodipuodgrpqykrupms) — Financeiro/Operações |
| `OPERATIONS_SUPABASE_ANON_KEY` | Server Only | Anon key do banco de operações |
| `OPERATIONS_SUPABASE_SERVICE_KEY` | Server Only | Service role do banco de operações — **NUNCA** no bundle |
| `SCORE_THRESHOLD` | Server Only | Threshold score disciplinar (default: 70) — score_monitor |
| `BH_THRESHOLD_HOURS` | Server Only | Threshold banco de horas em horas (default: 40) — banco_horas_monitor |

---

## 11. LIBS INTERNAS IMPORTANTES

### `src/lib/result.ts`
```typescript
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

### `src/lib/pessoas/ponto-actions.ts` — tipo extendido
`registrarPunch` retorna `PunchActionResult` (não `ActionResult`) para incluir `minutosRestantes`:
```typescript
export type PunchActionResult =
  | { ok: true; data: TimeClockPunch }
  | { ok: false; error: string; minutosRestantes?: number };
```
Regras de negócio enforçadas server-side:
- Sequência obrigatória: `entrada → intervalo_inicio → intervalo_fim → saida`
- Máximo 4 registros por dia (SP timezone)
- `intervalo_inicio` bloqueado se < 60 min da `entrada` — retorna `minutosRestantes`

### `src/lib/format.ts`
- `formatBRL(v)` — formata número como moeda BRL (pt-BR)
- `formatDateBR(iso)` — converte "YYYY-MM-DD" para "DD/MM/AAAA"
- `initials(name)` — iniciais do nome (primeiro + último)
- `avatarColor(seed)` — hash determinístico → uma de 8 cores estáveis

### `src/lib/utils.ts`
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `src/lib/pessoas/clt.ts`
Cálculos CLT 2024/Sinthoresp (puro, sem Supabase/React):
- `calcINSS(salarioBruto)` — tabela progressiva 2024 (teto R$ 7.786,02)
- `calcIRRF(baseCalculo, dependentes)` — tabela progressiva 2024
- Constantes: `HORAS_MES = 220`, `DEDUCAO_DEPENDENTE = 189.59`

### `src/lib/pessoas/score.ts`
Score disciplinar (puro):
- `SCORE_BASE = 100`
- `WARNING_DELTA`: verbal=-10, escrita=-25, suspensao=-50
- `ABSENCE_DELTA`: injustificada=-5, justificada=0, atestado=0, falta_abono=0

### `src/lib/export.ts`
```typescript
downloadCsv(filename, headers, rows)  // exporta CSV com BOM UTF-8 via Blob
```
**ATENÇÃO:** client-side only — usar apenas em event handlers (onClick). Nunca em Server Actions.

### `src/lib/discord/notify.ts`
```typescript
sendDiscordMessage(content)  // POST para DISCORD_WEBHOOK_URL
```

---

## 12. WORKFLOW DE DESENVOLVIMENTO

### Passo a passo para implementar uma feature

1. **Criar branch:** `feat/nome-do-modulo` ou `fix/nome-do-bug`
2. **Migration SQL primeiro** se há mudanças no banco:
   - Criar `supabase/migrations/0XX_descricao.sql` (próximo número: **063**)
   - Aplicar **manualmente** no Supabase SQL Editor antes de mergear
3. **Server Actions** em `src/app/(dashboard)/modulo/actions.ts`:
   - `"use server"` no topo
   - `createServiceClient()` para mutações
   - Padrão `ActionResult<T>`
   - `requireUser()` no início
4. **Pages** (Server Components):
   - `export const dynamic = "force-dynamic"`
   - `await params` para rotas dinâmicas
5. **Client Components** (`*-client.tsx`):
   - `"use client"` no topo
   - `mounted` guard se necessário
   - `useTransition` + `useRouter` para ações assíncronas
6. **TypeScript check:** `npx tsc --noEmit` — deve passar sem erros
7. **Commit e PR:**
   ```bash
   git add arquivo1 arquivo2 arquivo3
   git commit -m "feat(modulo): descrição"
   git push origin feat/nome-do-modulo
   gh pr create --base main
   ```

### Convenções de branch e commit

- **Branches:** `feat/nome`, `fix/nome`, `chore/nome`, `debug/nome`
- **Commits:** `feat(scope): descrição` — português ou inglês
- **Scope:** nome do módulo (`pdi`, `reunioes`, `onboarding`, `orquestrador`, etc.)

### Fluxo de PR

1. PR aberto → Orquestrador detecta → Code Review automático (Claude analisa diff)
2. QA Playwright roda smoke tests no preview URL
3. Se tudo ok → merge manual no GitHub
4. Merge em `main` → Vercel deploya automaticamente em produção

---

## 13. ERROS COMUNS E SOLUÇÕES

### RLS bloqueando inserts/updates
**Sintoma:** Server Action retorna erro ou dados vazios sem motivo.
**Causa:** Usando `createSupabaseServerClient()` onde deveria ser `createServiceClient()`.
**Fix:** Mudar para `createServiceClient()` em Server Actions.

### params não awaited
**Sintoma:** `TypeError: Cannot destructure property 'id' of params`
**Causa:** Next.js 16 — `params` é `Promise<{...}>`.
**Fix:** `const { id } = await params;`

### Hydration mismatch
**Sintoma:** "Text content did not match. Server: '...' Client: '...'"
**Fix:** Adicionar `mounted` guard — renderizar conteúdo dinâmico só após `useEffect`.

### TypeScript: array index `possibly undefined`
**Sintoma:** `TS2322: Type 'T | undefined' is not assignable to type 'T'`
**Causa:** `noUncheckedIndexedAccess: true`
**Fix:** `array[i]!` quando certeza que existe, ou `array[i] ?? defaultValue`.

### TypeScript: circular inference em async loop
**Sintoma:** `TS7022: 'X' implicitly has type 'any' because it references itself`
**Fix:** Pré-carregar dados antes do loop, usar Map, iterar sem await.

### Supabase insert type error
**Sintoma:** `TS2345: Argument of type '...' is not assignable to parameter`
**Fix:** Cast `as never` ou `(supabase as any).from(...)` para tabelas não tipadas.

### Lucide icon `title` prop
**Sintoma:** `TS2322: Property 'title' does not exist`
**Fix:** Remover prop `title` do ícone; usar `<span title="...">` wrapper.

### hos_approvals FK quebra
**Sintoma:** `invalid input syntax for type uuid: "bypass"`
**Fix:** Sempre usar UUID `00000000-0000-0000-0000-000000000001`.

### Vercel webhook duplicado
**Sintoma:** Mesmo deployment cria dois `hos_runs`.
**Fix:** Campo `deployment_id` + UNIQUE INDEX em `(deployment_id, job_id)` — migration 046.

### Tailwind v4 sem config
**Sintoma:** Estilos não aplicam ao tentar criar `tailwind.config.ts`.
**Fix:** Não criar `tailwind.config.ts`. Customizações vão em `globals.css` com `@theme inline`.

### createServiceClient() retorna null
**Sintoma:** `Cannot read properties of null (reading 'from')`
**Causa:** `SUPABASE_SERVICE_ROLE_KEY` ausente no ambiente.
**Fix:** Sempre checar `if (!supabase) return { ok: false, error: "..." }`.

### downloadCsv no servidor
**Sintoma:** `Blob is not defined`
**Causa:** `downloadCsv()` usa APIs browser-only.
**Fix:** Chamar apenas em event handlers (onClick), nunca em Server Actions.

---

## 14. SISTEMAS SATÉLITES

Estes projetos **NÃO estão neste repo**, mas integram com o mesmo Supabase:

| Sistema | Repo | URL Prod | Stack | Dir local |
|---------|------|----------|-------|-----------|
| HOS App (mobile) | N/A | App Store/TestFlight | React Native + Expo SDK 54 | ~/Desktop/_ORKESTRI/_HOS_APP/ |
| Maya (R&S WhatsApp) | maya-kph | maya-kph-production.up.railway.app | FastAPI + Railway | ~/Desktop/_ORKESTRI/_MAYA/ |
| Theo (SAC WhatsApp) | theo-kph | theo-kph-production.up.railway.app | FastAPI + Railway | ~/Desktop/_ORKESTRI/_THEO/ |
| Serena (atendimento) | serena-kph | restaurant-ai-production-bb5d.up.railway.app | FastAPI + Railway | ~/Desktop/_ORKESTRI/_Serena/ |

**Atenção:** Serena usa **Supabase próprio** (não o iqgrvptrtphvbmvrqntm). Maya e Theo usam o Supabase do KPH OS para `candidatos_maya` e `theo_tickets`.

### HOS App — Mobile

- Expo SDK 54, 13 telas
- Auth próprio via `employee_auth` (CPF + senha, sem auth.users)
- Endpoint ponto: `POST /api/ponto/punch` (route handler no KPH OS)
- View `tips_records` para gorjetas (migration 044)
- Seed de `employee_auth` feito manualmente via Supabase SQL Editor

### Deploy dos satélites (Railway)

```bash
railway up   # não usar git push — Railway usa o CLI
```

---

## 15. COMPONENTES REUTILIZÁVEIS

### Shell
- `Sidebar` — navegação principal com grupos colapsáveis, persistência em localStorage
- `TopBar` — barra superior com breadcrumb e notificações
- `NotificationBell` — sino de notificações com polling

### UI (shadcn/ui em src/components/ui/)

`Button`, `Input`, `Label`, `Textarea`, `Select`, `Dialog`, `Badge`, `Card`, `Table`, `Tabs`, `Tooltip`, `Avatar`, `Sonner` (toasts), `Sheet` (drawer mobile), `Command` (cmdk), `DropdownMenu`, `InputGroup`

### Padrão de CSS

Projeto usa shadcn/ui v4 com variáveis CSS em `globals.css`. Tailwind v4 com `tw-animate-css` para animações. Estilos inline com `style={{ ... }}` são aceitos — não refatorar sem motivo.

---

## 16. BANCO DE OPERAÇÕES — MEET & EAT

Segundo Supabase conectado ao KPH OS. **Não tem RLS** — acesso exclusivo via service role no servidor.

- **Project ID:** `laodipuodgrpqykrupms`
- **URL:** `https://laodipuodgrpqykrupms.supabase.co`
- **Cliente:** `createOperationsClient()` em `src/lib/supabase/operations-client.ts`
- **Tipos:** `src/types/operations-database.ts`
- **Actions:** `src/app/(dashboard)/financeiro/actions-operations.ts`

### Tabelas disponíveis

| Tabela | Fonte | Dados |
|--------|-------|-------|
| `workday_resumo` | PDV Workday | KPIs diários completos: CMV%, ticket, lucro, bruto, acessos, pagamentos JSONB, ambientes, turnos, perfil de cliente. Dado mais rico do sistema. |
| `workday_venda` | PDV Workday | Vendas consolidadas por dia (simplificado) |
| `workday_produtos` | PDV Workday | Ranking de produtos com CMV por produto |
| `workday_grupos` | PDV Workday | Mix por categoria (Bebidas, Pratos, etc.) |
| `workday_caixas` | PDV Workday | Detalhes por caixa físico e operador |
| `workday_usuarios` | PDV Workday | Ranking de garçons/vendedores |
| `titulos_a_pagar` | ERP TOTVS | AP completo: fornecedor, CNPJ, vencimento, saldo, dias de atraso, situação, ref_mes (YYYY-MM-01) |
| `vendas_diarias` | Preenchimento manual | Backup/validação das vendas diárias por turno |
| `metas_projecoes` | Manual | Meta mensal + array `metas_diarias[seg..dom]` por dia da semana |
| `notas_nutri` | Auditoria | Notas de inspeção nutricional |
| `auditoria_nutricional` | Auditoria | Auditoria nutricional detalhada |
| `notas_detalhadas` | Auditoria | Scores por tópico/setor |

### Padrão de uso

```typescript
import { createOperationsClient } from "@/lib/supabase/operations-client";
import type { WorkdayResumo } from "@/types/operations-database";

// Sempre em Server Actions ou Route Handlers
const ops = createOperationsClient();
if (!ops) return { ok: false, error: "Operações indisponível" };

const { data } = await ops
  .from("workday_resumo")
  .select("data, bruto, lucro, cmv_pct, ticket_medio, acessos")
  .gte("data", "2026-05-01")
  .order("data", { ascending: false });
```

### Disponibilidade de dados

- `workday_resumo` e `workday_*`: sincronizado até **abril 2026** (PDV não importado para maio ainda)
- `titulos_a_pagar`: disponível para **abril 2026** (ref_mes = '2026-04-01')
- `metas_projecoes`: disponível para **maio 2026** (mes_ano = '2026-5')
- `vendas_diarias`: disponível para **maio 2026**

---

## 17. OBSERVAÇÕES FINAIS

1. **Migrations rodam manualmente.** Verificar no Supabase Dashboard antes de mergear.

2. **Atualizar este CLAUDE.md** sempre que houver mudanças arquiteturais: nova tabela, novo padrão, novo módulo.

3. **PRs mergeados até 12/05/2026:** #1 ao #33 (PDI, Reuniões, Organograma, Onboarding, Feedback, 9Box, etc.).

   **PRs abertos em 21/05/2026:**
   - **#34** `feat/score-banco-horas-monitors` — Score Monitor + Banco de Horas Monitor (aguarda merge)
   - **#32** `feat/people-analytics` — People Analytics (aguarda merge; conflito resolvido, rebased sobre main)
   - **#35** `feat/financeiro-operations` — Fluxo de Caixa PDV + Contas a Pagar TOTVS
   - **#36** `fix/ponto-validacao-server` — bucket punch-photos + validação server-side de sequência/1h + tela Gestão ao vivo

4. **Sprint 6 — backlog pendente:**
   - Login persistente (auth ativo para usuários reais)
   - Seed de `employee_auth` para HOS App
   - Discord Commander conversacional
   - DB Guardian (agente de monitoramento de banco)

5. **Tabela não está em `database.ts`?** Usar `(supabase as any).from("tabela")`. Acontece com migrations recentes antes de regenerar os tipos com `supabase gen types typescript`.

6. **Próxima migration:** número `063`. Verificar: `ls supabase/migrations/ | sort | tail -5`.

7. **Claude API model:** sempre `claude-sonnet-4-20250514` nos agentes do orquestrador.

8. **@tanstack/react-table** disponível para tabelas com sorting/filtering no client.

9. **Sonner** para toasts (importar de `src/components/ui/sonner.tsx`). Não usar `alert()` ou `window.confirm()`.

10. **Migrations 043 e 044** (`employee_auth` e `mobile_views`) estão no repositório mas verificar se foram aplicadas em produção antes de usar `employee_auth` ou a view `tips_records`.
