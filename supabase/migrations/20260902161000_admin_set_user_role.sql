-- Define atomicamente o nível de acesso principal de um usuário.
-- Somente founders autenticados podem executar. Founders existentes são
-- protegidos contra remoção ou rebaixamento acidental.

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id uuid,
  p_role_id uuid,
  p_unit_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.kph_is_founder() THEN
    RAISE EXCEPTION 'Acesso restrito a founders' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.name = 'founder'
  ) THEN
    RAISE EXCEPTION 'O nível de um founder não pode ser alterado por esta tela'
      USING ERRCODE = '42501';
  END IF;

  IF p_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.roles WHERE id = p_role_id
  ) THEN
    RAISE EXCEPTION 'Nível de acesso inválido' USING ERRCODE = '22023';
  END IF;

  IF p_role_id IS NOT NULL AND (
    COALESCE(array_length(p_unit_ids, 1), 0) = 0 OR EXISTS (
      SELECT 1
      FROM unnest(p_unit_ids) selected_unit_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.units
        WHERE id = selected_unit_id AND active = true
      )
    )
  ) THEN
    RAISE EXCEPTION 'Selecione ao menos uma unidade ativa' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  IF p_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id, unit_id)
    SELECT p_user_id, p_role_id, selected_unit_id
    FROM unnest(p_unit_ids) selected_unit_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, uuid, uuid[]) TO authenticated;
