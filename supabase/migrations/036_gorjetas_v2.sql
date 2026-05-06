-- ============================================================
-- Migration 036 · Gorjetas v2 — Sistema de Pontos por Dia
-- Substitui tabelas da migration 035
-- ============================================================

-- Drop ordem reversa para respeitar FKs
DROP TABLE IF EXISTS gorjeta_dias      CASCADE;
DROP TABLE IF EXISTS gorjeta_periodos  CASCADE;
DROP TABLE IF EXISTS gorjeta_cargo_pontos CASCADE;

-- ------------------------------------------------------------
-- 1. Pontos por cargo (configurável por unidade)
-- ------------------------------------------------------------
CREATE TABLE gorjeta_cargo_pontos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    UUID        REFERENCES units(id) ON DELETE CASCADE,  -- NULL = template global
  cargo      TEXT        NOT NULL,
  pontos     INTEGER     NOT NULL CHECK (pontos >= 0),
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, cargo)
);

COMMENT ON TABLE gorjeta_cargo_pontos IS 'Pontuação por cargo para cálculo de gorjeta — configurável por unidade';
COMMENT ON COLUMN gorjeta_cargo_pontos.unit_id IS 'NULL = template global copiado para novas unidades';

-- ------------------------------------------------------------
-- 2. Períodos diários (uma linha por dia por unidade)
-- ------------------------------------------------------------
CREATE TABLE gorjeta_periodos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  data            DATE        NOT NULL,
  receita_bruta   NUMERIC(12,2) NOT NULL CHECK (receita_bruta >= 0),
  imposto_pct     NUMERIC(5,2)  NOT NULL DEFAULT 20.00 CHECK (imposto_pct BETWEEN 0 AND 100),
  receita_liquida NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(receita_bruta * (1 - imposto_pct / 100.0), 2)
  ) STORED,
  total_pontos    INTEGER     NOT NULL CHECK (total_pontos > 0),
  valor_ponto     NUMERIC(10,4) GENERATED ALWAYS AS (
    ROUND(receita_bruta * (1 - imposto_pct / 100.0) / total_pontos, 4)
  ) STORED,
  fonte           TEXT        NOT NULL DEFAULT 'manual' CHECK (fonte IN ('manual','lorean','import')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, data)
);

COMMENT ON TABLE gorjeta_periodos IS 'Receita bruta diária por unidade — base do cálculo de gorjeta';
COMMENT ON COLUMN gorjeta_periodos.fonte IS 'manual = entrada manual | lorean = API PDV | import = Excel';

-- ------------------------------------------------------------
-- 3. Distribuição diária por colaborador
-- ------------------------------------------------------------
CREATE TABLE gorjeta_dias (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  employee_id     UUID        REFERENCES employees(id) ON DELETE CASCADE,
  periodo_id      UUID        REFERENCES gorjeta_periodos(id) ON DELETE CASCADE,
  data            DATE        NOT NULL,
  cargo           TEXT        NOT NULL,
  pontos          INTEGER     NOT NULL DEFAULT 0 CHECK (pontos >= 0),
  presente        BOOLEAN     NOT NULL DEFAULT true,
  valor_calculado NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, employee_id, data)
);

COMMENT ON TABLE gorjeta_dias IS 'Gorjeta calculada por colaborador à dia';

-- ------------------------------------------------------------
-- 4. Índices
-- ------------------------------------------------------------
CREATE INDEX idx_gorjeta_periodos_unit_data ON gorjeta_periodos (unit_id, data);
CREATE INDEX idx_gorjeta_dias_unit_data     ON gorjeta_dias (unit_id, data);
CREATE INDEX idx_gorjeta_dias_employee      ON gorjeta_dias (employee_id);
CREATE INDEX idx_gorjeta_dias_periodo       ON gorjeta_dias (periodo_id);

-- ------------------------------------------------------------
-- 5. Trigger updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gorjeta_cargo_pontos_updated_at
  BEFORE UPDATE ON gorjeta_cargo_pontos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_gorjeta_periodos_updated_at
  BEFORE UPDATE ON gorjeta_periodos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
ALTER TABLE gorjeta_cargo_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorjeta_periodos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorjeta_dias         ENABLE ROW LEVEL SECURITY;

-- gorjeta_cargo_pontos — SELECT permite templates globais (unit_id IS NULL)
DROP POLICY IF EXISTS "gorjeta_cargo_pontos_select" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_select" ON gorjeta_cargo_pontos
  FOR SELECT USING (unit_id IS NULL OR public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_insert" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_insert" ON gorjeta_cargo_pontos
  FOR INSERT WITH CHECK (unit_id IS NOT NULL AND public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_update" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_update" ON gorjeta_cargo_pontos
  FOR UPDATE USING (unit_id IS NOT NULL AND public.kph_has_role_for_unit(unit_id))
  WITH CHECK (unit_id IS NOT NULL AND public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "gorjeta_cargo_pontos_delete" ON gorjeta_cargo_pontos;
CREATE POLICY "gorjeta_cargo_pontos_delete" ON gorjeta_cargo_pontos
  FOR DELETE USING (unit_id IS NOT NULL AND public.kph_has_role_for_unit(unit_id));

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

-- ------------------------------------------------------------
-- 7. Seed — 23 cargos padrão Meet & Eat (unit_id = null = template global)
--    Copiados para cada unidade no primeiro acesso
-- ------------------------------------------------------------
INSERT INTO gorjeta_cargo_pontos (unit_id, cargo, pontos) VALUES
  (NULL, 'Maître',                     13),
  (NULL, 'Garçom I',                    7),
  (NULL, 'Garçom II',                   6),
  (NULL, 'Garçom III',                  5),
  (NULL, 'Auxiliar de Garçom',          4),
  (NULL, 'Chefe de Bar',               10),
  (NULL, 'Barman I',                    7),
  (NULL, 'Barman II',                   6),
  (NULL, 'Auxiliar de Bar',             4),
  (NULL, 'Cozinheiro I',                7),
  (NULL, 'Cozinheiro II',               6),
  (NULL, 'Cozinheiro III',              5),
  (NULL, 'Auxiliar de Cozinha',         4),
  (NULL, 'Chefe de Cozinha',           12),
  (NULL, 'Sous Chef',                  10),
  (NULL, 'Confeiteiro',                 7),
  (NULL, 'Açougueiro / Parrilheiro',    8),
  (NULL, 'Copeiro',                     3),
  (NULL, 'Recepcionista',               6),
  (NULL, 'Hostess',                     5),
  (NULL, 'Gerente de Salão',           13),
  (NULL, 'Capitão de Salão',            9),
  (NULL, 'Sommelier',                  10)
ON CONFLICT (unit_id, cargo) DO NOTHING;
