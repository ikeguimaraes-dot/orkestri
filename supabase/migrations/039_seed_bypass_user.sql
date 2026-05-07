-- Migration 039_seed_bypass_user.sql
-- Raiz do bug: digest 2411294100 — "invalid input syntax for type uuid: bypass"
-- requireUser() retornava id "bypass" (string) quando não há sessão ativa.
-- hos_approvals.user_id é UUID NOT NULL REFERENCES auth.users(id) → cast quebrava no INSERT.
-- Correção: UUID fixo 00000000-0000-0000-0000-000000000001 para o user de bypass/dev.
-- Este seed garante que o FK seja satisfeito tanto em hos_approvals quanto em qualquer
-- outra tabela que referencie auth.users(id).

-- 1. Cria o user de bypass em auth.users (só a FK importa; login nunca ocorre).
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'bypass@kph.os',
  '',
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Vincula ao role founder no grupo KPH (necessário para kph_is_founder() se
--    a autenticação for re-habilitada no futuro; sem efeito enquanto service_role é usado).
INSERT INTO public.user_roles (user_id, role_id, group_id)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  r.id,
  g.id
FROM roles r, groups g
WHERE r.name = 'founder'
  AND g.slug = 'kph'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
      AND role_id = r.id
  );
