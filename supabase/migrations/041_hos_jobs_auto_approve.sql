ALTER TABLE public.hos_jobs
  ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT FALSE;

-- Jobs de baixo risco: aprovam automaticamente
UPDATE public.hos_jobs SET auto_approve = TRUE
  WHERE slug IN ('qa_preview', 'code_review');

-- deploy_prod permanece FALSE (aprovação humana obrigatória)
