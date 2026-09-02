-- Lista segura de contas do Supabase Auth para a área administrativa.
-- auth.users não é exposta pela API REST; esta função retorna somente os
-- campos necessários e exige que o chamador autenticado seja founder.

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  is_founder boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.kph_is_founder() THEN
    RAISE EXCEPTION 'Acesso restrito a founders'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    users.id,
    users.email::text,
    COALESCE(
      NULLIF(users.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(users.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(users.raw_user_meta_data ->> 'name', '')
    )::text AS display_name,
    EXISTS (
      SELECT 1
      FROM public.user_roles user_role
      JOIN public.roles role ON role.id = user_role.role_id
      WHERE user_role.user_id = users.id
        AND role.name = 'founder'
    ) AS is_founder
  FROM auth.users users
  ORDER BY COALESCE(
    users.raw_user_meta_data ->> 'display_name',
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    users.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

COMMENT ON FUNCTION public.admin_list_users() IS
  'Retorna dados mínimos de auth.users exclusivamente para founders autenticados.';
