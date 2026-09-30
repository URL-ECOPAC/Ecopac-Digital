-- Pruebas de las migraciones 00158, 00159 y 00160. Corre con: supabase test db
--
-- 00158. Las categorias de gasto son un catalogo: la que no existe se rechaza, la que se crea se
--        usa, y el personal de campo no las crea.
-- 00159. Un gasto no deja lo comprometido (pendiente + aprobado) por encima del presupuesto de su
--        jornada; su fecha llega hasta el dia de la jornada; un aporte no se quita por debajo de
--        lo comprometido.
-- 00160. El sobrante de una jornada finalizada se reparte por aporte (primero se usan donaciones y
--        aportes externos, al final fondos propios) y se devuelve o se traspasa a otra jornada del
--        mismo proyecto, sin contar dos veces el dinero de una donacion.
--
-- Ningun dato real: donantes, personas y jornadas son inventados.

BEGIN;

SELECT plan(29);

-- ============================================================================
-- Setup (como dueno, exento de RLS)
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000015800', 101, 'Comunidad de prueba 158');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000015801', 'admin158@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000015802', 'medico158@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000015801';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000015802';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000015801', 'Proyecto P 158'),
  ('50000000-0000-0000-0000-000000015802', 'Proyecto Q 158');

-- A y B son del proyecto P; D, del proyecto Q.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000015801', 'Jornada A 158', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000015800', '00000000-0000-0000-0000-000000015801',
   '50000000-0000-0000-0000-000000015801'),
  ('40000000-0000-0000-0000-000000015802', 'Jornada B 158', CURRENT_DATE + 11,
   '10000000-0000-0000-0000-000000015800', '00000000-0000-0000-0000-000000015801',
   '50000000-0000-0000-0000-000000015801'),
  ('40000000-0000-0000-0000-000000015804', 'Jornada D 158', CURRENT_DATE + 12,
   '10000000-0000-0000-0000-000000015800', '00000000-0000-0000-0000-000000015801',
   '50000000-0000-0000-0000-000000015802');

-- Una donacion de dinero de Q1000.
INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000015801', 'Donante de prueba 158', 'organizacion');
INSERT INTO donaciones (id, donante_id, tipo) VALUES
  ('d0000000-0000-0000-0000-000000015811', 'd0000000-0000-0000-0000-000000015801', 'dinero');
INSERT INTO donacion_detalle (donacion_id, descripcion, monto) VALUES
  ('d0000000-0000-0000-0000-000000015811', 'Aporte 158', 1000);

-- ============================================================================
-- 00158: catalogo de categorias
-- ============================================================================
SELECT is(
  has_table_privilege('anon', 'public.categorias_de_gasto', 'SELECT'), false,
  'anon no tiene ningun privilegio sobre categorias_de_gasto'
);

SELECT is(
  (SELECT count(*)::INT FROM categorias_de_gasto
    WHERE nombre IN ('Medicamentos', 'Logistica', 'Diagnostico', 'Honorarios', 'Educacion',
                     'Infraestructura')),
  6,
  'el catalogo trae las seis categorias del enum que reemplaza'
);

SELECT hasnt_type('public', 'categoria_gasto', 'el enum categoria_gasto ya no existe');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015801';

-- A: Q300 de la donacion y Q400 de fondos propios. B: Q100 de fondos propios.
INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, donacion_id, monto) VALUES
  ('70000000-0000-0000-0000-000000015801', '40000000-0000-0000-0000-000000015801', 'donacion',
   'd0000000-0000-0000-0000-000000015811', 300);
INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, monto) VALUES
  ('70000000-0000-0000-0000-000000015802', '40000000-0000-0000-0000-000000015801',
   'fondos_propios', 400),
  ('70000000-0000-0000-0000-000000015803', '40000000-0000-0000-0000-000000015802',
   'fondos_propios', 100);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015801', 'Bus', 'Transporte', 150,
             '00000000-0000-0000-0000-000000015801') $$,
  '23503', NULL,
  'un gasto con una categoria que no esta en el catalogo se rechaza'
);

SELECT lives_ok(
  $$ INSERT INTO categorias_de_gasto (nombre) VALUES ('Transporte') $$,
  'la administradora crea una categoria'
);

SELECT throws_ok(
  $$ INSERT INTO categorias_de_gasto (nombre) VALUES ('TRANSPORTE') $$,
  '23505', NULL,
  'la misma categoria no se repite con otras mayusculas'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015801', 'Bus', 'Transporte', 150,
             '00000000-0000-0000-0000-000000015801') $$,
  'y un gasto la usa en cuanto existe'
);

-- ============================================================================
-- 00159: el gasto dentro del presupuesto, su fecha, y los aportes comprometidos
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015801', 'Equipo', 'Logistica', 600,
             '00000000-0000-0000-0000-000000015801') $$,
  '23514', NULL,
  'un gasto que deja la jornada por encima de su presupuesto se rechaza (150 + 600 > 700)'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015801', 'Agua', 'Logistica', 50,
             '00000000-0000-0000-0000-000000015801') $$,
  'uno que cabe en lo que queda se registra'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, fecha, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015802', 'Reserva', 'Logistica', 1, CURRENT_DATE + 11,
             '00000000-0000-0000-0000-000000015801') $$,
  'un gasto puede tener la fecha de su jornada aunque sea futura'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, fecha, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015802', 'Reserva', 'Logistica', 1, CURRENT_DATE + 12,
             '00000000-0000-0000-0000-000000015801') $$,
  '23514', NULL,
  'pero no una posterior a su jornada'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, fecha, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015802', 'Compra previa', 'Logistica', 1,
             CURRENT_DATE - 60, '00000000-0000-0000-0000-000000015801') $$,
  'un gasto de preparacion puede ser de antes de la jornada'
);

SELECT throws_ok(
  $$ DELETE FROM jornada_presupuesto_origen WHERE id = '70000000-0000-0000-0000-000000015803' $$,
  '23514', NULL,
  'un aporte no se quita si la jornada queda con menos que lo comprometido'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015802';

SELECT throws_ok(
  $$ INSERT INTO categorias_de_gasto (nombre) VALUES ('Refacciones') $$,
  '42501', NULL,
  'el personal de campo no crea categorias'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015801';

-- ============================================================================
-- 00160: sobrante
-- ============================================================================
-- A tiene Q700 y Q200 comprometidos: salen primero de la donacion.
SELECT results_eq(
  $$ SELECT origen::TEXT, usado, sobrante
     FROM sobrante_de_jornada('40000000-0000-0000-0000-000000015801') $$,
  $$ VALUES ('donacion', 200.00::NUMERIC, 100.00::NUMERIC),
            ('fondos_propios', 0.00::NUMERIC, 400.00::NUMERIC) $$,
  'lo comprometido se descuenta primero de la donacion y al final de los fondos propios'
);

SELECT throws_ok(
  $$ SELECT fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000015801',
       '[{"origen_id": "70000000-0000-0000-0000-000000015802", "destino": "devolver"}]') $$,
  '23514', NULL,
  'el sobrante no se liquida mientras la jornada no esta finalizada'
);

RESET ROLE;
UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000015801';

-- Un gasto pendiente (sin la autoaprobacion de la administradora), registrado antes del cierre.
ALTER TABLE gastos DISABLE TRIGGER tr_autoaprobar_gasto_administrador;
INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por, estado) VALUES
  ('60000000-0000-0000-0000-000000015801', '40000000-0000-0000-0000-000000015801', 'Factura tardia',
   'Logistica', 10, '00000000-0000-0000-0000-000000015802', 'pendiente');
ALTER TABLE gastos ENABLE TRIGGER tr_autoaprobar_gasto_administrador;

UPDATE jornadas SET estado = 'finalizada' WHERE id = '40000000-0000-0000-0000-000000015801';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015801';

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000015801', 'Otro', 'Logistica', 1,
             '00000000-0000-0000-0000-000000015801') $$,
  '23514', NULL,
  'una jornada finalizada no admite gastos nuevos, ni de la administradora'
);

SELECT throws_ok(
  $$ SELECT fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000015801',
       '[{"origen_id": "70000000-0000-0000-0000-000000015802", "destino": "devolver"}]') $$,
  '23514', NULL,
  'ni mientras tiene gastos pendientes de aprobar'
);

RESET ROLE;
UPDATE gastos SET estado = 'rechazado', motivo_rechazo = 'Prueba'
 WHERE id = '60000000-0000-0000-0000-000000015801';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015801';

SELECT throws_ok(
  $$ SELECT fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000015801',
       '[{"origen_id": "70000000-0000-0000-0000-000000015801", "destino": "traspasar",
          "jornada_destino_id": "40000000-0000-0000-0000-000000015804"}]') $$,
  '23514', NULL,
  'el sobrante no se traspasa a una jornada de otro proyecto'
);

SELECT is(
  fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000015801',
    '[{"origen_id": "70000000-0000-0000-0000-000000015801", "destino": "traspasar",
       "jornada_destino_id": "40000000-0000-0000-0000-000000015802"},
      {"origen_id": "70000000-0000-0000-0000-000000015802", "destino": "devolver"}]'),
  2,
  'se traspasa el sobrante de la donacion a B y se devuelve el de los fondos propios'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000015801'),
  200.00::NUMERIC,
  'A se queda con lo que gasto'
);

SELECT is(
  (SELECT count(*)::INT FROM jornada_presupuesto_origen
    WHERE jornada_id = '40000000-0000-0000-0000-000000015802'
      AND traspasado_desde = '70000000-0000-0000-0000-000000015801'
      AND origen = 'donacion'
      AND donacion_id = 'd0000000-0000-0000-0000-000000015811'
      AND monto = 100),
  1,
  'B recibe un aporte de la misma donacion que dice de donde salio'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000015802'),
  200.00::NUMERIC,
  'y su presupuesto sube por ese monto'
);

-- La donacion tiene A (300 - 100) + B (100) = Q300 asignados: le quedan Q700, no Q600.
SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000015804', 'donacion',
             'd0000000-0000-0000-0000-000000015811', 700) $$,
  'el traspaso no cuenta dos veces el dinero de la donacion'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     VALUES ('40000000-0000-0000-0000-000000015804', 'donacion',
             'd0000000-0000-0000-0000-000000015811', 1) $$,
  '23514', NULL,
  'ni deja asignar de la donacion mas de lo que trae'
);

SELECT throws_ok(
  $$ UPDATE jornada_presupuesto_origen SET devuelto = 0
     WHERE id = '70000000-0000-0000-0000-000000015802' $$,
  '23514', NULL,
  'lo devuelto no se escribe a mano'
);

SELECT throws_ok(
  $$ DELETE FROM jornada_presupuesto_origen WHERE id = '70000000-0000-0000-0000-000000015802' $$,
  '23514', NULL,
  'un aporte liquidado no se quita'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015802';

SELECT throws_ok(
  $$ SELECT fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000015801',
       '[{"origen_id": "70000000-0000-0000-0000-000000015802", "destino": "devolver"}]') $$,
  '42501', NULL,
  'el personal de campo no liquida el sobrante'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015801';

SELECT is(
  (SELECT sum(sobrante) FROM sobrante_de_jornada('40000000-0000-0000-0000-000000015801')),
  0.00::NUMERIC,
  'despues de liquidar, a la jornada no le sobra nada'
);

SELECT * FROM finish();
ROLLBACK;
