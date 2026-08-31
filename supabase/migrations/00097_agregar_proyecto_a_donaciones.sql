-- Ecopac Digital - Agregar donaciones.proyecto_id (issue #193, RF-28)
--
-- listarDonaciones() necesita filtrar por proyecto (criterio de aceptacion de la #193), y
-- donaciones nunca tuvo esa relacion: 00022_donantes_donaciones.sql no la incluyo. El modulo ya
-- habia documentado esa ausencia en el codigo mergeado -- campos.js y columnas.js explican por
-- que no hay columna de monto/total (vive en donacion_detalle), y filtros.js (issue #287) dejo
-- FILTROS_DONACION sin ningun filtro de proyecto. Se agrega ahora la columna real.
--
-- Nullable: una donacion no siempre financia un proyecto puntual (por ejemplo, medicamentos que
-- entran directo a bodega). ON DELETE RESTRICT, mismo criterio que donaciones.donante_id en la
-- misma tabla: nada se borra fisicamente mientras tenga donaciones asociadas.
--
-- No hace falta tocar RLS ni GRANT: las politicas de donaciones (00083) no son por columna y ya
-- cubren SELECT/INSERT/UPDATE para administrador y los roles consultivos.

ALTER TABLE donaciones ADD COLUMN proyecto_id UUID REFERENCES proyectos(id) ON DELETE RESTRICT;

CREATE INDEX idx_donaciones_proyecto_id ON donaciones (proyecto_id);
