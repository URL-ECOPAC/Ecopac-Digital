-- Ecopac Digital - Generar codigo de jornada por secuencia (issue #756)
--
-- jornadas.codigo se agrego nullable + UNIQUE en la 00036, con un comentario que dejaba la
-- puerta abierta a proposito: "una migracion futura, cuando la app ya genere el codigo al crear
-- una jornada, puede hacer el backfill y endurecerla a NOT NULL". Meses despues seguia en NULL
-- en las dos jornadas de ecopac-dev: CAMPOS_JORNADA (issue #179) lo declaraba como campo de
-- formulario pero CAMPOS_FORMULARIO_JORNADA -el subconjunto que de verdad se renderiza- lo
-- excluia a mano, y no habia ningun DEFAULT ni trigger que lo generara solo. Se veia en
-- DetalleJornadaPage.jsx (que ya pinta jornada.codigo, con un "-" cuando es NULL) pero nunca se
-- podia capturar ni corregir. La auditoria campo-a-vista de la issue #756 encontro exactamente
-- este hueco, ya anticipado por el propio comentario de la 00036.
--
-- Mismo mecanismo que numero_ficha (00081, issue #114): una secuencia de Postgres, no un valor
-- que quien registra escribe a mano, para que dos dispositivos creando una jornada al mismo
-- tiempo nunca puedan chocar -- nextval() lo resuelve el motor, sin candado.
--
-- Formato "JOR-" + 6 digitos con ceros a la izquierda (JOR-000001, JOR-000002, ...): con
-- prefijo, a diferencia de numero_ficha, porque un codigo de jornada puede terminar impreso en
-- un reporte o citado en un mensaje fuera de la pantalla que lo muestra junto al resto de datos
-- del paciente, y ahi conviene que se identifique solo (mismo criterio que folio de receta,
-- "REC-" + 00066).
--
-- Backfill antes del DEFAULT: la 00036 dejo la columna nullable justamente para esto. Sin
-- backfill, las jornadas creadas antes de esta migracion se quedarian en NULL para siempre
-- aunque la columna pasara a NOT NULL (una restriccion NOT NULL no reescribe filas existentes).
-- El orden de las filas dentro del UPDATE no esta garantizado (no hay ORDER BY posible en un
-- UPDATE), asi que el codigo asignado a jornadas preexistentes no seguira necesariamente su
-- orden cronologico real; no importa para el proposito del codigo (identificar, no ordenar).

CREATE SEQUENCE jornadas_codigo_seq
  AS BIGINT
  START WITH 1
  MINVALUE 1
  INCREMENT BY 1
  OWNED BY jornadas.codigo;

UPDATE jornadas
SET codigo = 'JOR-' || LPAD(nextval('jornadas_codigo_seq')::text, 6, '0')
WHERE codigo IS NULL;

ALTER TABLE jornadas
  ALTER COLUMN codigo SET DEFAULT 'JOR-' || LPAD(nextval('jornadas_codigo_seq')::text, 6, '0'),
  ALTER COLUMN codigo SET NOT NULL;

COMMENT ON COLUMN jornadas.codigo IS
  'Identificador legible generado por el servidor (issue #756), nunca por quien registra: el '
  'DEFAULT toma el siguiente valor de jornadas_codigo_seq, formateado "JOR-" + 6 digitos con '
  'ceros a la izquierda. No es un campo de formulario: packages/shared/jornadas/campos.js ya no '
  'lo declara en CAMPOS_JORNADA (antes lo hacia, pero CAMPOS_FORMULARIO_JORNADA -issue #179- lo '
  'excluia del formulario real de todos modos).';
