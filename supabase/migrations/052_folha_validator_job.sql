INSERT INTO hos_jobs (name, slug, description, auto_approve, is_active)
VALUES (
  'Folha Validator',
  'folha_validator',
  'Detecta anomalias em holerites rascunho antes do fechamento',
  false,
  true
) ON CONFLICT (slug) DO NOTHING;
