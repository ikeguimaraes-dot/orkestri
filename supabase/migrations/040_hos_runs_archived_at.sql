ALTER TABLE public.hos_runs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS hos_runs_active_idx
  ON public.hos_runs(created_at DESC)
  WHERE archived_at IS NULL;

-- Arquiva runs antigos sem decisão registrada (ruído de desenvolvimento)
UPDATE public.hos_runs
SET archived_at = NOW()
WHERE created_at < NOW() - INTERVAL '6 hours'
  AND status = 'awaiting_approval'
  AND archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.hos_approvals a WHERE a.run_id = public.hos_runs.id
  );
