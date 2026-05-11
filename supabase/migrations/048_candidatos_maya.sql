-- Migration 048 — candidatos_maya
-- Leads WhatsApp do agente R&S Maya — separado da tabela candidates (pipeline web KPH OS)

CREATE TABLE IF NOT EXISTS public.candidatos_maya (
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

CREATE INDEX IF NOT EXISTS idx_candidatos_maya_telefone ON public.candidatos_maya (telefone);
CREATE INDEX IF NOT EXISTS idx_candidatos_maya_status   ON public.candidatos_maya (status);

ALTER TABLE public.candidatos_maya ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidatos_maya' AND policyname = 'candidatos_maya_service_role'
  ) THEN
    CREATE POLICY candidatos_maya_service_role ON public.candidatos_maya
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
