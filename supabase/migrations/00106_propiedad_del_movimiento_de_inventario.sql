-- Ecopac Digital - De quien es un movimiento de inventario, y hasta cuando (issue #625)
--
-- QUE ESTABA MAL
--
-- editarMovimiento() (packages/shared/inventario/movimientos.api.js) documenta que edita
-- "unicamente si se encuentra en estado pendiente y la modificacion es realizada por la misma
-- persona que lo registro". La politica de UPDATE vigente (00048, ampliada por la 00086) admite
-- solo es_administrador() o tiene_permiso('inventario.aprobar'), asi que para un medico o un
-- voluntario esa funcion NO PODIA FUNCIONAR: el UPDATE no alcanzaba ninguna fila y PostgREST
-- devuelve exito sin haber cambiado nada, que es la peor forma de fallar.
--
-- LA REGLA QUE SI RIGE, Y QUE ESTA MIGRACION IMPLEMENTA
--
-- La propiedad de un movimiento cambia con su estado:
--
--   pendiente  -> es de quien lo registro. Solo esa persona lo corrige. La administradora
--                 tambien entra, porque aprobar y rechazar son UPDATE sobre esta misma fila.
--   aprobado   -> pasa a ser de la administradora. Quien lo registro ya no lo toca.
--   rechazado  -> igual: la decision fue de ella y la fila queda bajo su nombre.
--
-- QUE **NO** CAMBIA, Y POR QUE NO DEBE CAMBIAR
--
-- Un movimiento aprobado ya movio existencias. Reescribir su cantidad, su lote o su bodega
-- dejaria existencias.cantidad_disponible diciendo una cosa y el historial de movimientos otra,
-- sin forma de saber cual de las dos miente. Por eso fn_bloquear_movimiento_finalizado (00023)
-- sigue congelando las columnas que definen el movimiento, **tambien para la administradora**:
-- corregir un aprobado es registrar el movimiento que lo compensa, no reescribir la historia.
--
-- Lo que si se abre es lo descriptivo. Hasta ahora el trigger bloqueaba la fila entera, asi que
-- un motivo mal escrito o un motivo_rechazo que habia que precisar quedaban mal para siempre y
-- ni la duenia de la fila podia arreglarlo. Eso no protegia ninguna integridad: no hay numero que
-- se desincronice por corregir un texto.

-- ============================================================================
-- 1. Quien puede intentar el UPDATE
-- ============================================================================
-- La rama de quien registro pide `estado = 'pendiente'` en las DOS clausulas, y ahi esta el
-- candado que impide la autoaprobacion:
--
--   USING      mira la fila VIEJA -> solo se puede partir de un movimiento pendiente.
--   WITH CHECK mira la fila NUEVA -> solo se puede llegar a un movimiento pendiente.
--
-- Un voluntario que intente pasar el suyo a 'aprobado' falla el WITH CHECK. Y `registrado_por =
-- auth.uid()` en el WITH CHECK impide ademas que le cambie el duenio a la fila para escaparse de
-- la propia regla.
ALTER POLICY "Administrador aprueba o rechaza"
  ON movimientos_inventario
  USING (
    public.es_administrador()
    OR public.tiene_permiso('inventario.aprobar')
    OR (registrado_por = auth.uid() AND estado = 'pendiente')
  )
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('inventario.aprobar')
    OR (registrado_por = auth.uid() AND estado = 'pendiente')
  );

COMMENT ON POLICY "Administrador aprueba o rechaza" ON movimientos_inventario IS
  'Quien registro un movimiento lo corrige mientras siga pendiente; la administradora (o quien '
  'tenga inventario.aprobar) puede siempre. El nombre de la politica es el de la 00048 y se '
  'conserva para no romper los ALTER POLICY de migraciones futuras, pero desde la 00105/00106 '
  'gobierna tambien la edicion, no solo la aprobacion.';

-- ============================================================================
-- 2. Las columnas de la decision son de quien decide
-- ============================================================================
-- La politica de arriba deja fuera la autoaprobacion via `estado`, pero no dice nada de
-- aprobado_por, aprobado_en, motivo_rechazo ni aprobacion_automatica: un voluntario podria
-- dejarlas escritas a su gusto mientras conserva estado='pendiente'. No causaria un descuadre de
-- stock, pero si una fila que miente sobre quien decidio que.
--
-- WITH CHECK no puede expresar esto porque no ve la fila vieja y lo que importa es el CAMBIO.
-- Por eso va en un trigger.
CREATE OR REPLACE FUNCTION fn_proteger_decision_de_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sin sesion no hay a quien atribuirle nada, y esta regla habla justamente de atribucion.
  -- auth.uid() es NULL en una conexion directa: `supabase db reset` sembrando seed-demo.sql, una
  -- migracion, service_role. Todas ellas ya pasan por encima de RLS por definicion, asi que
  -- comprobarlas aqui no protegeria nada y si romperia el seed, que fija aprobado_por a mano.
  -- Es el mismo criterio con el que la 00028 dejo fuera a esas sesiones de la autoaprobacion.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.es_administrador() OR public.tiene_permiso('inventario.aprobar') THEN
    RETURN NEW;
  END IF;

  -- El estado va primero, y no es redundante con el WITH CHECK de la politica.
  --
  -- Los triggers BEFORE corren ANTES de que Postgres evalue el WITH CHECK, y uno de ellos
  -- -tr_actualizar_existencias, que ordena antes que este por nombre- sella NEW.aprobado_en en
  -- cuanto ve que el estado paso a 'aprobado'. Sin esta comprobacion, un voluntario que intenta
  -- autoaprobarse quedaba frenado por la clausula de abajo, quejandose de una columna que el no
  -- escribio: bloqueado, si, pero con un mensaje que manda a investigar lo que no es.
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION
      'Solo quien aprueba puede cambiar el estado de un movimiento de inventario.';
  END IF;

  IF NEW.aprobado_por IS DISTINCT FROM OLD.aprobado_por
     OR NEW.aprobado_en IS DISTINCT FROM OLD.aprobado_en
     OR NEW.motivo_rechazo IS DISTINCT FROM OLD.motivo_rechazo
     OR NEW.aprobacion_automatica IS DISTINCT FROM OLD.aprobacion_automatica THEN
    RAISE EXCEPTION
      'Solo quien aprueba puede escribir aprobado_por, aprobado_en, motivo_rechazo o aprobacion_automatica.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_proteger_decision_de_movimiento() IS
  'Impide que quien registro un movimiento escriba las columnas que documentan la decision de '
  'quien lo aprueba o lo rechaza (issue #625). La politica RLS ya le impide cambiar estado; esto '
  'cubre las cuatro columnas que la acompanian, que WITH CHECK no puede vigilar porque lo que '
  'importa es el cambio y no el valor final.';

CREATE TRIGGER tr_proteger_decision_de_movimiento
BEFORE UPDATE ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_proteger_decision_de_movimiento();

-- ============================================================================
-- 3. Un movimiento finalizado congela lo que movio stock, no su descripcion
-- ============================================================================
-- Reemplaza a la version de la 00023, que bloqueaba la fila entera para todo el mundo.
--
-- DELETE sigue prohibido sin excepcion: un movimiento aprobado es el respaldo de una existencia
-- que hoy esta en una bodega, y borrarlo deja el numero sin explicacion.
CREATE OR REPLACE FUNCTION fn_bloquear_movimiento_finalizado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado NOT IN ('aprobado', 'rechazado') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'No se puede eliminar un movimiento de inventario en estado %: es el respaldo de la existencia que genero.',
      OLD.estado;
  END IF;

  IF NOT (public.es_administrador() OR public.tiene_permiso('inventario.aprobar')) THEN
    RAISE EXCEPTION
      'Un movimiento en estado % ya no es de quien lo registro: solo la administradora puede tocarlo.',
      OLD.estado;
  END IF;

  -- Lo que define el movimiento queda congelado incluso para ella: ya se aplico sobre
  -- existencias y cambiarlo aqui no lo desaplica. La correccion es un movimiento compensatorio.
  IF NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
     OR NEW.bodega_id IS DISTINCT FROM OLD.bodega_id
     OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por THEN
    RAISE EXCEPTION
      'Un movimiento en estado % ya ajusto las existencias: para corregirlo se registra el movimiento que lo compensa, no se reescribe.',
      OLD.estado;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_bloquear_movimiento_finalizado() IS
  'Un movimiento aprobado o rechazado no lo edita quien lo registro, y ni siquiera la '
  'administradora puede cambiar lo que movio stock (tipo, lote, bodega, cantidad, estado, '
  'registrado_por): eso se corrige con un movimiento compensatorio. Ella si puede corregir el '
  'texto -motivo, motivo_rechazo-, que antes tambien quedaba congelado sin que eso protegiera '
  'ninguna integridad (issue #625). El DELETE sigue prohibido para todos.';

-- El trigger de la 00023 ya apunta a esta funcion (BEFORE UPDATE OR DELETE); CREATE OR REPLACE
-- FUNCTION basta y no hace falta volver a crearlo.
