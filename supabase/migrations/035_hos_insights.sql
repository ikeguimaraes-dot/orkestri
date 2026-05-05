-- Migration 035_hos_insights.sql
-- Tabela para armazenar Insights Semanais gerados pela Claude API

CREATE TABLE IF NOT EXISTS public.hos_insights (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end   TIMESTAMPTZ NOT NULL,
    report_md    TEXT        NOT NULL,
    metrics      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hos_insights_created_at ON public.hos_insights(created_at DESC);

ALTER TABLE public.hos_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver insights"
    ON public.hos_insights FOR SELECT
    TO authenticated
    USING (public.kph_has_role_for_unit(null) OR public.kph_is_founder());

CREATE POLICY "Admins podem inserir insights"
    ON public.hos_insights FOR INSERT
    TO authenticated
    WITH CHECK (public.kph_has_role_for_unit(null) OR public.kph_is_founder());
