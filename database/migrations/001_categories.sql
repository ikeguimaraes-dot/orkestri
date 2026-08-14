-- ============================================================================
-- 001_categories.sql
-- Cria a tabela `categories` (módulos de produto: Financeiro, Compras, etc.)
-- e a tabela N:N `user_categories` ligando usuários a categorias.
--
-- Modelo:
--   - `roles`     → cargo / papel do usuário (founder, gerente, colaborador)
--   - `categories` → módulos de produto (financeiro, compras, pessoas, ...)
--   - `user_categories` → quais módulos o usuário enxerga no sidebar
--
-- Categorias são ortogonais às roles: um usuário pode ser "gerente" mas só
-- ter acesso ao módulo Financeiro. Founder sempre vê tudo (regra aplicada
-- na aplicação, não no banco — RLS usa kph_is_founder()).
-- ============================================================================

BEGIN;

-- ── 1. Catálogo de categorias ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    description text,
    icon        text,                              -- nome de ícone lucide (opcional)
    sort_order  integer     NOT NULL DEFAULT 0,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.categories              IS 'Módulos de produto do KPH OS (Financeiro, Compras, Pessoas, etc.). Ortogonal a roles.';
COMMENT ON COLUMN public.categories.slug         IS 'Identificador estável (kebab/snake). Usado em NAV_CONFIG e em queries.';
COMMENT ON COLUMN public.categories.icon         IS 'Nome do ícone lucide-react correspondente (ex: Wallet).';
COMMENT ON COLUMN public.categories.sort_order   IS 'Ordem de exibição na UI admin (menor = primeiro).';

-- Trigger genérico de updated_at (reaproveita padrão se já existir)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── 2. Seed das 7 categorias que correspondem aos grupos do NAV_CONFIG ─────
INSERT INTO public.categories (slug, name, description, icon, sort_order)
VALUES
    ('home',         'Dashboard',      'Visão geral executiva do KPH OS.',                 'LayoutDashboard', 0),
    ('operacao',     'Operação',       'Mapa da casa, eventos, manutenção, performance.',  'TrendingUp',      1),
    ('compras',      'Compras',        'Pedidos, estoque, fornecedores, CMV.',            'ShoppingCart',    2),
    ('financeiro',   'Financeiro',     'DRE, fluxo de caixa, contratos, conciliação.',    'Wallet',          3),
    ('pessoas',      'Pessoas',        'DP, recrutamento, DHO, folha.',                   'Users',           4),
    ('comercial',    'Comercial',      'CRM, reservas, eventos/OS, campanhas.',           'Handshake',       5),
    ('marca',        'Marca',          'BrandBook, canais, reputação.',                   'Bookmark',        6),
    ('inteligencia', 'Inteligência',   'Metas, WBR, roadmap, orquestrador.',              'Brain',           7)
ON CONFLICT (slug) DO UPDATE
    SET name        = EXCLUDED.name,
        description = EXCLUDED.description,
        icon        = EXCLUDED.icon,
        sort_order  = EXCLUDED.sort_order,
        is_active   = true;

-- ── 3. Tabela N:N usuário ↔ categoria ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
    category_id uuid        NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    granted_at  timestamptz NOT NULL DEFAULT now(),
    granted_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_id     ON public.user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_category_id ON public.user_categories(category_id);

COMMENT ON TABLE public.user_categories IS 'Quais módulos cada usuário enxerga. Vazio = vê só Dashboard (a menos que seja founder).';

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- Categorias: qualquer autenticado pode LER (precisa pra montar o sidebar).
DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Categorias: só founder gerencia.
DROP POLICY IF EXISTS categories_admin ON public.categories;
CREATE POLICY categories_admin ON public.categories
    FOR ALL TO authenticated
    USING (public.kph_is_founder())
    WITH CHECK (public.kph_is_founder());

-- user_categories: usuário lê os próprios vínculos.
DROP POLICY IF EXISTS user_categories_select_own ON public.user_categories;
CREATE POLICY user_categories_select_own ON public.user_categories
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- user_categories: founder pode ler tudo (pra UI admin listar todos users).
DROP POLICY IF EXISTS user_categories_select_all_founder ON public.user_categories;
CREATE POLICY user_categories_select_all_founder ON public.user_categories
    FOR SELECT TO authenticated
    USING (public.kph_is_founder());

-- user_categories: founder gerencia INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS user_categories_admin ON public.user_categories;
CREATE POLICY user_categories_admin ON public.user_categories
    FOR ALL TO authenticated
    USING (public.kph_is_founder())
    WITH CHECK (public.kph_is_founder());

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (rodar separado, fora da transação):
--
--   SELECT slug, name FROM public.categories ORDER BY sort_order;
--   -- Esperado: 8 linhas (home, operacao, compras, financeiro, pessoas,
--   --              comercial, marca, inteligencia)
--
--   SELECT user_id, category_id FROM public.user_categories;
--   -- Vazio por padrão. Popular via /admin/categorias.
-- ============================================================================
