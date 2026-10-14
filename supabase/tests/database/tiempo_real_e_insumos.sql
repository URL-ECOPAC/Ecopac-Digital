-- Pruebas de la 00163 (tablas en la publicacion de Realtime) y la 00164 (un insumo no tiene
-- principio activo ni concentracion). Corre con: supabase test db
--
-- Ningun dato real: los articulos son inventados.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- 00163: las pantallas se enteran de los cambios
-- ============================================================================
SELECT is(
  (SELECT count(*)::INT FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename IN ('gastos', 'jornadas', 'donaciones', 'lotes', 'existencias',
                        'movimientos_inventario', 'notificaciones', 'pacientes')),
  8,
  'las tablas que muestran las pantallas estan en la publicacion supabase_realtime'
);

SELECT is(
  (SELECT count(*)::INT FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'eventos_auditoria'),
  0,
  'la bitacora de auditoria no se publica: nadie la mira en tiempo real'
);

-- ============================================================================
-- 00164: insumos
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016401', 'admin164@test.ecopac.local');
ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000016401';
ALTER TABLE perfiles ENABLE TRIGGER USER;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016401';

SELECT lives_ok(
  $$ SELECT fn_registrar_medicamento('Guantes de nitrilo 164', NULL,
       (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', ARRAY[]::UUID[],
       NULL, false, 'insumo') $$,
  'un insumo se registra sin principio activo ni concentracion'
);

SELECT is(
  (SELECT row(concentracion, forma_farmaceutica, es_pediatrico)::TEXT FROM medicamentos
    WHERE nombre = 'Guantes de nitrilo 164'),
  row(NULL::TEXT, NULL::TEXT, false)::TEXT,
  'y queda sin datos farmacologicos'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_medicamento('Jeringa 5 ml 164', '500 mg',
       (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico',
       ARRAY[(SELECT id FROM principios_activos ORDER BY nombre LIMIT 1)], 'Oral', true, 'insumo') $$,
  'si a un insumo le llegan datos farmacologicos, se registra igual'
);

SELECT is(
  (SELECT row(m.concentracion, m.es_pediatrico, count(mp.principio_id))::TEXT
     FROM medicamentos m
     LEFT JOIN medicamento_principio mp ON mp.medicamento_id = m.id
    WHERE m.nombre = 'Jeringa 5 ml 164'
    GROUP BY m.id),
  row(NULL::TEXT, false, 0::BIGINT)::TEXT,
  'pero no los guarda'
);

SELECT throws_ok(
  $$ SELECT fn_registrar_medicamento('Medicamento sin principio 164', '500 mg',
       (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', ARRAY[]::UUID[]) $$,
  '23514', NULL,
  'un medicamento sigue exigiendo principio activo'
);

SELECT throws_ok(
  $$ SELECT fn_registrar_medicamento('Medicamento sin concentracion 164', NULL,
       (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico',
       ARRAY[(SELECT id FROM principios_activos ORDER BY nombre LIMIT 1)]) $$,
  '23514', NULL,
  'y su concentracion'
);

SELECT * FROM finish();
ROLLBACK;
