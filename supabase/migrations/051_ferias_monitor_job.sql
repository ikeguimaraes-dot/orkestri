INSERT INTO hos_jobs (name, slug, description, auto_approve, is_active)
VALUES (
  'Férias Monitor',
  'ferias_monitor',
  'Detecta colaboradores com +12 meses sem férias agendadas',
  false,
  true
) ON CONFLICT (slug) DO NOTHING;
