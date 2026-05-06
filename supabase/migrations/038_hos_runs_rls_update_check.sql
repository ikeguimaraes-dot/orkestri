-- Migration 038_hos_runs_rls_update_check.sql
-- Adiciona WITH CHECK à policy de UPDATE em hos_runs para evitar bloqueio silencioso de RLS.
-- Sem WITH CHECK, o PostgreSQL reutiliza USING como check pós-update, mas a ausência
-- tornava difícil diagnosticar rejeições silenciosas via PostgREST.

DROP POLICY IF EXISTS "Admins podem atualizar execucoes" ON public.hos_runs;

CREATE POLICY "Admins podem atualizar execucoes"
    ON public.hos_runs FOR UPDATE
    TO authenticated
    USING (public.kph_has_role_for_unit(null) OR public.kph_is_founder())
    WITH CHECK (public.kph_has_role_for_unit(null) OR public.kph_is_founder());
