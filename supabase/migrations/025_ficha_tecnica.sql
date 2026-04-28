-- KPH OS — 025_ficha_tecnica.sql
-- Sprint 5 / Etapa 2 — ficha técnica detalhada de cardápio.
--
-- Pré-req: 010 (financeiro / cmv_items).
--
-- Aditivo: nenhuma tabela existente alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY antes de CREATE POLICY.
--
-- Modelagem:
--   • recipe_items: 1 linha por insumo de um cmv_item. custo_total é
--     GENERATED (quantidade * custo_unitario) — IMMUTABLE.
--   • Trigger fn_recalc_cmv_item_custo_total atualiza cmv_items.custo_total
--     com SUM(recipe_items.custo_total) sempre que recipe_items muda. Isso
--     dispara a recomputação do cmv_items.cmv_pct (GENERATED em 010).
--   • recipe_notes: anotações livres por prato (técnicas, observações).
--   • RLS via kph_has_role_for_unit em recipe_items; recipe_notes cascateia
--     via cmv_items.unit_id.

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id     UUID NOT NULL REFERENCES cmv_items(id) ON DELETE CASCADE,
  unit_id         UUID REFERENCES units(id),
  insumo          TEXT NOT NULL,
  unidade         TEXT,
  quantidade      NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_unitario  NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_total     NUMERIC(14,4) GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id   UUID NOT NULL REFERENCES cmv_items(id) ON DELETE CASCADE,
  nota          TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recipe_items_cmv     ON recipe_items(cmv_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_unit    ON recipe_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_recipe_notes_cmv     ON recipe_notes(cmv_item_id, created_at DESC);

-- ── TRIGGER: recalcula cmv_items.custo_total a partir de recipe_items ──
CREATE OR REPLACE FUNCTION fn_recalc_cmv_item_custo_total()
RETURNS TRIGGER AS $$
DECLARE
  target_cmv_id UUID;
BEGIN
  target_cmv_id := COALESCE(NEW.cmv_item_id, OLD.cmv_item_id);

  UPDATE cmv_items
     SET custo_total       = COALESCE((
           SELECT SUM(custo_total) FROM recipe_items WHERE cmv_item_id = target_cmv_id
         ), 0),
         tem_ficha_tecnica = EXISTS (
           SELECT 1 FROM recipe_items WHERE cmv_item_id = target_cmv_id
         ),
         updated_at        = NOW()
   WHERE id = target_cmv_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recipe_items_recalc_cmv ON recipe_items;
CREATE TRIGGER trg_recipe_items_recalc_cmv
  AFTER INSERT OR UPDATE OR DELETE ON recipe_items
  FOR EACH ROW EXECUTE FUNCTION fn_recalc_cmv_item_custo_total();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_notes ENABLE ROW LEVEL SECURITY;

-- recipe_items: SELECT/INSERT/UPDATE/DELETE via role na unit do cmv_item
-- (unit_id pode estar null em recipe_items — cai no unit_id do cmv_items).
DROP POLICY IF EXISTS "ri_select" ON recipe_items;
CREATE POLICY "ri_select" ON recipe_items FOR SELECT
  USING (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE unit_id IS NULL
         OR kph_has_role_for_unit(unit_id)
         OR kph_has_role_for_brand(brand_id)
    )
  );

DROP POLICY IF EXISTS "ri_insert" ON recipe_items;
CREATE POLICY "ri_insert" ON recipe_items FOR INSERT
  WITH CHECK (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE kph_has_role_for_brand(brand_id)
    )
  );

DROP POLICY IF EXISTS "ri_update" ON recipe_items;
CREATE POLICY "ri_update" ON recipe_items FOR UPDATE
  USING (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE kph_has_role_for_brand(brand_id)
    )
  )
  WITH CHECK (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE kph_has_role_for_brand(brand_id)
    )
  );

DROP POLICY IF EXISTS "ri_delete" ON recipe_items;
CREATE POLICY "ri_delete" ON recipe_items FOR DELETE
  USING (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE kph_has_role_for_brand(brand_id)
    )
  );

-- recipe_notes: cascade via parent cmv_item.
DROP POLICY IF EXISTS "rn_select" ON recipe_notes;
CREATE POLICY "rn_select" ON recipe_notes FOR SELECT
  USING (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE unit_id IS NULL
         OR kph_has_role_for_unit(unit_id)
         OR kph_has_role_for_brand(brand_id)
    )
  );

DROP POLICY IF EXISTS "rn_insert" ON recipe_notes;
CREATE POLICY "rn_insert" ON recipe_notes FOR INSERT
  WITH CHECK (
    cmv_item_id IN (
      SELECT id FROM cmv_items
      WHERE kph_has_role_for_brand(brand_id)
    )
  );

DROP POLICY IF EXISTS "rn_delete" ON recipe_notes;
CREATE POLICY "rn_delete" ON recipe_notes FOR DELETE
  USING (kph_is_founder());

-- ── GRANTS ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_notes TO authenticated;
