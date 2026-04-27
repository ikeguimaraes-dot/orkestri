-- Fase 1 / Pessoas — expansão do schema (referência: HOS RH).
-- Incorpora dados Totvs (RG, PIS, CTPS, endereço, escolaridade) + tabelas
-- complementares de RH (dependentes, faltas, advertências, score).
--
-- Idempotente: ALTER ... ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS antes de cada CREATE POLICY.
--
-- Novos campos em employees são todos NULLABLE — seed e CRUD existentes
-- continuam funcionando sem ajuste.

-- ── employees: documentos pessoais (HOS) ───────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg_orgao TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rg_uf CHAR(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pis TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps_serie TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctps_uf CHAR(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reservista TEXT;

-- ── employees: endereço (HOS desnormalizado) ───────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS estado CHAR(2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cep TEXT;

-- ── employees: dados sociodemográficos ─────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS escolaridade TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS raca TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS genero TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nome_mae TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nome_pai TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS departamento TEXT;

-- ── Dependentes (IRRF) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dependents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  nome            TEXT NOT NULL,
  cpf             TEXT,
  data_nascimento DATE,
  parentesco      TEXT NOT NULL,
  ordem           INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependents_employee ON dependents(employee_id);
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dependents_select" ON dependents;
CREATE POLICY "dependents_select" ON dependents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "dependents_all" ON dependents;
CREATE POLICY "dependents_all" ON dependents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- ── Faltas / atestados ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  data          DATE NOT NULL,
  tipo          TEXT NOT NULL, -- justificada, injustificada, atestado, falta_abono
  motivo        TEXT,
  score_impact  INTEGER DEFAULT 0,
  atestado_path TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absences_employee ON absences(employee_id, data DESC);
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absences_all" ON absences;
CREATE POLICY "absences_all" ON absences FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- ── Advertências (CLT) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  nivel           TEXT NOT NULL, -- verbal, escrita, suspensao
  descricao       TEXT NOT NULL,
  score_impact    INTEGER DEFAULT 0,
  documento_path  TEXT,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warnings_employee ON warnings(employee_id, data DESC);
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warnings_all" ON warnings;
CREATE POLICY "warnings_all" ON warnings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- ── Score / gamificação RH ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  tipo          TEXT NOT NULL,
  delta         INTEGER NOT NULL,
  descricao     TEXT,
  referencia_id UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_events_employee ON score_events(employee_id, created_at DESC);
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_select" ON score_events;
CREATE POLICY "score_select" ON score_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

DROP POLICY IF EXISTS "score_insert" ON score_events;
CREATE POLICY "score_insert" ON score_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- ── Banco de horas: origem (KPH calculado vs Totvs importado) ──
ALTER TABLE time_bank_balance ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'kph';
ALTER TABLE time_bank_balance ADD COLUMN IF NOT EXISTS observacao TEXT;
