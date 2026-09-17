-- Ecopac Digital - un lote que YA vencio tambien necesita su alerta (issue #834)
--
-- EL SINTOMA. En el inventario aparece un lote vencido, pero la pestana de alertas, en su bloque
-- "Vencidos - Para dar de baja", esta vacia. La lista de ese bloque sale de alertas_caducidad
-- (useAlertasVencimiento.js -> listarAlertas()), y para ese lote nunca se creo ninguna fila.
--
-- POR QUE. fn_generar_alertas_caducidad() (00088) elige sus candidatos con
--
--     WHERE l.fecha_vencimiento >= CURRENT_DATE AND l.fecha_vencimiento <= CURRENT_DATE + 30
--
-- El limite de arriba es el que da sentido a la funcion: avisar con 30 dias. El de ABAJO, en
-- cambio, dice "y ademas que no haya vencido todavia", y eso deja permanentemente fuera:
--
--   - Un lote que ya estaba vencido la primera vez que corrio la rutina (una carga inicial de
--     inventario con lotes viejos, que es justo el caso de una ONG que digitaliza lo que tenia en
--     papel).
--   - Un lote cuya alerta se atendio mientras aun no vencia: al dia siguiente de vencer no vuelve
--     a entrar como candidato, asi que no queda ninguna alerta pendiente que lo recuerde.
--   - Cualquier lote que venciera durante una ventana en la que la rutina programada no corrio.
--
-- En los tres casos el medicamento sigue en existencia, sigue sin poder entregarse (la 00044 lo
-- impide) y nadie tiene por donde darlo de baja. El bloque que existe para exactamente eso se
-- queda vacio.
--
-- EL ARREGLO. Se quita el limite inferior: el candidato es todo lote con existencia mayor que
-- cero que vence dentro de los proximos 30 dias O QUE YA VENCIO. El resto de la funcion no
-- cambia: sigue descartando con NOT EXISTS los lotes que ya tienen una alerta pendiente, asi que
-- sigue siendo idempotente, y la UNIQUE INDEX uq_alertas_caducidad_lote_pendiente (00021) sigue
-- siendo el respaldo.
--
-- La 00088 no se edita: se reemplaza la funcion hacia adelante, como manda AGENTS.md.

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
    WHERE l.fecha_vencimiento <= CURRENT_DATE + 30
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
  '30 dias o menos, INCLUIDOS los que ya vencieron (issue #834: un lote ya vencido nunca entraba '
  'como candidato, asi que el bloque "Vencidos - Para dar de baja" quedaba vacio y no habia por '
  'donde darlo de baja). No duplica: descarta los lotes que ya tienen una alerta pendiente. '
  'SECURITY DEFINER; la invocan la Edge Function programada y fn_sincronizar_alertas_caducidad().';

REVOKE ALL ON FUNCTION fn_generar_alertas_caducidad() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Que la administradora pueda ponerse al dia sin esperar a la rutina de la noche
-- ---------------------------------------------------------------------------
--
-- Con el arreglo de arriba, el lote vencido entra como candidato, pero la fila no aparece hasta
-- que la Edge Function programada vuelva a correr. Para quien acaba de registrar el ingreso de un
-- lote vencido -o acaba de ver el aviso en la lista de inventario- eso es esperar hasta el dia
-- siguiente para poder darlo de baja.
--
-- Este envoltorio deja que la pantalla de alertas dispare la misma generacion al abrirse. No abre
-- ninguna puerta nueva: comprueba es_administrador() por dentro -el mismo rol que la politica
-- "Solo administrador atiende alertas_caducidad" (00034) exige para cerrarlas- y lo unico que
-- puede hacer es crear alertas pendientes que la rutina habria creado igual. Sin ese rol lanza,
-- en vez de devolver 0 en silencio: un fallo mudo aqui pareceria "no hay nada vencido".
CREATE OR REPLACE FUNCTION fn_sincronizar_alertas_caducidad()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creadas INT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo administracion puede sincronizar las alertas de caducidad.'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.fn_generar_alertas_caducidad() INTO v_creadas;
  RETURN v_creadas;
END;
$$;

COMMENT ON FUNCTION fn_sincronizar_alertas_caducidad() IS
  'Ejecuta fn_generar_alertas_caducidad() a peticion de la administradora, para que la pestana '
  'de alertas no dependa de cuando corrio por ultima vez la rutina programada (issue #834). '
  'Devuelve cuantas alertas nuevas creo. Comprueba es_administrador(); sin ese rol lanza 42501.';

REVOKE ALL ON FUNCTION fn_sincronizar_alertas_caducidad() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_sincronizar_alertas_caducidad() TO authenticated;
