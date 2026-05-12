-- Migration 058: Organograma — campo manager_id nos employees

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id);

CREATE INDEX IF NOT EXISTS employees_manager ON public.employees(manager_id);
