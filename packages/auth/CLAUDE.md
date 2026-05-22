# @kph/auth — Autenticação e Autorização

Pacote compartilhado que centraliza **toda a lógica de auth** do KPH OS.

## Conteúdo

| Arquivo | Exporta | Tipo |
|---------|---------|------|
| `context.tsx` | `AuthProvider`, `useAuth()`, `useUnit()` | `"use client"` — Client Component |
| `server.ts` | `requireUser()`, `getCurrentUser()`, `requireRole()`, `isFounder()` | Server-only (usa `cache` do React, `cookies()`) |
| `unit.ts` | `getCurrentUnit()` | Server-only |

## Como importar

```typescript
// Em Client Components:
import { useAuth, useUnit } from "@kph/auth/context";

// Em Server Components e Server Actions:
import { requireUser, getCurrentUser, requireRole, isFounder } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
```

## Bypass Dev

```typescript
// requireUser() retorna o bypass user quando não há sessão:
// ID: 00000000-0000-0000-0000-000000000001 (bypass@kph.os, role: founder)
```

## Regras

- `context.tsx` é `"use client"` — **nunca importar em Server Components**
- `server.ts` usa `cache()` do React e `cookies()` do Next.js — **nunca importar em Client Components**
- Depende apenas de `@kph/db` (sem deps diretas para o app)
