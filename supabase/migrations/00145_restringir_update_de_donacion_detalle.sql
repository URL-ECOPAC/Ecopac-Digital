-- Ecopac Digital - Restringe donacion_detalle.UPDATE a la columna lote_id (issue #840, migracion 00135)
--
-- 00135 agrego `GRANT UPDATE (lote_id) ON donacion_detalle TO authenticated;` con la intencion de
-- que la unica escritura posible sobre un renglon ya insertado fuera el enlace con su lote
-- (docs/PERMISOS.md: "el resto del renglon sigue sin poder corregirse; lo que esta mal se anula
-- con la donacion completa"). La politica RLS de UPDATE (00135) protege LA FILA -- via USING/WITH
-- CHECK -- pero no protege QUE COLUMNAS se escriben en esa fila: eso solo lo hace un GRANT de
-- columna, y para que restrinja algo tiene que ser el UNICO camino de UPDATE sobre la tabla.
--
-- donacion_detalle se creo en la 00022, antes de que la 00120 empezara a revocar privilegios por
-- defecto para tablas nuevas (issue #706). El default de este proyecto -heredado del bootstrap de
-- Supabase, documentado en la cabecera de la 00120- le concede a authenticated SELECT/INSERT/
-- UPDATE sobre toda tabla nueva que crea postgres, y ninguna migracion lo habia revocado para
-- donacion_detalle: la 00135 agrego el GRANT de columna ENCIMA de un UPDATE ya abierto a la tabla
-- completa, asi que la restriccion nunca se aplico. Cualquier fila que pasara la politica de
-- UPDATE (lote_id IS NULL, es_administrador() O tiene_permiso('donaciones.registrar')) podia
-- reescribir tambien cantidad, monto, descripcion o medicamento_id en la misma sentencia --
-- exactamente lo que el comentario de la 00135 decia que no se podia hacer.
--
-- El REVOKE de la tabla completa no le quita nada a nadie que deberia tenerlo: la unica escritura
-- legitima de donacion_detalle fuera del INSERT es enlazarLoteConDonacion()
-- (packages/shared/donaciones/ingreso.api.js), que solo toca lote_id. Confirmado revisando
-- packages/shared completo: ningun otro llamador hace .update() sobre esta tabla.
REVOKE UPDATE ON donacion_detalle FROM authenticated;

-- Re-otorgar explicito y no solo "ya estaba": REVOKE UPDATE sin columnas retira TAMBIEN el GRANT
-- de columna que dejo la 00135 (revocar la tabla completa incluye sus privilegios de columna), asi
-- que sin esta linea el enlace de lote quedaria sin ningun UPDATE posible.
GRANT UPDATE (lote_id) ON donacion_detalle TO authenticated;
