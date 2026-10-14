-- Ecopac Digital - Emitir una receta y registrar su salida de inventario, juntas (issue #711)
--
-- EL PROBLEMA. Emitir la receta y descontar el inventario eran dos operaciones separadas y no
-- atomicas. fn_generar_receta (00066) creaba la receta y sus renglones en una transaccion, y
-- despues el cliente (packages/shared/pacientes/useGeneracionReceta.js) recorria los lotes
-- llamando a registrarSalida() una vez por lote, en serie. Si una de esas llamadas fallaba, la
-- receta quedaba emitida y el medicamento seguia contado como disponible.
--
-- Motivos realistas de fallo a media receta, en jornada: se cae la red entre la primera salida y
-- la tercera; otro puesto despacho del mismo lote entre que se eligio y se confirmo; el lote paso
-- de vigente a vencido al cruzar la medianoche; o la politica de INSERT rechaza el movimiento
-- aunque la de recetas si dejara emitir. En los cuatro casos el medicamento sale de la bodega
-- fisica y el sistema lo sigue contando.
--
-- EL ARREGLO. El registro del movimiento se mueve DENTRO de fn_generar_receta. Al ser una sola
-- transaccion, o quedan la receta y sus movimientos, o no queda ninguna de las dos cosas. Se
-- eligio ampliar la funcion que ya existia en vez de crear una que envolviera a las dos porque
-- fn_generar_receta ya recorre el detalle renglon por renglon y ya comprueba lote vencido y
-- existencia suficiente: el movimiento se inserta justo donde esas comprobaciones acaban de
-- pasar, sin recorrer el detalle dos veces ni duplicar las validaciones.
--
-- LO QUE NO CAMBIA: EL FLUJO DE APROBACION. El movimiento se inserta con el mismo camino que
-- usaba registrarSalida(), asi que las reglas de 00023/00028/00048 siguen mandando:
--
--   - Administrador: tr_autoaprobar_movimiento_inventario lo aprueba al insertar y aplica el
--     ajuste sobre existencias en el acto.
--   - Medico y voluntario: nace 'pendiente' y el stock no se mueve hasta que administracion
--     apruebe, exactamente como hoy.
--
-- Lo que esta migracion garantiza no es que el stock baje siempre en el momento, sino que NUNCA
-- exista una receta emitida sin su movimiento registrado. Antes, cuando la salida fallaba, no
-- quedaba ni siquiera un pendiente que administracion pudiera encontrar y aprobar: no habia
-- rastro de nada.
--
-- SECURITY INVOKER, como estaba. La funcion no gana privilegios: el INSERT en
-- movimientos_inventario pasa por la politica de la 00034 con el usuario que llama, y por eso
-- registrado_por se fija a auth.uid() (esa politica exige que sea exactamente auth.uid() para
-- medico y voluntario). Un rol que no pueda registrar movimientos tampoco podra emitir la
-- receta, que es justo lo que la issue pide: enterarse antes de entregar nada.
--
-- LA BODEGA ES OBLIGATORIA CUANDO HAY LOTE. `existencias` esta particionada por (lote_id,
-- bodega_id) desde la 00047, asi que no se puede descontar sin saber de que bodega sale. El
-- detalle JSONB gana la clave `bodega_id`, y un renglon con lote pero sin bodega ahora es un
-- error explicito en vez de una salida que nadie registra. Los renglones SIN lote se siguen
-- admitiendo sin tocar inventario: recetar sin especificar lote es valido (receta_detalle.lote_id
-- es nullable, 00019) y ahi el control ocurre al despachar.
--
-- ADEMAS: DOS TRIGGERS DE INVENTARIO QUE DEPENDIAN DEL search_path DE QUIEN LLAMA
--
-- fn_generar_receta corre con `SET search_path = ''` (00066), como todas las funciones de este
-- esquema. Al mover el INSERT en movimientos_inventario dentro de ella, sus triggers pasan a
-- ejecutarse tambien con ese search_path vacio, y dos de ellos llamaban a otras funciones SIN
-- calificar con el esquema:
--
--   fn_autoaprobar_movimiento_inventario (BEFORE INSERT, 00028/00094) -> es_administrador(),
--                                                                        fn_aplicar_ajuste_existencias()
--   fn_actualizar_existencias            (BEFORE UPDATE, 00023/00094) -> fn_aplicar_ajuste_existencias()
--
-- Hasta ahora funcionaban porque quien insertaba era PostgREST, con `public` en el search_path.
-- Desde dentro de una funcion endurecida fallan con "function es_administrador() does not exist".
-- Se recrean las dos con `SET search_path = ''` y las llamadas calificadas, que es lo que ya
-- hacen fn_aplicar_ajuste_existencias (00107) y registrar_evento_auditoria (00026). No cambia su
-- logica ni su modelo de seguridad: solo dejan de depender del search_path de quien las dispara.

CREATE OR REPLACE FUNCTION fn_autoaprobar_movimiento_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF public.es_administrador() THEN
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

COMMENT ON FUNCTION fn_autoaprobar_movimiento_inventario() IS
  'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via '
  'auth.uid(), nunca de un campo del cliente), hace nacer el movimiento en estado aprobado, '
  'con aprobado_por, aprobado_en y aprobacion_automatica fijados automaticamente, y '
  'aplica el ajuste de existencias correspondiente. Cualquier otro rol conserva el DEFAULT '
  '''pendiente'' de la columna estado (00023), sin cambios. Desde la 00112 lleva '
  'SET search_path = '''' y llama calificado: antes dependia de que quien disparara el trigger '
  'tuviera public en su search_path, y fallaba al insertarse desde una funcion endurecida.';

CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo actua cuando el estado cambia a 'aprobado'.
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN

    IF NEW.aprobado_en IS NULL THEN
      NEW.aprobado_en := NOW();
    END IF;

    PERFORM public.fn_aplicar_ajuste_existencias(
      NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_actualizar_existencias() IS
  'Aplica el ajuste de existencias cuando un movimiento pasa a aprobado (00023, sobre '
  'existencias desde la 00047). Desde la 00112 lleva SET search_path = '''' y llama calificado, '
  'por el mismo motivo que fn_autoaprobar_movimiento_inventario.';

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
      -- sin registrar, que es el agujero que abre esta issue.
      IF v_bodega_id IS NULL THEN
        RAISE EXCEPTION
          'El renglon del lote % no indica de que bodega sale. Sin bodega no se puede descontar.',
          v_renglon ->> 'lote_id';
      END IF;
    END IF;

    INSERT INTO public.receta_detalle (
      receta_id, medicamento_id, lote_id, dosis, frecuencia, duracion, cantidad_entregada
    )
    VALUES (
      v_receta_id,
      (v_renglon ->> 'medicamento_id')::UUID,
      v_lote_id,
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
  'salida. SECURITY INVOKER: quien puede crear la receta y quien puede registrar el movimiento '
  'lo deciden las politicas de la 00033 y la 00034, no esta funcion; el flujo de aprobacion no '
  'cambia (administrador autoaprueba por la 00028, medico y voluntario dejan el movimiento '
  'pendiente).';

GRANT EXECUTE ON FUNCTION fn_generar_receta(UUID, UUID, TEXT, JSONB) TO authenticated;
