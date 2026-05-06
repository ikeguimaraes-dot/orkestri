-- ============================================================
-- Migration 037 · Controle de Vagas — Pipeline R&S
-- Expande tabela job_openings existente
-- ============================================================

-- ------------------------------------------------------------
-- 1. Novas colunas em job_openings
-- ------------------------------------------------------------
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','fechada','congelada')),
  ADD COLUMN IF NOT EXISTS recrutador         TEXT,
  ADD COLUMN IF NOT EXISTS sla_dias           INTEGER,
  ADD COLUMN IF NOT EXISTS status_prazo       TEXT
    CHECK (status_prazo IN ('no_prazo','atencao','atrasado','congelada')),
  ADD COLUMN IF NOT EXISTS motivo             TEXT
    CHECK (motivo IN (
      'substituicao_desligamento',
      'aumento_hc',
      'abertura_casa',
      'adequacao_hc',
      'outro'
    )),
  ADD COLUMN IF NOT EXISTS horario            TEXT,
  ADD COLUMN IF NOT EXISTS salario            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fonte_recrutamento TEXT,
  ADD COLUMN IF NOT EXISTS data_admissao      DATE,
  ADD COLUMN IF NOT EXISTS candidato_aprovado TEXT,
  ADD COLUMN IF NOT EXISTS fechamento_previsto DATE,
  ADD COLUMN IF NOT EXISTS dias_corridos      INTEGER
    GENERATED ALWAYS AS (
      EXTRACT(DAY FROM (CURRENT_DATE - created_at::DATE))::INTEGER
    ) STORED,
  ADD COLUMN IF NOT EXISTS observacoes        TEXT;

-- ------------------------------------------------------------
-- 2. Tabela de log de movimentações (histórico de candidatos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_opening_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id UUID        NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
  texto      TEXT        NOT NULL,
  autor      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE job_opening_logs IS 'Histórico de movimentações por vaga — ex: candidato enviado, aprovado, recusado';

CREATE INDEX IF NOT EXISTS idx_job_opening_logs_opening ON job_opening_logs (opening_id);

-- ------------------------------------------------------------
-- 3. RLS em job_opening_logs
-- ------------------------------------------------------------
ALTER TABLE job_opening_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_opening_logs_select" ON job_opening_logs;
CREATE POLICY "job_opening_logs_select" ON job_opening_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_openings jo
      WHERE jo.id = opening_id
        AND public.kph_has_role_for_unit(jo.unit_id)
    )
  );

DROP POLICY IF EXISTS "job_opening_logs_insert" ON job_opening_logs;
CREATE POLICY "job_opening_logs_insert" ON job_opening_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_openings jo
      WHERE jo.id = opening_id
        AND public.kph_has_role_for_unit(jo.unit_id)
    )
  );

DROP POLICY IF EXISTS "job_opening_logs_delete" ON job_opening_logs;
CREATE POLICY "job_opening_logs_delete" ON job_opening_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM job_openings jo
      WHERE jo.id = opening_id
        AND public.kph_has_role_for_unit(jo.unit_id)
    )
  );

-- ------------------------------------------------------------
-- 4. Atualizar status_prazo automaticamente via trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recalc_status_prazo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_dias INTEGER;
BEGIN
  IF NEW.status = 'congelada' THEN
    NEW.status_prazo := 'congelada';
  ELSIF NEW.status = 'fechada' THEN
    NEW.status_prazo := 'no_prazo';
  ELSIF NEW.status = 'aberta' AND NEW.sla_dias IS NOT NULL AND NEW.created_at IS NOT NULL THEN
    v_dias := EXTRACT(DAY FROM (CURRENT_DATE - NEW.created_at::DATE))::INTEGER;
    NEW.status_prazo := CASE
      WHEN v_dias <= NEW.sla_dias * 0.6 THEN 'no_prazo'
      WHEN v_dias <= NEW.sla_dias       THEN 'atencao'
      ELSE                                   'atrasado'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_openings_status_prazo ON job_openings;
CREATE TRIGGER trg_job_openings_status_prazo
  BEFORE INSERT OR UPDATE ON job_openings
  FOR EACH ROW EXECUTE FUNCTION fn_recalc_status_prazo();

-- ------------------------------------------------------------
-- 5. View pipeline (une job_openings + units + brands + log count)
--    security_invoker = true garante que RLS das tabelas base é respeitada
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_vagas_pipeline WITH (security_invoker = true) AS
SELECT
  jo.*,
  u.name                AS unit_name,
  b.name                AS brand_name,
  COUNT(jol.id)         AS total_logs,
  MAX(jol.created_at)   AS ultimo_log_em
FROM job_openings jo
LEFT JOIN units  u   ON u.id  = jo.unit_id
LEFT JOIN brands b   ON b.id  = u.brand_id
LEFT JOIN job_opening_logs jol ON jol.opening_id = jo.id
GROUP BY jo.id, u.name, b.name;

COMMENT ON VIEW v_vagas_pipeline IS 'Pipeline de vagas com meta-dados de unidade e contagem de logs';
