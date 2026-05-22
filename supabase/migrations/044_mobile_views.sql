-- ── 044_mobile_views.sql ──────────────────────────────────────────────────
-- Views para compatibilidade com o app mobile HOS.
-- O app consulta `tips_records` — esta view agrega gorjeta_dias por collab/mês.

CREATE OR REPLACE VIEW tips_records AS
SELECT
  -- ID determinístico para uso como React key no app
  md5(gd.employee_id::text || to_char(gd.data, 'YYYY-MM'))::uuid AS id,
  gd.employee_id,
  to_char(gd.data, 'YYYY-MM')                                     AS periodo,
  SUM(gd.pontos)::numeric(10,2)                                    AS total_pontos,
  SUM(gd.pontos)::numeric(10,2)                                    AS pontos_liquidos,
  CASE
    WHEN SUM(gd.pontos) > 0
    THEN (SUM(gd.valor_calculado) / SUM(gd.pontos))::numeric(10,4)
    ELSE 0
  END                                                              AS valor_ponto,
  SUM(gd.valor_calculado)::numeric(10,2)                          AS valor
FROM gorjeta_dias gd
WHERE gd.employee_id IS NOT NULL
GROUP BY gd.employee_id, to_char(gd.data, 'YYYY-MM');

COMMENT ON VIEW tips_records IS
  'Agrega gorjeta_dias por colaborador/mês para o app mobile HOS. Read-only.';
