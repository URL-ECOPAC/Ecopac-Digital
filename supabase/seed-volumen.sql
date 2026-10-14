-- Ecopac Digital - Datos sinteticos de volumen para medir el plan de ejecucion de la busqueda
-- de pacientes (issue #115, criterio 5). Cierra ademas la definicion de terminado de la
-- migracion 00011 (issue #70), que pedia demostrar la busqueda "sobre 5000 pacientes de
-- prueba" y nunca dejo esa semilla.
--
-- TODO INVENTADO. Ningun nombre, apellido, telefono ni numero de ficha de este archivo
-- corresponde a una persona real (regla de confidencialidad de AGENTS.md): los nombres son
-- combinaciones deterministas de silabas y un catalogo de nombres/apellidos comunes en
-- Guatemala (incluidos con tilde, con ñ y de origen maya) elegido para poder medir el criterio 1
-- (busqueda sin acentos y con errores de tipeo) sobre volumen real, no solo sobre los seis
-- pacientes de seed-demo.sql.
--
-- NUNCA ejecutar este archivo contra Ecopac-Digital-Prod. No esta en supabase/config.toml
-- ([db.seed] sql_paths = ["seed.sql", "seed-demo.sql"]), asi que "supabase db reset" NO lo
-- aplica solo: hay que correrlo a mano con
--   supabase db execute -f supabase/seed-volumen.sql --local
-- o
--   psql "$DATABASE_URL" -f supabase/seed-volumen.sql
-- despues de "supabase db reset" (que ya sembro seed.sql, con municipio_id=101 = "Guatemala,
-- Guatemala", el municipio que usa este archivo).
--
-- IDEMPOTENTE A PROPOSITO: los ids de pacientes y comunidades son deterministas (derivados del
-- indice de la fila, no de gen_random_uuid()) y numero_ficha sigue un patron fijo por indice, no
-- row_number() sobre lo que ya exista en la tabla -esa era la falla de la version anterior de
-- este archivo: en la segunda corrida, row_number() volvia a arrancar en 1 sobre un conjunto que
-- ya tenia esas fichas, y chocaba con el UNIQUE de expedientes-. Correrlo dos veces no duplica
-- ni falla: todo INSERT usa ON CONFLICT DO NOTHING contra una llave deterministica.

BEGIN;

-- ============================================================================
-- 1. Comunidad sintetica sobre la que se siembra
-- ============================================================================
-- municipio_id 101 = Guatemala, Guatemala (verificado en supabase/seed.sql:30, que ya corrio
-- por [db.seed] antes que este archivo).
INSERT INTO comunidades (id, municipio_id, nombre)
VALUES ('cc0e0000-0000-0000-0000-000000000001', 101, 'Comunidad Volumen Sintetica #115')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Catalogo curado: acentos, enie y apellidos de origen maya
-- ============================================================================
-- Sin este bloque, el criterio 1 (acentos y errores de tipeo) no se puede medir sobre volumen:
-- una generacion puramente combinatoria de silabas no produce ni un solo caracter acentuado. Los
-- primeros 60 pacientes sembrados salen de este catalogo curado; el resto (hasta 5000) sale del
-- generador combinatorio de la seccion 3. idioma usa los valores del enum idioma_preferido
-- (00001: espanol, quiche, mam, otros).
CREATE TEMP TABLE tmp_catalogo_nombres (
  nombres VARCHAR(100),
  apellidos VARCHAR(100),
  idioma idioma_preferido
) ON COMMIT DROP;

INSERT INTO tmp_catalogo_nombres (nombres, apellidos, idioma) VALUES
  ('María', 'Xiloj Tzul', 'quiche'),
  ('José', 'Cotzajay Batz', 'quiche'),
  ('María José', 'Ixcoy Sicaja', 'quiche'),
  ('Andrés', 'Cux Chub', 'mam'),
  ('Jesús', 'Ajpop Coy', 'quiche'),
  ('Ramón', 'Muñoz Peña', 'espanol'),
  ('Concepción', 'Núñez Ordóñez', 'espanol'),
  ('María Concepción', 'Tzul Xiloj', 'quiche'),
  ('José Andrés', 'Batz Cotzajay', 'quiche'),
  ('Ángela', 'Peña Muñoz', 'espanol'),
  ('María Ángela', 'Sicaja Ixcoy', 'quiche'),
  ('Jesús María', 'Chub Cux', 'mam'),
  ('José María', 'Coy Ajpop', 'quiche'),
  ('María Guadalupe', 'Ordóñez Núñez', 'espanol'),
  ('Iñaki', 'Muñoz Xiloj', 'espanol'),
  ('María Fernanda', 'Cotzajay Ixcoy', 'quiche'),
  ('José Ramón', 'Sicaja Batz', 'quiche'),
  ('Andrés Felipe', 'Cux Coy', 'mam'),
  ('María Belén', 'Tzul Chub', 'quiche'),
  ('Jesús Alberto', 'Ajpop Xiloj', 'quiche'),
  ('María Soledad', 'Peña Cotzajay', 'espanol'),
  ('Ramón Antonio', 'Núñez Sicaja', 'espanol'),
  ('Concepción María', 'Muñoz Ixcoy', 'espanol'),
  ('José Ángel', 'Batz Cux', 'quiche'),
  ('María Elena', 'Coy Tzul', 'quiche'),
  ('Andrés Ignacio', 'Chub Ajpop', 'mam'),
  ('Jesús Manuel', 'Xiloj Ordóñez', 'quiche'),
  ('María Milagros', 'Cotzajay Núñez', 'quiche'),
  ('José Luís', 'Ixcoy Muñoz', 'quiche'),
  ('Ángel', 'Sicaja Peña', 'espanol'),
  ('María Asunción', 'Cux Batz', 'quiche'),
  ('Ramón Iñigo', 'Coy Chub', 'espanol'),
  ('Jesús Ángeles', 'Tzul Ajpop', 'quiche'),
  ('María Nieves', 'Ajpop Xiloj', 'quiche'),
  ('José Rubén', 'Muñoz Cotzajay', 'espanol'),
  ('Andrés Iván', 'Peña Ixcoy', 'espanol'),
  ('María Íngrid', 'Batz Sicaja', 'quiche'),
  ('Concepción Andrea', 'Núñez Cux', 'espanol'),
  ('Jesús Ramón', 'Coy Tzul', 'quiche'),
  ('María Cristina', 'Chub Ajpop', 'mam'),
  ('José Joaquín', 'Ordóñez Xiloj', 'espanol'),
  ('Ángela María', 'Cotzajay Batz', 'quiche'),
  ('Ramón José', 'Ixcoy Coy', 'quiche'),
  ('María Dolores', 'Sicaja Chub', 'quiche'),
  ('Andrés Joaquín', 'Cux Ajpop', 'mam'),
  ('Jesús Andrés', 'Xiloj Muñoz', 'quiche'),
  ('María Inés', 'Tzul Peña', 'quiche'),
  ('José Iñaki', 'Ajpop Núñez', 'espanol'),
  ('Concepción Ángeles', 'Batz Ordóñez', 'espanol'),
  ('Ramón Andrés', 'Coy Cotzajay', 'quiche'),
  ('María José Ángeles', 'Chub Ixcoy', 'mam'),
  ('Jesús Iñigo', 'Muñoz Sicaja', 'espanol'),
  ('Andrés Ramón', 'Peña Cux', 'espanol'),
  ('María Encarnación', 'Núñez Coy', 'espanol'),
  ('José Concepción', 'Ordóñez Tzul', 'quiche'),
  ('Ángel María', 'Cotzajay Ajpop', 'quiche'),
  ('Ramón Ángel', 'Ixcoy Xiloj', 'quiche'),
  ('María Purificación', 'Sicaja Muñoz', 'espanol'),
  ('Andrés Ángel', 'Cux Batz', 'mam'),
  ('Jesús Ángel', 'Xiloj Peña', 'quiche');
-- Sin ON CONFLICT: tmp_catalogo_nombres es una tabla temporal nueva en cada corrida (ON COMMIT
-- DROP), sin llave unica, asi que no hay conflicto posible que resolver aqui.

-- pacientes y expedientes se insertan en una sola sentencia con un CTE de escritura
-- encadenado (INSERT ... RETURNING alimentando el INSERT siguiente): asi numero_ficha se
-- deriva del mismo indice "n" que ya distingue cada fila, sin volver a parsearlo del UUID -eso
-- fue justamente el bug que este diseno reemplaza: substr() sobre el texto del UUID caia siempre
-- dentro del tramo de ceros del relleno de lpad(), asi que las 5000 filas terminaban con el
-- mismo numero_ficha-. Ademas, ON CONFLICT DO NOTHING en el INSERT de pacientes hace que
-- RETURNING no emita nada para una fila que ya existia, asi que en una segunda corrida el INSERT
-- de expedientes encadenado tampoco inserta nada: idempotente de punta a punta.
WITH pacientes_nuevos AS (
  INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
  SELECT
    ('cc0e0001-0000-0000-0000-' || lpad(to_hex(100000 + fila.n), 12, '0'))::UUID,
    fila.nombres,
    fila.apellidos,
    DATE '1935-01-01' + ((fila.n * 137) % 32000)::INT,
    CASE WHEN fila.n % 2 = 0 THEN 'Femenino' ELSE 'Masculino' END,
    'cc0e0000-0000-0000-0000-000000000001',
    '0900-' || lpad(fila.n::TEXT, 4, '0'),
    fila.idioma
  FROM (
    SELECT row_number() OVER () AS n, nombres, apellidos, idioma
    FROM tmp_catalogo_nombres
  ) fila
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO expedientes (paciente_id, numero_ficha)
SELECT id, 'SINT-C-' || (100000 + row_number() OVER (ORDER BY id))
FROM pacientes_nuevos
ON CONFLICT (numero_ficha) DO NOTHING;

-- ============================================================================
-- 3. Generador combinatorio: completa hasta 5000 pacientes en la misma comunidad
-- ============================================================================
-- Sin acentos ni enie a proposito (la seccion 2 ya cubrio esa medicion): esta seccion existe
-- solo para tener el volumen que el criterio 5 necesita para que el planificador deje de elegir
-- recorrido secuencial por tabla chica. Mismo patron de INSERT encadenado que la seccion 2, con
-- el rango de "i" (1..4940) desplazado +900000 para que su hexadecimal nunca coincida con el de
-- la seccion 2 (100001..100060): son dos rangos disjuntos, asi que id y numero_ficha no
-- colisionan entre ambas secciones.
WITH silabas AS (
  SELECT ARRAY['ma','ri','a','jo','se','lu','pe','za','co','tu','xi','na','be','ro','qui','tzu'] AS s
),
generados AS (
  SELECT
    i,
    initcap(
      (SELECT s[1 + (i * 3 + 1) % 16] || s[1 + (i * 7 + 2) % 16] || s[1 + (i * 11) % 16] FROM silabas)
    ) AS nombres,
    initcap(
      (SELECT s[1 + (i * 5) % 16] || s[1 + (i * 13 + 3) % 16] || s[1 + (i * 2 + 5) % 16] FROM silabas)
    ) AS apellidos
  FROM generate_series(1, 4940) AS i
),
pacientes_nuevos AS (
  INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
  SELECT
    ('cc0e0002-0000-0000-0000-' || lpad(to_hex(900000 + g.i), 12, '0'))::UUID,
    g.nombres,
    g.apellidos,
    DATE '1935-01-01' + ((g.i * 7) % 32000),
    CASE WHEN g.i % 2 = 0 THEN 'Femenino' ELSE 'Masculino' END,
    'cc0e0000-0000-0000-0000-000000000001',
    '0901-' || lpad(g.i::TEXT, 4, '0'),
    'espanol'::idioma_preferido
  FROM generados g
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO expedientes (paciente_id, numero_ficha)
SELECT id, 'SINT-G-' || (900000 + row_number() OVER (ORDER BY id))
FROM pacientes_nuevos
ON CONFLICT (numero_ficha) DO NOTHING;

COMMIT;

-- Sin esto el planificador trabaja con estadisticas viejas y el EXPLAIN de la seccion 7 del
-- PLAN.md no vale.
ANALYZE pacientes;
ANALYZE expedientes;

-- Comprobacion rapida: debe dar 5000 (60 del catalogo curado + 4940 del generador).
SELECT count(*) AS pacientes_sembrados
FROM pacientes
WHERE comunidad_id = 'cc0e0000-0000-0000-0000-000000000001';
