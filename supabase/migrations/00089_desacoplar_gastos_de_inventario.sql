-- Ecopac Digital - Desacoplar gastos de movimientos_inventario (issue #412, casos 1 y 7)
--
-- Dos coincidencias de codigo, no de nombre, entre gastos y movimientos_inventario que hacian
-- que un cambio pensado solo para inventario pudiera afectar a gastos sin que nadie lo notara:
--
-- 1. gastos.estado reutilizaba el enum estado_movimiento (00023, pensado para
--    movimientos_inventario). Agregar o quitar un valor al flujo de aprobacion de inventario
--    habria cambiado tambien los valores permitidos en gastos.estado, sin relacion real entre
--    los dos flujos. Se le da su propio enum, estado_gasto, con los mismos tres valores que ya
--    tenia (00025): el cambio de tipo no mueve datos, solo separa el vocabulario.
--
-- 2. fn_gastos_updated_at() (00025) duplicaba, literalmente igual, a
--    actualizar_timestamp_updated_at() (00001, la funcion que ya usan el resto de tablas con
--    updated_at). Se elimina la copia y el trigger de gastos pasa a usar la funcion compartida.

-- ============================================================================
-- 1. estado_gasto: mismo vocabulario que estado_movimiento, tipo propio
-- ============================================================================
CREATE TYPE estado_gasto AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- Dos objetos referencian estado y bloquean el ALTER COLUMN TYPE mientras existan -Postgres no
-- los actualiza solo como haria con un RENAME COLUMN-: la politica de INSERT de 00052
-- ("cannot alter type of a column used in a policy definition", SQLSTATE 0A000) y el CHECK
-- chk_gastos_motivo_rechazo_coherente de 00071 (su literal 'rechazado' quedo tipado contra
-- estado_movimiento al crearse; compararlo despues contra estado_gasto es "operator does not
-- exist: estado_gasto = estado_movimiento", SQLSTATE 42883). Los dos se eliminan y se vuelven a
-- crear identicos despues del cambio de tipo.
DROP POLICY "Administrador registra cualquier gasto; el personal asignado registra los de su jornada"
  ON gastos;

ALTER TABLE gastos DROP CONSTRAINT chk_gastos_motivo_rechazo_coherente;

-- DROP DEFAULT antes del cambio de tipo: un DEFAULT que referencia al tipo viejo bloquea el
-- ALTER COLUMN TYPE. El USING castea cada fila por su representacion de texto -- 'pendiente',
-- 'aprobado' y 'rechazado' existen identicos en los dos enums, asi que no hay valor que se
-- quede sin mapear.
ALTER TABLE gastos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE gastos
  ALTER COLUMN estado TYPE estado_gasto USING estado::text::estado_gasto;
ALTER TABLE gastos ALTER COLUMN estado SET DEFAULT 'pendiente';

CREATE POLICY "Administrador registra cualquier gasto; el personal asignado registra los de su jornada"
  ON gastos FOR INSERT TO authenticated
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('presupuestos.registrar')
    OR (
      public.participa_en_jornada(jornada_id)
      AND estado = 'pendiente'
      AND registrado_por = auth.uid()
    )
  );

ALTER TABLE gastos ADD CONSTRAINT chk_gastos_motivo_rechazo_coherente CHECK (
  (estado = 'rechazado' AND motivo_rechazo IS NOT NULL AND length(trim(motivo_rechazo)) > 0)
  OR
  (estado <> 'rechazado' AND motivo_rechazo IS NULL)
);

COMMENT ON TYPE estado_gasto IS
  'Estados del flujo de aprobacion de un gasto. Vocabulario propio de gastos, separado de '
  'estado_movimiento (issue #412): antes del desacople, gastos.estado reutilizaba ese enum '
  'pensado para movimientos_inventario, y un cambio en el flujo de inventario podia alterar '
  'sin querer los valores permitidos aqui.';

-- ============================================================================
-- 2. Trigger de updated_at: usar la funcion compartida en vez de la copia
-- ============================================================================
DROP TRIGGER tr_gastos_updated_at ON gastos;

CREATE TRIGGER tr_gastos_updated_at
BEFORE UPDATE ON gastos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

DROP FUNCTION fn_gastos_updated_at();
