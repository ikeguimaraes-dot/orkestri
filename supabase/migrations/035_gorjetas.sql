-- KPH OS — 035_gorjetas.sql
-- Módulo de Gorjetas baseado em sistema de pontos diário.
-- Idempotente.

-- ── Configuração de pontos por cargo por unit ──────────────────────────────

CREATE TABLE IF NOT EXISTS gorjeta_cargo_pontos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  cargo      TEXT        NOT NULL,
  pontos     NUMERIC(4,1) NOT NULL DEFAULT 1,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, cargo)
);

-- ── Períodos (quinzena) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gorjeta_periodos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo       TEXT        NOT NULL,
  quinzena      INTEGER     NOT NULL,
  data_inicio   DATE        NOT NULL,
  data_fim      DATE        NOT NULL,
  receita_bruta NUMERIC(12,2) NOT NULL DEFAULT 0,
  imposto_pct   NUMERIC(5,2)  NOT NULL DEFAULT 20,
  valor_liquido NUMERIC(12,2) GENERATED ALWAYS AS
    (receita_bruta * (1 - imposto_pct / 100)) STORED,
  total_pontos  NUMERIC(10,1) NOT NULL DEFAULT 0,
  valor_ponto   NUMERIC(10,4) GENERATED ALWAYS AS
    (CASE WHEN total_pontos > 0
     THEN receita_bruta * (1 - imposto_pct / 100) / total_pontos
     ELSE 0 END) STORED,
  importado_em  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, periodo, quinzena)
);

-- ── Gorjeta por colaborador por dia ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS gorjeta_dias (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo_id      UUID        REFERENCES gorjeta_periodos(id) ON DELETE CASCADE,
  employee_id     UUID        REFERENCES employees(id) ON DELETE SET NULL,
  nome            TEXT        NOT NULL,
  cargo           TEXT,
  data            DATE        NOT NULL,
  pontos          NUMERIC(4,1) NOT NULL DEFAULT 0,
  presente        BOOLEAN     NOT NULL DEFAULT true,
  valor_calculado NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gorjeta_dias_periodo
  ON gorjeta_dias(periodo_id);

CREATE INDEX IF NOT EXISTS idx_gorjeta_dias_unit_data
  ON gorjeta_dias(unit_id, data);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE gorjeta_cargo_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorjeta_periodos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorjeta_dias         ENABLE ROW LEVEL SECURITY;

-- gorjeta_cargo_pontos
DROP POLICY IF EXISTS "gorjeta_cargo_pontos_select" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_select" ON gorjeta_cargo_pontos
  FOR SELECT USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_insert" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_insert" ON gorjeta_cargo_pontos
  FOR INSERT WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_update" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_update" ON gorjeta_cargo_pontos
  FOR UPDATE USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_delete" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_delete" ON gorjeta_cargo_pontos
  FOR DELETE USING (public.kph_has_role_for_unit(unit_id));

-- gorjeta_periodos
DROP POLICY IF EXISTS "gorjeta_periodos_select" ON gorjeta_periodos;
CREATE POLICY "gorjeta_periodos_select" ON gorjeta_periodos
  FOR SELECT USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_periodos_insert" ON gorjeta_periodos;
CREATE POLICY "gorjeta_periodos_insert" ON gorjeta_periodos
  FOR INSERT WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_periodos_update" ON gorjeta_periodos;
CREATE POLICY "gorjeta_periodos_update" ON gorjeta_periodos
  FOR UPDATE USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_periodos_delete" ON gorjeta_periodos;
CREATE POLICY "gorjeta_periodos_delete" ON gorjeta_periodos
  FOR DELETE USING (public.kph_has_role_for_unit(unit_id));

-- gorjeta_dias
DROP POLICY IF EXISTS "gorjeta_dias_select" ON gorjeta_dias;
CREATE POLICY "gorjeta_dias_select" ON gorjeta_dias
  FOR SELECT USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_dias_insert" ON gorjeta_dias;
CREATE POLICY "gorjeta_dias_insert" ON gorjeta_dias
  FOR INSERT WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_dias_update" ON gorjeta_dias;
CREATE POLICY "gorjeta_dias_update" ON gorjeta_dias
  FOR UPDATE USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_dias_delete" ON gorjeta_dias;
CREATE POLICY "gorjeta_dias_delete" ON gorjeta_dias
  FOR DELETE USING (public.kph_has_role_for_unit(unit_id));
