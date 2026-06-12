# Orkestri — Monorepo KPH

Sistema operacional de inteligência para hospitalidade do Grupo KPH.
Repo: `github.com/ikeguimaraes-dot/orkestri` (ex kph-os, fundido com kph-os-inteligencia em jun/2026).

## ⚠️ Antes de qualquer execução

Sempre confirme `pwd` e `git remote -v`. O clone correto é
`~/Desktop/_HOS/_ORKESTRI/_KPH-OS` com remote `git@github.com:ikeguimaraes-dot/orkestri.git`.
Ignore completamente os diretórios `_OLD_*_DELETAR`.

## Estrutura

```
apps/
  kph-os/         Shell — Vercel projeto "kph-os" (rootDir apps/kph-os), multi-zones:
                  /inteligencia, /pessoas, /financeiro etc. são proxiados via rewrites
                  para os apps-célula. NÃO remover assetPrefix/rewrites sem entender isso.
  inteligencia/   Vercel projeto "kph-os-inteligencia" (rootDir apps/inteligencia).
                  Cron Learning Machine: vercel.json deste app, sexta 11h UTC (8h BRT).
packages/
  core/           @kph/core — KERNEL. score-policy.ts e learning-machine.ts vivem
                  SOMENTE aqui. Nunca criar cópias locais nos apps.
  auth/ db/ ui/   @kph/auth, @kph/db, @kph/ui — pacotes fonte TS (transpilePackages).
supabase/
  migrations/     Pasta ÚNICA de migrations. Próxima: 080. Duplicatas históricas
                  documentadas em supabase/MIGRATIONS.md — não renomear aplicadas.
```

## Regras

- **Migrations**: via `supabase db query --linked --file` — NUNCA `db push`. Numeração única a partir de 080 (ver `supabase/MIGRATIONS.md`).
- **score-policy / learning-machine**: alterações só em `packages/core`. Os dois apps importam `@kph/core` e `@kph/core/learning-machine`. A notificação Discord da LM é injetada pelo caller (`opts.notify`) — o core não conhece Discord.
- **Crons**: NÃO criar `vercel.json` na raiz do repo (o root directory dos projetos Vercel é apps/* — vercel.json na raiz é ignorado e cria falsa sensação de cron ativa). A ativação seletiva dos crons do shell (daily-summary, lorean-import, monitores do orchestrator) está PENDENTE — decisão do Ike, mudança separada criando vercel.json em `apps/kph-os`.
- **Deploys**: produção do shell historicamente sai via CLI `--prebuilt` (bot) — a Vercel pode não buildar o main. Antes de mexer em deploy, rode `npm run build` (turbo, 2 apps) e `npm run type-check` localmente.
- **Build local**: o Turbopack root está fixado nos next.config (`turbopack.root`) por causa de lockfile perdido na HOME — não remover.
- Segredos nunca inline — só env vars referenciadas por nome.
- Idempotência: executar 2× nunca duplica. Sucesso só com confirmação no banco.
- Event handlers nunca em Server Components — extrair Client Component.

## Supabase

Projeto principal: `iqgrvptrtphvbmvrqntm` (compartilhado pelos 2 apps e células).
Serena (isolado): `fgntcrxuhfwcauvahaiz`.
