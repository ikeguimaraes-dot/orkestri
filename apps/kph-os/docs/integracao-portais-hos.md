# Integração dos Portais HOS no KPH OS

Mapeamento das 3 plataformas externas e plano de absorção dentro do KPH OS.

---

## 1. Estado atual — o que existe fora

### A. `hos-oseventos.vercel.app` — **O.S. Eventos** (app real com dados)
Sistema de Ordem de Serviço para eventos, multi-casa, Português. Hospedado no Vercel.

- Páginas: `/` Dashboard · `/eventos` · `/eventos/novo` · `/usuarios` · `/minha-senha`
- Casas vinculadas: **Meet & Eat**, **Madonna Cucina** (e provavelmente as outras 10 do Grupo HOS)
- Entidades:
  - **Eventos / O.S.** — status (`rascunho`, `confirmado`, `em_andamento`, `concluido`, `cancelado`); tipos (`corporativo`, `comemoracao`, `festa`, `aniversario`, `jantar`, `almoco`, `cafe`, `fotografia`, `palestra`, `outros`)
  - **Detalhes do evento**: nº convidados, contato, status pagamento, cardápio bar/cozinha com timing, tipo de setup + planta anexa, infraestrutura (manobrista, ambulância, gerador, DJ/banda, foto)
  - **Usuários**: roles `operacional`, `comercial`, `admin`; vinculados a casas
  - **Anexos**: PDF/JPG/PNG
- Stack provável: SPA (Vercel) com backend próprio (Supabase ou similar)

### B. `portal-grupohos.netlify.app` — **Hub de Marcas** (índice estático)
Página única de navegação que aponta para 12 sub-portais Netlify, um por marca.

| Marca | Sub-portal |
|---|---|
| Meet & Eat | `portal-meet.netlify.app` |
| Madonna | `portal-madonna.netlify.app` |
| Match Point | `portal-match.netlify.app` |
| The Forge | `portal-theforge.netlify.app` |
| Klauss | `portal-klauss.netlify.app` |
| HOS Diretoria | `portal-diretoriahos.netlify.app` |
| Pipokaê | `portal-pipokae.netlify.app` |
| PIPOU Academy | `portal-pipou-academy.netlify.app` |
| Sushi Muu | `portal-sushimuu.netlify.app` |
| Rojo | `portal-rojo.netlify.app` |
| Burguer | `portal-burguer.netlify.app` |
| Trato | `portal-trato.netlify.app` |

Cada sub-portal é praticamente o **mesmo template estático**: 3 botões — `Arquivos` (Google Drive da marca), `Dashboard` (link p/ vercel/looker), `Site` (Instagram). Não há login, não há dados gerenciados — é um marcador.

### C. `portal-hoscity.netlify.app` — **HOS CITY** (showcase público)
Site institucional do portfólio do Grupo Hospitalidade São Paulo. Apresenta as 11 marcas com tagline, ticket médio, conceito. **Marketing externo**, não operacional. Não pertence ao KPH OS.

---

## 2. Estado atual — o que já existe no KPH OS

### Stack
Next.js 16.2.4 · React 19 · TypeScript · Tailwind 4 · shadcn (Base UI) · Supabase SSR · TanStack Query · React Hook Form + Zod · `@react-pdf/renderer`

### Modelo de domínio (migrations 001–006)
- **Multi-tenant**: `groups` → `brands` → `units` (já existe: holding KPH → marca Madonna Cucina → unidade SP Itaim no seed)
- **RBAC**: `roles` (`founder`, `cfo`, `gm`, `pessoas`, `chef`, `comprador`, `colaborador`, `socio_readonly`) + `user_roles` escopados a unit/brand/group; helpers `kph_is_founder()`, `kph_has_role_for_unit()`, `kph_has_role_for_brand()`
- **Audit log**: tabela `audit_log`
- **Pessoas**: `employees`, `dependents`, `shifts`, `time_clock_punches`, `time_bank_balance`, `payslips`, `cct_versions`, `absences`, `warnings`, `score_events`
- **ETL**: [scripts/etl-hos-to-kph.ts](../scripts/etl-hos-to-kph.ts) já lê o **HOS RH** (Supabase `afxsrcezmetipzgosdvb`) e migra employees/payslips/absences/warnings/dependents para o KPH

### Rotas vivas
- `(auth)/login`
- `(dashboard)/page.tsx` (home)
- `(dashboard)/pessoas/{colaboradores,disciplina,escala,holerites,ponto}`
- `api/holerites/[id]` e `api/holerites/generate`
- `ponto/` (provável bater-ponto público)

---

## 3. Plano de integração

A regra: **KPH OS = único sistema operacional do grupo**. Os 3 sites externos viram módulos internos (ou são descontinuados quando redundantes).

### Fase E1 — Marcas & Unidades (1–2 dias)
Materializar as 12 marcas do Grupo HOS no schema atual.

- Migration `007_brands_seed_hos.sql`: insere todas as marcas + units conhecidas, com slugs alinhados aos sub-portais (`meet-eat`, `madonna-cucina`, `match-point`, `the-forge`, `klauss`, `pipokae`, `pipou-academy`, `sushi-muu`, `rojo`, `burguer`, `trato`)
- Tabela `brand_links` (nova): armazena por marca os links externos consolidados — `drive_url`, `instagram_url`, `dashboard_url`, `site_url`. Substitui os 12 sub-portais Netlify.
- Página `(dashboard)/marcas/page.tsx`: grid das marcas com avatar/cor + 3 botões. Substitui `portal-grupohos.netlify.app` e todos os `portal-{marca}.netlify.app`.
- Página `(dashboard)/marcas/[slug]/page.tsx`: detalhe da marca + lista de unidades + link rápido para os módulos contextualizados (Pessoas, Eventos etc.).

**Resultado**: 13 sites Netlify viram 1 módulo no KPH OS.

### Fase E2 — Módulo Eventos / O.S. (5–8 dias)
Reimplementar o `hos-oseventos` dentro do KPH OS reusando RBAC e multi-tenant.

- Migration `008_eventos.sql`:
  - `events` (id, unit_id, status, type, data_evento, hora_inicio, hora_fim, num_convidados, contato_nome, contato_telefone, contato_email, valor_total, status_pagamento, setup_tipo, setup_planta_url, observacoes, created_by, created_at, updated_at)
  - `event_menu_items` (event_id, categoria `bar`/`cozinha`, item, horario, observacao)
  - `event_infrastructure` (event_id, manobrista bool, ambulancia bool, gerador bool, dj_banda TEXT, fotografia bool, outros TEXT)
  - `event_attachments` (event_id, kind, url, uploaded_by)
  - RLS: `kph_has_role_for_unit(unit_id)` em todas — espelha padrão pessoas
  - Roles novos? Reuso `gm` + `comercial` (precisa criar `comercial` no `roles`) + `operacional` (idem)
- Páginas:
  - `(dashboard)/eventos/page.tsx` — listagem com filtros por casa/status/data
  - `(dashboard)/eventos/novo/page.tsx` — wizard multi-seção (espelha o form atual)
  - `(dashboard)/eventos/[id]/page.tsx` — visão completa + edição
- Componentes: `EventStatusBadge`, `EventForm`, `MenuPlanner`, `InfraChecklist`, `AttachmentUploader`
- Storage: bucket Supabase `event-attachments` para PDF/PNG/JPG
- ETL opcional: importar eventos existentes do `hos-oseventos` se houver banco acessível (similar ao ETL HOS RH)

**Resultado**: `hos-oseventos.vercel.app` desativado, dados consolidados no KPH.

### Fase E3 — Diretoria / Dashboards consolidados (3 dias)
Substitui `portal-diretoriahos.netlify.app` e os "Dashboard" links das marcas.

- `(dashboard)/page.tsx` (home) vira o dashboard executivo de fato — KPIs por marca/unidade: faturamento, headcount, eventos do mês, advertências em aberto
- `(dashboard)/marcas/[slug]/dashboard/page.tsx` por marca

Pode reusar dados que já estão sendo escritos por Pessoas + Eventos. Sem novo schema; apenas views/queries.

### Fase E4 — HOS CITY (sem ação obrigatória)
`portal-hoscity.netlify.app` é site público de marketing. **Não migrar para o KPH OS.** Pode ficar como está, ou ser portado para um Next.js separado em `apps/marketing/` quando houver demanda. Decisão fora do escopo do OS.

---

## 4. Backlog — coisas que fiquei na dúvida

- O `hos-oseventos` tem backend acessível? Se sim, qual Supabase/URL? Sem isso, ETL de eventos exige scraping ou export manual.
- Os "Arquivos" de cada marca apontam para Drives separados ou um Drive comum? Se separados, mantém ponteiro; se há intenção de unificar, vira módulo `arquivos` próprio (storage no Supabase).
- Os "Dashboard" Vercel/Looker de cada marca são feitos à mão ou geram-se de uma tool? Vale entender antes de replicar.
- Já existe role `comercial` ou `operacional` no `roles`? (Hoje `001` só tem `founder, cfo, gm, pessoas, chef, comprador, colaborador, socio_readonly`. O O.S. Eventos precisa de `comercial` e `operacional`.)

---

## 5. Sequência recomendada de execução

1. **E1** primeiro — entrega visível em horas, valida o domínio multi-marca.
2. **E2** em paralelo a E1 (schema separado, rotas separadas).
3. **E3** depois que E2 estiver populando dados de eventos.
4. **E4** fica só como decisão de produto.
