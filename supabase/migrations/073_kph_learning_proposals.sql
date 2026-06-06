-- Migration 073_kph_learning_proposals.sql
-- Tabela de propostas geradas pelo Learning Machine por módulo.
-- O agente lê dados do módulo, analisa com Claude Haiku e insere propostas
-- com status 'pending'. O painel OrkestriPanel permite aprovar ou descartar.

-- ── 1. Tabela principal ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kph_learning_proposals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo          TEXT        NOT NULL,                          -- 'pessoas' | 'operacao' | 'financeiro'
  tipo            TEXT        NOT NULL CHECK (tipo IN ('faq','prompt','processo','integracao')),
  prioridade      TEXT        NOT NULL CHECK (prioridade IN ('alta','media','baixa')),
  titulo          TEXT        NOT NULL,
  descricao       TEXT        NOT NULL,
  evidencia       TEXT,                                          -- dado/métrica que sustenta a proposta
  impacto_estimado TEXT,                                         -- efeito esperado se implementado
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at     TIMESTAMPTZ                                    -- preenchido quando aprovado/executado
);

-- ── 2. Índices ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kph_learning_proposals_modulo_status
  ON public.kph_learning_proposals (modulo, status);

CREATE INDEX IF NOT EXISTS idx_kph_learning_proposals_created_at
  ON public.kph_learning_proposals (created_at DESC);

-- ── 3. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.kph_learning_proposals ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado pode ver propostas
CREATE POLICY "kph_learning_proposals_select"
  ON public.kph_learning_proposals
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserção: apenas service_role (agentes) criam propostas
-- (sem política INSERT para authenticated — só service_role bypassa RLS)

-- Atualização: usuários autenticados podem atualizar status (aprovar/descartar)
CREATE POLICY "kph_learning_proposals_update"
  ON public.kph_learning_proposals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (status IN ('approved','dismissed'));

-- ── 4. Comentários ────────────────────────────────────────────────────────
COMMENT ON TABLE public.kph_learning_proposals IS
  'Propostas de melhoria geradas pelo Learning Machine por módulo do KPH OS.';
COMMENT ON COLUMN public.kph_learning_proposals.modulo IS
  'Módulo de origem: pessoas | operacao | financeiro';
COMMENT ON COLUMN public.kph_learning_proposals.tipo IS
  'Tipo de proposta: faq | prompt | processo | integracao';
COMMENT ON COLUMN public.kph_learning_proposals.prioridade IS
  'Prioridade: alta | media | baixa';
COMMENT ON COLUMN public.kph_learning_proposals.evidencia IS
  'Dado ou métrica que sustenta a proposta (ex: "23% de turnover no mês")';
COMMENT ON COLUMN public.kph_learning_proposals.impacto_estimado IS
  'Efeito esperado se a proposta for implementada';
COMMENT ON COLUMN public.kph_learning_proposals.status IS
  'pending = aguardando decisão | approved = aprovado | dismissed = descartado';
COMMENT ON COLUMN public.kph_learning_proposals.executed_at IS
  'Timestamp de quando a proposta foi aprovada ou descartada';
