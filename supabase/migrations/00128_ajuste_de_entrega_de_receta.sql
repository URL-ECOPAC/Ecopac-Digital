-- Ecopac Digital - Ajustar la cantidad realmente entregada de una receta (issue #764)
--
-- EL CONFLICTO. La issue #164 (RF-20) exige que la cantidad realmente entregada pueda diferir
-- de la recetada y que esa diferencia quede registrada -por ejemplo, si al momento de entregar
-- ya no alcanza el lote elegido al recetar-. Pero la migracion 00112 (issue #711) hizo que
-- fn_generar_receta descuente el inventario de forma ATOMICA con la cantidad recetada, en la
-- misma transaccion: hoy no existe ninguna funcion para corregir esa cantidad despues, y si
-- EntregaMedicamentosScreen escribiera cantidad_entregada a mano y volviera a llamar a
-- registrarSalida() con la diferencia, el inventario se descontaria dos veces por el mismo
-- renglon.
--
-- LA DECISION (issue #764, "construir un ajuste seguro"): no reabrir cantidad_entregada -esa
-- columna sigue siendo lo que la receta origin al pidio, un hecho clinico que no se reescribe,
-- mismo criterio que ya usan recetas.estado (00066: se anula, no se edita ni se borra)-. En vez
-- de eso, la correccion se APILA al lado: cantidad_ajustada guarda la ultima cantidad
-- confirmada como realmente entregada (NULL mientras nadie la corrija, y entonces
-- cantidad_entregada sigue siendo la cifra vigente), y ajustada_por/ajustada_en registran quien
-- y cuando. fn_ajustar_entrega_receta() es la UNICA forma de tocar estas columnas: no llevan
-- policy ni GRANT de UPDATE para nadie (mismo candado que cantidad_entregada ya tenia: la tabla
-- solo concede SELECT/INSERT, 00033), asi que la funcion tiene que ser SECURITY DEFINER.
--
-- COMO EVITA EL DOBLE DESCUENTO. La funcion nunca reaplica la cantidad recetada completa: calcula
-- la DIFERENCIA contra el ultimo valor confirmado (cantidad_ajustada si ya existe, si no
-- cantidad_entregada) y registra un movimiento nuevo solo por esa diferencia -una 'salida' si se
-- entrego mas, un 'ingreso' si se entrego menos y la diferencia se devuelve a existencia-. Llamar
-- la funcion dos veces con la misma cantidad no genera un segundo movimiento (diferencia = 0), y
-- corregir dos veces seguidas compone correctamente porque cada llamada parte del ultimo valor
-- confirmado, no del original.
--
-- COMO SE CIERRA EL PASO POR RLS. La funcion es SECURITY DEFINER (necesario para el UPDATE de
-- receta_detalle, que ningun rol tiene concedido directamente), asi que replica a mano la misma
-- regla que ya protege receta_detalle en la 00033 -solo medico o administrador-, en vez de confiar
-- en la politica de la tabla, que aqui no se evalua.
--
-- EL MOVIMIENTO SIGUE EL MISMO FLUJO DE APROBACION QUE CUALQUIER OTRO. Se inserta sin fijar
-- estado (DEFAULT 'pendiente', 00023): administrador lo autoaprueba al instante
-- (tr_autoaprobar_movimiento_inventario, 00028/00094), medico lo deja pendiente para que
-- administracion lo apruebe despues, exactamente igual que fn_generar_receta (00112). El chequeo
-- de lote vencido y existencia suficiente para la rama 'salida' se repite aqui por la misma razon
-- que en fn_generar_receta: dar un error inmediato a quien ajusta, no uno tardio a quien aprueba.
--
-- bodega_id EN receta_detalle. Hacia falta para saber de que bodega descontar/devolver: antes
-- solo viajaba en el JSONB de fn_generar_receta y no se guardaba en ningun lado. Se agrega
-- nullable, igual que lote_id (00019): un renglon sin lote tampoco tiene bodega, y sigue sin
-- poder ajustarse por inventario (no hay nada que ajustar).

-- ============================================================================
-- 1. receta_detalle gana bodega_id y las columnas de ajuste
-- ============================================================================

ALTER TABLE receta_detalle
  ADD COLUMN bodega_id UUID REFERENCES bodegas(id) ON DELETE SET NULL,
  ADD COLUMN cantidad_ajustada INT,
  ADD COLUMN ajustada_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  ADD COLUMN ajustada_en TIMESTAMPTZ,
  ADD CONSTRAINT chk_receta_detalle_cantidad_ajustada_positiva
    CHECK (cantidad_ajustada IS NULL OR cantidad_ajustada > 0),
  ADD CONSTRAINT chk_receta_detalle_ajuste_coherente
    CHECK (
      (cantidad_ajustada IS NULL AND ajustada_por IS NULL AND ajustada_en IS NULL)
      OR (cantidad_ajustada IS NOT NULL AND ajustada_por IS NOT NULL AND ajustada_en IS NOT NULL)
    );

COMMENT ON COLUMN receta_detalle.bodega_id IS
  'Bodega de la que salio este renglon (issue #764). NULL cuando el renglon no tiene lote '
  '(receta sin lote especifico, 00019): sin lote no hay bodega de la que descontar.';

COMMENT ON COLUMN receta_detalle.cantidad_ajustada IS
  'Ultima cantidad confirmada como realmente entregada, si difiere de cantidad_entregada '
  '(issue #764). NULL mientras nadie la corrija: en ese caso cantidad_entregada sigue siendo la '
  'cifra vigente. Solo fn_ajustar_entrega_receta() escribe esta columna.';

COMMENT ON COLUMN receta_detalle.ajustada_por IS
  'Quien confirmo la ultima correccion de cantidad_ajustada (issue #764).';

COMMENT ON COLUMN receta_detalle.ajustada_en IS
  'Cuando se confirmo la ultima correccion de cantidad_ajustada (issue #764).';

-- ============================================================================
-- 2. fn_generar_receta persiste bodega_id en receta_detalle (antes solo viajaba en el JSONB)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generar_receta(
  p_consulta_id UUID,
  p_medico_id UUID,
  p_indicaciones_generales TEXT,
  p_detalle JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_receta_id UUID;
  v_renglon JSONB;
  v_lote_id UUID;
  v_bodega_id UUID;
  v_cantidad INT;
  v_vence DATE;
  v_disponible INT;
  v_folio TEXT;
  v_salida RECORD;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una receta necesita al menos un medicamento.';
  END IF;

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

      IF v_vence IS NULL THEN
        RAISE EXCEPTION 'El lote indicado no existe.';
      END IF;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION
          'No se puede recetar del lote %: vencio el %.',
          v_renglon ->> 'lote_id', v_vence;
      END IF;

      SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_disponible
      FROM public.existencias
      WHERE lote_id = v_lote_id;

      IF v_disponible < v_cantidad THEN
        RAISE EXCEPTION
          'Existencia insuficiente en el lote %. Disponible: %, solicitado: %.',
          v_renglon ->> 'lote_id', v_disponible, v_cantidad;
      END IF;

      -- Sin bodega no hay fila de existencias que ajustar: se rechaza en vez de dejar la salida
      -- sin registrar, que es el agujero que abre la issue #711.
      IF v_bodega_id IS NULL THEN
        RAISE EXCEPTION
          'El renglon del lote % no indica de que bodega sale. Sin bodega no se puede descontar.',
          v_renglon ->> 'lote_id';
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

  -- Un movimiento por combinacion (lote, bodega) y no uno por renglon: dos renglones de la misma
  -- receta pueden salir del mismo lote, y el kardex tiene que leerse como una entrega, no como
  -- dos. Es la misma agregacion que hacia totalPorLote() en el cliente, ahora en la base.
  FOR v_salida IN
    SELECT
      (renglon ->> 'lote_id')::UUID AS lote_id,
      (renglon ->> 'bodega_id')::UUID AS bodega_id,
      SUM((renglon ->> 'cantidad_entregada')::INT) AS cantidad
    FROM jsonb_array_elements(p_detalle) AS renglon
    WHERE NULLIF(renglon ->> 'lote_id', '') IS NOT NULL
    GROUP BY 1, 2
  LOOP
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por
    )
    VALUES (
      'salida',
      v_salida.lote_id,
      v_salida.bodega_id,
      v_salida.cantidad,
      'Entrega por receta medica ' || COALESCE(v_folio, ''),
      auth.uid()
    );
  END LOOP;

  RETURN v_receta_id;
END;
$$;

COMMENT ON FUNCTION fn_generar_receta(UUID, UUID, TEXT, JSONB) IS
  'Crea una receta con todos sus renglones Y registra la salida de inventario correspondiente, '
  'todo en una sola transaccion (issues #120 y #711): si un renglon o una salida falla, no queda '
  'ni la receta ni el movimiento. Antes de insertar cada renglon con lote comprueba que el lote '
  'no este vencido, que la existencia alcance y que venga la bodega de la que sale. Los renglones '
  'sin lote no se comprueban ni generan movimiento: recetar sin especificar lote es valido '
  '(receta_detalle.lote_id es nullable en la 00019) y ahi el control ocurre al despachar. Los '
  'movimientos se agrupan por (lote, bodega), asi que dos renglones del mismo lote dan una sola '
  'salida. Desde la issue #764 tambien persiste bodega_id en receta_detalle, que '
  'fn_ajustar_entrega_receta() necesita para corregir la cantidad entregada mas adelante sin '
  'descontar el inventario dos veces. SECURITY INVOKER: quien puede crear la receta y quien '
  'puede registrar el movimiento lo deciden las politicas de la 00033 y la 00034, no esta '
  'funcion; el flujo de aprobacion no cambia (administrador autoaprueba por la 00028, medico y '
  'voluntario dejan el movimiento pendiente).';

-- ============================================================================
-- 3. fn_ajustar_entrega_receta: corrige cantidad_ajustada sin descontar dos veces
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_ajustar_entrega_receta(
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
      -- Se entrego MAS de lo ya confirmado: es una salida adicional, con las mismas
      -- comprobaciones de fn_generar_receta (lote vigente, existencia suficiente), para dar un
      -- error inmediato a quien ajusta en vez de uno tardio a quien apruebe el movimiento.
      SELECT fecha_vencimiento INTO v_vence FROM public.lotes WHERE id = v_detalle.lote_id;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se puede ajustar hacia un lote vencido: % vencio el %.',
          v_detalle.lote_id, v_vence;
      END IF;

      SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_disponible
      FROM public.existencias
      WHERE lote_id = v_detalle.lote_id;

      IF v_disponible < v_diferencia THEN
        RAISE EXCEPTION
          'Existencia insuficiente para ajustar la entrega. Disponible: %, diferencia solicitada: %.',
          v_disponible, v_diferencia;
      END IF;

      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por
      )
      VALUES (
        'salida', v_detalle.lote_id, v_detalle.bodega_id, v_diferencia,
        'Ajuste de entrega: se entrego ' || v_diferencia ||
          ' unidad(es) mas de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid()
      );
    ELSE
      -- Se entrego MENOS: la diferencia se devuelve a existencia. No hay comprobacion de
      -- vencimiento ni de disponibilidad que hacer: devolver stock nunca puede fallar por falta
      -- de stock (mismo criterio que fn_aplicar_ajuste_existencias, que solo valida en 'salida').
      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por
      )
      VALUES (
        'ingreso', v_detalle.lote_id, v_detalle.bodega_id, ABS(v_diferencia),
        'Ajuste de entrega: se devuelve a existencia por entregar ' || ABS(v_diferencia) ||
          ' unidad(es) menos de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid()
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

COMMENT ON FUNCTION fn_ajustar_entrega_receta(UUID, INT) IS
  'Corrige la cantidad realmente entregada de un renglon de receta (issue #764) sin reescribir '
  'cantidad_entregada ni descontar el inventario dos veces: calcula la diferencia contra el '
  'ultimo valor confirmado (cantidad_ajustada si ya existia, si no cantidad_entregada) y registra '
  'un movimiento nuevo solo por esa diferencia -salida si se entrego mas, ingreso si se entrego '
  'menos-, con el mismo flujo de aprobacion que cualquier otro movimiento (administrador '
  'autoaprueba, medico y voluntario dejan pendiente). SECURITY DEFINER porque cantidad_ajustada, '
  'ajustada_por y ajustada_en no tienen policy ni GRANT de UPDATE para ningun rol -mismo candado '
  'que ya protegia cantidad_entregada (00033)-, asi que la funcion valida el rol a mano (solo '
  'medico o administrador, igual que las politicas de receta_detalle) en vez de depender de RLS, '
  'que aqui no se evalua.';

REVOKE EXECUTE ON FUNCTION fn_ajustar_entrega_receta(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_ajustar_entrega_receta(UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION fn_ajustar_entrega_receta(UUID, INT) TO authenticated;
