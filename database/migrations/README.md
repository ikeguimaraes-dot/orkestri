# Migrations

Cada arquivo `.sql` aqui é uma mudança versionada do schema Supabase.

## Como aplicar

### Local (Supabase CLI rodando)
```bash
# do diretório orkestri/
supabase db reset          # reseta e aplica TUDO (apaga dados)
# OU incremental:
psql "$DATABASE_URL" -f database/migrations/001_categories.sql
```

### Produção / Preview (Vercel + Supabase remoto)
```bash
# pega connection string do painel Supabase → Project Settings → Database
psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
    -f database/migrations/001_categories.sql
```

## Histórico

| #  | Arquivo              | Descrição                                                        |
|----|----------------------|------------------------------------------------------------------|
| 001 | `001_categories.sql` | Tabela `categories` + N:N `user_categories` (módulos visíveis) |

## Convenções

- Toda migration é idempotente onde possível (`IF NOT EXISTS`, `CREATE OR REPLACE`).
- Nomes snake_case.
- Sempre criar índices pra FKs (`user_id`, `category_id`).
- RLS ligado com policies explícitas — sem deixar "aberto por default".
- Founders sempre bypassam RLS via `kph_is_founder()` (já existente).
- Após migration, atualizar `packages/db/src/types/database.ts` com as novas
  tabelas (Row / Insert / Update) — senão o TS reclama nos `.from(...)`.

## Validação pós-apply

```sql
-- 1. Catálogo populado
SELECT slug, name, sort_order FROM public.categories ORDER BY sort_order;
-- Esperado: 8 linhas (home, operacao, compras, financeiro, pessoas,
--              comercial, marca, inteligencia)

-- 2. RLS funcionando (autenticado lê, mas só founder escreve)
SELECT * FROM public.categories;

-- 3. Testar grant
INSERT INTO public.user_categories (user_id, category_id)
VALUES (
  '<uuid-do-user>',
  (SELECT id FROM public.categories WHERE slug = 'financeiro')
);

-- 4. Conferir que o user aparece no sidebar só com o Financeiro
```

## Teste manual no shell

1. Rodar migration no Supabase remoto
2. Deploy do shell (Vercel) — pega os novos tipos do `database.ts`
3. Logar como founder → sidebar mostra grupo **Admin** → entrar em
   `/admin/categorias`
4. Selecionar as categorias pra um usuário de teste (que NÃO é founder)
5. Logar com esse usuário → sidebar deve mostrar apenas os módulos marcados
6. Promover o mesmo user a founder → sidebar mostra tudo (bypass)
