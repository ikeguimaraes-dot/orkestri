-- Migration 045 — theo_tickets
-- Tabela de tickets do agente SAC Theo (WhatsApp interno KPH)
-- Aplicada manualmente em 10/05/2026 via psql (adicionada ao repo retroativamente)

CREATE TABLE IF NOT EXISTS theo_tickets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID        REFERENCES employees(id) ON DELETE SET NULL,
  categoria    TEXT        NOT NULL,
  descricao    TEXT,
  status       TEXT        NOT NULL DEFAULT 'aberto',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE theo_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'theo_tickets'
    AND policyname = 'theo_tickets_service_role'
  ) THEN
    CREATE POLICY theo_tickets_service_role ON theo_tickets
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_theo_tickets_employee ON theo_tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_theo_tickets_status ON theo_tickets(status);
