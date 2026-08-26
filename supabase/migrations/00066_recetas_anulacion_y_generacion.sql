CREATE TYPE estado_receta AS ENUM ('emitida', 'anulada');

ALTER TABLE recetas
  ADD COLUMN estado estado_receta NOT NULL DEFAULT 'emitida',
  ADD COLUMN motivo_anulacion TEXT,
  ADD COLUMN anulada_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  ADD COLUMN anulada_en TIMESTAMPTZ;

ALTER TABLE recetas
  ADD CONSTRAINT chk_recetas_anulacion_coherente CHECK (
    (estado = 'emitida'
      AND motivo_anulacion IS NULL AND anulada_por IS NULL AND anulada_en IS NULL)
    OR
    (estado = 'anulada'
      AND motivo_anulacion IS NOT NULL AND anulada_por IS NOT NULL AND anulada_en IS NOT NULL)
  );

CREATE INDEX idx_recetas_estado ON recetas (estado);

COMMENT ON COLUMN recetas.estado IS
  'Una receta emitida no se edita: se anula indicando el motivo (issue #120, RF-11). El CHECK '
  'chk_recetas_anulacion_coherente obliga a que motivo_anulacion, anulada_por y anulada_en '
  'viajen juntos con el estado anulada, y a que esten en NULL mientras siga emitida.';

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
  v_cantidad INT;
  v_vence DATE;
  v_disponible INT;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una receta necesita al menos un medicamento.';
  END IF;

  INSERT INTO public.recetas (consulta_id, medico_id, indicaciones_generales)
  VALUES (p_consulta_id, p_medico_id, p_indicaciones_generales)
  RETURNING id INTO v_receta_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_lote_id := NULLIF(v_renglon ->> 'lote_id', '')::UUID;
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

  RETURN v_receta_id;
END;
$$;

COMMENT ON FUNCTION fn_generar_receta(UUID, UUID, TEXT, JSONB) IS
  'Crea una receta con todos sus renglones en una sola transaccion: si un renglon falla, la '
  'receta tampoco queda (issue #120, criterio 1). Antes de insertar cada renglon con lote '
  'comprueba que el lote no este vencido y que la existencia alcance, que es el criterio 2. Los '
  'renglones sin lote no se comprueban: recetar sin especificar lote es valido (receta_detalle.'
  'lote_id es nullable en la 00019) y en ese caso el control ocurre al despachar, en '
  'fn_aplicar_ajuste_existencias (00047). SECURITY INVOKER: quien puede crear la receta lo '
  'deciden las politicas de la 00033, no esta funcion.';

GRANT EXECUTE ON FUNCTION fn_generar_receta(UUID, UUID, TEXT, JSONB) TO authenticated;
