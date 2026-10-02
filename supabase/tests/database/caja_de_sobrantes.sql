-- Pruebas de la 00167 y la 00168: el sobrante que no vuelve a una donacion entra a la caja, y la
-- caja es un origen del presupuesto de una jornada. Corre con: supabase test db
--
-- Los saldos se comparan contra el que habia al empezar: la base de pruebas puede traer datos.
--
-- Ningun dato real: donantes, personas y jornadas son inventados.

BEGIN;

SELECT plan(13);

-- Desde la 00169 toda jornada nueva lleva proyecto. Estas pruebas no tratan de proyectos: sus
-- jornadas reciben uno de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000000169', 'Proyecto de prueba 00169');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000000169';

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup (como dueno, exento de RLS)
-- ============================================================================
CREATE TEMP TABLE saldo_inicial AS SELECT fn_saldo_de_caja_sin_filtro() AS saldo;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000016800', 101, 'Comunidad de prueba 168');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016801', 'admin168@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000016802', 'junta168@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000016801';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000016802';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- X se cierra con sobrante; Y recibe dinero de la caja.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000016801', 'Jornada X 168', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000016800', '00000000-0000-0000-0000-000000016801'),
  ('40000000-0000-0000-0000-000000016802', 'Jornada Y 168', CURRENT_DATE + 11,
   '10000000-0000-0000-0000-000000016800', '00000000-0000-0000-0000-000000016801');

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000016801', 'Donante de prueba 168', 'organizacion');
INSERT INTO donaciones (id, donante_id, tipo) VALUES
  ('d0000000-0000-0000-0000-000000016811', 'd0000000-0000-0000-0000-000000016801', 'dinero');
INSERT INTO donacion_detalle (donacion_id, descripcion, monto) VALUES
  ('d0000000-0000-0000-0000-000000016811', 'Aporte 168', 1000);

-- X: Q500 de fondos propios y Q100 de la donacion. Sin gastos: sobra todo.
INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, monto) VALUES
  ('70000000-0000-0000-0000-000000016801', '40000000-0000-0000-0000-000000016801',
   'fondos_propios', 500);
INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, donacion_id, monto) VALUES
  ('70000000-0000-0000-0000-000000016802', '40000000-0000-0000-0000-000000016801', 'donacion',
   'd0000000-0000-0000-0000-000000016811', 100);

UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000016801';
UPDATE jornadas SET estado = 'finalizada' WHERE id = '40000000-0000-0000-0000-000000016801';

-- ============================================================================
-- La liquidacion manda a la caja lo que no es de una donacion
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016801';

SELECT is(
  fn_liquidar_sobrante_de_jornada('40000000-0000-0000-0000-000000016801',
    '[{"origen_id": "70000000-0000-0000-0000-000000016801", "destino": "devolver"},
      {"origen_id": "70000000-0000-0000-0000-000000016802", "destino": "devolver"}]'::JSONB),
  2,
  'la administradora devuelve el sobrante de los dos aportes'
);

SELECT results_eq(
  $$ SELECT tipo::TEXT, monto FROM movimientos_de_caja
      WHERE aporte_id = '70000000-0000-0000-0000-000000016801' $$,
  $$ VALUES ('entrada'::TEXT, 500.00::NUMERIC) $$,
  'el sobrante de fondos propios entra a la caja'
);

SELECT is(
  (SELECT count(*)::INT FROM movimientos_de_caja
    WHERE aporte_id = '70000000-0000-0000-0000-000000016802'),
  0,
  'el de la donacion no: vuelve a quedar libre en la donacion'
);

RESET ROLE;
SELECT is(
  fn_saldo_de_caja_sin_filtro() - (SELECT saldo FROM saldo_inicial),
  500.00::NUMERIC,
  'la caja tiene Q500 mas'
);

-- ============================================================================
-- La caja como origen de un aporte
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016801';

SELECT isnt(saldo_de_caja(), NULL::NUMERIC, 'la administradora lee el saldo de la caja');

SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, monto) VALUES
       ('70000000-0000-0000-0000-000000016803', '40000000-0000-0000-0000-000000016802',
        'caja', 200) $$,
  'un aporte de Q200 sale de la caja'
);

SELECT results_eq(
  $$ SELECT tipo::TEXT, monto, jornada_id FROM movimientos_de_caja
      WHERE aporte_id = '70000000-0000-0000-0000-000000016803' $$,
  $$ VALUES ('salida'::TEXT, 200.00::NUMERIC, '40000000-0000-0000-0000-000000016802'::UUID) $$,
  'y queda su salida en el libro de la caja'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000016802'),
  200.00::NUMERIC,
  'y cuenta en el presupuesto de la jornada'
);

RESET ROLE;
CREATE TEMP TABLE saldo_ahora AS SELECT fn_saldo_de_caja_sin_filtro() AS saldo;
GRANT SELECT ON saldo_ahora TO authenticated;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016801';

SELECT throws_ok(
  format(
    $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto)
       VALUES ('40000000-0000-0000-0000-000000016802', 'caja', %s) $$,
    (SELECT saldo + 1 FROM saldo_ahora)
  ),
  '23514', NULL,
  'no se saca de la caja mas de lo que tiene'
);

SELECT lives_ok(
  $$ DELETE FROM jornada_presupuesto_origen WHERE id = '70000000-0000-0000-0000-000000016803' $$,
  'quitar el aporte de la caja'
);

RESET ROLE;
SELECT is(
  fn_saldo_de_caja_sin_filtro() - (SELECT saldo FROM saldo_inicial),
  500.00::NUMERIC,
  'devuelve el dinero a la caja'
);

-- ============================================================================
-- Nadie la escribe a mano, y no la ve quien no ve los aportes
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016801';

SELECT throws_ok(
  $$ INSERT INTO movimientos_de_caja (tipo, monto, aporte_id, jornada_id)
     VALUES ('entrada', 1000, '70000000-0000-0000-0000-000000016801',
             '40000000-0000-0000-0000-000000016801') $$,
  '42501', NULL,
  'ni la administradora mete dinero a la caja a mano'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016802';

SELECT is(
  saldo_de_caja(),
  NULL::NUMERIC,
  'la junta directiva no ve el saldo de la caja'
);

SELECT * FROM finish();
ROLLBACK;
