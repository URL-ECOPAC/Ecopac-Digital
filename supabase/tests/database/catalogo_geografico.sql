-- Pruebas del catalogo geografico (issue #704, migracion 00125). Corre con: supabase test db
--
-- POR QUE ESTA SUITE SIGNIFICA ALGO
--
-- Hasta la 00125, los 22 departamentos y los 340 municipios los cargaba supabase/seed.sql, y
-- "supabase db push" -lo unico que corre contra ecopac-dev y ecopac-prod- nunca ejecuta seeds.
-- Desde este PR seed.sql no tiene ni una sentencia: la unica fuente del catalogo es la
-- migracion. Por eso comprobar aqui que las filas existen equivale a comprobar que llegan por
-- migracion, que es justo lo que un proyecto de Supabase recien creado necesita.
--
-- Si alguien vuelve a poner INSERT de departamentos o municipios en un seed, esta suite dejara
-- de probar lo que dice su nombre aunque siga en verde. La comprobacion dura es:
--
--   supabase db reset --no-seed
--   supabase test db supabase/tests/database/catalogo_geografico.sql
--
-- Se nombra el archivo y no el directorio entero porque otras tres suites SI dependen de
-- seed-demo.sql y lo declaran en su cabecera -tokens_auth_users.sql necesita las siete cuentas
-- demo, generar_alertas_caducidad.sql y desacoplar_gastos_de_inventario.sql sus fixtures-, asi
-- que sin semillas fallan por diseno. Esta no: se sostiene sola.
--
-- No cubre politicas ni GRANT: la lectura de estas dos tablas ya la cubre
-- politicas_rls_catalogos_y_seguimiento.sql, y la 00125 no las toca.

BEGIN;

SELECT plan(7);

-- ============================================================================
-- El catalogo esta completo
-- ============================================================================
SELECT is(
  (SELECT count(*) FROM departamentos),
  22::bigint,
  'los 22 departamentos de Guatemala llegan por la migracion 00125'
);

SELECT is(
  (SELECT count(*) FROM municipios),
  340::bigint,
  'los 340 municipios llegan por la migracion 00125'
);

-- ============================================================================
-- Y es coherente
-- ============================================================================
-- La FK fk_departamentos (00006) ya lo impone, pero un catalogo sembrado a mano es justo donde
-- un id mal escrito pasaria inadvertido si alguien la retirara.
SELECT is(
  (SELECT count(*) FROM municipios m LEFT JOIN departamentos d ON d.id = m.departamento_id
   WHERE d.id IS NULL),
  0::bigint,
  'ningun municipio cuelga de un departamento que no existe'
);

SELECT is(
  (SELECT count(DISTINCT departamento_id) FROM municipios),
  22::bigint,
  'los 22 departamentos tienen al menos un municipio'
);

-- ============================================================================
-- Los ids que otros archivos dan por ciertos
-- ============================================================================
-- Quince suites de este directorio insertan su comunidad de fixture sobre el municipio 101, y
-- supabase/seed-demo.sql cuelga las suyas de los municipios 106, 401 y 1601. Si la 00125
-- renumerara el catalogo, esos archivos reventarian con un error de llave foranea que no
-- mencionaria esta migracion.
SELECT is(
  (SELECT nombre FROM municipios WHERE id = 101),
  'Guatemala',
  'el municipio 101 sigue siendo el que usan los fixtures de este directorio'
);

SELECT is(
  (SELECT count(*) FROM municipios WHERE id IN (106, 401, 1601)),
  3::bigint,
  'los tres municipios de los que cuelgan las comunidades de seed-demo.sql existen'
);

-- ============================================================================
-- Volver a sembrar no duplica ni pisa
-- ============================================================================
-- Misma sentencia que la 00125: ON CONFLICT DO NOTHING sin objetivo, que cubre tanto la clave
-- primaria como las restricciones UNIQUE que agrego la 00008. Con "ON CONFLICT (id)" esta
-- prueba fallaria, que es exactamente la regresion que vigila.
INSERT INTO departamentos (id, nombre) VALUES (1, 'Guatemala'), (22, 'Jutiapa')
ON CONFLICT DO NOTHING;

INSERT INTO municipios (id, departamento_id, nombre) VALUES (101, 1, 'Guatemala')
ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT count(*) FROM departamentos) || '/' || (SELECT count(*) FROM municipios),
  '22/340',
  'reaplicar el catalogo es idempotente: no agrega filas ni lanza excepcion'
);

SELECT * FROM finish();

ROLLBACK;
