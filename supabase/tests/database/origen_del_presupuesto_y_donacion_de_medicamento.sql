-- Pruebas de la migracion 00135 (issue #840, bloques C y D).
-- Corre con: supabase test db
--
-- C. fn_registrar_donacion exige un medicamento del catalogo en cada renglon de una donacion de
--    medicamentos, y toma de ahi la descripcion y la unidad.
-- C. El renglon se enlaza una vez, con un lote de su mismo medicamento.
-- D. jornadas.presupuesto_asignado es la suma de jornada_presupuesto_origen, nadie lo escribe a
--    mano, y un origen de donacion no puede gastar mas de lo que se dono.
--
-- Ningun dato real: donantes, medicamentos y jornadas son inventados.

BEGIN;

SELECT plan(27);

-- ============================================================================
-- Setup (como dueno, exento de RLS)
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000840', 101, 'Comunidad de prueba 840');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000084001', 'admin840@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000084002', 'medico840@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000084003', 'junta840@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000084001';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000084002';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000084003';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('90000000-0000-0000-0000-000000000840', 'Medicamento 840', '500 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000084001', 'Donante de prueba 840', 'organizacion');

-- Una donacion de dinero de Q1000 en dos renglones, y una de insumos.
INSERT INTO donaciones (id, donante_id, tipo) VALUES
  ('d0000000-0000-0000-0000-000000084101', 'd0000000-0000-0000-0000-000000084001', 'dinero'),
  ('d0000000-0000-0000-0000-000000084102', 'd0000000-0000-0000-0000-000000084001', 'insumos');

INSERT INTO donacion_detalle (donacion_id, descripcion, monto) VALUES
  ('d0000000-0000-0000-0000-000000084101', 'Aporte 840 a', 600),
  ('d0000000-0000-0000-0000-000000084101', 'Aporte 840 b', 400);

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000084001', 'Jornada sin presupuesto 840', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000000840', '00000000-0000-0000-0000-000000084001');

-- Una jornada que se crea con el presupuesto ya puesto: el monto tiene que entrar como origen.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, presupuesto_asignado)
VALUES
  ('40000000-0000-0000-0000-000000084002', 'Jornada con presupuesto 840', CURRENT_DATE + 11,
   '10000000-0000-0000-0000-000000000840', '00000000-0000-0000-0000-000000084001', 750);

-- ============================================================================
-- D. Un INSERT con presupuesto deja su origen sin clasificar
-- ============================================================================
SELECT is(
  (SELECT count(*)::INT FROM jornada_presupuesto_origen
   WHERE jornada_id = '40000000-0000-0000-0000-000000084002' AND origen = 'sin_clasificar'),
  1,
  'una jornada creada con presupuesto tiene un origen sin clasificar por ese monto'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000084002'),
  750.00::NUMERIC,
  'el presupuesto de la jornada no cambia al registrar su origen inicial'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000084001';

-- ============================================================================
-- D. El asignado es la suma de los origenes
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto, descripcion)
     VALUES ('40000000-0000-0000-0000-000000084001', 'fondos_propios', 300, 'Fondos 840') $$,
  'administrador registra un origen de fondos propios'
);

SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000084001', 'donacion',
             'd0000000-0000-0000-0000-000000084101', 700) $$,
  'administrador asigna parte de una donacion de dinero'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000084001'),
  1000.00::NUMERIC,
  'presupuesto_asignado es la suma de los origenes'
);

SELECT is(
  (SELECT registrado_por FROM jornada_presupuesto_origen WHERE descripcion = 'Fondos 840'),
  '00000000-0000-0000-0000-000000084001'::UUID,
  'registrado_por sale de la sesion'
);

-- ============================================================================
-- D. Una donacion no se asigna dos veces
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000084002', 'donacion',
             'd0000000-0000-0000-0000-000000084101', 301) $$,
  '23514',
  NULL,
  'no se puede asignar mas de lo que queda de una donacion'
);

SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000084002', 'donacion',
             'd0000000-0000-0000-0000-000000084101', 300) $$,
  'se puede asignar exactamente lo que queda de una donacion'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000084001', 'donacion',
             'd0000000-0000-0000-0000-000000084102', 10) $$,
  '23514',
  NULL,
  'una donacion de insumos no puede ser origen de presupuesto'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto)
     VALUES ('40000000-0000-0000-0000-000000084001', 'donacion', 10) $$,
  '23514',
  NULL,
  'un origen de donacion sin donacion se rechaza'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto)
     VALUES ('40000000-0000-0000-0000-000000084001', 'fondos_propios', 0) $$,
  '23514',
  NULL,
  'un origen en cero se rechaza'
);

-- ============================================================================
-- D. Nadie escribe el total a mano
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE jornadas SET presupuesto_asignado = 99999
     WHERE id = '40000000-0000-0000-0000-000000084001' $$,
  '23514',
  NULL,
  'presupuesto_asignado no se escribe a mano'
);

SELECT lives_ok(
  $$ DELETE FROM jornada_presupuesto_origen WHERE descripcion = 'Fondos 840' $$,
  'administrador quita un origen'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000084001'),
  700.00::NUMERIC,
  'quitar un origen recalcula el total'
);

-- ============================================================================
-- D. RLS
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000084003';

-- ISSUE #864: la 00135 daba la lectura a los dos roles consultivos; la 00141 la deja en
-- es_administrador() mas tiene_permiso('jornadas.gestionar'). El desglose del presupuesto de una
-- jornada no es uno de los cuatro reportes que les quedan.
SELECT is(
  (SELECT count(*) FROM jornada_presupuesto_origen)::int, 0,
  'junta directiva ya no lee los origenes de presupuesto (issue #864)'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto)
     VALUES ('40000000-0000-0000-0000-000000084001', 'fondos_propios', 5) $$,
  '42501',
  NULL,
  'junta directiva no registra origenes de presupuesto'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000084002';

SELECT is(
  (SELECT count(*)::INT FROM jornada_presupuesto_origen),
  0,
  'un medico sin jornadas.gestionar no ve el desglose del presupuesto'
);

-- ============================================================================
-- C. La donacion de medicamentos elige del catalogo
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000084001';

SELECT throws_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000084001', 'medicamentos', CURRENT_DATE,
       '[{"descripcion": "Texto libre", "cantidad": 10, "unidad": "cajas"}]'::JSONB) $$,
  '23514',
  NULL,
  'una donacion de medicamentos sin medicamento del catalogo se rechaza'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000084001', 'medicamentos', CURRENT_DATE,
       '[{"medicamentoId": "90000000-0000-0000-0000-000000000840",
          "descripcion": "lo que sea", "cantidad": 25, "unidad": "cajas"}]'::JSONB) $$,
  'una donacion de medicamentos con medicamento del catalogo se registra'
);

SELECT is(
  (SELECT (descripcion, unidad, cantidad)::TEXT FROM donacion_detalle
   WHERE medicamento_id = '90000000-0000-0000-0000-000000000840'),
  '("Medicamento 840 500 mg",Tableta,25.00)',
  'la descripcion y la unidad salen del catalogo, no del texto del cliente'
);

SELECT throws_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000084001', 'insumos', CURRENT_DATE,
       '[{"medicamentoId": "90000000-0000-0000-0000-000000000840",
          "descripcion": "Guantes", "cantidad": 5}]'::JSONB) $$,
  '23514',
  NULL,
  'una donacion de insumos no lleva medicamento del catalogo'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000084001', 'insumos', CURRENT_DATE,
       '[{"descripcion": "Guantes 840", "cantidad": 5, "unidad": "cajas"}]'::JSONB) $$,
  'una donacion de insumos sigue aceptando texto libre'
);

-- ============================================================================
-- C. El lote que produjo un renglon se enlaza una vez, y es de su medicamento
-- ============================================================================
-- Antes de la correccion en esta migracion donacion_detalle no tenia GRANT ni politica de UPDATE:
-- enlazarLoteConDonacion() fallaba con permission denied y la donacion nunca quedaba ligada.
RESET ROLE;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('90000000-0000-0000-0000-000000000841', 'Otro medicamento 840', '5 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('b0000000-0000-0000-0000-000000084001', 'Proveedor de prueba 840', 'donante');

INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                   cantidad_ingresada) VALUES
  ('a0000000-0000-0000-0000-000000084001', '90000000-0000-0000-0000-000000000840', 'L-840-A',
   CURRENT_DATE + 365, 'b0000000-0000-0000-0000-000000084001', 'donacion', 25),
  ('a0000000-0000-0000-0000-000000084002', '90000000-0000-0000-0000-000000000841', 'L-840-B',
   CURRENT_DATE + 365, 'b0000000-0000-0000-0000-000000084001', 'donacion', 25);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000084001';

SELECT throws_ok(
  $$ UPDATE donacion_detalle SET lote_id = 'a0000000-0000-0000-0000-000000084002'
     WHERE medicamento_id = '90000000-0000-0000-0000-000000000840' $$,
  '23514',
  NULL,
  'un renglon no se enlaza a un lote de otro medicamento'
);

SELECT lives_ok(
  $$ UPDATE donacion_detalle SET lote_id = 'a0000000-0000-0000-0000-000000084001'
     WHERE medicamento_id = '90000000-0000-0000-0000-000000000840' $$,
  'quien registra donaciones enlaza el renglon con el lote de su medicamento'
);

SELECT is(
  (SELECT lote_id FROM donacion_detalle
   WHERE medicamento_id = '90000000-0000-0000-0000-000000000840'),
  'a0000000-0000-0000-0000-000000084001'::UUID,
  'el enlace queda guardado'
);

-- Ya enlazado, la politica no lo alcanza: el UPDATE no toca ninguna fila.
UPDATE donacion_detalle SET lote_id = NULL
WHERE medicamento_id = '90000000-0000-0000-0000-000000000840';

SELECT is(
  (SELECT lote_id FROM donacion_detalle
   WHERE medicamento_id = '90000000-0000-0000-0000-000000000840'),
  'a0000000-0000-0000-0000-000000084001'::UUID,
  'un renglon ya enlazado no se reenlaza ni se desenlaza'
);

SELECT throws_ok(
  $$ UPDATE donacion_detalle SET cantidad = 1
     WHERE medicamento_id = '90000000-0000-0000-0000-000000000840' $$,
  '42501',
  NULL,
  'el resto del renglon sigue sin poder corregirse'
);

SELECT * FROM finish();
ROLLBACK;
