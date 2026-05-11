-- Migration 047 — candidates
-- Tabela de candidatos do agente R&S Maya (WhatsApp)
-- Aplicada em 11/05/2026

CREATE TABLE IF NOT EXISTS public.candidates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT        NOT NULL,
  telefone        TEXT        NOT NULL,
  area_interesse  TEXT,
  cargo_interesse TEXT,
  status          TEXT        NOT NULL DEFAULT 'novo'
                  CHECK (status IN ('novo','triagem','entrevista','aprovado','reprovado','desistiu')),
  source          TEXT        NOT NULL DEFAULT 'whatsapp',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_telefone ON public.candidates (telefone);
CREATE INDEX IF NOT EXISTS idx_candidates_status   ON public.candidates (status);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidates' AND policyname = 'candidates_service_role'
  ) THEN
    CREATE POLICY candidates_service_role ON public.candidates
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
