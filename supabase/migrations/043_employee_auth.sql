-- ── 043_employee_auth.sql ─────────────────────────────────────────────────
-- Auth do app mobile HOS: colaboradores autenticam com CPF + senha.
-- NÃO usa auth.users do Supabase — sistema de auth próprio, leve e offline-first.

CREATE TABLE IF NOT EXISTS employee_auth (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cpf            TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_auth_cpf         ON employee_auth(cpf);
CREATE INDEX IF NOT EXISTS idx_employee_auth_employee_id ON employee_auth(employee_id);

ALTER TABLE employee_auth ENABLE ROW LEVEL SECURITY;

-- Todas as operações via service_role (app mobile usa service_role key)
-- TODO Sprint 7: migrar para anon key + policies por employee_id
CREATE POLICY "employee_auth_service_role_all" ON employee_auth
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_employee_auth_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_auth_updated_at ON employee_auth;
CREATE TRIGGER trg_employee_auth_updated_at
  BEFORE UPDATE ON employee_auth
  FOR EACH ROW EXECUTE FUNCTION update_employee_auth_updated_at();
