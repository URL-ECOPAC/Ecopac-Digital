-- Ecopac Digital - Auto-aprobacion de movimientos de inventario registrados por administrador
--
-- Issue #294: un movimiento de inventario (00023) nace hoy siempre en estado 'pendiente'. Esta
-- migracion agrega un trigger BEFORE INSERT que, cuando quien inserta es administrador (segun
-- es_administrador() de 00004, que lee el rol desde perfiles via auth.uid(), nunca desde un
-- campo enviado por el cliente), lo hace nacer 'aprobado' con aprobado_por y fecha_aprobacion
-- fijados automaticamente. Cualquier otro rol conserva el comportamiento actual sin cambios.
--
-- No se toca 00023, 00024 ni 00004: la nueva logica vive aqui y se ata mediante
-- CREATE OR REPLACE FUNCTION / ALTER TABLE / CREATE TRIGGER, el mismo patron que ya uso 00024
-- para corregir fn_actualizar_existencias hacia adelante.

-- ============================================================================
-- 1. Columna para distinguir aprobacion automatica de aprobacion manual
-- ============================================================================
-- El registro de auditoria de movimientos_inventario vive en columnas de la fila
-- (registrado_por, aprobado_por, fecha_aprobacion), no en una tabla de historial aparte. Sin
-- esta columna, distinguir "aprobado por este trigger" de "aprobado manualmente por alguien mas
-- via el flujo de #80" solo se podria inferir comparando aprobado_por con registrado_por, lo
-- cual es ambiguo: un administrador puede aprobar manualmente el pendiente de otra persona, o
-- el propio movimiento pendiente de otro administrador.
ALTER TABLE movimientos_inventario
  ADD COLUMN aprobacion_automatica BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN movimientos_inventario.aprobacion_automatica IS
  'TRUE cuando el estado aprobado lo fijo el trigger tr_autoaprobar_movimiento_inventario al '
  'insertar (administrador). FALSE en el flujo manual de aprobacion de #80, incluido el caso '
  'en el que un administrador aprueba manualmente un movimiento pendiente ya existente.';

-- ============================================================================
-- 2. Funcion auxiliar: ajuste de existencias, extraida de fn_actualizar_existencias
-- ============================================================================
-- tr_actualizar_existencias (00023, reescrita en 00024) es BEFORE UPDATE y depende de OLD para
-- saber si el estado cambio a 'aprobado'. En un INSERT no existe OLD, asi que ese trigger nunca
-- se dispara para un movimiento que nace ya aprobado: las existencias quedarian sin ajustar.
--
-- En vez de agregar un segundo trigger BEFORE INSERT separado (que dependeria del orden
-- alfabetico en el que Postgres dispara varios triggers BEFORE del mismo evento, un
-- acoplamiento invisible), se extrae el ajuste de stock a esta funcion auxiliar y la llaman
-- ambos caminos: fn_actualizar_existencias (aprobacion manual, UPDATE) y
-- fn_autoaprobar_movimiento_inventario (aprobacion automatica, INSERT).
CREATE OR REPLACE FUNCTION fn_aplicar_ajuste_existencias(
  p_lote_id UUID,
  p_tipo tipo_movimiento,
  p_cantidad INT
)
RETURNS VOID AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  SELECT cantidad, fecha_vencimiento
  INTO v_stock_actual, v_fecha_vencimiento
  FROM lotes_existencias
  WHERE id = p_lote_id
  FOR UPDATE;

  IF p_tipo = 'salida' THEN
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
    END IF;

    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
    END IF;

    UPDATE lotes_existencias
    SET cantidad = cantidad - p_cantidad,
        updated_at = NOW()
    WHERE id = p_lote_id;

  ELSIF p_tipo = 'ingreso' THEN
    UPDATE lotes_existencias
    SET cantidad = cantidad + p_cantidad,
        updated_at = NOW()
    WHERE id = p_lote_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. fn_actualizar_existencias ahora delega el ajuste en la funcion auxiliar
-- ============================================================================
-- Mismo disparador (tr_actualizar_existencias, BEFORE UPDATE, definido en 00023 y sin tocar
-- aqui): solo se reemplaza el cuerpo de la funcion, igual que ya hizo 00024.
CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actúa cuando el estado cambia a 'aprobado'
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN

    IF NEW.fecha_aprobacion IS NULL THEN
      NEW.fecha_aprobacion := NOW();
    END IF;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Trigger de auto-aprobacion para administrador
-- ============================================================================
-- No es SECURITY DEFINER: no necesita bypasear RLS directamente porque delega la lectura del
-- rol en es_administrador() (que ya resuelve eso via rol_actual(), SECURITY DEFINER) y
-- lotes_existencias no tiene RLS habilitado (mismo motivo por el que fn_actualizar_existencias
-- tampoco lo necesita).
CREATE OR REPLACE FUNCTION fn_autoaprobar_movimiento_inventario()
RETURNS TRIGGER AS $$
BEGIN
  IF es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.fecha_aprobacion := NOW();
    NEW.aprobacion_automatica := TRUE;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_autoaprobar_movimiento_inventario() IS
  'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via '
  'auth.uid(), nunca de un campo del cliente), hace nacer el movimiento en estado aprobado, '
  'con aprobado_por, fecha_aprobacion y aprobacion_automatica fijados automaticamente, y '
  'aplica el ajuste de existencias correspondiente. Cualquier otro rol conserva el DEFAULT '
  '''pendiente'' de la columna estado (00023), sin cambios.';

CREATE TRIGGER tr_autoaprobar_movimiento_inventario
BEFORE INSERT ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_autoaprobar_movimiento_inventario();

COMMENT ON TRIGGER tr_autoaprobar_movimiento_inventario ON movimientos_inventario IS
  'Auto-aprueba al insertar cuando quien registra el movimiento es administrador. Issue #294.';
