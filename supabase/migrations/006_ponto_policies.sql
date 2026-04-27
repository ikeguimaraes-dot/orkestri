-- Fase 1 / Ponto — completar policies de time_clock_punches.
-- A migration 003 só criou SELECT; INSERT/UPDATE estavam bloqueados
-- pelo RLS. Mesmo padrão do bug que tivemos em payslips (004).
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.

-- INSERT: dois caminhos válidos
--   1. Colaborador batendo o próprio ponto: employee.user_id = auth.uid()
--   2. GM/founder batendo em nome do colaborador (caso ele esteja sem
--      conta vinculada): kph_has_role_for_unit
DROP POLICY IF EXISTS "punches_insert" ON time_clock_punches;
CREATE POLICY "punches_insert" ON time_clock_punches FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id
      AND (e.user_id = auth.uid() OR kph_has_role_for_unit(e.unit_id))
  ));

-- UPDATE: só GM/founder aprova/rejeita. Colaborador não muda
-- ponto registrado (auditoria).
DROP POLICY IF EXISTS "punches_update" ON time_clock_punches;
CREATE POLICY "punches_update" ON time_clock_punches FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_id AND kph_has_role_for_unit(e.unit_id)
  ));

-- DELETE: só founder, e em casos excepcionais (registro duplicado, erro).
DROP POLICY IF EXISTS "punches_delete" ON time_clock_punches;
CREATE POLICY "punches_delete" ON time_clock_punches FOR DELETE
  USING (kph_is_founder());
