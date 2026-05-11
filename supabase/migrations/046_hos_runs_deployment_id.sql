-- Migration 046 — hos_runs_deployment_id
-- Adiciona deployment_id à hos_runs para deduplicação de eventos Vercel.
-- Um mesmo deploymentId nunca deve gerar dois runs para o mesmo job.

ALTER TABLE public.hos_runs ADD COLUMN IF NOT EXISTS deployment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hos_runs_deployment_id_job_idx
  ON public.hos_runs (deployment_id, job_id)
  WHERE deployment_id IS NOT NULL;
