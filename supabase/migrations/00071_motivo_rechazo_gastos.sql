-- Ecopac Digital - Motivo de rechazo de gastos (issue #490)
--
-- rechazarGasto() (packages/shared/presupuestos/aprobacionGastosApi.js) escribia
-- rechazado_por, motivo_rechazo y fecha_rechazo, ninguna de las cuales existe en gastos
-- (00025_presupuesto_gastos.sql): la operacion fallaba siempre con 42703. El motivo de
-- rechazo es criterio de aceptacion de la issue #299 original, asi que no basta con corregir
-- el nombre: hace falta la columna.
--
-- Se sigue el patron que el esquema ya usa dos veces para "anular con motivo":
-- recetas.motivo_anulacion (00066) y donaciones.motivo_anulacion (00022), cada una con un
-- CHECK que ata el motivo al estado. Se descarta eventos_auditoria (00026): es un log
-- generico poblado solo por un trigger to_jsonb(OLD/NEW), no tiene trigger para gastos, y
-- el motivo de rechazo es un dato de negocio, no una traza tecnica.
--
-- La auditoria de quien decidio y cuando sigue viviendo en aprobado_por/fecha_aprobacion,
-- que ya existen y ya se reutilizan para aprobar y rechazar (mismo patron que
-- movimientos_inventario en 00023). No se agregan rechazado_por ni fecha_rechazo.
--
-- No hace falta GRANT ni politica RLS nueva: la politica de UPDATE de gastos (00052) no esta
-- acotada por columna, asi que ya cubre motivo_rechazo.

ALTER TABLE gastos ADD COLUMN motivo_rechazo TEXT;

ALTER TABLE gastos ADD CONSTRAINT chk_gastos_motivo_rechazo_coherente CHECK (
  (estado = 'rechazado' AND motivo_rechazo IS NOT NULL AND length(trim(motivo_rechazo)) > 0)
  OR
  (estado <> 'rechazado' AND motivo_rechazo IS NULL)
);

COMMENT ON COLUMN gastos.motivo_rechazo IS
  'Motivo obligatorio al rechazar un gasto (issue #490). El CHECK '
  'chk_gastos_motivo_rechazo_coherente obliga a que viaje junto con estado = rechazado y a '
  'que este en NULL en cualquier otro estado.';
