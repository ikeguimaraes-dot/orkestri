-- KPH OS — 026_fix_rls_multi_unit.sql
-- Etapa 5 Sprint 5 — Multi-unit auditoria e correções.
--
-- Bug identificado: kph_has_role_for_unit(p_unit_id) só verificava
-- user_roles.unit_id = p_unit_id. Um usuário com role brand-level
-- (brand_id setado, unit_id NULL) era barrado em TODOS os recursos
-- de unidade: employees, shifts, payslips, punches, etc.
--
-- A função irmã kph_has_role_for_brand já inclui acesso via unit_id
-- ("unit-level user vê brand-level data"). O inverso faltava:
-- "brand-level user vê unit-level data das suas brands".
--
-- Correção: adicionar OR ur.brand_id IN (SELECT brand_id FROM units WHERE id = p_unit_id).
-- O índice idx_units_brand (001) e o novo idx_user_roles_brand tornam a
-- subquery de O(1) na prática.
--
-- Cascata automática: todas as 15+ policies que chamam kph_has_role_for_unit
-- (employees, shifts, payslips, time_clock_punches, time_bank_balance, vacations,
-- absences, warnings, etc.) ganham o fix sem nenhuma alteração adicional.
--
-- Idempotente.

-- ── 1. Índice brand_id em user_roles ───────────────────────────
-- Melhora a subquery OR ur.brand_id IN (...) em todos os helpers.

CREATE INDEX IF NOT EXISTS idx_user_roles_brand ON user_roles(brand_id);

-- ── 2. Patch do helper central ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.kph_has_role_for_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (
            -- Acesso direto à unidade (role unit-scoped)
            ur.unit_id = p_unit_id
            -- OU acesso brand-level para a brand dona desta unit
            OR ur.brand_id IN (
              SELECT brand_id FROM units WHERE id = p_unit_id
            )
          )
      );
$$;

-- ── 3. Helper complementar: lista todas as unit_ids acessíveis ─
-- Útil para queries IN (SELECT kph_accessible_unit_ids())
-- sem precisar fazer JOIN explícito em application code.

CREATE OR REPLACE FUNCTION public.kph_accessible_unit_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Founder vê tudo
  SELECT id FROM units WHERE public.kph_is_founder()
  UNION
  -- Unit-scoped roles
  SELECT ur.unit_id
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.unit_id IS NOT NULL
  UNION
  -- Brand-scoped roles: todas as units da brand
  SELECT u.id
  FROM units u
  JOIN user_roles ur ON ur.brand_id = u.brand_id
  WHERE ur.user_id = auth.uid()
    AND ur.brand_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.kph_accessible_unit_ids() TO authenticated;
