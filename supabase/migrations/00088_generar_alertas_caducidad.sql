-- Ecopac Digital - fn_generar_alertas_caducidad(), para la Edge Function programada (issue #166)
--
-- La logica de "que lote necesita alerta" vive en SQL y no en la Edge Function, mismo criterio
-- que fn_existencias_disponibles (00065) y fn_aplicar_ajuste_existencias (00047): es una consulta
-- de agregacion (existencia total por lote, sumada entre bodegas) que Postgres resuelve en una
-- sola pasada, y que asi queda atomica -- todo o nada, sin estado a medias si algo falla a mitad
-- de camino (criterio 4 del DoD) -- y probable con pgTAP, igual que el resto del esquema.
--
-- LOS CRITERIOS DEL DOD, UNO A UNO
--
-- 1. "revisa todos los lotes con existencia mayor que cero y genera alertas para los que vencen
--    en 30 dias o menos": existencias esta particionada por (lote_id, bodega_id) (00020), asi
--    que "existencia del lote" es la suma entre bodegas, no una fila. fecha_vencimiento vive en
--    lotes, no en existencias.
-- 2. "no se generan alertas duplicadas para un lote que ya tiene una pendiente": el candidato se
--    descarta con NOT EXISTS contra alertas_caducidad en estado 'pendiente'. La UNIQUE INDEX
--    uq_alertas_caducidad_lote_pendiente (00021) es el respaldo si dos corridas coincidieran
--    exactamente en el mismo instante: la segunda INSERT fallaria con 23505 en vez de duplicar.
-- 3. "es idempotente: ejecutarla dos veces el mismo dia no cambia el resultado": es consecuencia
--    directa del punto 2 -- la segunda corrida no encuentra candidatos nuevos, porque los lotes
--    que ya tenian alerta siguen teniendola pendiente -- no de logica de fecha aparte.
-- 4. Ver el comentario de arriba: una sola sentencia, atomica.
-- 5. El lint de Edge Functions se cubre en el archivo de la funcion, no aqui.
--
-- POR QUE SECURITY DEFINER Y REVOKE DE PUBLIC
--
-- alertas_caducidad no tiene ninguna politica de INSERT para anon/authenticated (00034, a
-- proposito: "se generan por rutina programada, no por un rol de aplicacion"). SECURITY DEFINER
-- hace que esta funcion escriba con los privilegios de su dueno (el rol de la migracion, exento
-- de RLS) en vez de los de quien la invoca. El REVOKE de PUBLIC es el mismo patron que
-- fn_crear_usuario_administrativo (00074): ni authenticated ni anon reciben EXECUTE, asi que
-- SECURITY DEFINER no abre una puerta nueva -- solo la Edge Function, con la llave de servicio
-- (que ya bypasea GRANT/RLS por su cuenta), la va a poder llamar.

CREATE OR REPLACE FUNCTION fn_generar_alertas_caducidad()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidatos AS (
    SELECT
      l.id AS lote_id,
      SUM(e.cantidad_disponible) AS cantidad_total
    FROM public.lotes l
    JOIN public.existencias e ON e.lote_id = l.id
    WHERE l.fecha_vencimiento >= CURRENT_DATE
      AND l.fecha_vencimiento <= CURRENT_DATE + 30
    GROUP BY l.id
    HAVING SUM(e.cantidad_disponible) > 0
  ),
  nuevas AS (
    INSERT INTO public.alertas_caducidad (lote_id, cantidad_afectada)
    SELECT c.lote_id, c.cantidad_total
    FROM candidatos c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.alertas_caducidad a
      WHERE a.lote_id = c.lote_id AND a.estado = 'pendiente'
    )
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM nuevas;
$$;

COMMENT ON FUNCTION fn_generar_alertas_caducidad() IS
  'Genera una alerta pendiente por cada lote con existencia total mayor que cero que vence en '
  '30 dias o menos y que no tenga ya una alerta pendiente. Devuelve cuantas alertas nuevas creo. '
  'SECURITY DEFINER, sin GRANT a authenticated/anon (issue #166): solo la Edge Function '
  'programada, con la llave de servicio, la invoca.';

REVOKE ALL ON FUNCTION fn_generar_alertas_caducidad() FROM PUBLIC;
