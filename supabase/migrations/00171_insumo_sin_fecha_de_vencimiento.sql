-- ============================================================================
-- 00171: un lote de insumo puede no tener fecha de vencimiento
-- ============================================================================
--
-- lotes.fecha_vencimiento es NOT NULL desde la 00020, cuando todo el catalogo eran
-- medicamentos. Desde la 00142 tambien hay insumos (tipo_articulo), y muchos -gasas, jeringas,
-- guantes- no traen vencimiento: el ingreso obligaba a inventarles uno.
--
-- Desde aqui:
--
-- 1. La columna admite NULL, pero un lote de MEDICAMENTO la sigue exigiendo (trigger). No es un
--    CHECK porque la regla depende de medicamentos.tipo_articulo, otra tabla.
-- 2. Un lote sin fecha no vence. vista_lotes_disponibles y fn_medicamento_tiene_existencias lo
--    cuentan como disponible; antes `fecha_vencimiento >= CURRENT_DATE` lo dejaba fuera.
-- 3. fn_generar_receta decidia "el lote no existe" porque su fecha venia NULL. Ahora lo decide
--    con FOUND; el resto del cuerpo es el de la 00128, sin cambios.
--
-- Lo que ya se porta bien con NULL y no se toca: las salidas y ajustes rechazan un lote vencido
-- con `fecha_vencimiento < CURRENT_DATE`, que con NULL no es verdadero; las alertas de caducidad
-- (00162) comparan la fecha contra sus umbrales, y un lote sin fecha nunca entra; el CHECK
-- chk_lotes_vencimiento_posterior (00096) deja pasar un NULL.
-- ============================================================================

ALTER TABLE public.lotes ALTER COLUMN fecha_vencimiento DROP NOT NULL;

COMMENT ON COLUMN public.lotes.fecha_vencimiento IS
  'Fecha de vencimiento; un lote vencido no se entrega. Obligatoria en un lote de medicamento; un lote de insumo puede no tenerla y entonces no vence (00171).';

-- ----------------------------------------------------------------------------
-- 1. Un lote de medicamento lleva fecha de vencimiento
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: lee medicamentos.tipo_articulo, y quien registra un ingreso no tiene por que
-- poder leer el catalogo por RLS; sin el, el articulo no apareceria y el trigger lo dejaria pasar.
-- Solo lee ese dato; no devuelve nada a quien escribe.
CREATE FUNCTION public.fn_lote_de_medicamento_tiene_vencimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.fecha_vencimiento IS NULL AND EXISTS (
    SELECT 1
    FROM public.medicamentos m
    WHERE m.id = NEW.medicamento_id
      AND m.tipo_articulo = 'medicamento'
  ) THEN
    RAISE EXCEPTION 'Un lote de medicamento necesita fecha de vencimiento.'
      USING ERRCODE = 'not_null_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_lote_de_medicamento_tiene_vencimiento() IS
  'Rechaza un lote de medicamento sin fecha de vencimiento; un lote de insumo puede no tenerla (00171).';

REVOKE EXECUTE ON FUNCTION public.fn_lote_de_medicamento_tiene_vencimiento() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_lotes_medicamento_con_vencimiento
BEFORE INSERT OR UPDATE OF fecha_vencimiento, medicamento_id ON public.lotes
FOR EACH ROW
EXECUTE FUNCTION public.fn_lote_de_medicamento_tiene_vencimiento();

-- ----------------------------------------------------------------------------
-- 2. Un lote sin fecha no vence
-- ----------------------------------------------------------------------------
-- Mismas columnas, misma opcion security_invoker y mismo GRANT que la 00047.
CREATE OR REPLACE VIEW public.vista_lotes_disponibles
WITH (security_invoker = true) AS
SELECT
  l.id AS lote_id,
  l.medicamento_id,
  m.nombre AS medicamento_nombre,
  l.numero_lote,
  l.fecha_vencimiento,
  e.cantidad_disponible,
  e.created_at,
  e.updated_at,
  e.bodega_id,
  b.nombre AS bodega_nombre
FROM public.existencias e
JOIN public.lotes l ON l.id = e.lote_id
JOIN public.medicamentos m ON m.id = l.medicamento_id
JOIN public.bodegas b ON b.id = e.bodega_id
WHERE e.cantidad_disponible > 0
  AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE);

COMMENT ON VIEW public.vista_lotes_disponibles IS
  'Muestra las combinaciones (lote, bodega) con stock positivo cuyo lote no ha alcanzado su fecha de vencimiento, o no tiene (un insumo, 00171). security_invoker = TRUE hace que respete las politicas RLS de existencias, lotes, medicamentos y bodegas (00034). Issue #369: reconstruida sobre lotes/existencias (antes lotes_existencias); una fila por bodega en vez de una fila por lote, porque existencias trackea cantidad por bodega.';

CREATE OR REPLACE FUNCTION public.fn_medicamento_tiene_existencias(p_medicamento_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.existencias e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE l.medicamento_id = p_medicamento_id
      AND e.cantidad_disponible > 0
      AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
  );
$function$;

COMMENT ON FUNCTION public.fn_medicamento_tiene_existencias(UUID) IS
  'TRUE si el medicamento tiene stock positivo no vencido (existencias.cantidad_disponible > 0 y lote con fecha_vencimiento >= hoy, o sin fecha, 00171) en algun lote. medicamentos.api.js la consulta antes de desactivar un medicamento (issue #142); un medicamento con lotes historicos ya agotados o vencidos si se puede desactivar.';

-- ----------------------------------------------------------------------------
-- 3. fn_generar_receta: "el lote no existe" ya no se deduce de una fecha NULL
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

      -- FOUND y no `v_vence IS NULL`: desde la 00171 un lote de insumo puede no tener fecha.
      IF NOT FOUND THEN
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
$function$;
