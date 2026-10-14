-- ============================================================================
-- 00186: el inventario de una jornada se cuenta por jornada, y lo pendiente ya esta comprometido
-- ============================================================================
--
-- Issue #925. Al recorrer el flujo completo (crear la jornada, cargar su bodega, recetar, cerrar y
-- devolver) las cuentas de Consumo no cuadraban, y en varios casos el inventario cambiaba de
-- bodega sin dejar rastro en ninguna jornada. Las decisiones que se tomaron en la issue son:
--
--   1B. Una salida por receta que registra el medico sigue naciendo pendiente (00028/00112), pero
--       lo pendiente queda COMPROMETIDO: lo disponible para recetar, cargar, devolver o trasladar
--       ya lo descuenta, y Consumo lo muestra aparte. Antes la siguiente receta veia 50 donde en la
--       caja quedaban 40.
--   2A. "Queda" se calcula por jornada: cargado - entregado - devuelto. Antes era lo que hubiera en
--       ese momento en toda la bodega, asi que una jornada cerrada cambiaba cuando otra cargaba la
--       misma bodega, y la siguiente heredaba el sobrante como si fuera suyo.
--   3B. Cargar desde la bodega movil de otra jornada esta permitido, pero queda registrado en las
--       dos: como devuelto en la que la tenia y como cargado en la que la recibe. Lo mismo un
--       traslado de Inventario hacia o desde una bodega movil.
--   4A. Anular una receta es "no se entrego": lo que salio vuelve a la bodega y lo que seguia
--       pendiente se cancela.
--   +   Cuando una jornada empieza con una bodega que todavia tiene sobrante de otra, el sobrante
--       pasa a la jornada nueva al iniciarla (traspaso): devuelto en la anterior, cargado en la
--       nueva. El inventario fisico no se mueve; solo cambia de quien es.
--
-- Contenido:
--   1. movimientos_inventario.receta_id: de que receta es una salida o un ajuste.
--   2. La marca de "aprobacion de sistema" para los movimientos que nacen de una regla y no de
--      una persona (el traspaso, la anulacion).
--   3. Lo comprometido y lo disponible neto; vista_lotes_disponibles descuenta lo comprometido.
--   4. De que jornada es el inventario de una bodega movil.
--   5. fn_trasladar_entre_bodegas registra cada lado en su jornada.
--   6. Cargar y devolver.
--   7. La receta y su ajuste descuentan lo comprometido y quedan enlazados.
--   8. Anular una receta devuelve el inventario.
--   9. El traspaso al iniciar la jornada.
--  10. fn_consumo_de_insumos_de_jornada con lo pendiente y lo que queda de la jornada.
--  11. fn_insumos_de_proyecto: lo que queda en las jornadas de un proyecto, sin contar dos veces.
--  12. La entrega de una receta se valida completa: una notificacion, aprobar o rechazar todo.
--  13. Los indicadores y reportes de la jornada no cuentan recetas anuladas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. De que receta es un movimiento
-- ----------------------------------------------------------------------------
-- Hasta aqui la unica pista era el folio dentro del texto del motivo ("Entrega por receta medica
-- REC-..."). Anular una receta (seccion 8) y contar lo pendiente de una jornada (seccion 10)
-- necesitan saberlo sin leer texto.
ALTER TABLE public.movimientos_inventario
  ADD COLUMN receta_id UUID REFERENCES public.recetas (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.movimientos_inventario.receta_id IS
  'Receta de la que sale el movimiento: la salida que registra fn_generar_receta, el ajuste de fn_ajustar_entrega_receta y la devolucion al anularla (00186). NULL en cualquier otro movimiento.';

CREATE INDEX idx_movimientos_inventario_receta_id
  ON public.movimientos_inventario (receta_id)
  WHERE receta_id IS NOT NULL;

-- Lo ya registrado, con las dos pistas que dejaban los motivos: el folio en la salida de la
-- receta (00112) y el id del renglon en el ajuste (00128). Un movimiento aprobado o rechazado no
-- se toca (tr_bloquear_movimiento_finalizado, 00023/00106), y eso protege lo que documenta: el
-- estado, la cantidad, quien decidio. receta_id no cambia nada de eso; solo dice de donde vino. Se
-- apaga ese trigger para este relleno y se vuelve a encender enseguida.
ALTER TABLE public.movimientos_inventario DISABLE TRIGGER tr_bloquear_movimiento_finalizado;

UPDATE public.movimientos_inventario m
SET receta_id = r.id
FROM public.recetas r
WHERE m.receta_id IS NULL
  AND r.folio IS NOT NULL
  AND m.motivo = 'Entrega por receta medica ' || r.folio;

UPDATE public.movimientos_inventario m
SET receta_id = rd.receta_id
FROM public.receta_detalle rd
WHERE m.receta_id IS NULL
  AND m.motivo LIKE 'Ajuste de entrega:%(receta_detalle ' || rd.id::TEXT || ')';

ALTER TABLE public.movimientos_inventario ENABLE TRIGGER tr_bloquear_movimiento_finalizado;

-- ----------------------------------------------------------------------------
-- 2. Aprobacion de sistema
-- ----------------------------------------------------------------------------
-- El traspaso al iniciar una jornada (9) lo dispara quien la inicia, que puede ser alguien con
-- jornadas.gestionar y no la administradora; y la anulacion (8) la hace el medico. Ninguno de los
-- dos aprueba movimientos, pero estos movimientos no son una decision de nadie: los impone la
-- regla. Sin esto nacerian pendientes y la bandeja de Validacion se llenaria de traspasos.
--
-- La marca es una variable de configuracion local a la transaccion. Solo la ponen funciones de
-- este archivo, que son SECURITY DEFINER y la quitan al terminar; PostgREST no expone set_config
-- ni deja ejecutar SQL suelto, asi que una sesion del cliente no puede encenderla.
CREATE FUNCTION public.fn_es_aprobacion_de_sistema()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(current_setting('ecopac.aprobacion_de_sistema', TRUE), '') = 'on';
$$;

COMMENT ON FUNCTION public.fn_es_aprobacion_de_sistema() IS
  'TRUE mientras una funcion del sistema (traspaso al iniciar una jornada, anulacion de una receta) registra movimientos que impone una regla y no una persona (00186). Los aprueba solos y les deja cambiar de estado.';

-- La consultan los triggers de movimientos, que corren como quien inserta: authenticated si,
-- anon no (privilegios_anon.sql).
REVOKE EXECUTE ON FUNCTION public.fn_es_aprobacion_de_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_es_aprobacion_de_sistema() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_autoaprobar_movimiento_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF public.es_administrador() OR public.fn_es_aprobacion_de_sistema() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
    NEW.aprobacion_automatica := TRUE;

    PERFORM public.fn_aplicar_ajuste_existencias(
      NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_autoaprobar_movimiento_inventario() IS
  'Hace nacer aprobado el movimiento que inserta la administradora, o el que registra el sistema (fn_es_aprobacion_de_sistema, 00186), con aprobado_por, aprobado_en y aprobacion_automatica, y aplica el ajuste de existencias. Cualquier otro caso conserva el DEFAULT ''pendiente'' (00023). SET search_path = '''' desde la 00112.';

CREATE OR REPLACE FUNCTION public.fn_proteger_decision_de_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sin sesion no hay a quien atribuirle nada (seed, migraciones, service_role).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.es_administrador() OR public.tiene_permiso('inventario.aprobar')
     OR public.fn_es_aprobacion_de_sistema() THEN
    RETURN NEW;
  END IF;

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

COMMENT ON FUNCTION public.fn_proteger_decision_de_movimiento() IS
  'Impide que quien registro un movimiento escriba las columnas que documentan la decision de quien lo aprueba o lo rechaza (issue #625). Desde la 00186 tampoco frena al sistema (fn_es_aprobacion_de_sistema): la anulacion de una receta rechaza sus salidas pendientes.';

-- ----------------------------------------------------------------------------
-- 3. Lo comprometido y lo disponible neto
-- ----------------------------------------------------------------------------
-- Comprometido = salidas pendientes de aprobar. Todavia estan en la existencia (que solo cambia al
-- aprobar), pero ya no se pueden dar a nadie mas. Los ingresos pendientes no suman: hasta que se
-- aprueben no hay nada que entregar.
--
-- SECURITY DEFINER: la vista de abajo es security_invoker y quien la lee puede no ver los
-- movimientos de otros. Devuelve solo un numero.
CREATE FUNCTION public.fn_cantidad_comprometida(p_lote_id UUID, p_bodega_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(m.cantidad), 0)::INT
  FROM public.movimientos_inventario m
  WHERE m.lote_id = p_lote_id
    AND m.bodega_id = p_bodega_id
    AND m.tipo = 'salida'
    AND m.estado = 'pendiente';
$$;

COMMENT ON FUNCTION public.fn_cantidad_comprometida(UUID, UUID) IS
  'Unidades de un lote en una bodega con una salida pendiente de aprobar: ya estan en la existencia pero ya no se pueden entregar (00186, issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_cantidad_comprometida(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cantidad_comprometida(UUID, UUID) TO authenticated;

CREATE FUNCTION public.fn_disponible_neto(p_lote_id UUID, p_bodega_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT e.cantidad_disponible
    FROM public.existencias e
    WHERE e.lote_id = p_lote_id AND e.bodega_id = p_bodega_id
  ), 0) - public.fn_cantidad_comprometida(p_lote_id, p_bodega_id);
$$;

COMMENT ON FUNCTION public.fn_disponible_neto(UUID, UUID) IS
  'Existencia de un lote en una bodega menos lo comprometido en salidas pendientes (00186). Es lo que se puede recetar, cargar, devolver o trasladar.';

REVOKE EXECUTE ON FUNCTION public.fn_disponible_neto(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_disponible_neto(UUID, UUID) TO authenticated;

-- Mismas columnas, en el mismo orden y del mismo tipo que la 00171 (CREATE OR REPLACE VIEW solo
-- deja agregar al final): cantidad_disponible pasa a ser lo neto, y cantidad_fisica y
-- cantidad_comprometida dicen de donde sale. El reporte de inventario no usa esta vista: lee
-- existencias, que sigue siendo lo fisico.
CREATE OR REPLACE VIEW public.vista_lotes_disponibles
WITH (security_invoker = true) AS
SELECT
  l.id AS lote_id,
  l.medicamento_id,
  m.nombre AS medicamento_nombre,
  l.numero_lote,
  l.fecha_vencimiento,
  (e.cantidad_disponible - c.comprometida)::INT AS cantidad_disponible,
  e.created_at,
  e.updated_at,
  e.bodega_id,
  b.nombre AS bodega_nombre,
  e.cantidad_disponible AS cantidad_fisica,
  c.comprometida AS cantidad_comprometida
FROM public.existencias e
JOIN public.lotes l ON l.id = e.lote_id
JOIN public.medicamentos m ON m.id = l.medicamento_id
JOIN public.bodegas b ON b.id = e.bodega_id
CROSS JOIN LATERAL (
  SELECT public.fn_cantidad_comprometida(e.lote_id, e.bodega_id) AS comprometida
) c
WHERE e.cantidad_disponible > 0
  AND e.cantidad_disponible - c.comprometida > 0
  AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE);

COMMENT ON VIEW public.vista_lotes_disponibles IS
  'Combinaciones (lote, bodega) que se pueden entregar: lote vigente (o sin fecha, 00171) y existencia que no este comprometida en una salida pendiente (00186). cantidad_disponible es lo neto; cantidad_fisica y cantidad_comprometida, de donde sale. security_invoker = TRUE respeta la RLS de existencias, lotes, medicamentos y bodegas (00034).';

-- ----------------------------------------------------------------------------
-- 4. De que jornada es el inventario de una bodega movil
-- ----------------------------------------------------------------------------
-- La jornada en curso que tiene la bodega, si hay una (00179 garantiza que es una sola).
CREATE FUNCTION public.fn_jornada_en_curso_de_bodega(p_bodega_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT j.id
  FROM public.jornadas j
  JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.botiquin_bodega_id = p_bodega_id
    AND j.estado = 'en curso'
    AND b.es_movil
    AND NOT b.es_principal
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_jornada_en_curso_de_bodega(UUID) IS
  'La jornada en curso que tiene esta bodega movil, o NULL (00186).';

-- La duena es la en curso; si no hay, la ultima que recibio inventario en la bodega (una carga, un
-- traslado o un traspaso marcado con ella). Una planificada que ya cargo su bodega es la duena de
-- lo que cargo aunque todavia no haya empezado.
CREATE FUNCTION public.fn_jornada_duena_de_bodega(p_bodega_id UUID, p_excluir UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT j.id
      FROM public.jornadas j
      WHERE j.id = public.fn_jornada_en_curso_de_bodega(p_bodega_id)
        AND j.id IS DISTINCT FROM p_excluir
    ),
    (
      SELECT m.jornada_id
      FROM public.movimientos_inventario m
      WHERE m.bodega_id = p_bodega_id
        AND m.tipo = 'ingreso'
        AND m.estado = 'aprobado'
        AND m.jornada_id IS NOT NULL
        AND m.jornada_id IS DISTINCT FROM p_excluir
      ORDER BY m.created_at DESC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.fn_jornada_duena_de_bodega(UUID, UUID) IS
  'De que jornada es hoy el inventario de una bodega movil: la que la tiene en curso o, si no hay, la ultima que recibio inventario en ella (00186). p_excluir deja fuera una jornada.';

-- Lo que le queda a una jornada de un lote: cargado - entregado - devuelto. Entregado son sus
-- recetas emitidas con la cantidad ajustada si la hay, tambien las que esperan aprobacion (1B).
CREATE FUNCTION public.fn_queda_de_jornada_en_lote(p_jornada_id UUID, p_lote_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bodega AS (
    SELECT j.botiquin_bodega_id AS id
    FROM public.jornadas j
    WHERE j.id = p_jornada_id
  )
  SELECT (
    COALESCE((
      SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE -m.cantidad END)
      FROM public.movimientos_inventario m, bodega
      WHERE m.jornada_id = p_jornada_id
        AND m.lote_id = p_lote_id
        AND m.bodega_id = bodega.id
        AND m.estado = 'aprobado'
    ), 0)
    - COALESCE((
      SELECT SUM(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada))
      FROM public.receta_detalle rd
      JOIN public.recetas r ON r.id = rd.receta_id
      JOIN public.consultas c ON c.id = r.consulta_id
      JOIN public.atenciones a ON a.id = c.atencion_id
      WHERE a.jornada_id = p_jornada_id
        AND r.estado = 'emitida'
        AND rd.lote_id = p_lote_id
    ), 0)
  )::INT;
$$;

COMMENT ON FUNCTION public.fn_queda_de_jornada_en_lote(UUID, UUID) IS
  'Lo que le queda a una jornada de un lote en su bodega: cargado - entregado - devuelto (00186, issue #925). Entregado cuenta las recetas emitidas aunque su salida siga pendiente.';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_en_curso_de_bodega(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_jornada_duena_de_bodega(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_queda_de_jornada_en_lote(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_jornada_en_curso_de_bodega(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_jornada_duena_de_bodega(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_queda_de_jornada_en_lote(UUID, UUID) TO authenticated;

-- Registra la salida de una bodega movil a cuenta de su jornada duena, hasta donde le alcanza lo
-- que le queda; el resto sale sin jornada (inventario que no era de ninguna: un ingreso directo,
-- un traslado sin jornada en curso). Una salida que se pasa de lo que le queda a una jornada
-- dejaria su "Queda" en negativo.
CREATE FUNCTION public.fn_registrar_salida_a_cuenta_de_jornada(
  p_lote_id UUID,
  p_bodega_id UUID,
  p_cantidad INT,
  p_motivo TEXT,
  p_jornada_id UUID,
  p_registrado_por UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_de_la_jornada INT := 0;
  v_registrado_por UUID := COALESCE(p_registrado_por, auth.uid());
BEGIN
  IF p_jornada_id IS NOT NULL THEN
    v_de_la_jornada := LEAST(
      p_cantidad,
      GREATEST(0, public.fn_queda_de_jornada_en_lote(p_jornada_id, p_lote_id))
    );
  END IF;

  IF v_de_la_jornada > 0 THEN
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_id, v_de_la_jornada, p_motivo, v_registrado_por, p_jornada_id);
  END IF;

  IF p_cantidad - v_de_la_jornada > 0 THEN
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_id, p_cantidad - v_de_la_jornada, p_motivo, v_registrado_por, NULL);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_registrar_salida_a_cuenta_de_jornada(UUID, UUID, INT, TEXT, UUID, UUID) IS
  'Saca p_cantidad de una bodega movil: a cuenta de p_jornada_id hasta lo que le queda de ese lote, y el resto sin jornada (00186). p_registrado_por, si viene, reemplaza a auth.uid() (el traspaso iniciado sin sesion).';

-- SECURITY INVOKER: la llama fn_trasladar_entre_bodegas, que corre como quien la invoca, y los
-- INSERT pasan por la misma RLS que un INSERT directo en la tabla. Ejecutarla por su cuenta no da
-- nada que la tabla no de ya.
REVOKE EXECUTE ON FUNCTION public.fn_registrar_salida_a_cuenta_de_jornada(UUID, UUID, INT, TEXT, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_salida_a_cuenta_de_jornada(UUID, UUID, INT, TEXT, UUID, UUID)
  TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Traslado: cada lado en su jornada
-- ----------------------------------------------------------------------------
-- Misma firma y mismas comprobaciones que la 00179, con tres cambios:
--   - la existencia del origen se compara con lo disponible neto (1B);
--   - si la destino es movil, el ingreso es de la jornada indicada cuando esa bodega es la suya, o
--     de la que la tiene en curso. Sin jornada en curso entra sin jornada, y el traspaso (9) se lo
--     da a la que empiece despues;
--   - si el origen es movil, la salida es de la jornada indicada cuando esa bodega es la suya, o
--     de su duena, hasta lo que le queda (fn_registrar_salida_a_cuenta_de_jornada).
-- Con una bodega fija se conserva lo de antes: el lado fijo lleva p_jornada_id.
CREATE OR REPLACE FUNCTION public.fn_trasladar_entre_bodegas(
  p_lote_id UUID,
  p_bodega_origen_id UUID,
  p_bodega_destino_id UUID,
  p_cantidad INT,
  p_motivo TEXT DEFAULT NULL,
  p_jornada_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_vence DATE;
  v_disponible INT;
  v_motivo TEXT;
  v_ingreso_id UUID;
  v_origen RECORD;
  v_destino RECORD;
  v_bodega_de_la_jornada UUID;
  v_jornada_ingreso UUID;
  v_jornada_salida UUID;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora traslada inventario entre bodegas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a trasladar tiene que ser mayor que cero.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_bodega_origen_id IS NULL OR p_bodega_destino_id IS NULL
     OR p_bodega_origen_id = p_bodega_destino_id THEN
    RAISE EXCEPTION 'Un traslado sale de una bodega y entra a otra distinta.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT b.nombre, (b.es_movil AND NOT b.es_principal) AS es_movil INTO v_destino
  FROM public.bodegas b WHERE b.id = p_bodega_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bodega destino no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT b.nombre, (b.es_movil AND NOT b.es_principal) AS es_movil INTO v_origen
  FROM public.bodegas b WHERE b.id = p_bodega_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bodega de origen no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote indicado no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_vence IS NOT NULL AND v_vence < CURRENT_DATE THEN
    RAISE EXCEPTION 'El lote vencio el %: se da de baja desde su alerta, no se traslada.', v_vence
      USING ERRCODE = 'check_violation';
  END IF;

  -- El bloqueo es el de la 00179; lo disponible ahora descuenta lo comprometido.
  PERFORM 1 FROM public.existencias e
  WHERE e.lote_id = p_lote_id AND e.bodega_id = p_bodega_origen_id
  FOR UPDATE;

  v_disponible := public.fn_disponible_neto(p_lote_id, p_bodega_origen_id);

  IF v_disponible < p_cantidad THEN
    RAISE EXCEPTION 'Existencia insuficiente en %. Disponible: %, solicitado: %.',
      v_origen.nombre, GREATEST(v_disponible, 0), p_cantidad
      USING ERRCODE = 'check_violation';
  END IF;

  v_motivo := COALESCE(
    NULLIF(btrim(p_motivo), ''),
    'Traslado de ' || v_origen.nombre || ' a ' || v_destino.nombre
  );

  IF p_jornada_id IS NOT NULL THEN
    SELECT j.botiquin_bodega_id INTO v_bodega_de_la_jornada
    FROM public.jornadas j WHERE j.id = p_jornada_id;
  END IF;

  v_jornada_ingreso := CASE
    WHEN NOT v_destino.es_movil THEN p_jornada_id
    WHEN v_bodega_de_la_jornada = p_bodega_destino_id THEN p_jornada_id
    ELSE public.fn_jornada_en_curso_de_bodega(p_bodega_destino_id)
  END;

  v_jornada_salida := CASE
    WHEN NOT v_origen.es_movil THEN p_jornada_id
    WHEN v_bodega_de_la_jornada = p_bodega_origen_id THEN p_jornada_id
    ELSE public.fn_jornada_duena_de_bodega(p_bodega_origen_id)
  END;

  -- Primero el ingreso y despues la salida (00143): al reves, el total del articulo pasaria por
  -- cero y trg_existencias_notificar_sin_stock avisaria de un "sin stock" falso.
  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES ('ingreso', p_lote_id, p_bodega_destino_id, p_cantidad, v_motivo, auth.uid(), v_jornada_ingreso)
  RETURNING id INTO v_ingreso_id;

  IF v_origen.es_movil THEN
    PERFORM public.fn_registrar_salida_a_cuenta_de_jornada(
      p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, v_jornada_salida
    );
  ELSE
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, auth.uid(), v_jornada_salida);
  END IF;

  RETURN v_ingreso_id;
END;
$$;

COMMENT ON FUNCTION public.fn_trasladar_entre_bodegas(UUID, UUID, UUID, INT, TEXT, UUID) IS
  'Traslada p_cantidad de un lote de una bodega a otra: un ingreso en la destino y la salida del origen, aprobados y en una transaccion (00179). Solo la administradora. Desde la 00186 compara con lo disponible neto y registra cada lado movil en su jornada: el ingreso en la jornada indicada o en la que tiene la bodega en curso; la salida en la indicada o en la duena, hasta lo que le queda. Devuelve el id del ingreso.';

-- ----------------------------------------------------------------------------
-- 6. Cargar y devolver
-- ----------------------------------------------------------------------------
-- Cargar: lo de la 00181 mas una regla. Una jornada planificada puede compartir bodega con otra
-- que la tiene en curso (00179); cargarla mientras tanto metia inventario de la planificada en el
-- botiquin que la otra esta usando, y la otra lo recetaba como propio.
CREATE OR REPLACE FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(
  p_jornada_id UUID,
  p_lote_id UUID,
  p_bodega_origen_id UUID,
  p_cantidad INT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_otra TEXT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora carga la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.nombre, j.estado, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         COALESCE(b.es_principal, FALSE) AS es_principal, p.estado AS estado_proyecto
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  LEFT JOIN public.proyectos p ON p.id = j.proyecto_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.estado = 'finalizada' THEN
    RAISE EXCEPTION 'La jornada ya finalizo: su bodega ya no se carga.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.estado_proyecto IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', v_jornada.estado_proyecto
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: asignale una antes de cargarla.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: entrega directo de ella y no hay nada que cargar.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF p_bodega_origen_id = v_jornada.botiquin_bodega_id THEN
    RAISE EXCEPTION 'La bodega de origen es la misma de la jornada: elige otra bodega para cargarla.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT j.nombre INTO v_otra
  FROM public.jornadas j
  WHERE j.id = public.fn_jornada_en_curso_de_bodega(v_jornada.botiquin_bodega_id)
    AND j.id <> p_jornada_id;

  IF v_otra IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega % esta ahora en la jornada %, que sigue en curso: cargala cuando esa jornada termine.',
      v_jornada.bodega_nombre, v_otra
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    p_bodega_origen_id,
    v_jornada.botiquin_bodega_id,
    p_cantidad,
    'Carga de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' para la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;

-- No se cambia de bodega con inventario cargado (00181), ahora con lo que le queda a la jornada:
-- la regla vieja miraba si la bodega tenia existencia de algun lote que la jornada hubiera cargado,
-- y despues de un traspaso (9) seguia viendo como suyo lo que ya era de la jornada siguiente.
CREATE OR REPLACE FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bodega TEXT;
BEGIN
  IF OLD.botiquin_bodega_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.nombre INTO v_bodega
  FROM public.bodegas b
  WHERE b.id = OLD.botiquin_bodega_id
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT DISTINCT m.lote_id
        FROM public.movimientos_inventario m
        WHERE m.jornada_id = OLD.id
          AND m.bodega_id = OLD.botiquin_bodega_id
          AND m.estado = 'aprobado'
      ) lotes
      WHERE public.fn_queda_de_jornada_en_lote(OLD.id, lotes.lote_id) > 0
    );

  IF v_bodega IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega % todavia tiene inventario cargado para esta jornada: devuelvelo antes de cambiar de bodega.', v_bodega
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega() IS
  'Rechaza cambiar la bodega de una jornada mientras le quede inventario en su bodega movil (cargado - entregado - devuelto > 0); primero se devuelve (00181, por jornada desde la 00186).';

-- Devolver: lo de la 00181, pero solo lo que le queda a la jornada (2A). Lo que hay en la bodega
-- y no es suyo -el sobrante que ya paso a otra jornada, o lo que entro sin jornada- se devuelve
-- desde la jornada que lo tiene.
CREATE OR REPLACE FUNCTION public.fn_devolver_de_bodega_de_jornada(
  p_jornada_id UUID,
  p_lote_id UUID,
  p_bodega_destino_id UUID,
  p_cantidad INT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_queda INT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora devuelve lo que queda en la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.nombre, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         COALESCE(b.es_principal, FALSE) AS es_principal
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: no hay nada que devolver.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: no hay nada que devolver.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = p_bodega_destino_id AND b.es_movil) THEN
    RAISE EXCEPTION 'Lo que sobra se devuelve a una bodega fija.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_queda := GREATEST(0, public.fn_queda_de_jornada_en_lote(p_jornada_id, p_lote_id));

  IF p_cantidad > v_queda THEN
    RAISE EXCEPTION 'De ese lote, a esta jornada le quedan % unidad(es): no se puede devolver mas.', v_queda
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    v_jornada.botiquin_bodega_id,
    p_bodega_destino_id,
    p_cantidad,
    'Devolucion de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' de la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. La receta y su ajuste
-- ----------------------------------------------------------------------------
-- fn_generar_receta: la de la 00176 con dos cambios. La existencia se compara con lo disponible
-- neto y por lote, una vez sumados los renglones (dos renglones del mismo lote se comprobaban por
-- separado y podian pasarse entre los dos). Y la salida queda enlazada a la receta.
CREATE OR REPLACE FUNCTION public.fn_generar_receta(
  p_consulta_id UUID,
  p_medico_id UUID,
  p_indicaciones_generales TEXT,
  p_detalle JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_receta_id UUID;
  v_renglon JSONB;
  v_lote_id UUID;
  v_bodega_id UUID;
  v_bodega_de_entrega UUID;
  v_cantidad INT;
  v_vence DATE;
  v_disponible INT;
  v_folio TEXT;
  v_salida RECORD;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una receta necesita al menos un medicamento.';
  END IF;

  v_bodega_de_entrega := public.fn_bodega_de_entrega_de_consulta(p_consulta_id);

  INSERT INTO public.recetas (consulta_id, medico_id, indicaciones_generales)
  VALUES (p_consulta_id, p_medico_id, p_indicaciones_generales)
  RETURNING id, folio INTO v_receta_id, v_folio;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_lote_id := NULLIF(v_renglon ->> 'lote_id', '')::UUID;
    v_bodega_id := NULLIF(v_renglon ->> 'bodega_id', '')::UUID;
    v_cantidad := (v_renglon ->> 'cantidad_entregada')::INT;

    IF v_lote_id IS NOT NULL THEN
      SELECT fecha_vencimiento INTO v_vence
      FROM public.lotes
      WHERE id = v_lote_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote indicado no existe.';
      END IF;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION
          'No se puede recetar del lote %: vencio el %.',
          v_renglon ->> 'lote_id', v_vence;
      END IF;

      IF v_bodega_id IS NULL THEN
        RAISE EXCEPTION
          'El renglon del lote % no indica de que bodega sale. Sin bodega no se puede descontar.',
          v_renglon ->> 'lote_id';
      END IF;

      IF v_bodega_de_entrega IS NOT NULL AND v_bodega_id <> v_bodega_de_entrega THEN
        RAISE EXCEPTION
          'En esta jornada los medicamentos salen de la bodega %, no de otra.',
          (SELECT nombre FROM public.bodegas WHERE id = v_bodega_de_entrega)
          USING ERRCODE = 'object_not_in_prerequisite_state';
      END IF;
    END IF;

    INSERT INTO public.receta_detalle (
      receta_id, medicamento_id, lote_id, bodega_id, dosis, frecuencia, duracion,
      cantidad_entregada
    )
    VALUES (
      v_receta_id,
      (v_renglon ->> 'medicamento_id')::UUID,
      v_lote_id,
      v_bodega_id,
      v_renglon ->> 'dosis',
      v_renglon ->> 'frecuencia',
      v_renglon ->> 'duracion',
      v_cantidad
    );
  END LOOP;

  -- Un movimiento por combinacion (lote, bodega) y no uno por renglon (00112).
  FOR v_salida IN
    SELECT
      (renglon ->> 'lote_id')::UUID AS lote_id,
      (renglon ->> 'bodega_id')::UUID AS bodega_id,
      SUM((renglon ->> 'cantidad_entregada')::INT) AS cantidad
    FROM jsonb_array_elements(p_detalle) AS renglon
    WHERE NULLIF(renglon ->> 'lote_id', '') IS NOT NULL
    GROUP BY 1, 2
  LOOP
    PERFORM 1 FROM public.existencias e
    WHERE e.lote_id = v_salida.lote_id AND e.bodega_id = v_salida.bodega_id
    FOR UPDATE;

    v_disponible := public.fn_disponible_neto(v_salida.lote_id, v_salida.bodega_id);

    -- Mismo mensaje que la 00176 (lo comparan las pruebas y el cliente).
    IF v_disponible < v_salida.cantidad THEN
      RAISE EXCEPTION
        'Existencia insuficiente en el lote %. Disponible: %, solicitado: %.',
        v_salida.lote_id, GREATEST(v_disponible, 0), v_salida.cantidad;
    END IF;

    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
    )
    VALUES (
      'salida',
      v_salida.lote_id,
      v_salida.bodega_id,
      v_salida.cantidad,
      'Entrega por receta medica ' || COALESCE(v_folio, ''),
      auth.uid(),
      v_receta_id
    );
  END LOOP;

  RETURN v_receta_id;
END;
$function$;

-- fn_ajustar_entrega_receta: la de la 00128, comparando con lo disponible neto de la bodega del
-- renglon (antes sumaba el lote en todas las bodegas) y enlazando el movimiento a la receta.
CREATE OR REPLACE FUNCTION public.fn_ajustar_entrega_receta(
  p_receta_detalle_id UUID,
  p_cantidad_real INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_detalle RECORD;
  v_cantidad_previa INT;
  v_diferencia INT;
  v_vence DATE;
  v_disponible INT;
BEGIN
  IF NOT (public.es_administrador() OR public.rol_actual() = 'medico') THEN
    RAISE EXCEPTION 'Solo medico o administracion puede ajustar la entrega de una receta.';
  END IF;

  IF p_cantidad_real IS NULL OR p_cantidad_real <= 0 THEN
    RAISE EXCEPTION 'La cantidad realmente entregada debe ser mayor que cero.';
  END IF;

  SELECT rd.*, r.estado AS receta_estado
  INTO v_detalle
  FROM public.receta_detalle rd
  JOIN public.recetas r ON r.id = rd.receta_id
  WHERE rd.id = p_receta_detalle_id
  FOR UPDATE OF rd;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El renglon de receta indicado no existe.';
  END IF;

  IF v_detalle.receta_estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede ajustar la entrega de una receta anulada.';
  END IF;

  v_cantidad_previa := COALESCE(v_detalle.cantidad_ajustada, v_detalle.cantidad_entregada);
  v_diferencia := p_cantidad_real - v_cantidad_previa;

  IF v_diferencia <> 0 THEN
    IF v_detalle.lote_id IS NULL OR v_detalle.bodega_id IS NULL THEN
      RAISE EXCEPTION
        'Este renglon no tiene lote y bodega asociados: no genero movimiento de inventario que ajustar.';
    END IF;

    IF v_diferencia > 0 THEN
      SELECT fecha_vencimiento INTO v_vence FROM public.lotes WHERE id = v_detalle.lote_id;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se puede ajustar hacia un lote vencido: % vencio el %.',
          v_detalle.lote_id, v_vence;
      END IF;

      v_disponible := public.fn_disponible_neto(v_detalle.lote_id, v_detalle.bodega_id);

      IF v_disponible < v_diferencia THEN
        RAISE EXCEPTION
          'Existencia insuficiente para ajustar la entrega. Disponible: %, diferencia solicitada: %.',
          GREATEST(v_disponible, 0), v_diferencia
          USING ERRCODE = 'check_violation';
      END IF;

      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'salida', v_detalle.lote_id, v_detalle.bodega_id, v_diferencia,
        'Ajuste de entrega: se entrego ' || v_diferencia ||
          ' unidad(es) mas de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid(),
        v_detalle.receta_id
      );
    ELSE
      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'ingreso', v_detalle.lote_id, v_detalle.bodega_id, ABS(v_diferencia),
        'Ajuste de entrega: se devuelve a existencia por entregar ' || ABS(v_diferencia) ||
          ' unidad(es) menos de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid(),
        v_detalle.receta_id
      );
    END IF;
  END IF;

  UPDATE public.receta_detalle
  SET cantidad_ajustada = p_cantidad_real,
      ajustada_por = auth.uid(),
      ajustada_en = NOW()
  WHERE id = p_receta_detalle_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Anular una receta devuelve el inventario (4A)
-- ----------------------------------------------------------------------------
-- Va en un trigger y no en una funcion nueva: anular sigue siendo el UPDATE de siempre (web y
-- movil), con la politica de la 00075 decidiendo quien puede. Lo que cambia es lo que pasa con el
-- inventario:
--   - las salidas y ajustes de la receta que siguen pendientes se rechazan (ya no hay nada que
--     entregar, y aprobarlas bajaria la existencia por una receta anulada);
--   - lo que ya se desconto vuelve con un ingreso a la misma bodega. Ese ingreso sigue la regla de
--     siempre: la administradora lo aprueba al registrarlo; un medico lo deja pendiente.
CREATE FUNCTION public.fn_devolver_inventario_de_receta_anulada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_neto RECORD;
  v_registrado_por UUID := COALESCE(auth.uid(), NEW.anulada_por, NEW.medico_id);
BEGIN
  PERFORM set_config('ecopac.aprobacion_de_sistema', 'on', TRUE);

  UPDATE public.movimientos_inventario m
  SET estado = 'rechazado',
      motivo_rechazo = 'La receta ' || COALESCE(NEW.folio, '') || ' se anulo.',
      aprobado_por = v_registrado_por,
      aprobado_en = NOW()
  WHERE m.receta_id = NEW.id
    AND m.estado = 'pendiente';

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'off', TRUE);

  FOR v_neto IN
    SELECT m.lote_id, m.bodega_id,
           SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE -m.cantidad END)::INT AS cantidad
    FROM public.movimientos_inventario m
    WHERE m.receta_id = NEW.id
      AND m.estado = 'aprobado'
    GROUP BY m.lote_id, m.bodega_id
  LOOP
    IF v_neto.cantidad > 0 THEN
      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'ingreso', v_neto.lote_id, v_neto.bodega_id, v_neto.cantidad,
        'Devolucion por receta anulada ' || COALESCE(NEW.folio, ''),
        v_registrado_por,
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_devolver_inventario_de_receta_anulada() IS
  'Al anular una receta (4A, issue #925): rechaza sus movimientos pendientes y devuelve a la bodega lo que ya se habia descontado, con un ingreso enlazado a la receta (00186).';

REVOKE EXECUTE ON FUNCTION public.fn_devolver_inventario_de_receta_anulada()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_recetas_devolver_inventario_al_anular
AFTER UPDATE OF estado ON public.recetas
FOR EACH ROW
WHEN (OLD.estado = 'emitida' AND NEW.estado = 'anulada')
EXECUTE FUNCTION public.fn_devolver_inventario_de_receta_anulada();

-- Rechazar en la bandeja de Validacion la salida que entrega una receta es decir que esa entrega
-- no ocurrio: la receta se anula entera (issue #925). Antes la receta seguia "emitida", Consumo la
-- contaba como entregada y la existencia no bajaba, asi que nada cuadraba, y el medico no se
-- enteraba. El motivo de la anulacion dice que la anulo la administracion y por que; la ficha del
-- paciente lo muestra en la receta. Al anularse, el trigger de arriba rechaza las demas salidas
-- pendientes de la receta y devuelve lo ya aprobado.
--
-- Solo la salida de la entrega ("Entrega por receta medica ...", fn_generar_receta), no la de un
-- ajuste: rechazar un ajuste corrige el ajuste, no la receta. El guard de estado = 'emitida'
-- corta la recursion: cuando la anulacion rechaza las otras salidas, la receta ya esta anulada.
CREATE FUNCTION public.fn_anular_receta_al_rechazar_su_entrega()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.recetas r
  SET estado = 'anulada',
      motivo_anulacion = 'Anulada por la administracion al rechazar su salida de inventario: '
        || COALESCE(NULLIF(btrim(NEW.motivo_rechazo), ''), 'sin motivo'),
      anulada_por = COALESCE(auth.uid(), NEW.aprobado_por, r.medico_id),
      anulada_en = NOW()
  WHERE r.id = NEW.receta_id
    AND r.estado = 'emitida';

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_anular_receta_al_rechazar_su_entrega() IS
  'Rechazar la salida que entrega una receta la anula entera, con un motivo que dice que fue la administracion (00186, issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_anular_receta_al_rechazar_su_entrega()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_movimientos_anular_receta_al_rechazar_su_entrega
AFTER UPDATE OF estado ON public.movimientos_inventario
FOR EACH ROW
WHEN (
  OLD.estado = 'pendiente' AND NEW.estado = 'rechazado'
  AND NEW.receta_id IS NOT NULL AND NEW.tipo = 'salida'
  AND NEW.motivo LIKE 'Entrega por receta medica%'
)
EXECUTE FUNCTION public.fn_anular_receta_al_rechazar_su_entrega();

-- Las recetas anuladas antes de esta migracion dejaron sus salidas pendientes en la bandeja: con
-- la seccion 3 comprometerian esa existencia para siempre, y aprobarlas la bajaria por una receta
-- que no se entrego. Se rechazan. Lo que ya se habia aprobado no se devuelve de forma retroactiva:
-- no hay como saber si fisicamente volvio a la bodega, y eso lo decide quien revise el inventario.
UPDATE public.movimientos_inventario m
SET estado = 'rechazado',
    motivo_rechazo = 'La receta ' || COALESCE(r.folio, '') || ' se anulo.',
    aprobado_en = NOW()
FROM public.recetas r
WHERE m.receta_id = r.id
  AND r.estado = 'anulada'
  AND m.estado = 'pendiente';

-- ----------------------------------------------------------------------------
-- 9. El traspaso al iniciar la jornada
-- ----------------------------------------------------------------------------
-- Al pasar de planificada a en curso, lo que haya en la bodega movil y no sea ya de esta jornada
-- pasa a serlo: un ingreso a su cuenta y la salida a cuenta de la duena anterior (hasta lo que le
-- queda; el resto sin jornada). El inventario fisico no cambia: entra y sale lo mismo de la misma
-- bodega. Los lotes vencidos no pasan: se dan de baja desde su alerta, no se recetan.
--
-- Lo que se traspasa es lo disponible neto menos lo que ya le queda a la jornada. Si lo que le
-- queda es negativo -una jornada anterior a esta migracion que receto de un ingreso directo, sin
-- carga-, el traspaso lo compensa y la deja cuadrando con lo que hay en la bodega.
--
-- Reabrir una jornada finalizada no vuelve a traspasar: solo cuenta la primera vez que empieza.
CREATE FUNCTION public.fn_traspasar_sobrante_a_jornada(p_jornada_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_lote RECORD;
  v_a_traspasar INT;
  v_anterior UUID;
  v_anterior_nombre TEXT;
  v_motivo TEXT;
  v_registrado_por UUID;
BEGIN
  SELECT j.id, j.nombre, j.botiquin_bodega_id, j.responsable_id INTO v_jornada
  FROM public.jornadas j
  JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id AND b.es_movil AND NOT b.es_principal;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Sin sesion (la migracion, SQL directo, pruebas) el traspaso queda a nombre del responsable de
  -- la jornada: registrado_por no admite NULL.
  v_registrado_por := COALESCE(auth.uid(), v_jornada.responsable_id);

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'on', TRUE);

  FOR v_lote IN
    SELECT e.lote_id
    FROM public.existencias e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE e.bodega_id = v_jornada.botiquin_bodega_id
      AND e.cantidad_disponible > 0
      AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
    FOR UPDATE OF e
  LOOP
    v_a_traspasar := public.fn_disponible_neto(v_lote.lote_id, v_jornada.botiquin_bodega_id)
      - public.fn_queda_de_jornada_en_lote(v_jornada.id, v_lote.lote_id);

    CONTINUE WHEN v_a_traspasar <= 0;

    v_anterior := public.fn_jornada_duena_de_bodega(v_jornada.botiquin_bodega_id, v_jornada.id);
    v_anterior_nombre := NULL;
    SELECT j.nombre INTO v_anterior_nombre FROM public.jornadas j WHERE j.id = v_anterior;

    v_motivo := 'Traspaso a la jornada ' || v_jornada.nombre || ' de lo que habia en la bodega'
      || CASE WHEN v_anterior_nombre IS NOT NULL
              THEN ' (sobrante de la jornada ' || v_anterior_nombre || ')' ELSE '' END;

    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('ingreso', v_lote.lote_id, v_jornada.botiquin_bodega_id, v_a_traspasar, v_motivo,
            v_registrado_por, v_jornada.id);

    PERFORM public.fn_registrar_salida_a_cuenta_de_jornada(
      v_lote.lote_id, v_jornada.botiquin_bodega_id, v_a_traspasar, v_motivo, v_anterior,
      v_registrado_por
    );
  END LOOP;

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'off', TRUE);
END;
$$;

COMMENT ON FUNCTION public.fn_traspasar_sobrante_a_jornada(UUID) IS
  'Pasa a la cuenta de una jornada con bodega movil lo que hay en su bodega y no es suyo: cargado en ella, devuelto en la anterior. El inventario fisico no cambia (00186, issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_traspasar_sobrante_a_jornada(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.fn_traspasar_sobrante_al_iniciar_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.fn_traspasar_sobrante_a_jornada(NEW.id);
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_traspasar_sobrante_al_iniciar_jornada() IS
  'Al iniciar una jornada (planificada a en curso), fn_traspasar_sobrante_a_jornada() (00186).';

REVOKE EXECUTE ON FUNCTION public.fn_traspasar_sobrante_al_iniciar_jornada()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_traspasar_sobrante_al_iniciar
AFTER UPDATE OF estado ON public.jornadas
FOR EACH ROW
WHEN (OLD.estado = 'planificada' AND NEW.estado = 'en curso')
EXECUTE FUNCTION public.fn_traspasar_sobrante_al_iniciar_jornada();

-- Las jornadas que ya estan en curso empezaron antes de esta regla: lo que hay en su bodega pasa a
-- su cuenta una sola vez, como si acabaran de iniciar. Sin esto, una jornada que recibio su
-- inventario por un ingreso directo mostraria "Queda" en negativo.
DO $$
DECLARE
  v_jornada UUID;
BEGIN
  FOR v_jornada IN SELECT j.id FROM public.jornadas j WHERE j.estado = 'en curso' LOOP
    PERFORM public.fn_traspasar_sobrante_a_jornada(v_jornada);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Consumo de la jornada
-- ----------------------------------------------------------------------------
-- Dos columnas nuevas al final: pendiente (salidas de sus recetas que esperan aprobacion) y queda
-- (cargado - entregado - devuelto, 2A). en_bodega sigue siendo lo fisico de toda la bodega: la
-- pantalla lo usa para decir cuanto hay ahi que no es de esta jornada. Cambia el tipo de retorno,
-- y CREATE OR REPLACE no puede: va DROP y CREATE, y con ellos el GRANT de la 00178.
DROP FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID);

CREATE FUNCTION public.fn_consumo_de_insumos_de_jornada(p_jornada_id UUID)
RETURNS TABLE (
  lote_id UUID,
  medicamento_id UUID,
  articulo TEXT,
  concentracion TEXT,
  numero_lote TEXT,
  fecha_vencimiento DATE,
  costo_unitario NUMERIC,
  cargado BIGINT,
  entregado BIGINT,
  devuelto BIGINT,
  en_bodega BIGINT,
  pendiente BIGINT,
  queda BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bodega_id UUID;
BEGIN
  IF NOT (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los insumos de esta jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- La bodega solo cuenta para cargado, devuelto y en bodega cuando no es la principal.
  SELECT j.botiquin_bodega_id INTO v_bodega_id
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id
    AND NOT COALESCE(b.es_principal, FALSE);

  RETURN QUERY
  WITH traslados AS (
    SELECT
      m.lote_id,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'ingreso')::BIGINT AS cargado,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'salida')::BIGINT AS devuelto
    FROM public.movimientos_inventario m
    WHERE v_bodega_id IS NOT NULL
      AND m.jornada_id = p_jornada_id
      AND m.bodega_id = v_bodega_id
      AND m.estado = 'aprobado'
    GROUP BY m.lote_id
  ),
  recetas_de_la_jornada AS (
    SELECT r.id, r.estado
    FROM public.recetas r
    JOIN public.consultas c ON c.id = r.consulta_id
    JOIN public.atenciones a ON a.id = c.atencion_id
    WHERE a.jornada_id = p_jornada_id
  ),
  entregas AS (
    SELECT rd.lote_id, SUM(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada))::BIGINT AS cantidad
    FROM public.receta_detalle rd
    JOIN recetas_de_la_jornada r ON r.id = rd.receta_id
    WHERE r.estado = 'emitida'
      AND rd.lote_id IS NOT NULL
    GROUP BY rd.lote_id
  ),
  pendientes AS (
    SELECT m.lote_id,
           SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE -m.cantidad END)::BIGINT AS cantidad
    FROM public.movimientos_inventario m
    JOIN recetas_de_la_jornada r ON r.id = m.receta_id
    WHERE m.estado = 'pendiente'
    GROUP BY m.lote_id
  ),
  en_bodega AS (
    SELECT e.lote_id, SUM(e.cantidad_disponible)::BIGINT AS cantidad
    FROM public.existencias e
    WHERE v_bodega_id IS NOT NULL
      AND e.bodega_id = v_bodega_id
      AND e.cantidad_disponible > 0
    GROUP BY e.lote_id
  ),
  lotes_de_la_jornada AS (
    SELECT traslados.lote_id FROM traslados
    UNION
    SELECT entregas.lote_id FROM entregas
    UNION
    SELECT en_bodega.lote_id FROM en_bodega
  )
  SELECT
    l.id,
    m.id,
    m.nombre::TEXT,
    m.concentracion::TEXT,
    l.numero_lote::TEXT,
    l.fecha_vencimiento,
    l.costo_unitario,
    COALESCE(t.cargado, 0),
    COALESCE(en.cantidad, 0),
    COALESCE(t.devuelto, 0),
    COALESCE(eb.cantidad, 0),
    GREATEST(COALESCE(p.cantidad, 0), 0),
    CASE WHEN v_bodega_id IS NULL THEN 0
         ELSE COALESCE(t.cargado, 0) - COALESCE(en.cantidad, 0) - COALESCE(t.devuelto, 0)
    END
  FROM lotes_de_la_jornada lj
  JOIN public.lotes l ON l.id = lj.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  LEFT JOIN traslados t ON t.lote_id = l.id
  LEFT JOIN entregas en ON en.lote_id = l.id
  LEFT JOIN pendientes p ON p.lote_id = l.id
  LEFT JOIN en_bodega eb ON eb.lote_id = l.id
  ORDER BY m.nombre, l.fecha_vencimiento NULLS LAST, l.numero_lote;
END;
$$;

COMMENT ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) IS
  'Por lote: lo cargado a la bodega movil de la jornada, lo entregado en sus recetas emitidas (con el ajuste si lo hay), lo devuelto, lo que hay hoy en toda la bodega (en_bodega), lo que espera aprobacion (pendiente) y lo que le queda a la jornada (queda = cargado - entregado - devuelto). 00178, 00181; pendiente y queda desde la 00186 (issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. Insumos de un proyecto
-- ----------------------------------------------------------------------------
-- Lo que les queda a las jornadas de un proyecto, por jornada y lote. Antes la pantalla sumaba el
-- contenido actual de toda bodega que alguna jornada del proyecto hubiera usado, y una bodega
-- compartida con otro proyecto contaba en los dos (B07 de la issue #925).
CREATE FUNCTION public.fn_insumos_de_proyecto(p_proyecto_id UUID)
RETURNS TABLE (
  jornada_id UUID,
  jornada TEXT,
  bodega TEXT,
  lote_id UUID,
  articulo TEXT,
  concentracion TEXT,
  numero_lote TEXT,
  fecha_vencimiento DATE,
  costo_unitario NUMERIC,
  queda BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
BEGIN
  IF NOT (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los insumos de este proyecto.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_jornada IN
    SELECT j.id, j.nombre, b.nombre AS bodega
    FROM public.jornadas j
    JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
    WHERE j.proyecto_id = p_proyecto_id
      AND b.es_movil
      AND NOT b.es_principal
  LOOP
    RETURN QUERY
    SELECT v_jornada.id, v_jornada.nombre::TEXT, v_jornada.bodega::TEXT,
           c.lote_id, c.articulo, c.concentracion, c.numero_lote, c.fecha_vencimiento,
           c.costo_unitario, c.queda
    FROM public.fn_consumo_de_insumos_de_jornada(v_jornada.id) c
    WHERE c.queda > 0;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_insumos_de_proyecto(UUID) IS
  'Lo que les queda a las jornadas del proyecto en sus bodegas moviles, por jornada y lote (queda de fn_consumo_de_insumos_de_jornada). Cada unidad cuenta en una sola jornada, asi que una bodega compartida no se suma en dos proyectos (00186, issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_insumos_de_proyecto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_insumos_de_proyecto(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 12. La entrega de una receta se valida completa
-- ----------------------------------------------------------------------------
-- Una receta con tres medicamentos registra tres salidas (una por lote y bodega, 00112). Cada una
-- avisaba por separado a la administracion y se aprobaba o rechazaba por separado: aprobar la de
-- un medicamento y no las otras dejaba una receta entregada a medias (issue #925). Ahora:
--   - la notificacion es una sola por receta (la deduplica uq_notificaciones_incidencia, 00138, al
--     tener por origen la receta y no el movimiento);
--   - aprobar una de sus salidas aprueba las demas, en la misma transaccion: si alguna no tiene
--     existencia, no se aprueba ninguna;
--   - rechazar una la anula entera (seccion 8).
-- Los ajustes de entrega y cualquier otro movimiento siguen igual: uno por uno.
CREATE OR REPLACE FUNCTION public.fn_notificar_movimiento_por_validar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_bodega TEXT;
  v_registrado_por TEXT;
  v_folio TEXT;
BEGIN
  SELECT b.nombre INTO v_bodega FROM public.bodegas b WHERE b.id = NEW.bodega_id;

  SELECT p.nombres || ' ' || p.apellidos INTO v_registrado_por
  FROM public.perfiles p WHERE p.id = NEW.registrado_por;

  IF NEW.receta_id IS NOT NULL AND NEW.tipo = 'salida'
     AND NEW.motivo LIKE 'Entrega por receta medica%' THEN
    SELECT r.folio INTO v_folio FROM public.recetas r WHERE r.id = NEW.receta_id;

    PERFORM public.fn_notificar_administradores(
      'validacion',
      format('Receta por validar: %s', COALESCE(v_folio, 'sin folio')),
      format(
        '%s emitio la receta %s en %s. La salida de sus medicamentos espera aprobacion y se aprueba o rechaza completa.',
        COALESCE(v_registrado_por, 'Alguien'),
        COALESCE(v_folio, 'sin folio'),
        v_bodega
      ),
      '/inventario?tab=validacion',
      'recetas',
      NEW.receta_id
    );
    RETURN NULL;
  END IF;

  SELECT m.nombre, l.numero_lote INTO v_medicamento, v_numero_lote
  FROM public.lotes l
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE l.id = NEW.lote_id;

  PERFORM public.fn_notificar_administradores(
    'validacion',
    format(
      'Movimiento por validar: %s de %s',
      CASE WHEN NEW.tipo = 'ingreso' THEN 'ingreso' ELSE 'salida' END,
      v_medicamento
    ),
    format(
      '%s registró %s de %s unidades del lote %s en %s. Motivo: %s',
      COALESCE(v_registrado_por, 'Alguien'),
      CASE WHEN NEW.tipo = 'ingreso' THEN 'un ingreso' ELSE 'una salida' END,
      NEW.cantidad,
      v_numero_lote,
      v_bodega,
      NEW.motivo
    ),
    '/inventario?tab=validacion',
    'movimientos_inventario',
    NEW.id
  );

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_notificar_movimiento_por_validar() IS
  'Trigger: avisa a quien valida movimientos cuando se registra uno pendiente (00138). Desde la 00186 la entrega de una receta avisa una sola vez, por receta, y no una por medicamento.';

-- Aprobar una salida de la entrega aprueba las demas de la misma receta. Es AFTER ROW: Postgres
-- dispara estos triggers al terminar la sentencia, cuando las filas que ella actualizo ya estan
-- aprobadas, asi que la vuelta siguiente no encuentra pendientes y no hay recursion. Si a una le
-- falta existencia, fn_aplicar_ajuste_existencias revienta y se deshace todo: la receta se aprueba
-- completa o nada.
CREATE FUNCTION public.fn_aprobar_entrega_completa_de_receta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.movimientos_inventario m
  SET estado = 'aprobado',
      aprobado_por = NEW.aprobado_por,
      aprobado_en = NOW()
  WHERE m.receta_id = NEW.receta_id
    AND m.id <> NEW.id
    AND m.estado = 'pendiente'
    AND m.tipo = 'salida'
    AND m.motivo LIKE 'Entrega por receta medica%';

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_aprobar_entrega_completa_de_receta() IS
  'Aprobar una salida de la entrega de una receta aprueba las demas: la receta se valida completa o nada (00186, issue #925).';

REVOKE EXECUTE ON FUNCTION public.fn_aprobar_entrega_completa_de_receta()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_movimientos_aprobar_entrega_completa_de_receta
AFTER UPDATE OF estado ON public.movimientos_inventario
FOR EACH ROW
WHEN (
  OLD.estado = 'pendiente' AND NEW.estado = 'aprobado'
  AND NEW.receta_id IS NOT NULL AND NEW.tipo = 'salida'
  AND NEW.motivo LIKE 'Entrega por receta medica%'
)
EXECUTE FUNCTION public.fn_aprobar_entrega_completa_de_receta();

-- ----------------------------------------------------------------------------
-- 13. Los indicadores de la jornada no cuentan recetas anuladas
-- ----------------------------------------------------------------------------
-- "Tratamientos entregados" y "Medicamentos utilizados" del Resumen de la jornada (de
-- vista_reporte_impacto), los reportes de impacto y "Medicamentos mas entregados" del reporte de la
-- jornada contaban tambien las recetas anuladas y sumaban la cantidad recetada aunque se hubiera
-- ajustado lo entregado (issue #925). Mismas columnas, en el mismo orden: solo cambia de donde sale
-- lo entregado. Cada definicion es la vigente (00148, 00155) con ese unico cambio.
CREATE OR REPLACE VIEW vista_reporte_impacto
WITH (security_invoker = false) AS
WITH pacientes_por_jornada AS (
  SELECT a.jornada_id, count(DISTINCT a.paciente_id) AS pacientes_atendidos
  FROM atenciones a
  GROUP BY a.jornada_id
), consultas_por_jornada AS (
  SELECT c.jornada_id, count(*) AS consultas_realizadas
  FROM consultas c
  GROUP BY c.jornada_id
), entregas_por_jornada AS (
  SELECT
    c.jornada_id,
    count(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(sum(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada)), 0::bigint) AS medicamentos_utilizados
  FROM consultas c
  JOIN recetas r ON r.consulta_id = c.id AND r.estado = 'emitida'
  LEFT JOIN receta_detalle rd ON rd.receta_id = r.id
  GROUP BY c.jornada_id
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0::bigint) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0::bigint) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0::bigint) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0::bigint) AS medicamentos_utilizados,
  j.proyecto_id,
  pr.nombre AS proyecto
FROM jornadas j
JOIN comunidades com ON com.id = j.comunidad_id
LEFT JOIN proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_jornada p ON p.jornada_id = j.id
LEFT JOIN consultas_por_jornada cs ON cs.jornada_id = j.id
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id
WHERE public.puede_consultar_reportes();

CREATE OR REPLACE VIEW public.vista_reporte_impacto_por_comunidad
WITH (security_invoker = false) AS
WITH atenciones_con_comunidad AS (
  SELECT
    a.id AS atencion_id,
    a.jornada_id,
    a.paciente_id,
    COALESCE(p.comunidad_id, j.comunidad_id) AS comunidad_id
  FROM public.atenciones a
  JOIN public.jornadas j ON j.id = a.jornada_id
  JOIN public.pacientes p ON p.id = a.paciente_id
), pacientes_por_grupo AS (
  SELECT ac.jornada_id, ac.comunidad_id, count(DISTINCT ac.paciente_id) AS pacientes_atendidos
  FROM atenciones_con_comunidad ac
  GROUP BY ac.jornada_id, ac.comunidad_id
), consultas_por_grupo AS (
  SELECT ac.jornada_id, ac.comunidad_id, count(*) AS consultas_realizadas
  FROM public.consultas c
  JOIN atenciones_con_comunidad ac ON ac.atencion_id = c.atencion_id
  GROUP BY ac.jornada_id, ac.comunidad_id
), entregas_por_grupo AS (
  SELECT
    ac.jornada_id,
    ac.comunidad_id,
    count(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(sum(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada)), 0::bigint) AS medicamentos_utilizados
  FROM public.consultas c
  JOIN atenciones_con_comunidad ac ON ac.atencion_id = c.atencion_id
  JOIN public.recetas r ON r.consulta_id = c.id AND r.estado = 'emitida'
  LEFT JOIN public.receta_detalle rd ON rd.receta_id = r.id
  GROUP BY ac.jornada_id, ac.comunidad_id
), grupos AS (
  SELECT pg.jornada_id, pg.comunidad_id FROM pacientes_por_grupo pg
  UNION
  -- La jornada sin atenciones, con su propia comunidad.
  SELECT j.id, j.comunidad_id
  FROM public.jornadas j
  WHERE NOT EXISTS (SELECT 1 FROM public.atenciones a WHERE a.jornada_id = j.id)
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0::bigint) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0::bigint) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0::bigint) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0::bigint) AS medicamentos_utilizados,
  j.proyecto_id,
  pr.nombre AS proyecto
FROM grupos g
JOIN public.jornadas j ON j.id = g.jornada_id
JOIN public.comunidades com ON com.id = g.comunidad_id
LEFT JOIN public.proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_grupo p ON p.jornada_id = g.jornada_id AND p.comunidad_id = g.comunidad_id
LEFT JOIN consultas_por_grupo cs ON cs.jornada_id = g.jornada_id AND cs.comunidad_id = g.comunidad_id
LEFT JOIN entregas_por_grupo e ON e.jornada_id = g.jornada_id AND e.comunidad_id = g.comunidad_id
WHERE public.puede_consultar_reportes();

CREATE OR REPLACE FUNCTION public.fn_reporte_jornada(p_jornada_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reporte JSONB;
BEGIN
  IF NOT (public.puede_consultar_reportes() OR public.rol_actual() = 'medico') THEN
    RAISE EXCEPTION 'Solo administracion, el medico y quien consulta reportes ve el reporte de una jornada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'jornada', jsonb_build_object(
      'id', j.id,
      'nombre', j.nombre,
      'fecha', j.fecha,
      'estado', j.estado,
      'comunidad', jsonb_build_object('id', c.id, 'nombre', c.nombre)
    ),
    'resumen', jsonb_build_object(
      'total_consultas',
      (SELECT count(*) FROM public.consultas co WHERE co.jornada_id = j.id),
      'pacientes_atendidos',
      (SELECT count(DISTINCT e.paciente_id)
         FROM public.consultas co
         JOIN public.expedientes e ON e.id = co.expediente_id
        WHERE co.jornada_id = j.id)
    ),
    'diagnosticos_mas_frecuentes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('diagnostico', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT d.nombre, count(*) AS cantidad
        FROM public.consultas co
        JOIN public.consulta_diagnostico cd ON cd.consulta_id = co.id
        JOIN public.diagnosticos d ON d.id = cd.diagnostico_id
        WHERE co.jornada_id = j.id
        GROUP BY d.nombre
      ) x
    ), '[]'::jsonb),
    'medicamentos_mas_entregados', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('medicamento', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT COALESCE(m.nombre, 'Sin nombre') AS nombre,
               sum(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada, 0)) AS cantidad
        FROM public.consultas co
        JOIN public.recetas r ON r.consulta_id = co.id AND r.estado = 'emitida'
        JOIN public.receta_detalle rd ON rd.receta_id = r.id
        LEFT JOIN public.medicamentos m ON m.id = rd.medicamento_id
        WHERE co.jornada_id = j.id
        GROUP BY COALESCE(m.nombre, 'Sin nombre')
      ) x
    ), '[]'::jsonb),
    'personal_participante', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'usuario_id', x.medico_id,
          'nombre', x.nombre,
          'total_atenciones', x.cantidad
        )
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT co.medico_id,
               NULLIF(trim(concat_ws(' ', pe.nombres, pe.apellidos)), '') AS nombre,
               count(*) AS cantidad
        FROM public.consultas co
        LEFT JOIN public.perfiles pe ON pe.id = co.medico_id
        WHERE co.jornada_id = j.id
        GROUP BY co.medico_id, pe.nombres, pe.apellidos
      ) x
    ), '[]'::jsonb)
  )
  INTO v_reporte
  FROM public.jornadas j
  JOIN public.comunidades c ON c.id = j.comunidad_id
  WHERE j.id = p_jornada_id;

  RETURN v_reporte;
END;
$$;


COMMENT ON FUNCTION public.fn_reporte_jornada(UUID) IS
  'Reporte de una jornada: resumen, diagnosticos, medicamentos mas entregados y personal (00148). Desde la 00186 lo entregado es de las recetas emitidas, con la cantidad ajustada si la hay.';
