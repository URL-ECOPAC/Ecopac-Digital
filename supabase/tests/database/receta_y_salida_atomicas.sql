-- Pruebas de que emitir una receta y descontar su inventario ocurren juntas o no ocurren
-- (issue #711, migracion 00112).
-- Corre con: supabase test db
--
-- El caso que motiva la issue es el segundo renglon: la receta pide dos medicamentos, el primero
-- tiene existencia y el segundo no. Antes, fn_generar_receta emitia la receta (su comprobacion de
-- existencia si estaba, pero el descuento lo hacia despues el cliente, renglon por renglon) y la
-- salida que fallaba solo dejaba un aviso en pantalla. Ahora la funcion registra los movimientos
-- dentro de la misma transaccion, asi que un fallo no deja ni receta ni movimiento.
--
-- Estas pruebas NO comprueban RLS: el setup corre como el rol dueno de las tablas, que esta
-- exento de politicas. Lo que se comprueba es la atomicidad de la funcion, que es igual para
-- todos. Quien puede emitir y quien puede registrar movimientos ya se prueba en
-- politicas_rls_atenciones_consultas_recetas.sql y politicas_rls_inventario.sql.
--
-- SI hace falta fijar `request.jwt.claim.sub`, y no por RLS: fn_generar_receta pone
-- `registrado_por = auth.uid()` en el movimiento, y esa columna es NOT NULL (00023). Sin un sub
-- en la sesion, auth.uid() devuelve NULL y el INSERT falla por la restriccion, no por la logica
-- que se quiere probar. Mismo patron que politicas_rls_inventario.sql.
--
-- Ningun dato real: la comunidad, el paciente, los medicamentos y los lotes son inventados.

BEGIN;

SELECT plan(9);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000711', 101, 'Comunidad de prueba 711');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000711', 'medico711@test.ecopac.local');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000000711',
  'Paciente', 'Prueba711', '1990-01-01', 'F',
  '10000000-0000-0000-0000-000000000711', '5555-0711', 'espanol'
);

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES (
  '40000000-0000-0000-0000-000000000711',
  '20000000-0000-0000-0000-000000000711',
  'F-0711'
);

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('30000000-0000-0000-0000-000000000711', 'Jornada 711',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000711');

UPDATE jornadas SET estado = 'en curso'
WHERE id = '30000000-0000-0000-0000-000000000711';

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000711',
   '20000000-0000-0000-0000-000000000711',
   '30000000-0000-0000-0000-000000000711');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
VALUES (
  '60000000-0000-0000-0000-000000000711',
  '40000000-0000-0000-0000-000000000711',
  '50000000-0000-0000-0000-000000000711',
  '00000000-0000-0000-0000-000000000711',
  '30000000-0000-0000-0000-000000000711',
  'motivo de prueba 711'
);

INSERT INTO bodegas (id, nombre) VALUES
  ('70000000-0000-0000-0000-000000000711', 'Bodega de prueba 711');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('80000000-0000-0000-0000-000000000711', 'Proveedor de prueba 711', 'comercial');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('90000000-0000-0000-0000-000000000711', 'Medicamento A 711', '500mg', 'tableta', 'Generico'),
  ('90000000-0000-0000-0000-000000000712', 'Medicamento B 711', '250mg', 'tableta', 'Generico');

-- Lote A con existencia de sobra; lote B con existencia deliberadamente corta.
INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada)
VALUES
  ('a0000000-0000-0000-0000-000000000711', '90000000-0000-0000-0000-000000000711',
   'LOTE-A-711', CURRENT_DATE + 365, '80000000-0000-0000-0000-000000000711', 'compra', 100),
  ('a0000000-0000-0000-0000-000000000712', '90000000-0000-0000-0000-000000000712',
   'LOTE-B-711', CURRENT_DATE + 365, '80000000-0000-0000-0000-000000000711', 'compra', 100);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a0000000-0000-0000-0000-000000000711', '70000000-0000-0000-0000-000000000711', 50),
  ('a0000000-0000-0000-0000-000000000712', '70000000-0000-0000-0000-000000000711', 2);

-- Quien emite. fn_generar_receta fija `registrado_por = auth.uid()` en el movimiento y esa
-- columna es NOT NULL: sin sub en la sesion, el INSERT falla por la restriccion y no por lo que
-- se quiere probar. El perfil lo crea el trigger crear_perfil_nuevo_usuario (00002) al insertar
-- en auth.users, con el rol por defecto 'voluntario general': es a proposito, asi el movimiento
-- nace 'pendiente' y no se autoaprueba (00028), que es el caso comun en jornada.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000711';

-- ============================================================================
-- 1. El caso de la issue: el segundo renglon no tiene existencia
-- ============================================================================
SELECT throws_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000000711',
       '00000000-0000-0000-0000-000000000711',
       'indicaciones de prueba',
       '[{"medicamento_id": "90000000-0000-0000-0000-000000000711",
          "lote_id": "a0000000-0000-0000-0000-000000000711",
          "bodega_id": "70000000-0000-0000-0000-000000000711",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 10},
         {"medicamento_id": "90000000-0000-0000-0000-000000000712",
          "lote_id": "a0000000-0000-0000-0000-000000000712",
          "bodega_id": "70000000-0000-0000-0000-000000000711",
          "dosis": "1 tableta", "frecuencia": "cada 12h", "duracion": "5 dias",
          "cantidad_entregada": 10}]'::jsonb
     ) $$,
  'Existencia insuficiente en el lote a0000000-0000-0000-0000-000000000712. Disponible: 2, solicitado: 10.',
  'un renglon sin existencia detiene la receta entera'
);

SELECT is(
  (SELECT COUNT(*)::int FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000711'),
  0,
  'no queda receta emitida cuando el segundo renglon falla'
);

SELECT is(
  (SELECT COUNT(*)::int FROM movimientos_inventario
   WHERE lote_id IN ('a0000000-0000-0000-0000-000000000711',
                     'a0000000-0000-0000-0000-000000000712')),
  0,
  'no queda ningun movimiento: tampoco el del primer renglon, que si alcanzaba'
);

SELECT is(
  (SELECT cantidad_disponible FROM existencias
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000711'
     AND bodega_id = '70000000-0000-0000-0000-000000000711'),
  50,
  'la existencia del lote que si alcanzaba queda intacta'
);

-- ============================================================================
-- 2. Un renglon con lote pero sin bodega ya no pasa en silencio
-- ============================================================================
-- Sin bodega no hay fila de existencias que ajustar: antes esto era una salida que nadie
-- registraba, ahora es un error explicito.
SELECT throws_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000000711',
       '00000000-0000-0000-0000-000000000711',
       NULL,
       '[{"medicamento_id": "90000000-0000-0000-0000-000000000711",
          "lote_id": "a0000000-0000-0000-0000-000000000711",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$,
  'El renglon del lote a0000000-0000-0000-0000-000000000711 no indica de que bodega sale. Sin bodega no se puede descontar.',
  'un renglon con lote y sin bodega se rechaza'
);

-- ============================================================================
-- 3. El camino feliz: receta y movimiento quedan los dos
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000000711',
       '00000000-0000-0000-0000-000000000711',
       'indicaciones de prueba',
       '[{"medicamento_id": "90000000-0000-0000-0000-000000000711",
          "lote_id": "a0000000-0000-0000-0000-000000000711",
          "bodega_id": "70000000-0000-0000-0000-000000000711",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 10},
         {"medicamento_id": "90000000-0000-0000-0000-000000000711",
          "lote_id": "a0000000-0000-0000-0000-000000000711",
          "bodega_id": "70000000-0000-0000-0000-000000000711",
          "dosis": "1 tableta", "frecuencia": "cada 24h", "duracion": "3 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$,
  'una receta cuyos renglones alcanzan se emite sin error'
);

SELECT is(
  (SELECT COUNT(*)::int FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000711'),
  1,
  'la receta queda emitida'
);

-- Dos renglones del mismo lote dan UN movimiento por (lote, bodega), no dos: el kardex tiene que
-- leerse como una entrega.
SELECT is(
  (SELECT COUNT(*)::int FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000711'),
  1,
  'dos renglones del mismo lote dan una sola salida'
);

SELECT is(
  (SELECT cantidad FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000711'),
  15,
  'la salida suma las cantidades de los dos renglones del mismo lote'
);

SELECT * FROM finish();
ROLLBACK;
