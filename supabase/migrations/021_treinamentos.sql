-- KPH OS — 021_treinamentos.sql
-- Sprint 3 / Etapa 4 — módulo Treinamentos / Onboarding.
--
-- Pré-req: 001 (groups/brands/units + helpers RBAC) · 003 (employees).
--
-- Aditivo: nenhuma tabela existente alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.
--
-- ATENÇÃO sobre `validade_ate GENERATED`:
--   A spec original pediu `GENERATED ALWAYS AS (data_conclusao + validade_dias * INTERVAL '1 day')`,
--   mas isso depende de `validade_dias` da tabela `training_templates` (outra
--   linha) — não é permitido em GENERATED ALWAYS AS STORED. Implementação:
--   guarda validade_dias_snapshot direto em training_records (capturado no
--   create) e calcula validade_ate como GENERATED da própria linha.

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id),
  unit_id         UUID REFERENCES units(id),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  funcao          TEXT,            -- filtro por cargo (NULL = todos)
  obrigatorio     BOOLEAN DEFAULT FALSE,
  validade_dias   INTEGER,         -- NULL = sem validade
  ativo           BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id              UUID NOT NULL REFERENCES training_templates(id),
  status                   TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente','em_andamento','concluido','vencido')),
  data_inicio              DATE,
  data_conclusao           DATE,
  -- Snapshot da validade no momento do create. Permite GENERATED na própria
  -- linha (data_conclusao + validade_dias_snapshot * INTERVAL '1 day').
  -- Mudanças posteriores no template NÃO afetam treinamentos já registrados —
  -- isso é uma feature, não bug (auditoria fica estável).
  validade_dias_snapshot   INTEGER,
  validade_ate             DATE GENERATED ALWAYS AS (
    CASE
      WHEN data_conclusao IS NULL OR validade_dias_snapshot IS NULL THEN NULL
      ELSE data_conclusao + (validade_dias_snapshot || ' days')::interval
    END
  ) STORED,
  observacoes              TEXT,
  created_by               UUID REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, template_id)
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_training_templates_brand    ON training_templates(brand_id);
CREATE INDEX IF NOT EXISTS idx_training_templates_unit     ON training_templates(unit_id);
CREATE INDEX IF NOT EXISTS idx_training_templates_funcao   ON training_templates(funcao);
CREATE INDEX IF NOT EXISTS idx_training_records_employee   ON training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_records_template   ON training_records(template_id);
CREATE INDEX IF NOT EXISTS idx_training_records_status     ON training_records(status);
CREATE INDEX IF NOT EXISTS idx_training_records_validade   ON training_records(validade_ate);

-- ── updated_at TRIGGERS ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_training_templates_updated_at ON training_templates;
CREATE TRIGGER trg_training_templates_updated_at
  BEFORE UPDATE ON training_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_training_records_updated_at ON training_records;
CREATE TRIGGER trg_training_records_updated_at
  BEFORE UPDATE ON training_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE training_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records   ENABLE ROW LEVEL SECURITY;

-- training_templates: SELECT/INSERT/UPDATE pra qualquer role na brand;
--                     DELETE só founder.
DROP POLICY IF EXISTS "tt_select" ON training_templates;
CREATE POLICY "tt_select" ON training_templates FOR SELECT
  USING (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "tt_insert" ON training_templates;
CREATE POLICY "tt_insert" ON training_templates FOR INSERT
  WITH CHECK (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "tt_update" ON training_templates;
CREATE POLICY "tt_update" ON training_templates FOR UPDATE
  USING (kph_has_role_for_brand(brand_id))
  WITH CHECK (kph_has_role_for_brand(brand_id));

DROP POLICY IF EXISTS "tt_delete" ON training_templates;
CREATE POLICY "tt_delete" ON training_templates FOR DELETE
  USING (kph_is_founder());

-- training_records: cascade via employee.unit_id.
DROP POLICY IF EXISTS "tr_select" ON training_records;
CREATE POLICY "tr_select" ON training_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "tr_insert" ON training_records;
CREATE POLICY "tr_insert" ON training_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "tr_update" ON training_records;
CREATE POLICY "tr_update" ON training_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "tr_delete" ON training_records;
CREATE POLICY "tr_delete" ON training_records FOR DELETE
  USING (kph_is_founder());

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON training_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON training_records   TO authenticated;
