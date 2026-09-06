-- Ecopac Digital - Catalogo de diagnosticos: retirar sin borrar (issue #639)
--
-- QUE FALTABA
--
-- El criterio de aceptacion "un diagnostico ya usado en una consulta no se borra: se marca como
-- no vigente y deja de ofrecerse en el selector, sin romper las consultas que lo citan" no tenia
-- donde aterrizar: diagnosticos (00018) no tiene ninguna columna de estado, y de todas formas
-- borrar uno ya usado ya fallaria por el ON DELETE RESTRICT de consulta_diagnostico (00018). Lo
-- que faltaba era la forma de retirarlo del selector sin tocar su historia clinica.
--
-- LA COLUMNA
--
-- Mismo nombre y mismo patron que medicamentos.activo (00050) y donantes.activo (00022): boolean
-- NOT NULL DEFAULT TRUE, para que los 34 diagnosticos sembrados por la 00105 y cualquiera
-- agregado desde entonces queden vigentes sin migrar datos aparte.
--
-- RLS Y GRANT: no cambian. Las politicas de INSERT/UPDATE de la 00105 ya son
-- es_administrador() sin distinguir columna, asi que alternar `activo` ya es un UPDATE permitido
-- para la administradora; no hace falta una politica nueva.

ALTER TABLE diagnosticos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN diagnosticos.activo IS
  'FALSE retira el diagnostico del selector de la consulta medica (issue #639) sin borrarlo: '
  'consulta_diagnostico lo referencia ON DELETE RESTRICT (00018) y las consultas que ya lo '
  'citan no cambian. Mismo patron que medicamentos.activo (00050).';
