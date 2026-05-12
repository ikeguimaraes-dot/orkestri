-- Módulo de Feedback Contínuo entre colaboradores
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id          UUID        NOT NULL REFERENCES public.units(id),
  de_employee_id   UUID        NOT NULL REFERENCES public.employees(id),
  para_employee_id UUID        NOT NULL REFERENCES public.employees(id),
  tipo             TEXT        NOT NULL CHECK (tipo IN ('positivo', 'desenvolvimento')),
  categoria        TEXT        NOT NULL CHECK (categoria IN (
    'atendimento', 'trabalho_em_equipe', 'lideranca',
    'pontualidade', 'tecnico', 'comportamento', 'outro'
  )),
  mensagem         TEXT        NOT NULL,
  anonimo          BOOLEAN     DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT feedback_nao_proprio CHECK (de_employee_id != para_employee_id)
);

CREATE INDEX IF NOT EXISTS feedbacks_para_employee ON public.feedbacks(para_employee_id);
CREATE INDEX IF NOT EXISTS feedbacks_unit          ON public.feedbacks(unit_id);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_access" ON public.feedbacks
  USING (unit_id IN (
    SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
  ));
