-- Ecopac Digital - Motivo de rechazo de movimientos de inventario (issue #491)
--
-- rechazarMovimiento() (packages/shared/inventario/validacion.api.js) escribe motivo_rechazo,
-- que no existe en movimientos_inventario (00023): la operacion fallaba siempre con 42703.
-- Mismo defecto exacto que #490 encontro en gastos, y misma solucion: la 00071 ya sento el
-- patron -columna nueva, no eventos_auditoria (que es un log tecnico generico, sin trigger
-- para movimientos_inventario, y el motivo de rechazo es un dato de negocio)- asi que esta
-- migracion lo repite aqui en vez de inventar un mecanismo distinto para el mismo problema.
--
-- La auditoria de quien decidio y cuando sigue viviendo en aprobado_por/fecha_aprobacion, que
-- ya existen y ya se reutilizan para aprobar y rechazar (00023). No se agregan
-- rechazado_por ni fecha_rechazo, mismo criterio que 00071.
--
-- No hace falta GRANT ni politica RLS nueva: la politica de UPDATE de movimientos_inventario
-- (00048, "Administrador aprueba o rechaza") no esta acotada por columna, asi que ya cubre
-- motivo_rechazo.

ALTER TABLE movimientos_inventario ADD COLUMN motivo_rechazo TEXT;

ALTER TABLE movimientos_inventario ADD CONSTRAINT chk_movimientos_motivo_rechazo_coherente CHECK (
  (estado = 'rechazado' AND motivo_rechazo IS NOT NULL AND length(trim(motivo_rechazo)) > 0)
  OR
  (estado <> 'rechazado' AND motivo_rechazo IS NULL)
);

COMMENT ON COLUMN movimientos_inventario.motivo_rechazo IS
  'Motivo obligatorio al rechazar un movimiento (issue #491, mismo patron que gastos.motivo_rechazo '
  'de la 00071). El CHECK chk_movimientos_motivo_rechazo_coherente obliga a que viaje junto con '
  'estado = rechazado y a que este en NULL en cualquier otro estado.';
