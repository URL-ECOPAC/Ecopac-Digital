-- Pruebas de las tres reglas de dominio de la issue #625. Corre con: supabase test db
--
--   1. El catalogo de diagnosticos lo mantiene la administradora (00105).
--   2. Un movimiento pendiente es de quien lo registro; aprobado, de ella (00106).
--   3. Un medico o un voluntario dan de alta lotes, provisionales hasta que ella
--      aprueba el ingreso (00107).
--
-- Mismo patron que el resto de las suites: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol.
--
-- COMO SE LEE UN FALLO DE RLS AQUI, QUE NO SIEMPRE ES UNA EXCEPCION
--
-- Un INSERT que no pasa el WITH CHECK lanza 42501. Un UPDATE cuya clausula USING no deja ver la
-- fila NO lanza nada: simplemente no afecta ninguna fila, y PostgREST devuelve exito. Por eso las
-- negativas de UPDATE se comprueban leyendo el valor despues y viendo que no cambio; asertar
-- throws_ok ahi seria asertar algo falso.
--
-- Ningun dato real: personas, proveedor, medicamento y lotes son inventados.

BEGIN;

SELECT plan(28);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000625001', 'admin625@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000625002', 'medico625@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000625003', 'voluntario625@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000625004', 'voluntario625b@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000625001';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000625002';
-- Los dos voluntarios se quedan con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('74000000-0000-0000-0000-000000625001', 'Medicamento 625', '500 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('75000000-0000-0000-0000-000000625001', 'Proveedor 625', 'comercial');

INSERT INTO bodegas (id, nombre) VALUES
  ('80000000-0000-0000-0000-000000625001', 'Bodega 625');

-- Lote ya firme, para el movimiento del bloque 2.
INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                   cantidad_ingresada, confirmado) VALUES
  ('76000000-0000-0000-0000-000000625001', '74000000-0000-0000-0000-000000625001', 'L-625-FIRME',
   CURRENT_DATE + 200, '75000000-0000-0000-0000-000000625001', 'compra', 100, TRUE);

SET LOCAL ROLE authenticated;

-- ============================================================================
-- 1. El catalogo de diagnosticos (00105)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625001';

SELECT lives_ok(
  $$ INSERT INTO diagnosticos (id, codigo, nombre)
     VALUES ('7d000000-0000-0000-0000-000000625001', 'Z625', 'Diagnostico de prueba 625') $$,
  'POSITIVA INSERT: la administradora agrega un diagnostico al catalogo'
);

SELECT lives_ok(
  $$ UPDATE diagnosticos SET nombre = 'Diagnostico de prueba 625 corregido'
     WHERE id = '7d000000-0000-0000-0000-000000625001' $$,
  'POSITIVA UPDATE: la administradora corrige un diagnostico'
);

SELECT is(
  (SELECT nombre FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000625001'),
  'Diagnostico de prueba 625 corregido',
  'la correccion se guardo'
);

SELECT throws_ok(
  $$ INSERT INTO diagnosticos (codigo, nombre) VALUES ('Z625', 'Codigo repetido') $$,
  '23505',
  NULL,
  'NEGATIVA INSERT: el codigo identifica al diagnostico y no se puede repetir'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625002';

SELECT throws_ok(
  $$ INSERT INTO diagnosticos (codigo, nombre) VALUES ('Z625M', 'Diagnostico del medico') $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: el medico lee el catalogo pero no lo mantiene'
);

SELECT isnt_empty(
  $$ SELECT 1 FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000625001' $$,
  'POSITIVA SELECT: el medico lee el catalogo, que es lo que alimenta su formulario'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625003';

SELECT is_empty(
  $$ SELECT 1 FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000625001' $$,
  'NEGATIVA SELECT: el voluntario no ve diagnosticos, que son informacion clinica'
);

-- ============================================================================
-- 2. De quien es un movimiento de inventario (00106)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000625001', 'ingreso',
             '76000000-0000-0000-0000-000000625001', '80000000-0000-0000-0000-000000625001',
             10, 'ingreso del voluntario', '00000000-0000-0000-0000-000000625003') $$,
  'POSITIVA INSERT: el voluntario registra un movimiento propio'
);

SELECT lives_ok(
  $$ UPDATE movimientos_inventario SET motivo = 'ingreso del voluntario, corregido'
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'POSITIVA UPDATE: quien lo registro corrige su movimiento mientras siga pendiente'
);

SELECT is(
  (SELECT motivo FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000625001'),
  'ingreso del voluntario, corregido',
  'la correccion se guardo de verdad, no fue un UPDATE de cero filas'
);

-- La autoaprobacion tiene DOS candados y el que salta es el del trigger, no el de la politica:
-- los triggers BEFORE corren antes de que Postgres evalue el WITH CHECK. Se asserta P0001 y no
-- 42501 a proposito, porque es lo que de verdad ocurre; asertar 42501 seria describir un
-- mecanismo que no es el que actua.
SELECT throws_ok(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado'
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'P0001',
  'Solo quien aprueba puede cambiar el estado de un movimiento de inventario.',
  'NEGATIVA UPDATE: el voluntario no puede aprobarse su propio movimiento'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000625001'),
  'pendiente',
  'y el movimiento sigue pendiente: el intento no dejo rastro'
);

-- La politica deja pasar esto (estado sigue pendiente y la fila sigue siendo suya); lo para el
-- trigger fn_proteger_decision_de_movimiento.
SELECT throws_ok(
  $$ UPDATE movimientos_inventario SET aprobado_por = '00000000-0000-0000-0000-000000625003'
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'P0001',
  NULL,
  'NEGATIVA UPDATE: el voluntario no escribe las columnas de la decision'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625004';

UPDATE movimientos_inventario SET motivo = 'editado por otro voluntario'
  WHERE id = '90000000-0000-0000-0000-000000625001';

SELECT is(
  (SELECT motivo FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000625001'),
  'ingreso del voluntario, corregido',
  'NEGATIVA UPDATE: otro voluntario no edita un movimiento ajeno (USING lo filtra: cero filas)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625001';

SELECT lives_ok(
  $$ UPDATE movimientos_inventario
     SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000625001', aprobado_en = NOW()
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'POSITIVA UPDATE: la administradora aprueba el movimiento'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625003';

UPDATE movimientos_inventario SET motivo = 'ya no es mio'
  WHERE id = '90000000-0000-0000-0000-000000625001';

SELECT is(
  (SELECT motivo FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000625001'),
  'ingreso del voluntario, corregido',
  'NEGATIVA UPDATE: aprobado el movimiento, quien lo registro ya no lo toca'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625001';

SELECT lives_ok(
  $$ UPDATE movimientos_inventario SET motivo = 'corregido por la administradora'
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'POSITIVA UPDATE: ella si corrige el texto de un movimiento ya aprobado'
);

SELECT throws_ok(
  $$ UPDATE movimientos_inventario SET cantidad = 999
     WHERE id = '90000000-0000-0000-0000-000000625001' $$,
  'P0001',
  NULL,
  'NEGATIVA UPDATE: ni ella cambia lo que ya movio existencias; eso se compensa, no se reescribe'
);

-- ============================================================================
-- 3. Lotes provisionales (00107)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625003';

SELECT lives_ok(
  $$ INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                        cantidad_ingresada, registrado_por)
     VALUES ('76000000-0000-0000-0000-000000625002', '74000000-0000-0000-0000-000000625001',
             'L-625-PROVISIONAL', CURRENT_DATE + 300, '75000000-0000-0000-0000-000000625001',
             'donacion', 50, '00000000-0000-0000-0000-000000625003') $$,
  'POSITIVA INSERT: el voluntario da de alta el lote de su ingreso'
);

SELECT is(
  (SELECT confirmado FROM lotes WHERE id = '76000000-0000-0000-0000-000000625002'),
  FALSE,
  'ese lote nace provisional, no firme'
);

SELECT throws_ok(
  $$ INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                        cantidad_ingresada, registrado_por, confirmado)
     VALUES ('74000000-0000-0000-0000-000000625001', 'L-625-COLADO', CURRENT_DATE + 300,
             '75000000-0000-0000-0000-000000625001', 'compra', 10,
             '00000000-0000-0000-0000-000000625003', TRUE) $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: el voluntario no puede dar de alta un lote ya firme'
);

SELECT throws_ok(
  $$ INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                        cantidad_ingresada, registrado_por)
     VALUES ('74000000-0000-0000-0000-000000625001', 'L-625-AJENO', CURRENT_DATE + 300,
             '75000000-0000-0000-0000-000000625001', 'compra', 10,
             '00000000-0000-0000-0000-000000625001') $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: tampoco puede atribuirle el lote a otra persona'
);

SELECT lives_ok(
  $$ UPDATE lotes SET numero_lote = 'L-625-PROVISIONAL-B'
     WHERE id = '76000000-0000-0000-0000-000000625002' $$,
  'POSITIVA UPDATE: corrige su lote mientras siga provisional'
);

-- Aprobar el ingreso es lo que lo vuelve firme.
INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
VALUES ('90000000-0000-0000-0000-000000625002', 'ingreso',
        '76000000-0000-0000-0000-000000625002', '80000000-0000-0000-0000-000000625001',
        50, 'ingreso que trae el lote provisional', '00000000-0000-0000-0000-000000625003');

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625001';

UPDATE movimientos_inventario
  SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000625001', aprobado_en = NOW()
  WHERE id = '90000000-0000-0000-0000-000000625002';

SELECT is(
  (SELECT confirmado FROM lotes WHERE id = '76000000-0000-0000-0000-000000625002'),
  TRUE,
  'aprobar el ingreso confirma el lote que lo acompanaba'
);

SELECT is(
  (SELECT cantidad_disponible FROM existencias
    WHERE lote_id = '76000000-0000-0000-0000-000000625002'
      AND bodega_id = '80000000-0000-0000-0000-000000625001'),
  50,
  'y en la misma operacion aparecen sus existencias'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625003';

UPDATE lotes SET numero_lote = 'L-625-YA-NO-ES-MIO'
  WHERE id = '76000000-0000-0000-0000-000000625002';

SELECT is(
  (SELECT numero_lote FROM lotes WHERE id = '76000000-0000-0000-0000-000000625002'),
  'L-625-PROVISIONAL-B',
  'NEGATIVA UPDATE: confirmado el lote, deja de ser de quien lo propuso'
);

-- Un lote provisional no llega a la vista de disponibles aunque su medicamento sea vigente:
-- existencias solo se crea al aprobar, y la vista parte de ahi.
INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                   cantidad_ingresada, registrado_por)
VALUES ('76000000-0000-0000-0000-000000625003', '74000000-0000-0000-0000-000000625001',
        'L-625-SIN-APROBAR', CURRENT_DATE + 300, '75000000-0000-0000-0000-000000625001',
        'compra', 25, '00000000-0000-0000-0000-000000625003');

SELECT is_empty(
  $$ SELECT 1 FROM vista_lotes_disponibles
      WHERE lote_id = '76000000-0000-0000-0000-000000625003' $$,
  'un lote provisional no se puede dispensar: no aparece en vista_lotes_disponibles'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000625002';

SELECT lives_ok(
  $$ INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen,
                        cantidad_ingresada, registrado_por)
     VALUES ('74000000-0000-0000-0000-000000625001', 'L-625-DEL-MEDICO', CURRENT_DATE + 300,
             '75000000-0000-0000-0000-000000625001', 'compra', 10,
             '00000000-0000-0000-0000-000000625002') $$,
  'POSITIVA INSERT: el medico tambien propone lotes, con las mismas condiciones'
);

SELECT * FROM finish();

ROLLBACK;
