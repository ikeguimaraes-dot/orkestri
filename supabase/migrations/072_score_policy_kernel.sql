-- Migration 072: kernel de política de score
--
-- Adiciona dois pilares necessários para que o score oficial nunca contradiga um risco crítico:
--
-- 1. kph_learning_proposals.severidade
--    Classifica cada proposta em CRITICO / ALTO / MEDIO / BAIXO.
--    Agentes gravam aqui; o kernel lê para decidir o teto.
--    CHECK constraint garante que valores inválidos nunca entram.
--
-- 2. kph_intelligence_scores.score_oficial + cap_razao
--    score_oficial: score pós-teto — o número que todos os painéis exibem.
--    cap_razao: por que o teto foi aplicado (qual risco, qual severidade).
--    CHECK garante 0–100; NULL = ainda não computado (usar score raw como fallback).
--
-- Regra de teto (definida em src/lib/score-policy.ts):
--   CRITICO → max 60
--   ALTO    → max 80
--   MEDIO/BAIXO → sem teto

ALTER TABLE kph_learning_proposals
  ADD COLUMN IF NOT EXISTS severidade text
  CONSTRAINT kph_learning_proposals_severidade_check
  CHECK (severidade IS NULL OR severidade IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO'));

ALTER TABLE kph_intelligence_scores
  ADD COLUMN IF NOT EXISTS score_oficial integer
  CONSTRAINT kph_intelligence_scores_score_oficial_check
  CHECK (score_oficial IS NULL OR (score_oficial >= 0 AND score_oficial <= 100)),
  ADD COLUMN IF NOT EXISTS cap_razao text;

-- Índice para busca eficiente de proposals pendentes por módulo+severidade
CREATE INDEX IF NOT EXISTS idx_klp_modulo_sev_pending
  ON kph_learning_proposals (modulo, severidade)
  WHERE status = 'pending';
