-- Ecopac Digital - Unificar fecha_aprobacion a aprobado_en (issue #412)
--
-- El resto de los pares actor/momento del esquema usan la misma raiz con sufijo _por/_en:
-- atendida_por/atendida_en (alertas_caducidad, 00021), anulada_por/anulada_en (donaciones,
-- 00022), tomado_por/tomado_en (triajes, 00013), realizado_por/realizado_en (eventos_auditoria,
-- 00026). fecha_aprobacion (movimientos_inventario 00023, gastos 00025) es el unico que rompe el
-- patron: su propio gemelo en la misma fila ya se llama aprobado_por, asi que el nombre correcto
-- del timestamp es aprobado_en, no un prefijo fecha_ suelto.
--
-- Se actualizan las dos funciones trigger que escriben la columna (fn_actualizar_existencias y
-- fn_autoaprobar_movimiento_inventario, ambas vigentes desde 00047) para que sigan compilando
-- contra el nuevo nombre. RENAME COLUMN no les avisa solo: a diferencia de una politica RLS, el
-- cuerpo de una funcion PL/pgSQL referencia NEW.fecha_aprobacion como texto compilado, y quedaria
-- roto (columna inexistente) en el primer UPDATE que lo dispare si no se reescribe aqui.

ALTER TABLE movimientos_inventario RENAME COLUMN fecha_aprobacion TO aprobado_en;
ALTER TABLE gastos RENAME COLUMN fecha_aprobacion TO aprobado_en;

CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actúa cuando el estado cambia a 'aprobado'
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN

    IF NEW.aprobado_en IS NULL THEN
      NEW.aprobado_en := NOW();
    END IF;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_autoaprobar_movimiento_inventario()
RETURNS TRIGGER AS $$
BEGIN
  IF es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
    NEW.aprobacion_automatica := TRUE;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_autoaprobar_movimiento_inventario() IS
  'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via '
  'auth.uid(), nunca de un campo del cliente), hace nacer el movimiento en estado aprobado, '
  'con aprobado_por, aprobado_en y aprobacion_automatica fijados automaticamente, y '
  'aplica el ajuste de existencias correspondiente sobre existencias (issue #369, antes '
  'lotes_existencias). Cualquier otro rol conserva el DEFAULT ''pendiente'' de la columna '
  'estado (00023), sin cambios.';
