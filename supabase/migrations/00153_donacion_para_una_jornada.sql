-- ============================================================================
-- 00153: una donacion puede ser para una jornada
-- ============================================================================
--
-- Hasta aqui una donacion solo se podia asociar a un proyecto (proyecto_id, 00097). La
-- administracion trabaja por jornadas: un proyecto agrupa la informacion de sus jornadas, y una
-- donacion casi siempre se recibe para una jornada concreta. Se agrega donaciones.jornada_id.
--
-- La jornada manda sobre el proyecto: si la donacion es para una jornada, su proyecto es el de esa
-- jornada (o ninguno, si la jornada no tiene proyecto). Lo impone un trigger, para que no puedan
-- quedar una jornada de un proyecto y un proyecto distinto en la misma fila. Sin jornada, el
-- proyecto se sigue eligiendo como antes.
-- ============================================================================

ALTER TABLE public.donaciones
  ADD COLUMN jornada_id UUID REFERENCES public.jornadas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.donaciones.jornada_id IS
  'Jornada para la que se recibio la donacion (00153). Si esta puesta, proyecto_id es el de la jornada.';

CREATE INDEX idx_donaciones_jornada_id ON public.donaciones (jornada_id);

-- SECURITY DEFINER: quien registra donaciones por delegacion (donaciones.registrar) puede no leer
-- jornadas por RLS, y aun asi el proyecto tiene que salir de la jornada elegida.
CREATE FUNCTION public.fn_proyecto_de_la_jornada_de_la_donacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.jornada_id IS NOT NULL THEN
    SELECT j.proyecto_id INTO NEW.proyecto_id
    FROM public.jornadas j
    WHERE j.id = NEW.jornada_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_proyecto_de_la_jornada_de_la_donacion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_donaciones_proyecto_de_la_jornada
BEFORE INSERT OR UPDATE OF jornada_id, proyecto_id ON public.donaciones
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_de_la_jornada_de_la_donacion();

-- ============================================================================
-- fn_registrar_donacion recibe la jornada
-- ============================================================================
-- Cambia la firma (un parametro nuevo al final, con DEFAULT), asi que se borra y se vuelve a crear
-- con el mismo cuerpo que la 00144 y sus mismos privilegios.
DROP FUNCTION public.fn_registrar_donacion(UUID, public.tipo_donacion, DATE, JSONB, UUID, TEXT);

CREATE FUNCTION public.fn_registrar_donacion(
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

    IF p_tipo = 'medicamentos' THEN
      IF v_medicamento_id IS NULL THEN
        RAISE EXCEPTION 'Cada renglon de una donacion de medicamentos tiene que elegir un medicamento del catalogo.'
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT * INTO v_medicamento FROM public.medicamentos WHERE id = v_medicamento_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El medicamento elegido no existe en el catalogo.'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      -- El catalogo manda: lo que el cliente haya mandado como texto se ignora.
      v_descripcion := concat_ws(' ', v_medicamento.nombre, v_medicamento.concentracion);
      SELECT nombre INTO v_unidad FROM public.presentaciones WHERE id = v_medicamento.presentacion_id;
    ELSIF v_medicamento_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo una donacion de medicamentos lleva un medicamento del catalogo.'
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

REVOKE EXECUTE ON FUNCTION public.fn_registrar_donacion(UUID, public.tipo_donacion, DATE, JSONB, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_donacion(UUID, public.tipo_donacion, DATE, JSONB, UUID, TEXT, UUID) TO authenticated;
