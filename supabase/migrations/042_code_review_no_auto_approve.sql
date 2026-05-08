-- code_review executa lógica real antes de aprovar — não pode ser auto_approve
UPDATE public.hos_jobs SET auto_approve = FALSE WHERE slug = 'code_review';
