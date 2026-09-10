# PROJECT_MANUAL — kph-os (Shell)

## Regra de ouro

**Rotas, sidebar, middleware e rewrites vivem no shell (`kph-os`).  
Telas e lógica vivem nas zonas (kph-os-marca, kph-os-pessoas, etc.).  
Toda mudança de rota = commit no shell.**

---

## Arquitetura de zonas

O shell (`kph-os.vercel.app`) é o único ponto de entrada. Ele:
- Controla autenticação (session cookie + middleware)
- Define a navegação global (`src/lib/nav-config.ts`)
- Faz proxy das rotas para os sub-apps via `rewrites` em `next.config.ts`

### Mapa de zonas (set/2026)

| Prefixo | Sub-app | Vercel |
|---|---|---|
| `/financeiro` | kph-os-financeiro | kph-os-financeiro.vercel.app |
| `/pessoas` | kph-os-pessoas | kph-os-pessoas.vercel.app |
| `/operacao` | kph-os-operacao | kph-os-operacao.vercel.app |
| `/compras` | kph-os-compras | kph-os-compras.vercel.app |
| `/comercial` | kph-os-ruptura | kph-os-ruptura.vercel.app |
| `/marca` | kph-os-marca | kph-os-marca.vercel.app |
| `/escritorio` | kph-os-marca | kph-os-marca.vercel.app |
| `/clientes` | kph-os-marca | kph-os-marca.vercel.app |
| `/frentes` | kph-os-marca | kph-os-marca.vercel.app |
| `/inteligencia` | kph-os-inteligencia | kph-os-inteligencia.vercel.app |
| `/orquestrador` | kph-os-inteligencia | kph-os-inteligencia.vercel.app |

### Middleware de cada sub-app

Cada sub-app tem `src/middleware.ts` que redireciona requisições vindas de host
diferente do shell para `kph-os.vercel.app`. Garante que os sub-apps não sejam
acessados diretamente em produção.

---

## Redirects permanentes (308)

Rotas antigas redirecionam para as novas via `redirects()` em `next.config.ts`.
Redirects têm prioridade sobre rewrites (são checados antes).

| Origem | Destino | Motivo |
|---|---|---|
| `/marcas` | `/clientes` | Sprint B set/2026 — unificação |
| `/marca` | `/clientes` | Sprint B set/2026 — unificação |
| `/marca/:path*` | `/clientes` | Sprint B set/2026 — unificação |

---

## Sidebar — grupo MARCA (set/2026)

Configurado em `src/lib/nav-config.ts`, grupo `id: "marca"`.

| Item | Rota | Zona |
|---|---|---|
| Escritório | `/escritorio` | kph-os-marca |
| Frentes | `/frentes` | kph-os-marca |
| Clientes | `/clientes` | kph-os-marca |
| Dashboard | `/frentes/dashboard` | kph-os-marca |

---

## Como adicionar uma nova rota de zona

1. Adicionar entrada em `zones` no `next.config.ts` (variável de ambiente + porta local + host produção)
2. Atualizar `nav-config.ts` com o item do sidebar
3. No sub-app: adicionar a rota à lista `matcher` do `src/middleware.ts`
4. Commitar **nos dois repos** e aguardar deploy
