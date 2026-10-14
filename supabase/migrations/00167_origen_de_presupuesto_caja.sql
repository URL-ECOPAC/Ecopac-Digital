-- ============================================================================
-- 00167: la caja como origen del presupuesto de una jornada
-- ============================================================================
--
-- Solo agrega el valor al enum. Va sola porque un valor nuevo de un enum no se puede usar en la
-- misma transaccion que lo crea, y la 00168 -la caja en si- lo usa.
-- ============================================================================

ALTER TYPE public.origen_de_presupuesto ADD VALUE IF NOT EXISTS 'caja';
