-- KPH OS — 034_ponto_mensal.sql
-- Relatório de Ponto mensal importado do Totvs.
-- Armazena o relatório agregado (≠ registros individuais de ponto).
-- Cada linha = 1 colaborador por período por unidade.
-- A linha com matricula='' é a linha de totais do CSV.
-- Idempotente.

-- ── Tabela principal ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ponto_mensal (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                    UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  employee_id                UUID        REFERENCES employees(id),
  matricula                  TEXT,
  nome                       TEXT        NOT NULL DEFAULT '',
  cpf                        TEXT,
  cargo                      TEXT,
  departamento               TEXT,
  periodo                    TEXT        NOT NULL,
  importado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por              UUID        REFERENCES auth.users(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- datas do colaborador
  data_admissao              TEXT,
  data_demissao              TEXT,

  -- horas
  horas_previstas            TEXT,
  horas_trabalhadas          TEXT,
  horas_negativas            TEXT,
  horas_positivas            TEXT,
  saldo                      TEXT,

  -- banco de horas
  banco_horas_acumulado      TEXT,
  banco_horas_mes            TEXT,
  compensacao_bh             TEXT,

  -- extras de jornada
  adicional_noturno          TEXT,

  -- ausências
  falta_injustificada_horas  TEXT,
  falta_injustificada_dias   INTEGER     NOT NULL DEFAULT 0,
  atestado_medico            TEXT,
  abonado_horas              TEXT,
  abonado_dias               INTEGER     NOT NULL DEFAULT 0,
  afastamentos_horas         TEXT,
  afastamentos_dias          INTEGER     NOT NULL DEFAULT 0,
  inss_horas                 TEXT,
  inss_dias                  INTEGER     NOT NULL DEFAULT 0,
  ferias_horas               TEXT,
  ferias_dias                INTEGER     NOT NULL DEFAULT 0,
  licenca_paternidade_horas  TEXT,
  licenca_paternidade_dias   INTEGER     NOT NULL DEFAULT 0,

  -- folgas / feriados
  folga_domingo              TEXT,
  folga_feriado              TEXT,
  feriados_dias              INTEGER     NOT NULL DEFAULT 0,
  confraternizacao           TEXT
);

-- ── Índices ────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_ponto_mensal_uniq
  ON ponto_mensal(unit_id, periodo, COALESCE(matricula, ''));

CREATE INDEX IF NOT EXISTS idx_ponto_mensal_unit_periodo
  ON ponto_mensal(unit_id, periodo);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE ponto_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_mensal_select" ON ponto_mensal;
CREATE POLICY "ponto_mensal_select" ON ponto_mensal
  FOR SELECT USING (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "ponto_mensal_insert" ON ponto_mensal;
CREATE POLICY "ponto_mensal_insert" ON ponto_mensal
  FOR INSERT WITH CHECK (public.kph_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "ponto_mensal_delete" ON ponto_mensal;
CREATE POLICY "ponto_mensal_delete" ON ponto_mensal
  FOR DELETE USING (public.kph_has_role_for_unit(unit_id));
