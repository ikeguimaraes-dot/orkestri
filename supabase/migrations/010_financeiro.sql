-- KPH OS — 010_financeiro.sql
-- Fase E4 — módulo Financeiro: períodos, projeção, lançamentos, CMV,
-- aprovações, config por marca + DRE/gap/CMV/aprovações em views.
-- DEPRECATED: cmv_items renamed to menu_items in migration 028 (nunca rodou em produção).
--
-- Aditivo: zero ALTER em tabelas existentes.
-- Idempotente: tipos via DO/EXCEPTION, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS antes de cada CREATE POLICY, CREATE OR REPLACE
-- pra functions e views.
--
-- Pré-req: 001 (groups/brands/units/RBAC) · 008 (events).

-- ── ENUMS ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lancamento_natureza AS ENUM ('receita','despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lancamento_regime AS ENUM ('caixa','competencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lancamento_status AS ENUM (
    'rascunho','pendente_aprovacao','aprovado','rejeitado','pago','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_receita AS ENUM (
    'vendas_salao',
    'vendas_delivery',
    'vendas_bar',
    'eventos_private_dining',
    'gorjeta',
    'outras_receitas'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_despesa AS ENUM (
    -- CMV
    'cmv_cozinha','cmv_bar','cmv_delivery',
    -- Folha
    'folha_salarios','folha_encargos','folha_beneficios','folha_gorjeta_repasse',
    -- Ocupação
    'aluguel','condominio','iptu',
    -- Utilidades
    'energia_eletrica','gas','agua','telefone_internet',
    -- Operacional
    'manutencao','limpeza_higiene','uniformes_epi','descartaveis_embalagens',
    -- Comercial
    'marketing_publicidade','delivery_taxas_plataforma','comissoes',
    -- Administrativo
    'contabilidade','juridico','seguros','software_sistemas','cartao_taxas',
    -- Tributos
    'pis_cofins','irpj_csll','iss','outros_tributos',
    -- Capex
    'depreciacao','investimento_capex',
    -- Outros
    'outras_despesas'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABELAS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(id),
  brand_id      UUID NOT NULL REFERENCES brands(id),
  unit_id       UUID REFERENCES units(id),
  competencia   DATE NOT NULL,                     -- sempre dia 1 do mês
  status        TEXT NOT NULL DEFAULT 'aberto',    -- aberto | fechado | revisao
  fechado_por   UUID REFERENCES auth.users(id),
  fechado_at    TIMESTAMPTZ,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, unit_id, competencia)
);

CREATE TABLE IF NOT EXISTS cash_flow_projections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id          UUID NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  natureza           lancamento_natureza NOT NULL,
  categoria_receita  categoria_receita,
  categoria_despesa  categoria_despesa,
  descricao          TEXT,
  valor_projetado    NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_evento          BOOLEAN DEFAULT FALSE,
  criado_por         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (natureza = 'receita' AND categoria_receita IS NOT NULL AND categoria_despesa IS NULL) OR
    (natureza = 'despesa' AND categoria_despesa IS NOT NULL AND categoria_receita IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS cash_flow_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           UUID NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  natureza            lancamento_natureza NOT NULL,
  categoria_receita   categoria_receita,
  categoria_despesa   categoria_despesa,
  descricao           TEXT NOT NULL,
  valor               NUMERIC(14,2) NOT NULL,
  data_lancamento     DATE NOT NULL,
  data_vencimento     DATE,
  data_pagamento      DATE,
  status              lancamento_status NOT NULL DEFAULT 'rascunho',
  regime              lancamento_regime NOT NULL DEFAULT 'caixa',
  fornecedor          TEXT,
  numero_documento    TEXT,
  centro_custo        TEXT,
  event_id            UUID REFERENCES events(id),
  -- flag coarse: > R$3K dispara revisão. Decisão real usa brand_financial_config.
  requer_aprovacao    BOOLEAN GENERATED ALWAYS AS (valor > 3000) STORED,
  aprovado_por        UUID REFERENCES auth.users(id),
  aprovado_at         TIMESTAMPTZ,
  rejeitado_por       UUID REFERENCES auth.users(id),
  rejeitado_at        TIMESTAMPTZ,
  motivo_rejeicao     TEXT,
  criado_por          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (natureza = 'receita' AND categoria_receita IS NOT NULL AND categoria_despesa IS NULL) OR
    (natureza = 'despesa' AND categoria_despesa IS NOT NULL AND categoria_receita IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS cmv_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           UUID NOT NULL REFERENCES brands(id),
  unit_id            UUID REFERENCES units(id),
  nome               TEXT NOT NULL,
  categoria          TEXT NOT NULL,
  preco_venda        NUMERIC(10,2) NOT NULL,
  custo_total        NUMERIC(10,2),
  cmv_pct            NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN preco_venda > 0 AND custo_total IS NOT NULL
      THEN ROUND((custo_total / preco_venda) * 100, 2)
      ELSE NULL
    END
  ) STORED,
  tem_ficha_tecnica  BOOLEAN DEFAULT FALSE,
  ativo              BOOLEAN DEFAULT TRUE,
  observacoes        TEXT,
  criado_por         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          UUID NOT NULL REFERENCES cash_flow_entries(id) ON DELETE CASCADE,
  brand_id          UUID NOT NULL REFERENCES brands(id),
  solicitante_id    UUID NOT NULL REFERENCES auth.users(id),
  aprovador_id      UUID REFERENCES auth.users(id),
  valor             NUMERIC(14,2) NOT NULL,
  descricao         TEXT NOT NULL,
  justificativa     TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente', -- pendente | aprovado | rejeitado
  respondido_em     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_financial_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                 UUID NOT NULL REFERENCES brands(id) UNIQUE,
  threshold_aprovacao      NUMERIC(10,2) NOT NULL DEFAULT 5000,
  meta_cmv_pct             NUMERIC(5,2) DEFAULT 28.0,
  meta_ebitda_pct          NUMERIC(5,2) DEFAULT 18.0,
  meta_prime_cost_pct      NUMERIC(5,2) DEFAULT 60.0,
  alerta_desvio_pct        NUMERIC(5,2) DEFAULT 5.0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: thresholds reais por marca operacional
INSERT INTO brand_financial_config (brand_id, threshold_aprovacao, meta_cmv_pct, meta_ebitda_pct)
SELECT id,
  CASE slug
    WHEN 'madonna-cucina' THEN 3000
    WHEN 'meet-eat'       THEN 5000
    ELSE 5000
  END,
  28.0, 18.0
FROM brands
WHERE slug IN ('madonna-cucina','meet-eat','match-point')
ON CONFLICT (brand_id) DO NOTHING;

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_financial_periods_brand_competencia ON financial_periods(brand_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_period            ON cash_flow_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_status            ON cash_flow_entries(status);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_data              ON cash_flow_entries(data_lancamento DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_projections_period       ON cash_flow_projections(period_id);
CREATE INDEX IF NOT EXISTS idx_cmv_items_brand                     ON cmv_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status            ON approval_requests(status, brand_id);

-- ── updated_at TRIGGERS ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_periods_updated_at ON financial_periods;
CREATE TRIGGER trg_financial_periods_updated_at
  BEFORE UPDATE ON financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cash_flow_entries_updated_at ON cash_flow_entries;
CREATE TRIGGER trg_cash_flow_entries_updated_at
  BEFORE UPDATE ON cash_flow_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cash_flow_projections_updated_at ON cash_flow_projections;
CREATE TRIGGER trg_cash_flow_projections_updated_at
  BEFORE UPDATE ON cash_flow_projections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cmv_items_updated_at ON cmv_items;
CREATE TRIGGER trg_cmv_items_updated_at
  BEFORE UPDATE ON cmv_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_brand_financial_config_updated_at ON brand_financial_config;
CREATE TRIGGER trg_brand_financial_config_updated_at
  BEFORE UPDATE ON brand_financial_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE financial_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_projections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmv_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_financial_config  ENABLE ROW LEVEL SECURITY;

-- financial_periods
DROP POLICY IF EXISTS "fp_select" ON financial_periods;
CREATE POLICY "fp_select" ON financial_periods FOR SELECT
  USING (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "fp_write" ON financial_periods;
CREATE POLICY "fp_write" ON financial_periods FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = financial_periods.brand_id
      AND r.name IN ('founder','cfo','gm')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = financial_periods.brand_id
      AND r.name IN ('founder','cfo','gm')
  ));

-- cash_flow_entries
DROP POLICY IF EXISTS "cfe_select" ON cash_flow_entries;
CREATE POLICY "cfe_select" ON cash_flow_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM financial_periods fp
    WHERE fp.id = cash_flow_entries.period_id
      AND kph_has_role_for_brand(fp.brand_id)
  ));

DROP POLICY IF EXISTS "cfe_insert" ON cash_flow_entries;
CREATE POLICY "cfe_insert" ON cash_flow_entries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM financial_periods fp
    JOIN user_roles ur ON ur.brand_id = fp.brand_id
    JOIN roles r ON r.id = ur.role_id
    WHERE fp.id = cash_flow_entries.period_id
      AND ur.user_id = auth.uid()
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ));

DROP POLICY IF EXISTS "cfe_update" ON cash_flow_entries;
CREATE POLICY "cfe_update" ON cash_flow_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM financial_periods fp
    JOIN user_roles ur ON ur.brand_id = fp.brand_id
    JOIN roles r ON r.id = ur.role_id
    WHERE fp.id = cash_flow_entries.period_id
      AND ur.user_id = auth.uid()
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ));

DROP POLICY IF EXISTS "cfe_delete" ON cash_flow_entries;
CREATE POLICY "cfe_delete" ON cash_flow_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM financial_periods fp
    JOIN user_roles ur ON ur.brand_id = fp.brand_id
    JOIN roles r ON r.id = ur.role_id
    WHERE fp.id = cash_flow_entries.period_id
      AND ur.user_id = auth.uid()
      AND r.name IN ('founder','cfo')
  ));

-- cash_flow_projections
DROP POLICY IF EXISTS "cfp_select" ON cash_flow_projections;
CREATE POLICY "cfp_select" ON cash_flow_projections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM financial_periods fp
    WHERE fp.id = cash_flow_projections.period_id
      AND kph_has_role_for_brand(fp.brand_id)
  ));

DROP POLICY IF EXISTS "cfp_write" ON cash_flow_projections;
CREATE POLICY "cfp_write" ON cash_flow_projections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM financial_periods fp
    JOIN user_roles ur ON ur.brand_id = fp.brand_id
    JOIN roles r ON r.id = ur.role_id
    WHERE fp.id = cash_flow_projections.period_id
      AND ur.user_id = auth.uid()
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM financial_periods fp
    JOIN user_roles ur ON ur.brand_id = fp.brand_id
    JOIN roles r ON r.id = ur.role_id
    WHERE fp.id = cash_flow_projections.period_id
      AND ur.user_id = auth.uid()
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ));

-- cmv_items
DROP POLICY IF EXISTS "cmv_select" ON cmv_items;
CREATE POLICY "cmv_select" ON cmv_items FOR SELECT
  USING (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "cmv_write" ON cmv_items;
CREATE POLICY "cmv_write" ON cmv_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = cmv_items.brand_id
      AND r.name IN ('founder','cfo','gm','chef','comprador')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = cmv_items.brand_id
      AND r.name IN ('founder','cfo','gm','chef','comprador')
  ));

-- approval_requests
DROP POLICY IF EXISTS "ar_select" ON approval_requests;
CREATE POLICY "ar_select" ON approval_requests FOR SELECT
  USING (
    solicitante_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.brand_id = approval_requests.brand_id
        AND r.name IN ('founder','cfo')
    )
  );

DROP POLICY IF EXISTS "ar_write" ON approval_requests;
CREATE POLICY "ar_write" ON approval_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = approval_requests.brand_id
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = approval_requests.brand_id
      AND r.name IN ('founder','cfo','gm','comercial','operacional')
  ));

-- brand_financial_config
DROP POLICY IF EXISTS "bfc_select" ON brand_financial_config;
CREATE POLICY "bfc_select" ON brand_financial_config FOR SELECT
  USING (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "bfc_write" ON brand_financial_config;
CREATE POLICY "bfc_write" ON brand_financial_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = brand_financial_config.brand_id
      AND r.name IN ('founder','cfo')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.brand_id = brand_financial_config.brand_id
      AND r.name IN ('founder','cfo')
  ));

-- ── VIEWS ANALÍTICAS (security_invoker) ────────────────────────

-- DRE consolidada por marca/período.
-- Refatorado pra um único scan com aggregate FILTERs — assim períodos
-- "vazios" (sem receita ou sem despesa) ainda aparecem no DRE com 0.
-- O spec original tinha INNER JOIN entre receitas e despesas que escondia
-- linhas — corrigido.
CREATE OR REPLACE VIEW v_dre_consolidado WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    fp.id          AS period_id,
    fp.brand_id,
    fp.competencia,
    cfe.natureza,
    cfe.categoria_receita,
    cfe.categoria_despesa,
    cfe.valor
  FROM financial_periods fp
  LEFT JOIN cash_flow_entries cfe
    ON cfe.period_id = fp.id
   AND cfe.status NOT IN ('cancelado','rejeitado')
)
SELECT
  base.brand_id,
  b.name AS brand_name,
  b.slug AS brand_slug,
  base.competencia,
  COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0) AS receita_bruta,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_receita = 'vendas_salao'), 0)            AS vendas_salao,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_receita = 'eventos_private_dining'), 0)  AS vendas_eventos,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_receita = 'vendas_bar'), 0)              AS vendas_bar,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_receita = 'vendas_delivery'), 0)         AS vendas_delivery,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('cmv_cozinha','cmv_bar','cmv_delivery')), 0) AS cmv_total,
  ROUND(
    COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('cmv_cozinha','cmv_bar','cmv_delivery')), 0)
    / NULLIF(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
    * 100, 2
  ) AS cmv_pct,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('folha_salarios','folha_encargos','folha_beneficios','folha_gorjeta_repasse')), 0) AS folha_total,
  ROUND(
    COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('folha_salarios','folha_encargos','folha_beneficios','folha_gorjeta_repasse')), 0)
    / NULLIF(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
    * 100, 2
  ) AS folha_pct,
  (
    COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('cmv_cozinha','cmv_bar','cmv_delivery')), 0)
  + COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('folha_salarios','folha_encargos','folha_beneficios','folha_gorjeta_repasse')), 0)
  ) AS prime_cost,
  ROUND(
    (
      COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('cmv_cozinha','cmv_bar','cmv_delivery')), 0)
    + COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('folha_salarios','folha_encargos','folha_beneficios','folha_gorjeta_repasse')), 0)
    )
    / NULLIF(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
    * 100, 2
  ) AS prime_cost_pct,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('aluguel','condominio','iptu')), 0) AS ocupacao_total,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('energia_eletrica','gas','agua','telefone_internet')), 0) AS utilidades_total,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('marketing_publicidade','delivery_taxas_plataforma','comissoes')), 0) AS comercial_total,
  COALESCE(SUM(base.valor) FILTER (WHERE base.categoria_despesa IN ('pis_cofins','irpj_csll','iss','outros_tributos')), 0) AS tributos_total,
  COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'despesa'), 0) AS despesa_total,
  (
    COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
  - COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'despesa'), 0)
  ) AS ebitda,
  ROUND(
    (
      COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
    - COALESCE(SUM(base.valor) FILTER (WHERE base.natureza = 'despesa'), 0)
    )
    / NULLIF(SUM(base.valor) FILTER (WHERE base.natureza = 'receita'), 0)
    * 100, 2
  ) AS ebitda_pct
FROM base
JOIN brands b ON b.id = base.brand_id
GROUP BY base.brand_id, b.name, b.slug, base.competencia;

-- Gap projeção × realizado por categoria
CREATE OR REPLACE VIEW v_gap_projecao_realizado WITH (security_invoker = true) AS
SELECT
  fp.id   AS period_id,
  fp.brand_id,
  b.name  AS brand_name,
  b.slug  AS brand_slug,
  fp.competencia,
  cfp.natureza,
  COALESCE(cfp.categoria_receita::text, cfp.categoria_despesa::text) AS categoria,
  cfp.is_evento,
  COALESCE(SUM(cfp.valor_projetado), 0)   AS valor_projetado,
  COALESCE(SUM(cfe.valor), 0)              AS valor_realizado,
  COALESCE(SUM(cfp.valor_projetado), 0) - COALESCE(SUM(cfe.valor), 0) AS gap_absoluto,
  ROUND(
    (COALESCE(SUM(cfp.valor_projetado), 0) - COALESCE(SUM(cfe.valor), 0))
    / NULLIF(SUM(cfp.valor_projetado), 0) * 100, 2
  ) AS gap_pct,
  ABS(
    ROUND(
      (COALESCE(SUM(cfp.valor_projetado), 0) - COALESCE(SUM(cfe.valor), 0))
      / NULLIF(SUM(cfp.valor_projetado), 0) * 100, 2
    )
  ) > 5 AS acima_threshold
FROM financial_periods fp
JOIN brands b ON b.id = fp.brand_id
LEFT JOIN cash_flow_projections cfp ON cfp.period_id = fp.id
LEFT JOIN cash_flow_entries cfe
       ON cfe.period_id = fp.id
      AND cfe.status NOT IN ('cancelado','rejeitado')
      AND (
        (cfp.natureza = 'receita' AND cfe.categoria_receita = cfp.categoria_receita)
        OR
        (cfp.natureza = 'despesa' AND cfe.categoria_despesa = cfp.categoria_despesa)
      )
GROUP BY fp.id, fp.brand_id, b.name, b.slug, fp.competencia,
         cfp.natureza, cfp.categoria_receita, cfp.categoria_despesa, cfp.is_evento;

-- Aprovações pendentes (enriched)
CREATE OR REPLACE VIEW v_aprovacoes_pendentes WITH (security_invoker = true) AS
SELECT
  ar.id,
  ar.entry_id,
  ar.brand_id,
  b.name             AS brand_name,
  ar.valor,
  ar.descricao,
  ar.justificativa,
  ar.status,
  ar.created_at,
  cfe.categoria_despesa,
  cfe.fornecedor,
  cfe.data_vencimento,
  u.email            AS solicitante_email
FROM approval_requests ar
JOIN brands b ON b.id = ar.brand_id
JOIN cash_flow_entries cfe ON cfe.id = ar.entry_id
JOIN auth.users u ON u.id = ar.solicitante_id
WHERE ar.status = 'pendente';

-- CMV dashboard por marca
CREATE OR REPLACE VIEW v_cmv_dashboard WITH (security_invoker = true) AS
SELECT
  ci.brand_id,
  b.name AS brand_name,
  b.slug AS brand_slug,
  COUNT(*)                                                                 AS total_itens,
  COUNT(*) FILTER (WHERE ci.tem_ficha_tecnica = FALSE AND ci.ativo = TRUE) AS sem_ficha_tecnica,
  COUNT(*) FILTER (WHERE ci.cmv_pct > 40 AND ci.ativo = TRUE)              AS itens_criticos_acima_40,
  COUNT(*) FILTER (WHERE ci.cmv_pct BETWEEN 30 AND 40 AND ci.ativo = TRUE) AS itens_atencao_30_40,
  ROUND(AVG(ci.cmv_pct) FILTER (WHERE ci.ativo = TRUE AND ci.cmv_pct IS NOT NULL), 2) AS cmv_medio_pct,
  ROUND(AVG(ci.cmv_pct) FILTER (WHERE ci.ativo = TRUE AND ci.cmv_pct > 40), 2)        AS cmv_medio_criticos
FROM cmv_items ci
JOIN brands b ON b.id = ci.brand_id
GROUP BY ci.brand_id, b.name, b.slug;

GRANT SELECT ON v_dre_consolidado        TO authenticated;
GRANT SELECT ON v_gap_projecao_realizado TO authenticated;
GRANT SELECT ON v_aprovacoes_pendentes   TO authenticated;
GRANT SELECT ON v_cmv_dashboard          TO authenticated;
