-- Pruebas de la 00175: cada donante tiene su proveedor en inventario, y el proveedor sigue al
-- donante. Corre con: supabase test db
--
-- Como la administradora, que por RLS registra donantes. El proveedor lo escribe el trigger
-- (SECURITY DEFINER), no quien registra.

BEGIN;

SELECT plan(9);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000017511', 'admin1751@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000017511';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('80000000-0000-0000-0000-000000001751', 'Farmacia 1751', 'comercial');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000017511';

-- ============================================================================
-- Registrar un donante crea su proveedor
-- ============================================================================
INSERT INTO donantes (id, nombre, tipo, telefono, email) VALUES
  ('d0000000-0000-0000-0000-000000001751', 'Donante 1751', 'persona', '5555-1751', 'donante1751@test.local');

SELECT is(
  (SELECT nombre FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001751'),
  'Donante 1751',
  'el donante nuevo tiene su proveedor, con el mismo nombre'
);

SELECT is(
  (SELECT tipo::text FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001751'),
  'donante',
  'y es de tipo donante'
);

SELECT is(
  (SELECT contacto FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001751'),
  '5555-1751 · donante1751@test.local',
  'el contacto del proveedor junta el telefono y el correo del donante'
);

-- ============================================================================
-- Editar el donante actualiza el proveedor
-- ============================================================================
UPDATE donantes SET nombre = 'Donante 1751 renombrado'
WHERE id = 'd0000000-0000-0000-0000-000000001751';

SELECT is(
  (SELECT nombre FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001751'),
  'Donante 1751 renombrado',
  'cambiar el nombre del donante cambia el de su proveedor'
);

SELECT is(
  (SELECT count(*)::int FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001751'),
  1,
  'y no crea un segundo proveedor'
);

-- ============================================================================
-- Un nombre que ya tiene un proveedor comercial
-- ============================================================================
INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000001752', 'Farmacia 1751', 'organizacion');

SELECT is(
  (SELECT nombre FROM proveedores WHERE donante_id = 'd0000000-0000-0000-0000-000000001752'),
  'Farmacia 1751 (donante)',
  'si un proveedor comercial ya tiene el nombre, el del donante lleva un sufijo'
);

SELECT is(
  (SELECT donante_id FROM proveedores WHERE id = '80000000-0000-0000-0000-000000001751'),
  NULL,
  'y el comercial no se toca'
);

-- ============================================================================
-- Restricciones
-- ============================================================================
RESET ROLE;

SELECT throws_ok(
  $$ UPDATE proveedores SET donante_id = 'd0000000-0000-0000-0000-000000001751'
      WHERE id = '80000000-0000-0000-0000-000000001751' $$,
  '23514', NULL,
  'un proveedor comercial no se enlaza con un donante'
);

SELECT is(
  has_function_privilege('authenticated', 'public.fn_sincronizar_proveedor_de_donante(uuid)', 'EXECUTE'),
  false,
  'nadie llama directo a la sincronizacion'
);

SELECT * FROM finish();
ROLLBACK;
