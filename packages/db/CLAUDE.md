# @kph/db — Supabase Clients + Database Types

Pacote compartilhado que centraliza **todos os clientes Supabase** e **todos os tipos TypeScript** do banco de dados KPH OS.

## Conteúdo

### `src/supabase/`
| Arquivo | Exporta | Uso |
|---------|---------|-----|
| `client.ts` | `getBrowserClient()` | Client Components — usa anon key, RLS aplica |
| `server.ts` | `createSupabaseServerClient()`, `createServiceClient()` | Server Actions (service role) e Server Components (session) |
| `proxy.ts` | helper de middleware | Renovação de token via cookie |
| `operations-client.ts` | `createOperationsClient()`, `createOperationsAnonClient()` | Banco Meet & Eat (mesmas credenciais — sem banco separado após Sprint 1) |

### `src/types/`
| Arquivo | Conteúdo |
|---------|---------|
| `database.ts` | Tipos gerados pelo Supabase CLI (migrations 001–062) |
| `operations-database.ts` | Tipos manuais das 12 tabelas de operações Meet & Eat |
| `pessoas.ts` | Tipos adicionais de RH |
| `compras-ingredientes.ts` | Tipos de compras e ingredientes |
| `index.ts` | Re-exports de tipos comuns |

## Como importar

```typescript
// Clientes Supabase
import { createServiceClient } from "@kph/db/supabase/server";
import { getBrowserClient } from "@kph/db/supabase/client";

// Tipos
import type { Database } from "@kph/db/types/database";
import type { VendaDiaria } from "@kph/db/types/operations-database";
```

## Regras

- **NUNCA** exportar `SUPABASE_SERVICE_ROLE_KEY` em qualquer export deste pacote
- `createServiceClient()` retorna `SupabaseClient | null` — sempre checar antes de usar
- Sem RLS nas tabelas de operações — acesso exclusivo via `createServiceClient()`
