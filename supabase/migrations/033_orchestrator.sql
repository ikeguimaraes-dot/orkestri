CREATE TABLE hos_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hos_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES hos_jobs(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','awaiting_approval','approved','rejected','failed')),
  triggered_by TEXT NOT NULL DEFAULT 'webhook'
    CHECK (triggered_by IN ('webhook','cron','discord','manual')),
  payload JSONB DEFAULT '{}',
  logs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hos_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES hos_runs(id),
  user_id UUID REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hos_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hos_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hos_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê jobs" ON hos_jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','founder','gm'))
);
CREATE POLICY "Admin vê runs" ON hos_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','founder','gm'))
);
CREATE POLICY "Founder aprova" ON hos_approvals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('founder','admin'))
);

INSERT INTO hos_jobs (name, slug, description) VALUES
  ('QA Playwright Preview', 'qa_preview', 'Testes automatizados no ambiente de preview'),
  ('Code Review PR', 'code_review', 'Analisa qualidade do PR antes do merge'),
  ('Deploy Production', 'deploy_prod', 'Promove preview para produção após aprovação');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER runs_updated_at
  BEFORE UPDATE ON hos_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
