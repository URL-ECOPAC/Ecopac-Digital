-- ============================================================================
-- 00170: el renglon de una donacion de insumos tambien elige del catalogo
-- ============================================================================
--
-- Desde la 00135 el renglon de una donacion de medicamentos elige el medicamento del catalogo
-- (donacion_detalle.medicamento_id), y fn_registrar_donacion arma la descripcion y la unidad con
-- el. Los insumos se quedaron en texto libre: la 00135 los dejo fuera porque entonces "no habia
-- catalogo de insumos". Lo hay desde la 00142 (medicamentos.tipo_articulo) y la 00164 (un insumo
-- sin principio activo ni concentracion), y la pantalla ya ofrecia elegirlos de una lista, pero
-- la base rechazaba el medicamento_id fuera de una donacion de medicamentos. Asi que el cliente
-- guardaba el id del articulo como descripcion: el renglon decia un UUID y nunca llegaba a
-- inventario.
--
-- Desde aqui:
--
-- 1. Una donacion de insumos elige cada renglon del catalogo, igual que una de medicamentos, y
--    la descripcion y la unidad las pone el catalogo (nombre y presentacion).
-- 2. El articulo tiene que ser del tipo de la donacion: un insumo no entra en una donacion de
--    medicamentos ni al reves. Antes nada lo impedia.
--
-- Mismo cuerpo que la 00153 en todo lo demas. CREATE OR REPLACE con la misma firma: conserva los
-- privilegios (REVOKE de anon, GRANT a authenticated de la 00153).
--
-- Las donaciones de insumos ya registradas no se tocan: siguen con su descripcion y sin
-- medicamento_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_registrar_donacion(
  p_donante_id UUID,
  p_tipo public.tipo_donacion,
  p_fecha DATE,
  p_detalle JSONB,
  p_proyecto_id UUID DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL,
  p_jornada_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_donacion public.donaciones;
  v_renglon JSONB;
  v_detalle_id UUID;
  v_ids_detalle JSONB := '[]'::JSONB;
  v_medicamento_id UUID;
  v_medicamento public.medicamentos;
  v_descripcion TEXT;
  v_unidad TEXT;
  -- Que tipo de articulo del catalogo lleva cada renglon, o NULL si el tipo de donacion no usa
  -- catalogo (dinero, servicios).
  v_tipo_articulo public.tipo_articulo := CASE p_tipo
    WHEN 'medicamentos' THEN 'medicamento'::public.tipo_articulo
    WHEN 'insumos' THEN 'insumo'::public.tipo_articulo
  END;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una donacion necesita al menos un renglon de detalle.';
  END IF;

  INSERT INTO public.donaciones (
    donante_id, proyecto_id, jornada_id, tipo, fecha, observaciones, registrado_por
  )
  VALUES (
    p_donante_id, p_proyecto_id, p_jornada_id, p_tipo, p_fecha, p_observaciones, auth.uid()
  )
  RETURNING * INTO v_donacion;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_medicamento_id := NULLIF(v_renglon ->> 'medicamentoId', '')::UUID;
    v_descripcion := v_renglon ->> 'descripcion';
    v_unidad := v_renglon ->> 'unidad';

    IF v_tipo_articulo IS NOT NULL THEN
      IF v_medicamento_id IS NULL THEN
        RAISE EXCEPTION 'Cada renglon de una donacion de % tiene que elegir un articulo del catalogo.', p_tipo
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT * INTO v_medicamento FROM public.medicamentos WHERE id = v_medicamento_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El articulo elegido no existe en el catalogo.'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF v_medicamento.tipo_articulo <> v_tipo_articulo THEN
        RAISE EXCEPTION 'Una donacion de % solo lleva articulos de tipo %.', p_tipo, v_tipo_articulo
          USING ERRCODE = 'check_violation';
      END IF;

      -- El catalogo manda: lo que el cliente haya mandado como texto se ignora. Un insumo no
      -- tiene concentracion (00164): concat_ws la salta.
      v_descripcion := concat_ws(' ', v_medicamento.nombre, v_medicamento.concentracion);
      SELECT nombre INTO v_unidad FROM public.presentaciones WHERE id = v_medicamento.presentacion_id;
    ELSIF v_medicamento_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo una donacion de medicamentos o de insumos lleva un articulo del catalogo.'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.donacion_detalle (
      donacion_id, descripcion, cantidad, unidad, monto, medicamento_id
    )
    VALUES (
      v_donacion.id,
      v_descripcion,
      NULLIF(v_renglon ->> 'cantidad', '')::NUMERIC,
      v_unidad,
      NULLIF(v_renglon ->> 'monto', '')::NUMERIC,
      v_medicamento_id
    )
    RETURNING id INTO v_detalle_id;

    v_ids_detalle := v_ids_detalle || to_jsonb(v_detalle_id);
  END LOOP;

  RETURN jsonb_build_object('donacion', to_jsonb(v_donacion), 'detalleIds', v_ids_detalle);
END;
$function$;

COMMENT ON FUNCTION public.fn_registrar_donacion(UUID, public.tipo_donacion, DATE, JSONB, UUID, TEXT, UUID) IS
  'Registra una donacion con sus renglones en una transaccion. En medicamentos e insumos cada renglon elige un articulo del catalogo de su mismo tipo, y la descripcion y la unidad salen de el (00135, 00170).';

COMMENT ON COLUMN public.donacion_detalle.medicamento_id IS
  'Articulo del catalogo del renglon: un medicamento en una donacion de medicamentos, un insumo en una de insumos (00135, 00170). NULL en dinero y servicios, y en los insumos registrados antes de la 00170.';
