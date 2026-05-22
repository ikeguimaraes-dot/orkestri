# apps/kph-os — KPH OS (Monolito Principal)

ERP de hospitalidade multi-tenant da KPH Participações. Next.js 16.2.4, React 19, Tailwind v4, Supabase.

## Posição no workspace

```
packages/db   → @kph/db   (Supabase clients + DB types)
packages/auth → @kph/auth (Auth utilities)
packages/ui   → @kph/ui   (shadcn/ui primitives)
        ↓ todos importados por
apps/kph-os   ← você está aqui
```

## Imports dos packages

```typescript
// Supabase
import { createServiceClient } from "@kph/db/supabase/server";
import { getBrowserClient }    from "@kph/db/supabase/client";

// Tipos do banco
import type { Database }         from "@kph/db/types/database";
import type { VendaDiaria }      from "@kph/db/types/operations-database";

// Auth
import { requireUser }           from "@kph/auth/server";
import { useAuth, useUnit }      from "@kph/auth/context";

// UI primitives
import { Button }                from "@kph/ui/button";
import { Input }                 from "@kph/ui/input";
```

## O que FICA neste app (não extraído para packages)

- `src/lib/` — toda a lógica de domínio (pessoas, financeiro, eventos, compras, etc.)
- `src/components/shell/` — Sidebar, TopBar, NotificationBell (deps de notifications/actions)
- `src/components/dashboard/` — KpiCard, AlertasPanel, etc. (deps de lib/dashboard/utils)
- `src/components/pessoas/`, `eventos/`, `financeiro/` — componentes de domínio
- `src/lib/utils.ts` — `cn()` para uso no app (@kph/ui tem cópia própria)

## Dev

```bash
# A partir da raiz do workspace:
npm run dev        # turbo dev (roda todos os apps)

# Ou direto neste app:
cd apps/kph-os && npm run dev
```

## Documentação completa

Ver `../../.claude/CLAUDE.md` (guia permanente do projeto KPH OS).
