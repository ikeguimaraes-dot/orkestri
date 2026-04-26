-- Fase 1 / Holerites — completar policies do payslips.
-- A migration 003 só criou SELECT; INSERT/UPDATE/DELETE ficaram bloqueados
-- pelo RLS, impedindo o módulo Holerites de gravar.
--
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE.

-- INSERT: qualquer role da unit do employee pode criar holerite.
DROP POLICY IF EXISTS "payslips_insert" ON payslips;
CREATE POLICY "payslips_insert" ON payslips FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- UPDATE: para mudar status (rascunho → aprovado → pago) e setar pdf_url.
DROP POLICY IF EXISTS "payslips_update" ON payslips;
CREATE POLICY "payslips_update" ON payslips FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- DELETE: só founder. Holerite aprovado/pago não deveria ser deletado normalmente,
-- mas em rascunho dá pra apagar e regerar.
DROP POLICY IF EXISTS "payslips_delete" ON payslips;
CREATE POLICY "payslips_delete" ON payslips FOR DELETE
  USING (kph_is_founder());
