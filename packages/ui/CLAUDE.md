# @kph/ui — Componentes UI Compartilhados

Pacote de **primitivos UI** baseados em shadcn/ui para compartilhamento entre todos os apps do workspace KPH.

## Conteúdo

### `src/ui/` — 17 componentes shadcn/ui
`avatar` · `badge` · `button` · `card` · `command` · `dialog` · `dropdown-menu` · `input` · `input-group` · `label` · `select` · `sheet` · `sonner` · `table` · `tabs` · `textarea` · `tooltip`

### `src/utils.ts`
Função `cn()` (tailwind-merge + clsx) usada internamente pelos componentes.

## Como importar

```typescript
import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import { Badge } from "@kph/ui/badge";
import { cn } from "@kph/ui/utils";
```

## O que NÃO está neste pacote

- `shell/` (Sidebar, TopBar, NotificationBell) — ficam em `apps/kph-os/src/components/shell/` porque dependem de `notifications/actions` (app-specific), o que criaria dependência circular
- `dashboard/` (KpiCard, AlertasPanel, etc.) — ficam no app por dependerem de `lib/dashboard/utils`, `lib/eventos/labels` e tipos de Server Actions
- Componentes de domínio (pessoas/, eventos/, financeiro/) — sempre ficam no app que os usa

## Regras

- Componentes aqui são **agnósticos de domínio** — zero imports de `@/lib/` do app
- Imports internos usam caminhos relativos (`../utils`, `./button`) — não `@/`
- Tailwind v4: sem `tailwind.config.ts`. O app consumidor precisa de `transpilePackages: ["@kph/ui"]` no `next.config.ts`
