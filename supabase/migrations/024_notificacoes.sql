-- KPH OS — 024_notificacoes.sql
-- Sprint 4 / Etapa 4 — módulo Notificações in-app.
--
-- Pré-req: nenhum (auth.users é parte do Supabase).
--
-- Aditivo: nenhuma tabela existente alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.
--
-- Modelagem:
--   • notifications: 1 linha por notificação por user_id. Geradas pelo
--     sistema (server-side via createServiceClient — service_role bypassa
--     RLS). User só lê e marca como lida — não cria nem apaga.
--   • RLS: SELECT/UPDATE WHERE user_id = auth.uid(). INSERT/DELETE não
--     são granted pra authenticated → apenas service_role insere.

-- ── TABELA ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  mensagem    TEXT,
  link        TEXT,
  lida        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_lida
  ON notifications(user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Sem policy de INSERT pra authenticated → INSERT só via service_role
-- (createServiceClient bypassa RLS).
-- Sem policy de DELETE → ninguém apaga via API; cascade via auth.users
-- cuida quando user é deletado.

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, UPDATE ON notifications TO authenticated;
