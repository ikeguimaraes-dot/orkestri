-- Migration 056: PDI — Plano de Desenvolvimento Individual

CREATE TABLE IF NOT EXISTS public.pdis (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID        NOT NULL REFERENCES public.units(id),
  employee_id  UUID        NOT NULL REFERENCES public.employees(id),
  titulo       TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  data_inicio  DATE        NOT NULL,
  data_fim     DATE        NOT NULL,
  avaliacao_id UUID        REFERENCES public.performance_reviews(id),
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pdis_employee ON public.pdis(employee_id);
CREATE INDEX IF NOT EXISTS pdis_unit     ON public.pdis(unit_id);

ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_access" ON public.pdis
  USING (unit_id IN (
    SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Metas do PDI
CREATE TABLE IF NOT EXISTS public.pdi_metas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id    UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  prazo     DATE NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  progresso INT  NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS pdi_metas_pdi ON public.pdi_metas(pdi_id);

ALTER TABLE public.pdi_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdi_unit_access" ON public.pdi_metas
  USING (pdi_id IN (
    SELECT id FROM public.pdis
    WHERE unit_id IN (
      SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  ));
