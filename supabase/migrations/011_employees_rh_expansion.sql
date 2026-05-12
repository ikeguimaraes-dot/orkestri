-- ============================================================
-- Migration 011 · RH Expansion consolidada
--
-- Substitui as migrations 011–018 que estavam ausentes do repo.
-- Adiciona 23 colunas em employees e cria 6 tabelas que o código
-- já usa em produção sem definição prévia no banco.
--
-- Totalmente idempotente: ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS antes
-- de cada CREATE POLICY.
-- ============================================================

-- ============================================================
-- PARTE 1 — Colunas extras em employees
-- ============================================================

-- Documentos pessoais complementares
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps_expedicao  TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS zona_eleitoral  TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS secao_eleitoral TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rne             TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rne_orgao       TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rne_expedicao   TEXT;

-- Identificação e cadastro (eSocial / Totvs)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS esocial_code    TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nome_social     TEXT;

-- Dados pessoais eSocial obrigatórios
ALTER TABLE employees ADD COLUMN IF NOT EXISTS data_nascimento   DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cidade_nascimento TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uf_nascimento     CHAR(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pais_nascimento   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS estado_civil      TEXT;

-- Vínculo empregatício
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_contrato     TEXT
  CHECK (tipo_contrato IS NULL OR tipo_contrato IN ('CLT','PJ','temporario','estagiario'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS jornada           TEXT;

-- Contato operacional (usado pelo app mobile)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS telefone                TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email                   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contato_emergencia_nome TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contato_emergencia_tel  TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url               TEXT;

-- Status e score (NOT NULL com defaults — retrocompatível com rows existentes)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_rh  TEXT NOT NULL DEFAULT 'ativo'
  CHECK (status_rh IN ('ativo','inativo','ferias','afastado'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS score      INTEGER NOT NULL DEFAULT 100;

-- ============================================================
-- PARTE 2 — Tabela vacations
-- ============================================================

CREATE TABLE IF NOT EXISTS vacations (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id                  UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  start_date               DATE        NOT NULL,
  end_date                 DATE        NOT NULL,
  acquisitive_period_start DATE,
  acquisitive_period_end   DATE,
  days_entitled            INTEGER     NOT NULL DEFAULT 30,
  days_taken               INTEGER,
  abono_days               INTEGER,
  is_double_pay            BOOLEAN     NOT NULL DEFAULT FALSE,
  status                   TEXT        NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada','em_andamento','concluida','cancelada')),
  notes                    TEXT,
  created_by               UUID        REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacations_employee ON vacations(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_vacations_unit     ON vacations(unit_id, start_date DESC);

ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacations_select" ON vacations;
CREATE POLICY "vacations_select" ON vacations FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "vacations_insert" ON vacations;
CREATE POLICY "vacations_insert" ON vacations FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "vacations_update" ON vacations;
CREATE POLICY "vacations_update" ON vacations FOR UPDATE
  USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "vacations_delete" ON vacations;
CREATE POLICY "vacations_delete" ON vacations FOR DELETE
  USING (public.kph_has_role_for_unit(unit_id));

-- ============================================================
-- PARTE 3 — Tabela transport_vouchers
-- ============================================================

CREATE TABLE IF NOT EXISTS transport_vouchers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id               UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo               DATE        NOT NULL,   -- primeiro dia do mês
  dias_uteis            INTEGER     NOT NULL,
  valor_diario          NUMERIC(10,2) NOT NULL,
  total_bruto           NUMERIC(10,2) NOT NULL,
  desconto_funcionario  NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_empresa         NUMERIC(10,2) NOT NULL,
  operadora             TEXT,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_transport_vouchers_employee ON transport_vouchers(employee_id, periodo DESC);
CREATE INDEX IF NOT EXISTS idx_transport_vouchers_unit     ON transport_vouchers(unit_id, periodo DESC);

ALTER TABLE transport_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transport_vouchers_select" ON transport_vouchers;
CREATE POLICY "transport_vouchers_select" ON transport_vouchers FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "transport_vouchers_insert" ON transport_vouchers;
CREATE POLICY "transport_vouchers_insert" ON transport_vouchers FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "transport_vouchers_update" ON transport_vouchers;
CREATE POLICY "transport_vouchers_update" ON transport_vouchers FOR UPDATE
  USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "transport_vouchers_delete" ON transport_vouchers;
CREATE POLICY "transport_vouchers_delete" ON transport_vouchers FOR DELETE
  USING (public.kph_has_role_for_unit(unit_id));

-- ============================================================
-- PARTE 4 — Tabela overtime_records
-- ============================================================

CREATE TABLE IF NOT EXISTS overtime_records (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id     UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  hours       NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  type        TEXT        NOT NULL CHECK (type IN ('50','100','banco')),
  reason      TEXT,
  approved    BOOLEAN,
  approved_by UUID        REFERENCES auth.users(id),
  periodo     DATE,               -- primeiro dia do mês (denormalizado para agrupamento)
  source      TEXT        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','totvs')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overtime_employee ON overtime_records(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_unit     ON overtime_records(unit_id, date DESC);

ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_records_select" ON overtime_records;
CREATE POLICY "overtime_records_select" ON overtime_records FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "overtime_records_insert" ON overtime_records;
CREATE POLICY "overtime_records_insert" ON overtime_records FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "overtime_records_update" ON overtime_records;
CREATE POLICY "overtime_records_update" ON overtime_records FOR UPDATE
  USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "overtime_records_delete" ON overtime_records;
CREATE POLICY "overtime_records_delete" ON overtime_records FOR DELETE
  USING (public.kph_has_role_for_unit(unit_id));

-- ============================================================
-- PARTE 5 — Tabela tips_records
-- ============================================================

CREATE TABLE IF NOT EXISTS tips_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id           UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo           DATE        NOT NULL,   -- primeiro dia do mês
  valor_ponto       NUMERIC(10,4) NOT NULL,
  total_pontos      INTEGER     NOT NULL DEFAULT 0 CHECK (total_pontos >= 0),
  abatimento_pontos INTEGER     NOT NULL DEFAULT 0 CHECK (abatimento_pontos >= 0),
  pontos_liquidos   INTEGER     GENERATED ALWAYS AS (total_pontos - abatimento_pontos) STORED,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_tips_records_employee ON tips_records(employee_id, periodo DESC);
CREATE INDEX IF NOT EXISTS idx_tips_records_unit     ON tips_records(unit_id, periodo DESC);

ALTER TABLE tips_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tips_records_select" ON tips_records;
CREATE POLICY "tips_records_select" ON tips_records FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "tips_records_insert" ON tips_records;
CREATE POLICY "tips_records_insert" ON tips_records FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "tips_records_update" ON tips_records;
CREATE POLICY "tips_records_update" ON tips_records FOR UPDATE
  USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "tips_records_delete" ON tips_records;
CREATE POLICY "tips_records_delete" ON tips_records FOR DELETE
  USING (public.kph_has_role_for_unit(unit_id));

-- ============================================================
-- PARTE 6 — Tabela time_records (banco de horas Totvs)
-- ============================================================

CREATE TABLE IF NOT EXISTS time_records (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  unit_id                     UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo                     DATE        NOT NULL,   -- primeiro dia do mês
  horas_previstas             TEXT,                   -- "220:00" — formato Totvs
  horas_trabalhadas           TEXT,
  banco_horas_positivo        TEXT,
  banco_horas_negativo        TEXT,
  saldo_banco                 TEXT,
  banco_horas_acumulado       TEXT,
  faltas_injustificadas_dias  INTEGER,
  atestado_horas              TEXT,
  afastamentos_dias           INTEGER,
  ferias_dias                 INTEGER,
  adicional_noturno           TEXT,
  fonte                       TEXT        NOT NULL DEFAULT 'totvs',
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_time_records_employee ON time_records(employee_id, periodo DESC);
CREATE INDEX IF NOT EXISTS idx_time_records_unit     ON time_records(unit_id, periodo DESC);

ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_records_select" ON time_records;
CREATE POLICY "time_records_select" ON time_records FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "time_records_insert" ON time_records;
CREATE POLICY "time_records_insert" ON time_records FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "time_records_update" ON time_records;
CREATE POLICY "time_records_update" ON time_records FOR UPDATE
  USING (public.kph_has_role_for_unit(unit_id))
  WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "time_records_delete" ON time_records;
CREATE POLICY "time_records_delete" ON time_records FOR DELETE
  USING (public.kph_has_role_for_unit(unit_id));

-- ============================================================
-- PARTE 7 — Tabela import_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS import_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  periodo           TEXT        NOT NULL,   -- "2025-01" ou "2025-01-01"
  tipo              TEXT        NOT NULL CHECK (tipo IN ('ponto','holerites','gorjetas','vt')),
  total_linhas      INTEGER,
  importados        INTEGER,
  nao_encontrados   INTEGER,
  erros             INTEGER,
  detalhes          JSONB,
  imported_by       UUID        REFERENCES auth.users(id),
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_unit ON import_logs(unit_id, imported_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_logs_select" ON import_logs;
CREATE POLICY "import_logs_select" ON import_logs FOR SELECT
  USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "import_logs_insert" ON import_logs;
CREATE POLICY "import_logs_insert" ON import_logs FOR INSERT
  WITH CHECK (public.kph_has_role_for_unit(unit_id));
