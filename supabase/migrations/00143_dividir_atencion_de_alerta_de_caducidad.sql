-- Ecopac Digital - Atender una alerta de caducidad con varias acciones (PLAN.md punto 5)
--
-- Hasta hoy fn_atender_alerta_caducidad (00138) recibia UNA accion y vaciaba TODO el lote con
-- ella, en todas las bodegas: no habia forma de donar una parte y descartar otra. El limite no
-- era cantidad_afectada (el numero que quedo congelado al generar la alerta) sino el stock VIVO
-- de existencias en el momento de atender -- ese criterio no cambia aqui, solo se reparte entre
-- varias acciones en vez de aplicarse entero a una sola.
--
-- CONTRATO NUEVO: p_accion + p_bodega_destino_id se reemplazan por p_acciones JSONB, un arreglo
-- de { accion, cantidad, bodegaDestinoId? }. El servidor exige que la suma de las cantidades sea
-- EXACTAMENTE el disponible total del lote (no <=): atender una alerta sigue significando "este
-- lote queda resuelto del todo", ahora repartido en varias acciones en vez de una. Permitir un
-- remanente sin asignar dejaria unidades sin alerta activa que las cubra hasta que el generador
-- diario decida si les toca una nueva.
--
-- REGISTRO DE VARIAS ACCIONES: alertas_caducidad.accion es una sola columna y no alcanza para
-- guardar un desglose. Se agrega alerta_caducidad_detalle (una fila por accion aplicada, siempre
-- -incluso cuando solo hubo una-) y alertas_caducidad.accion se sigue llenando SOLO cuando la
-- alerta se resolvio con una unica accion (compatibilidad con las pantallas que ya la leen tal
-- cual); con varias, queda NULL y el desglose completo vive en la tabla nueva. El CHECK
-- chk_alertas_caducidad_cierre_coherente (00021) exigia accion NOT NULL en toda alerta atendida;
-- se relaja para permitir NULL en el caso de varias acciones.

-- ============================================================================
-- 1. Relajar el CHECK de cierre: accion puede quedar NULL si el detalle esta en la tabla nueva
-- ============================================================================
ALTER TABLE alertas_caducidad
  DROP CONSTRAINT chk_alertas_caducidad_cierre_coherente;

ALTER TABLE alertas_caducidad
  ADD CONSTRAINT chk_alertas_caducidad_cierre_coherente CHECK (
    (estado = 'pendiente'
      AND accion IS NULL AND atendida_por IS NULL AND atendida_en IS NULL)
    OR
    (estado = 'atendida'
      AND atendida_por IS NOT NULL AND atendida_en IS NOT NULL)
  );

-- ============================================================================
-- 2. Detalle de las acciones aplicadas a una alerta
-- ============================================================================
CREATE TABLE alerta_caducidad_detalle (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  alerta_id UUID NOT NULL REFERENCES alertas_caducidad(id) ON DELETE CASCADE,
  accion accion_alerta NOT NULL,
  cantidad INT NOT NULL,
  -- Solo tiene valor cuando accion = 'reubicado'; la funcion no lo exige por CHECK porque ya lo
  -- exige antes de aplicar nada (mismo criterio que la funcion vieja no lo exigia por columna).
  bodega_destino_id UUID REFERENCES bodegas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alerta_caducidad_detalle_cantidad_positiva CHECK (cantidad > 0)
);

CREATE INDEX idx_alerta_caducidad_detalle_alerta_id ON alerta_caducidad_detalle (alerta_id);

ALTER TABLE alerta_caducidad_detalle ENABLE ROW LEVEL SECURITY;

-- Sin GRANT de INSERT/UPDATE/DELETE para nadie: la unica escritura es
-- fn_atender_alerta_caducidad, que es SECURITY DEFINER y no necesita permiso de tabla propio.
GRANT SELECT ON alerta_caducidad_detalle TO authenticated;

CREATE POLICY "Autenticados leen alerta_caducidad_detalle"
  ON alerta_caducidad_detalle FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 3. fn_atender_alerta_caducidad: p_accion + p_bodega_destino_id -> p_acciones JSONB
-- ============================================================================
-- DROP explicito: cambia el numero y el tipo de los parametros, CREATE OR REPLACE no alcanza
-- (mismo criterio que 00142/00143 con fn_registrar_medicamento, que a su vez sigue el de
-- 00081_generar_numero_ficha_por_secuencia.sql).
DROP FUNCTION IF EXISTS fn_atender_alerta_caducidad(UUID, accion_alerta, UUID);

CREATE FUNCTION fn_atender_alerta_caducidad(
  p_alerta_id UUID,
  p_acciones JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alerta public.alertas_caducidad;
  v_vence DATE;
  v_existencia RECORD;
  v_accion_item JSONB;
  v_accion public.accion_alerta;
  v_cantidad INT;
  v_bodega_destino UUID;
  v_pendiente INT;
  v_a_mover INT;
  v_total_disponible INT;
  v_suma_acciones INT := 0;
  v_num_acciones INT;
  v_disponible_fuera_destino INT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo administracion puede atender una alerta de vencimiento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta FROM public.alertas_caducidad WHERE id = p_alerta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La alerta no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_alerta.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La alerta ya fue atendida.' USING ERRCODE = '23514';
  END IF;

  v_num_acciones := COALESCE(jsonb_array_length(p_acciones), 0);
  IF v_num_acciones = 0 THEN
    RAISE EXCEPTION 'Hay que indicar al menos una accion.' USING ERRCODE = '23502';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = v_alerta.lote_id;

  -- Bloquea las filas de existencias del lote para toda la transaccion: nadie mas puede
  -- registrar un movimiento de este lote mientras se reparte entre las acciones, y lo que se
  -- lea aqui sigue siendo verdad cuando se aplique mas abajo.
  --
  -- El FOR UPDATE va sobre la subconsulta, no sobre el SELECT con SUM(): Postgres rechaza
  -- "FOR UPDATE is not allowed with aggregate functions" (SQLSTATE 42601) apenas se intenta
  -- planificar la sentencia, así que esto no era un caso raro -- CUALQUIER llamada a esta
  -- funcion caia aqui antes de mover nada. Y 42601 no es un codigo que
  -- errores-de-supabase.js sepa clasificar, asi que en pantalla se veia el generico "Ocurrio
  -- un error inesperado" para cualquier alerta que se intentara atender.
  SELECT COALESCE(SUM(bloqueadas.cantidad_disponible), 0) INTO v_total_disponible
  FROM (
    SELECT e.cantidad_disponible
    FROM public.existencias e
    WHERE e.lote_id = v_alerta.lote_id AND e.cantidad_disponible > 0
    FOR UPDATE
  ) bloqueadas;

  IF v_total_disponible = 0 THEN
    RAISE EXCEPTION 'El lote ya no tiene existencia disponible que atender.' USING ERRCODE = '23514';
  END IF;

  -- Validar cada accion y sumar cantidades ANTES de mover nada: una accion invalida a mitad de
  -- la lista no debe dejar las anteriores ya aplicadas.
  FOR v_accion_item IN SELECT * FROM jsonb_array_elements(p_acciones)
  LOOP
    v_accion := (v_accion_item ->> 'accion')::public.accion_alerta;
    v_cantidad := (v_accion_item ->> 'cantidad')::INT;
    v_bodega_destino := NULLIF(v_accion_item ->> 'bodegaDestinoId', '')::UUID;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada accion debe ser mayor a cero.' USING ERRCODE = '23514';
    END IF;

    IF v_accion = 'reubicado' THEN
      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION 'Un lote vencido no se reubica: se descarta o se dona.' USING ERRCODE = '23514';
      END IF;
      IF v_bodega_destino IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = v_bodega_destino) THEN
        RAISE EXCEPTION 'Reubicar exige una bodega destino que exista.' USING ERRCODE = '23502';
      END IF;

      -- Reubicar saca existencia de las demas bodegas para meterla en la destino: si el lote
      -- vive entero (o en su mayoria) ya en esa misma bodega, no hay de donde tomar la cantidad
      -- pedida. Sin este chequeo, el caso mas comun para provocarlo -un lote que solo esta en UNA
      -- bodega, y quien atiende elige esa misma bodega como destino, algo que la pantalla no le
      -- impide porque la alerta no muestra en que bodega esta el lote hoy- caia en el chequeo
      -- defensivo de mas abajo (pensado para que "nunca" pase) y esa RAISE usa ERRCODE 55000, que
      -- el cliente no sabe traducir: la persona veia "Ocurrio un error inesperado" en vez de un
      -- mensaje que explique que le falta stock fuera de la bodega destino.
      SELECT COALESCE(SUM(e.cantidad_disponible), 0) INTO v_disponible_fuera_destino
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id
        AND e.cantidad_disponible > 0
        AND e.bodega_id <> v_bodega_destino;

      IF v_cantidad > v_disponible_fuera_destino THEN
        RAISE EXCEPTION
          'No hay % unidades del lote fuera de la bodega destino para reubicar (disponible: %).',
          v_cantidad, v_disponible_fuera_destino USING ERRCODE = '23514';
      END IF;
    END IF;

    v_suma_acciones := v_suma_acciones + v_cantidad;
  END LOOP;

  IF v_suma_acciones <> v_total_disponible THEN
    RAISE EXCEPTION 'Las acciones tienen que sumar exactamente el disponible del lote (%), no %.',
      v_total_disponible, v_suma_acciones USING ERRCODE = '23514';
  END IF;

  -- Ahora si, aplicar: una accion a la vez, consumiendo bodegas hasta completar su cantidad, y
  -- dejando un registro en alerta_caducidad_detalle de cada una.
  FOR v_accion_item IN SELECT * FROM jsonb_array_elements(p_acciones)
  LOOP
    v_accion := (v_accion_item ->> 'accion')::public.accion_alerta;
    v_pendiente := (v_accion_item ->> 'cantidad')::INT;
    v_bodega_destino := NULLIF(v_accion_item ->> 'bodegaDestinoId', '')::UUID;

    IF v_accion <> 'reubicado' THEN
      PERFORM set_config('ecopac.baja_por_caducidad', 'on', TRUE);
    END IF;

    FOR v_existencia IN
      SELECT e.bodega_id, e.cantidad_disponible
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id
        AND e.cantidad_disponible > 0
        AND (v_accion <> 'reubicado' OR e.bodega_id <> v_bodega_destino)
      ORDER BY e.bodega_id
      FOR UPDATE
    LOOP
      EXIT WHEN v_pendiente <= 0;
      v_a_mover := LEAST(v_pendiente, v_existencia.cantidad_disponible);
      IF v_a_mover <= 0 THEN
        CONTINUE;
      END IF;

      IF v_accion = 'reubicado' THEN
        -- Primero el ingreso en la destino y despues la salida del origen: al reves, el total
        -- del medicamento pasaria por cero entre las dos sentencias y
        -- trg_existencias_notificar_sin_stock avisaria de un "sin stock" que nunca ocurrio.
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('ingreso', v_alerta.lote_id, v_bodega_destino, v_a_mover,
                'Reubicacion por alerta de vencimiento', auth.uid());
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_a_mover,
                'Reubicacion por alerta de vencimiento', auth.uid());
      ELSE
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_a_mover,
                'Baja por caducidad: ' || v_accion::TEXT, auth.uid());
      END IF;

      v_pendiente := v_pendiente - v_a_mover;
    END LOOP;

    IF v_accion <> 'reubicado' THEN
      PERFORM set_config('ecopac.baja_por_caducidad', 'off', TRUE);
    END IF;

    IF v_pendiente > 0 THEN
      -- No deberia pasar: la suma de todas las acciones ya se valido == disponible total, y el
      -- lote esta bloqueado (FOR UPDATE) desde antes de validar. Defensa, no camino esperado.
      RAISE EXCEPTION 'No se pudo completar la accion "%": faltaron % unidades por repartir.',
        v_accion, v_pendiente USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.alerta_caducidad_detalle (alerta_id, accion, cantidad, bodega_destino_id)
    VALUES (p_alerta_id, v_accion, (v_accion_item ->> 'cantidad')::INT, v_bodega_destino);
  END LOOP;

  -- accion en alertas_caducidad solo se llena cuando fue una unica accion (compatibilidad con
  -- las pantallas que ya la leen tal cual, sin desglose); con varias, queda NULL y el detalle
  -- completo vive en alerta_caducidad_detalle.
  UPDATE public.alertas_caducidad
  SET estado = 'atendida',
      accion = CASE
        WHEN v_num_acciones = 1 THEN (p_acciones -> 0 ->> 'accion')::public.accion_alerta
        ELSE NULL
      END,
      atendida_por = auth.uid(),
      atendida_en = NOW()
  WHERE id = p_alerta_id;

  RETURN p_alerta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_atender_alerta_caducidad(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION fn_atender_alerta_caducidad(UUID, JSONB) IS
  'Cierra una alerta de caducidad y ejecuta una o mas acciones sobre el stock, en una '
  'transaccion (issue de division de alertas, PLAN.md punto 5): p_acciones es un arreglo de '
  '{ accion, cantidad, bodegaDestinoId? } cuyas cantidades tienen que sumar exactamente el '
  'disponible vivo del lote (todas las bodegas) al momento de atender, no cantidad_afectada '
  '(el numero congelado al generar la alerta). descartado/donado dan de baja esa cantidad con '
  'salidas aprobadas; reubicado la traslada a bodegaDestinoId (exige que el lote no haya '
  'vencido). Cada accion aplicada queda en alerta_caducidad_detalle; alertas_caducidad.accion '
  'solo se llena cuando hubo una unica accion. Solo administracion; lanza 42501 a cualquier '
  'otro rol.';
