-- Migration 057: Reuniões 1:1

CREATE TABLE IF NOT EXISTS public.reunioes_1on1 (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       UUID        NOT NULL REFERENCES public.units(id),
  gestor_id     UUID        NOT NULL REFERENCES public.employees(id),
  colaborador_id UUID       NOT NULL REFERENCES public.employees(id),
  data_reuniao  TIMESTAMPTZ NOT NULL,
  duracao_min   INT         DEFAULT 30,
  status        TEXT        NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  notas         TEXT,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT reuniao_diferentes CHECK (gestor_id != colaborador_id)
);

CREATE TABLE IF NOT EXISTS public.reuniao_action_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id     UUID NOT NULL REFERENCES public.reunioes_1on1(id) ON DELETE CASCADE,
  descricao      TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.employees(id),
  prazo          DATE,
  status         TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reunioes_1on1        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniao_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_access" ON public.reunioes_1on1
  USING (unit_id IN (
    SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "action_items_access" ON public.reuniao_action_items
  USING (reuniao_id IN (
    SELECT id FROM public.reunioes_1on1
    WHERE unit_id IN (
      SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX IF NOT EXISTS reunioes_gestor      ON public.reunioes_1on1(gestor_id);
CREATE INDEX IF NOT EXISTS reunioes_colaborador ON public.reunioes_1on1(colaborador_id);
CREATE INDEX IF NOT EXISTS reunioes_data        ON public.reunioes_1on1(data_reuniao);
CREATE INDEX IF NOT EXISTS action_items_reuniao ON public.reuniao_action_items(reuniao_id);
