-- ============================================================================
-- 00176: lo que se receta en una jornada sale de su bodega
-- ============================================================================
--
-- Una jornada tiene bodega de botiquin (jornadas.botiquin_bodega_id, 00036), documentada como "de
-- ella salen las entregas" (00156). Pero la receta ofrecia los lotes de todas las bodegas, y
-- fn_generar_receta descontaba de la que el cliente dijera. La organizacion pidio:
--
-- - Si la jornada tiene bodega de botiquin, el medicamento sale solo de ahi, primero el lote que
--   vence antes.
-- - Si no tiene, sale de la bodega principal.
--
-- 1. bodegas.es_principal marca la bodega principal: la que siembra la 00017 con ese nombre, o, si
--    se renombro, la bodega fija mas antigua. Un indice unico parcial impide que haya dos.
-- 2. fn_bodega_de_entrega_de_consulta() dice de que bodega sale lo que se receta en una consulta:
--    la del botiquin de su jornada, o la principal. La consulta el cliente para ofrecer solo esos
--    lotes, y la usa fn_generar_receta para rechazar cualquier otra.
-- 3. fn_generar_receta: el cuerpo de la 00171 con dos cambios. Rechaza un renglon cuya bodega no
--    es la de entrega, y la existencia que compara es la de ese lote EN esa bodega; antes sumaba
--    todas las bodegas, y una receta podia pasar la comprobacion y despues fallar al descontar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La bodega principal
-- ----------------------------------------------------------------------------
ALTER TABLE public.bodegas ADD COLUMN es_principal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bodegas.es_principal IS
  'TRUE en la bodega principal: de ella sale lo que se receta en una jornada sin bodega de botiquin (00176). Hay una sola.';

CREATE UNIQUE INDEX uq_bodegas_una_principal ON public.bodegas (es_principal) WHERE es_principal;

UPDATE public.bodegas
SET es_principal = TRUE
WHERE id = COALESCE(
  (SELECT id FROM public.bodegas WHERE nombre = 'Bodega Principal'),
  (SELECT id FROM public.bodegas WHERE NOT es_movil ORDER BY created_at LIMIT 1)
);

-- ----------------------------------------------------------------------------
-- 2. De que bodega sale lo que se receta en una consulta
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: el medico puede no leer la jornada ni las atenciones por RLS, y con su consulta
-- la jornada no apareceria y la funcion caeria a la bodega principal. Solo devuelve el id de una
-- bodega, que cualquier autenticado ya lee (00062).
CREATE FUNCTION public.fn_bodega_de_entrega_de_consulta(p_consulta_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT j.botiquin_bodega_id
      FROM public.consultas c
      JOIN public.atenciones a ON a.id = c.atencion_id
      JOIN public.jornadas j ON j.id = a.jornada_id
      WHERE c.id = p_consulta_id
    ),
    (SELECT b.id FROM public.bodegas b WHERE b.es_principal)
  );
$$;

COMMENT ON FUNCTION public.fn_bodega_de_entrega_de_consulta(UUID) IS
  'Bodega de la que sale lo que se receta en una consulta: la de botiquin de su jornada o, si no tiene, la principal (00176).';

REVOKE EXECUTE ON FUNCTION public.fn_bodega_de_entrega_de_consulta(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_bodega_de_entrega_de_consulta(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. fn_generar_receta solo descuenta de la bodega de entrega
-- ----------------------------------------------------------------------------
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

      -- FOUND y no `v_vence IS NULL`: desde la 00171 un lote de insumo puede no tener fecha.
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote indicado no existe.';
      END IF;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION
          'No se puede recetar del lote %: vencio el %.',
          v_renglon ->> 'lote_id', v_vence;
      END IF;

      -- Sin bodega no hay fila de existencias que ajustar: se rechaza en vez de dejar la salida
      -- sin registrar, que es el agujero que abre la issue #711.
      IF v_bodega_id IS NULL THEN
        RAISE EXCEPTION
          'El renglon del lote % no indica de que bodega sale. Sin bodega no se puede descontar.',
          v_renglon ->> 'lote_id';
      END IF;

      -- 00176: solo de la bodega del botiquin de la jornada, o de la principal.
      IF v_bodega_de_entrega IS NOT NULL AND v_bodega_id <> v_bodega_de_entrega THEN
        RAISE EXCEPTION
          'En esta jornada los medicamentos salen de la bodega %, no de otra.',
          (SELECT nombre FROM public.bodegas WHERE id = v_bodega_de_entrega)
          USING ERRCODE = 'object_not_in_prerequisite_state';
      END IF;

      SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_disponible
      FROM public.existencias
      WHERE lote_id = v_lote_id
        AND bodega_id = v_bodega_id;

      IF v_disponible < v_cantidad THEN
        RAISE EXCEPTION
          'Existencia insuficiente en el lote %. Disponible: %, solicitado: %.',
          v_renglon ->> 'lote_id', v_disponible, v_cantidad;
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
$function$;
