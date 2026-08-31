-- Pruebas de la auditoria de padecimientos_cronicos (issue #122, migracion 00070).
-- Corre con: supabase test db
--
-- POR QUE ESTA SUITE EXISTE
--
-- La 00026 dejo esta tabla fuera de los seis triggers de auditoria, y nadie se entero durante
-- cuarenta y cuatro migraciones. No se entero porque un trigger que falta no rompe nada: los
-- INSERT siguen funcionando, el CI sigue verde y la unica senal es una fila que no aparece en
-- eventos_auditoria, donde nadie la estaba buscando. La 00070 lo corrige, y esta suite es lo que
-- impide que se vuelva a caer sin ruido.
--
-- Importa mas en esta tabla que en las otras seis: docs/PERMISOS.md la documenta como la unica
-- tabla clinica con politica de DELETE, asi que es la unica fila del esquema clinico que puede
-- desaparecer de verdad.
--
-- Las tres pruebas leen eventos_auditoria como el rol dueno, sin impersonar: quien puede leer esa
-- tabla ya lo cubre otra suite. Lo que se comprueba aqui es que el trigger escribe, no quien lo
-- puede leer.
--
-- Ningun dato real: paciente, comunidad y condicion son inventados.

BEGIN;

SELECT plan(4);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000122001', 101, 'Comunidad 122');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000122001', 'Uno', 'Inventado', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000122001', '00000122', 'espanol');

INSERT INTO condiciones_cronicas (id, nombre) VALUES
  ('71000000-0000-0000-0000-000000122001', 'Condicion de prueba 122');

-- ============================================================================
-- 1. El trigger existe y cubre las tres operaciones
-- ============================================================================
-- Se comprueba sobre el catalogo y no solo por su efecto, porque un trigger declarado para menos
-- operaciones de las debidas (solo INSERT, por ejemplo) dejaria pasar las pruebas de abajo que
-- si cubre y ninguna diria por que.
SELECT is(
  (
    SELECT tgtype::int & 28
    FROM pg_trigger
    WHERE tgrelid = 'public.padecimientos_cronicos'::regclass
      AND tgname = 'trg_padecimientos_cronicos_auditoria'
  ),
  28,
  'trg_padecimientos_cronicos_auditoria cubre INSERT, UPDATE y DELETE'
);

-- ============================================================================
-- 2. Un alta deja rastro
-- ============================================================================
INSERT INTO padecimientos_cronicos (id, paciente_id, condicion_id, fecha_diagnostico) VALUES
  ('72000000-0000-0000-0000-000000122001', '20000000-0000-0000-0000-000000122001',
   '71000000-0000-0000-0000-000000122001', CURRENT_DATE - 30);

SELECT is(
  (
    SELECT count(*)::int
    FROM eventos_auditoria
    WHERE tabla_afectada = 'padecimientos_cronicos'
      AND fila_id = '72000000-0000-0000-0000-000000122001'
      AND operacion = 'insercion'
  ),
  1,
  'asociar una condicion cronica queda registrado en eventos_auditoria'
);

-- ============================================================================
-- 3. La baja logica deja rastro, con el valor anterior
-- ============================================================================
-- Es la operacion de desasociarCondicion() en packages/shared/pacientes/condiciones.api.js.
-- Se comprueba valores_anteriores y no solo el conteo: lo que hace util la bitacora de un cambio
-- de estado es poder decir de que estado venia.
UPDATE padecimientos_cronicos
SET estado = 'resuelta'
WHERE id = '72000000-0000-0000-0000-000000122001';

SELECT is(
  (
    SELECT valores_anteriores ->> 'estado'
    FROM eventos_auditoria
    WHERE tabla_afectada = 'padecimientos_cronicos'
      AND fila_id = '72000000-0000-0000-0000-000000122001'
      AND operacion = 'actualizacion'
  ),
  'activa',
  'dar de baja una condicion registra el estado del que venia'
);

-- ============================================================================
-- 4. El borrado fisico deja rastro
-- ============================================================================
-- El caso que motivo la 00070: es el unico DELETE del esquema clinico, y hasta ahora la fila se
-- iba sin dejar constancia de que existio.
DELETE FROM padecimientos_cronicos WHERE id = '72000000-0000-0000-0000-000000122001';

SELECT is(
  (
    SELECT valores_anteriores ->> 'condicion_id'
    FROM eventos_auditoria
    WHERE tabla_afectada = 'padecimientos_cronicos'
      AND fila_id = '72000000-0000-0000-0000-000000122001'
      AND operacion = 'eliminacion'
  ),
  '71000000-0000-0000-0000-000000122001',
  'borrar una condicion conserva en la bitacora cual era'
);

SELECT * FROM finish();
ROLLBACK;
