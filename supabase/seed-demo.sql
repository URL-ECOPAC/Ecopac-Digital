-- Ecopac Digital - Datos ficticios de demostracion (issue #94)
--
-- TODO INVENTADO. Ningun nombre, telefono, DPI, comunidad o credencial de este archivo
-- corresponde a una persona o lugar real (regla de confidencialidad de AGENTS.md). Sirve
-- para desarrollar y demostrar el sistema sin arrancar con la base vacia: un usuario por
-- rol, comunidades, pacientes, dos proyectos sociales, una jornada finalizada y una en curso
-- -- una colgando de cada proyecto --, medicamentos, lotes con distintas fechas de vencimiento
-- y movimientos de inventario en los tres estados.
--
-- NUNCA ejecutar este archivo contra Ecopac-Digital-Prod. Por diseno del pipeline actual
-- (.github/workflows/supabase.yml) ya es imposible que llegue ahi de forma automatica:
-- "supabase db push" (lo unico que corre contra ecopac-dev/ecopac-prod) nunca ejecuta
-- archivos de seed, solo migraciones. Este archivo solo corre via "supabase db reset"
-- (local, y el job "validar" del CI, ambos desechables) o si alguien lo aplica a mano
-- contra ecopac-dev. Ver docs/DATOS-DEMO.md para las credenciales y el procedimiento.
--
-- Catalogos que se conservan al recargar ecopac-dev (bodegas, proveedores, comunidades, principios
-- activos): se crean con su id fijo solo si no hay ya una fila con el mismo nombre, y todo lo que
-- los usa los busca por nombre. Asi el seed convive con lo que el equipo ya registro
-- (scripts/recargar-datos-demo.sh vacia los datos de negocio pero no los catalogos).
--
-- Idempotencia: todos los IDs son UUIDs fijos (prefijo "de00000X-" por tipo de entidad,
-- para no chocar con los fixtures de supabase/tests/database/, que usan bloques
-- "00000000-...-0NNN" dentro de transacciones que siempre hacen ROLLBACK). Se usa
-- "ON CONFLICT ... DO NOTHING" salvo en jornadas y lotes, donde "DO UPDATE" refresca las
-- fechas relativas a CURRENT_DATE en cada corrida (para que "vencido" y "vence este mes"
-- sigan siendo ciertos sin importar cuando se ejecute el seed). movimientos_inventario
-- NUNCA usa "DO UPDATE": tr_bloquear_movimiento_finalizado (00023) aborta cualquier UPDATE
-- sobre una fila que ya quedo aprobada o rechazada, y un DO UPDATE dispara ese trigger aun
-- si los valores no cambian. En su lugar, cada movimiento nace 'pendiente' con
-- ON CONFLICT DO NOTHING y la transicion a 'aprobado'/'rechazado' se aplica con un UPDATE
-- separado, guardado con "WHERE estado = 'pendiente'" para que no haga nada en una
-- segunda corrida (cero filas afectadas = el trigger de bloqueo ni se dispara).
--
-- auth.uid() no resuelve en esta sesion (conexion directa, sin JWT de PostgREST), asi que
-- tr_autoaprobar_movimiento_inventario (00028) no interfiere: cada movimiento queda en el
-- estado que este archivo pide explicitamente. Mismo comportamiento que ya explota
-- supabase/tests/database/politicas_rls_inventario.sql para armar sus fixtures.

-- ============================================================================
-- 1. Bodegas y proveedores demo
-- ============================================================================
-- La bodega principal ya la siembra la migracion 00017; aqui solo se agrega la bodega
-- movil que "viaja" con la jornada en curso.
INSERT INTO bodegas (id, nombre, ubicacion, es_movil) VALUES
  ('de000002-0000-0000-0000-000000000001', 'Bodega Movil Demo', NULL, TRUE),
  -- 00179: una bodega movil no esta en dos jornadas en curso; la planificada lleva la suya.
  ('de000002-0000-0000-0000-000000000002', 'Bodega Movil Demo 2', NULL, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO proveedores (id, nombre, contacto, tipo) VALUES
  ('de000003-0000-0000-0000-000000000001', 'Distribuidora Farmaceutica Demo, S.A.', 'ventas@distribuidorademo.test', 'comercial'),
  ('de000003-0000-0000-0000-000000000002', 'Fundacion Manos Solidarias Demo', 'contacto@manossolidariasdemo.test', 'donante'),
  -- "Donante no identificado" (issue #165, criterio 4): registrarIngreso() exige proveedor_id
  -- para crear un lote nuevo (lotes.proveedor_id es NOT NULL, 00020), y solo la administradora
  -- puede dar de alta un proveedor/donante (00062, "Solo Administrador puede modificar
  -- proveedores"). Sin esta fila, un medico o voluntario que reciba en el lugar una donacion de
  -- alguien que todavia no esta en el catalogo no podria cerrar el ingreso sin llamar a la
  -- administradora. Solo dato (INSERT), sin tocar esquema ni RLS.
  ('de000003-0000-0000-0000-000000000003', 'Donante no identificado', NULL, 'donante')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Usuarios: uno por rol (medico y voluntario general llevan dos, para poblar
--    jornada_personal en las dos jornadas sin repetir persona)
-- ============================================================================
-- Credenciales documentadas en docs/DATOS-DEMO.md. Mismo password para las siete cuentas
-- porque son datos de desarrollo, no de produccion: EcopacDemo#2026
--
-- auth.identities se inserta ademas de auth.users porque GoTrue (login por password) lo
-- necesita para resolver el login por el proveedor "email"; el patron minimo de
-- supabase/tests/database (solo id + email en auth.users) alcanza para simular auth.uid()
-- en pgTAP, pero no para iniciar sesion de verdad desde la app.
--
-- Las cuatro columnas de token van explicitas en '' y no se omiten: auth.users no les pone
-- DEFAULT '', y GoTrue las escanea como texto no nulo. Dejadas en NULL, toda busqueda de
-- usuario por correo aborta -login y recuperacion de contrasena por igual- con un 500
-- "Database error querying schema". Ver la migracion 00069.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Administradora","apellidos":"Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'junta.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Junta","apellidos":"Directiva Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'socio.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Socio","apellidos":"Fundador Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'medico.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Mario","apellidos":"Medico Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'medico2.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Miriam","apellidos":"Medico Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'voluntario.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Victor","apellidos":"Voluntario Demo"}', NOW(), NOW(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'de000001-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'voluntario2.demo@ecopac.test', extensions.crypt('EcopacDemo#2026', extensions.gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}', '{"nombres":"Valeria","apellidos":"Voluntario Demo"}', NOW(), NOW(),
   '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT extensions.gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', NOW(), NOW(), NOW()
FROM auth.users u
WHERE u.id IN (
  'de000001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000002',
  'de000001-0000-0000-0000-000000000003', 'de000001-0000-0000-0000-000000000004',
  'de000001-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000006',
  'de000001-0000-0000-0000-000000000007'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- El trigger trg_auth_users_crear_perfil (00002) ya creo el perfil con nombres/apellidos
-- del raw_user_meta_data y rol por defecto 'voluntario general'; aqui se fija el rol real
-- de cada quien y el resto de columnas operativas.
--
-- trg_perfiles_impedir_cambio_de_rol_propio (00038) bloquea cualquier UPDATE que cambie
-- perfiles.rol si quien lo ejecuta no es administrador segun es_administrador() (que lee
-- auth.uid(), NULL en esta sesion directa): sin excepcion para el dueno de la conexion,
-- porque es un trigger, no una politica RLS (la sesion de "supabase db reset" no es RLS-
-- exenta frente a triggers). Se desactivan los triggers de usuario de perfiles mientras
-- se fija el rol, mismo patron que ya usa
-- supabase/tests/database/politicas_rls_inventario.sql para el mismo motivo.
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador', telefono = '5999-0001', activo = TRUE, fecha_ingreso = CURRENT_DATE - 400
  WHERE id = 'de000001-0000-0000-0000-000000000001';
UPDATE perfiles SET rol = 'junta directiva', telefono = '5999-0002', activo = TRUE, fecha_ingreso = CURRENT_DATE - 400
  WHERE id = 'de000001-0000-0000-0000-000000000002';
UPDATE perfiles SET rol = 'socio fundador', telefono = '5999-0003', activo = TRUE, fecha_ingreso = CURRENT_DATE - 400
  WHERE id = 'de000001-0000-0000-0000-000000000003';
UPDATE perfiles SET rol = 'medico', telefono = '5999-0004', activo = TRUE, fecha_ingreso = CURRENT_DATE - 200
  WHERE id = 'de000001-0000-0000-0000-000000000004';
UPDATE perfiles SET rol = 'medico', telefono = '5999-0005', activo = TRUE, fecha_ingreso = CURRENT_DATE - 150
  WHERE id = 'de000001-0000-0000-0000-000000000005';
UPDATE perfiles SET rol = 'voluntario general', telefono = '5999-0006', activo = TRUE, fecha_ingreso = CURRENT_DATE - 100
  WHERE id = 'de000001-0000-0000-0000-000000000006';
UPDATE perfiles SET rol = 'voluntario general', telefono = '5999-0007', activo = TRUE, fecha_ingreso = CURRENT_DATE - 90
  WHERE id = 'de000001-0000-0000-0000-000000000007';

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- ============================================================================
-- 3. Comunidades
-- ============================================================================
-- municipio_id usa los municipios ya sembrados por seed.sql (corre antes que este
-- archivo, ver supabase/config.toml). Nombres de comunidad inventados: no representan un
-- caserio/aldea real de esos municipios.
INSERT INTO comunidades (id, municipio_id, nombre, latitud, longitud, referencia_acceso) VALUES
  ('de000004-0000-0000-0000-000000000001', 106, 'Caserio El Rosario Demo', 14.712000, -90.470000, 'Acceso por camino de terraceria a 15 minutos de la cabecera municipal.'),
  ('de000004-0000-0000-0000-000000000002', 401, 'Aldea Vista Hermosa Demo', 14.660000, -90.820000, 'Se llega por la ruta departamental, ultimo tramo sin asfaltar.'),
  ('de000004-0000-0000-0000-000000000003', 1601, 'Comunidad Nueva Esperanza Demo', 15.470000, -90.370000, 'Punto de encuentro en la escuela local.')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Pacientes y expedientes
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma, dpi) VALUES
  ('de000005-0000-0000-0000-000000000001', 'Marta', 'Xiloj Demo', '1958-03-12', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), '5999-1001', 'quiche', '9999900000001'),
  ('de000005-0000-0000-0000-000000000002', 'Pedro', 'Vasquez Demo', '1990-07-22', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), '5999-1002', 'espanol', '9999900000002'),
  ('de000005-0000-0000-0000-000000000003', 'Elena', 'Ramirez Demo', '2015-01-05', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), '5999-1003', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000004', 'Carlos', 'Tzul Demo', '1975-11-30', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), '5999-1004', 'quiche', NULL),
  ('de000005-0000-0000-0000-000000000005', 'Sofia', 'Morales Demo', '2001-09-14', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), '5999-1005', 'espanol', '9999900000005'),
  ('de000005-0000-0000-0000-000000000006', 'Juan', 'Perez Demo', '1948-05-02', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), '5999-1006', 'espanol', '9999900000006'),
  ('de000005-0000-0000-0000-000000000007', 'Rosa', 'Cotzojay Demo', '2018-06-19', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), '5999-1007', 'mam', NULL),
  ('de000005-0000-0000-0000-000000000008', 'Miguel', 'Gomez Demo', '1983-02-27', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), '5999-1008', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000009', 'Ana', 'Lopez Demo', '1995-12-08', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), '5999-1009', 'espanol', '9999900000009'),
  ('de000005-0000-0000-0000-000000000010', 'Diego', 'Us Demo', '1965-04-17', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), '5999-1010', 'mam', NULL),
  ('de000005-0000-0000-0000-000000000011', 'Luisa', 'Chavez Demo', '2010-10-25', 'Femenino', (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), '5999-1011', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000012', 'Andres', 'Tum Demo', '1937-08-09', 'Masculino', (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), '5999-1012', 'quiche', '9999900000012')
ON CONFLICT (id) DO NOTHING;

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('de000006-0000-0000-0000-000000000001', 'de000005-0000-0000-0000-000000000001', 'DEMO-0001'),
  ('de000006-0000-0000-0000-000000000002', 'de000005-0000-0000-0000-000000000002', 'DEMO-0002'),
  ('de000006-0000-0000-0000-000000000003', 'de000005-0000-0000-0000-000000000003', 'DEMO-0003'),
  ('de000006-0000-0000-0000-000000000004', 'de000005-0000-0000-0000-000000000004', 'DEMO-0004'),
  ('de000006-0000-0000-0000-000000000005', 'de000005-0000-0000-0000-000000000005', 'DEMO-0005'),
  ('de000006-0000-0000-0000-000000000006', 'de000005-0000-0000-0000-000000000006', 'DEMO-0006'),
  ('de000006-0000-0000-0000-000000000007', 'de000005-0000-0000-0000-000000000007', 'DEMO-0007'),
  ('de000006-0000-0000-0000-000000000008', 'de000005-0000-0000-0000-000000000008', 'DEMO-0008'),
  ('de000006-0000-0000-0000-000000000009', 'de000005-0000-0000-0000-000000000009', 'DEMO-0009'),
  ('de000006-0000-0000-0000-000000000010', 'de000005-0000-0000-0000-000000000010', 'DEMO-0010'),
  ('de000006-0000-0000-0000-000000000011', 'de000005-0000-0000-0000-000000000011', 'DEMO-0011'),
  ('de000006-0000-0000-0000-000000000012', 'de000005-0000-0000-0000-000000000012', 'DEMO-0012')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Condiciones cronicas de los pacientes
-- ============================================================================
-- El catalogo condiciones_cronicas lo siembra la migracion 00010 con ids generados, asi que
-- aqui se resuelve por nombre: hardcodear un UUID que la migracion no fija romperia el seed en
-- cuanto la base se reconstruya.
--
-- Reparto pensado para que la vista de pacientes cronicos (issue #132) tenga algo que enseniar
-- en cada filtro: las tres comunidades, los tres estados del enum estado_condicion_cronica, un
-- paciente con dos condiciones a la vez y uno cuya condicion ya se resolvio, que es el caso que
-- los listados excluyen por defecto.
INSERT INTO padecimientos_cronicos (id, paciente_id, condicion_id, fecha_diagnostico, estado, notas)
SELECT v.id, v.paciente_id, c.id, v.fecha_diagnostico, v.estado::estado_condicion_cronica, v.notas
FROM (VALUES
  -- Caserio El Rosario Demo
  ('de00000d-0000-0000-0000-000000000001'::uuid, 'de000005-0000-0000-0000-000000000001'::uuid, 'Diabetes',     CURRENT_DATE - 900, 'activa',     'Control cada tres meses. Toma metformina.'),
  ('de00000d-0000-0000-0000-000000000002'::uuid, 'de000005-0000-0000-0000-000000000001'::uuid, 'Hipertension', CURRENT_DATE - 700, 'controlada', 'Presion estable en las ultimas tres jornadas.'),
  ('de00000d-0000-0000-0000-000000000003'::uuid, 'de000005-0000-0000-0000-000000000004'::uuid, 'Hipertension', CURRENT_DATE - 400, 'activa',     NULL),
  ('de00000d-0000-0000-0000-000000000004'::uuid, 'de000005-0000-0000-0000-000000000003'::uuid, 'Desnutricion', CURRENT_DATE - 120, 'activa',     'Seguimiento nutricional mensual.'),
  -- Aldea Vista Hermosa Demo
  ('de00000d-0000-0000-0000-000000000005'::uuid, 'de000005-0000-0000-0000-000000000006'::uuid, 'Diabetes',     CURRENT_DATE - 1500, 'activa',    'Requiere revision de pies en cada jornada.'),
  ('de00000d-0000-0000-0000-000000000006'::uuid, 'de000005-0000-0000-0000-000000000006'::uuid, 'Hipertension', CURRENT_DATE - 1500, 'activa',    NULL),
  ('de00000d-0000-0000-0000-000000000007'::uuid, 'de000005-0000-0000-0000-000000000007'::uuid, 'Asma',         CURRENT_DATE - 200, 'controlada', 'Usa inhalador de rescate.'),
  ('de00000d-0000-0000-0000-000000000008'::uuid, 'de000005-0000-0000-0000-000000000008'::uuid, 'Epilepsia',    CURRENT_DATE - 1100, 'controlada', 'Sin crisis en el ultimo anio.'),
  -- Comunidad Nueva Esperanza Demo
  ('de00000d-0000-0000-0000-000000000009'::uuid, 'de000005-0000-0000-0000-000000000010'::uuid, 'Hipertension', CURRENT_DATE - 600, 'activa',     NULL),
  ('de00000d-0000-0000-0000-00000000000a'::uuid, 'de000005-0000-0000-0000-000000000012'::uuid, 'Diabetes',     CURRENT_DATE - 2000, 'controlada', 'Dieta ajustada; acude acompaniado.'),
  ('de00000d-0000-0000-0000-00000000000b'::uuid, 'de000005-0000-0000-0000-000000000011'::uuid, 'Desnutricion', CURRENT_DATE - 800, 'resuelta',   'Alta nutricional tras seis meses de seguimiento.')
) AS v(id, paciente_id, condicion, fecha_diagnostico, estado, notas)
JOIN condiciones_cronicas c ON c.nombre = v.condicion
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Medicamentos y principios activos
-- ============================================================================
-- presentacion_id (00144): sale de un lookup contra el catalogo por su etiqueta en espanol, no
-- del slug viejo del enum -- presentacion_medicamento ya no existe.
INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, forma_farmaceutica, es_pediatrico)
SELECT v.id, v.nombre, v.concentracion, p.id, v.marca, v.forma_farmaceutica, v.es_pediatrico
FROM (VALUES
  ('de000007-0000-0000-0000-000000000001'::uuid, 'Acetaminofen', '500 mg', 'Tableta', 'Generico', NULL::VARCHAR, FALSE),
  ('de000007-0000-0000-0000-000000000002'::uuid, 'Ibuprofeno', '400 mg', 'Tableta', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000003'::uuid, 'Amoxicilina', '250 mg/5 ml', 'Jarabe', 'Generico', 'suspension', TRUE),
  ('de000007-0000-0000-0000-000000000004'::uuid, 'Loratadina', '10 mg', 'Tableta', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000005'::uuid, 'Omeprazol', '20 mg', 'Cápsula', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000006'::uuid, 'Hidrocortisona', '1%', 'Pomada', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000007'::uuid, 'Ciprofloxacino', '0.3%', 'Gotas oftálmicas', 'Generico', NULL, FALSE)
) AS v(id, nombre, concentracion, presentacion_nombre, marca, forma_farmaceutica, es_pediatrico)
JOIN presentaciones p ON p.nombre = v.presentacion_nombre
ON CONFLICT (id) DO NOTHING;

INSERT INTO principios_activos (id, nombre) VALUES
  ('de000008-0000-0000-0000-000000000001', 'Paracetamol'),
  ('de000008-0000-0000-0000-000000000002', 'Ibuprofeno'),
  ('de000008-0000-0000-0000-000000000003', 'Amoxicilina')
ON CONFLICT DO NOTHING;

-- Por nombre y no por id: en una base que ya tenia ese principio activo, es el que hay.
INSERT INTO medicamento_principio (medicamento_id, principio_id)
SELECT v.medicamento_id, pa.id
FROM (VALUES
  ('de000007-0000-0000-0000-000000000001'::uuid, 'Paracetamol'),
  ('de000007-0000-0000-0000-000000000002'::uuid, 'Ibuprofeno'),
  ('de000007-0000-0000-0000-000000000003'::uuid, 'Amoxicilina')
) AS v(medicamento_id, principio)
JOIN principios_activos pa ON pa.nombre = v.principio
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Lotes (fechas relativas a CURRENT_DATE: DO UPDATE las refresca en cada corrida)
-- ============================================================================
-- L1 vencido, L2 vence dentro del mes, L3/L4 vencimiento lejano (flujo sano).
--
-- costo_unitario (issue #752): L1 y L3 se dejan sin costo a proposito -uno de compra sin precio
-- capturado, uno de donacion, los dos casos reales que fn_valor_de_inventario_disponible tiene
-- que declarar como "sin valorizar" en vez de contar como cero-. L2 y L4 si traen costo, para
-- que la demo muestre tambien el caso normal.
INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento, costo_unitario) VALUES
  ('de000009-0000-0000-0000-000000000001', 'de000007-0000-0000-0000-000000000001',
   'LOTE-DEMO-VENCIDO', (SELECT id FROM proveedores WHERE nombre = 'Distribuidora Farmaceutica Demo, S.A.'), 'compra', 200, CURRENT_DATE - 400, CURRENT_DATE - 10, NULL),
  ('de000009-0000-0000-0000-000000000002', 'de000007-0000-0000-0000-000000000002',
   'LOTE-DEMO-POR-VENCER', (SELECT id FROM proveedores WHERE nombre = 'Distribuidora Farmaceutica Demo, S.A.'), 'compra', 150, CURRENT_DATE - 60, CURRENT_DATE + 20, 1.00),
  ('de000009-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000003',
   'LOTE-DEMO-DONACION', (SELECT id FROM proveedores WHERE nombre = 'Fundacion Manos Solidarias Demo'), 'donacion', 80, CURRENT_DATE - 30, CURRENT_DATE + 400, NULL),
  ('de000009-0000-0000-0000-000000000004', 'de000007-0000-0000-0000-000000000004',
   'LOTE-DEMO-SANO', (SELECT id FROM proveedores WHERE nombre = 'Distribuidora Farmaceutica Demo, S.A.'), 'compra', 300, CURRENT_DATE - 200, CURRENT_DATE + 500, 2.50)
ON CONFLICT (id) DO UPDATE SET
  cantidad_ingresada = EXCLUDED.cantidad_ingresada,
  fecha_ingreso = EXCLUDED.fecha_ingreso,
  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
  costo_unitario = EXCLUDED.costo_unitario,
  updated_at = NOW();

-- ============================================================================
-- 8. Proyectos sociales (issue #864)
-- ============================================================================
-- Hasta ahora `proyectos` se quedaba vacia en los datos de demostracion, asi que el modulo se
-- abria con "No hay proyectos que coincidan con los filtros" para todo el mundo y no habia forma
-- de probar en pantalla quien ve cuales.
--
-- Hacen falta DOS y con distinta jornada colgada, porque desde la 00141 la politica de SELECT de
-- `proyectos` le entrega al personal de campo **solo el proyecto de las jornadas a las que
-- pertenece**. Con un unico proyecto no se distingue "ve el suyo" de "ve todos".
INSERT INTO proyectos (id, nombre, descripcion, fecha_inicio, fecha_fin, responsable_id, estado, porcentaje_avance) VALUES
  ('de00000e-0000-0000-0000-000000000001', 'Salud Rural Demo',
   'Jornadas medicas y dentales en comunidades del altiplano. Proyecto de demostracion.',
   CURRENT_DATE - 60, CURRENT_DATE + 120, 'de000001-0000-0000-0000-000000000001', 'en curso', 45),
  ('de00000e-0000-0000-0000-000000000002', 'Nutricion Infantil Demo',
   'Tamizaje nutricional y seguimiento de menores de cinco anios. Proyecto de demostracion.',
   CURRENT_DATE - 20, CURRENT_DATE + 200, 'de000001-0000-0000-0000-000000000001', 'planificado', 10)
ON CONFLICT (id) DO UPDATE SET
  fecha_inicio = EXCLUDED.fecha_inicio,
  fecha_fin = EXCLUDED.fecha_fin,
  estado = EXCLUDED.estado,
  porcentaje_avance = EXCLUDED.porcentaje_avance,
  updated_at = NOW();

-- ============================================================================
-- 9. Jornadas y personal asignado
-- ============================================================================
-- J1 finalizada: created_at se fija antes de "fecha" a proposito (chk_jornadas_fecha_no
-- _anterior_a_creacion, 00012, exige fecha >= created_at::date; con el DEFAULT NOW() una
-- fecha en el pasado violaria el CHECK).
-- Cada jornada cuelga de un proyecto DISTINTO a proposito (issue #864): Mario (medico) esta en
-- el cuadro de turnos de El Rosario y es el responsable de Vista Hermosa, asi que ve los dos
-- proyectos; Miriam (el otro medico) solo esta en Vista Hermosa y ve solo el suyo. Es lo que
-- hace visible en pantalla la politica de SELECT de `proyectos` de la 00141.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, presupuesto_asignado, proyecto_id, created_at, botiquin_bodega_id) VALUES
  ('de00000a-0000-0000-0000-000000000001', 'Jornada Demo El Rosario', CURRENT_DATE - 30,
   (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), 'de000001-0000-0000-0000-000000000001', 'finalizada', 5000,
   'de00000e-0000-0000-0000-000000000001', CURRENT_DATE - 35, (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo')),
  ('de00000a-0000-0000-0000-000000000002', 'Jornada Demo Vista Hermosa', CURRENT_DATE,
   (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), 'de000001-0000-0000-0000-000000000004', 'en curso', 3000,
   'de00000e-0000-0000-0000-000000000002', NOW(), (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo'))
ON CONFLICT (id) DO UPDATE SET
  fecha = EXCLUDED.fecha,
  estado = EXCLUDED.estado,
  proyecto_id = EXCLUDED.proyecto_id,
  botiquin_bodega_id = EXCLUDED.botiquin_bodega_id,
  created_at = EXCLUDED.created_at,
  updated_at = NOW();

INSERT INTO jornada_personal (id, jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin, responsabilidad) VALUES
  ('de00000b-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000004', 'medico', '07:00', '15:00', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000006', 'voluntario general', '07:00', '15:00', 'Registro y triaje'),
  ('de00000b-0000-0000-0000-000000000003', 'de00000a-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000005', 'medico', '07:00', '16:00', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000004', 'de00000a-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000007', 'voluntario general', '07:00', '16:00', 'Dispensacion de farmacia')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. Movimientos de inventario en los tres estados
-- ============================================================================
-- Cada fila nace 'pendiente' (estado por defecto) y, salvo la que debe quedar en la
-- bandeja de validacion, se transiciona con un UPDATE aparte guardado por
-- "WHERE estado = 'pendiente'": eso dispara de verdad tr_actualizar_existencias (00047) y
-- deja stock real en existencias, y en una segunda corrida no hace nada (0 filas
-- afectadas) en vez de chocar con tr_bloquear_movimiento_finalizado.
INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por) VALUES
  ('de00000c-0000-0000-0000-000000000001', 'ingreso', 'de000009-0000-0000-0000-000000000001',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 200,
   'Ingreso inicial de compra (demo)', 'de000001-0000-0000-0000-000000000006'),
  ('de00000c-0000-0000-0000-000000000002', 'ingreso', 'de000009-0000-0000-0000-000000000002',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo'), 150,
   'Ingreso a bodega movil para la jornada en curso (demo)', 'de000001-0000-0000-0000-000000000005'),
  ('de00000c-0000-0000-0000-000000000003', 'ingreso', 'de000009-0000-0000-0000-000000000003',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 80,
   'Ingreso por donacion (demo)', 'de000001-0000-0000-0000-000000000007'),
  ('de00000c-0000-0000-0000-000000000004', 'ingreso', 'de000009-0000-0000-0000-000000000004',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 300,
   'Ingreso inicial de compra (demo)', 'de000001-0000-0000-0000-000000000004'),
  ('de00000c-0000-0000-0000-000000000005', 'salida', 'de000009-0000-0000-0000-000000000002',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo'), 40,
   'Dispensacion durante la jornada en curso (demo)', 'de000001-0000-0000-0000-000000000005'),
  ('de00000c-0000-0000-0000-000000000006', 'ingreso', 'de000009-0000-0000-0000-000000000003',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 25,
   'Donacion adicional pendiente de validar (demo, queda en la bandeja)', 'de000001-0000-0000-0000-000000000006'),
  ('de00000c-0000-0000-0000-000000000007', 'ingreso', 'de000009-0000-0000-0000-000000000004',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 15,
   'Registro con datos incompletos, se rechaza en revision (demo)', 'de000001-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- Aprobados: los cuatro ingresos que crean stock y la salida que lo consume en parte.
UPDATE movimientos_inventario
  SET estado = 'aprobado', aprobado_por = 'de000001-0000-0000-0000-000000000001', aprobado_en = NOW()
  WHERE id IN (
    'de00000c-0000-0000-0000-000000000001', 'de00000c-0000-0000-0000-000000000002',
    'de00000c-0000-0000-0000-000000000003', 'de00000c-0000-0000-0000-000000000004'
  ) AND estado = 'pendiente';

-- La salida depende de que el ingreso al lote por vencer ya haya creado stock en la
-- bodega movil (fila anterior), por eso va en un UPDATE aparte y despues.
UPDATE movimientos_inventario
  SET estado = 'aprobado', aprobado_por = 'de000001-0000-0000-0000-000000000001', aprobado_en = NOW()
  WHERE id = 'de00000c-0000-0000-0000-000000000005' AND estado = 'pendiente';

-- Rechazado: no ajusta existencias (fn_actualizar_existencias solo actua si NEW.estado
-- = 'aprobado'). motivo_rechazo es obligatorio en este estado desde la 00084 (issue #491).
UPDATE movimientos_inventario
  SET estado = 'rechazado', aprobado_por = 'de000001-0000-0000-0000-000000000001',
      aprobado_en = NOW(), motivo_rechazo = 'Cantidad reportada no coincide con el conteo fisico'
  WHERE id = 'de00000c-0000-0000-0000-000000000007' AND estado = 'pendiente';

-- 'de00000c-...-0000000006' se deja tal cual, en 'pendiente': es la fila que puebla la
-- bandeja de validacion (DoD del issue #94).

-- ============================================================================
-- 11. Insumos del catalogo (00164: sin principio activo ni concentracion)
-- ============================================================================
INSERT INTO presentaciones (nombre)
SELECT v.nombre FROM (VALUES ('Unidad'), ('Caja')) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM presentaciones p WHERE p.nombre = v.nombre);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo)
SELECT v.id, v.nombre, NULL, p.id, v.marca, 'insumo'
FROM (VALUES
  ('de000007-0000-0000-0000-000000000008'::uuid, 'Guantes de nitrilo', 'Caja', 'Generico'),
  ('de000007-0000-0000-0000-000000000009'::uuid, 'Jeringa 5 ml', 'Unidad', 'Generico')
) AS v(id, nombre, presentacion_nombre, marca)
JOIN presentaciones p ON p.nombre = v.presentacion_nombre
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. Una tercera jornada, planificada: la preparacion y el destino del sobrante
-- ============================================================================
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, proyecto_id, botiquin_bodega_id) VALUES
  ('de00000a-0000-0000-0000-000000000003', 'Jornada Demo Nueva Esperanza', CURRENT_DATE + 20,
   (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), 'de000001-0000-0000-0000-000000000001', 'planificada',
   'de00000e-0000-0000-0000-000000000001', (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo 2'))
ON CONFLICT (id) DO UPDATE SET fecha = EXCLUDED.fecha, botiquin_bodega_id = EXCLUDED.botiquin_bodega_id, updated_at = NOW();

INSERT INTO jornada_personal (id, jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin, responsabilidad) VALUES
  ('de00000b-0000-0000-0000-000000000005', 'de00000a-0000-0000-0000-000000000003', 'de000001-0000-0000-0000-000000000004', 'medico', '08:00', '14:00', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000006', 'de00000a-0000-0000-0000-000000000003', 'de000001-0000-0000-0000-000000000006', 'voluntario general', '07:00', '14:00', 'Registro y triaje')
ON CONFLICT (id) DO NOTHING;

INSERT INTO jornada_insumos (id, jornada_id, medicamento_id, cantidad, unidad, costo_unitario_estimado, nota) VALUES
  ('de00001c-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000001', 200, 'tabletas', 0.50, 'Para dolor y fiebre'),
  ('de00001c-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000008', 5, 'cajas', 45.00, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 13. Donantes y donaciones de los cuatro tipos
-- ============================================================================
INSERT INTO donantes (id, nombre, tipo, contacto, telefono, email) VALUES
  ('de00000f-0000-0000-0000-000000000001', 'Fundacion Manos Solidarias Demo', 'organizacion', 'Coordinacion de programas', '5999-2001', 'programas@manossolidariasdemo.test'),
  ('de00000f-0000-0000-0000-000000000002', 'Club de Servicio Demo', 'organizacion', 'Tesoreria', '5999-2002', 'tesoreria@clubdemo.test'),
  ('de00000f-0000-0000-0000-000000000003', 'Carlos Ejemplo Demo', 'persona', NULL, '5999-2003', NULL),
  -- Desde la 00175 cada proveedor donante es un donante: este adopta el proveedor de la seccion 1.
  ('de00000f-0000-0000-0000-000000000004', 'Donante no identificado', 'persona', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- La de dinero es para la jornada en curso: su proyecto lo fija el trigger desde la jornada.
INSERT INTO donaciones (id, donante_id, fecha, tipo, observaciones, registrado_por, jornada_id, proyecto_id) VALUES
  ('de000010-0000-0000-0000-000000000001', 'de00000f-0000-0000-0000-000000000001', CURRENT_DATE - 40, 'dinero',
   'Aporte para la jornada de Vista Hermosa (demo)', 'de000001-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000002', NULL),
  ('de000010-0000-0000-0000-000000000002', 'de00000f-0000-0000-0000-000000000002', CURRENT_DATE - 25, 'medicamentos',
   'Dos medicamentos; uno ya ingreso a inventario (demo)', 'de000001-0000-0000-0000-000000000001', NULL, 'de00000e-0000-0000-0000-000000000001'),
  ('de000010-0000-0000-0000-000000000003', 'de00000f-0000-0000-0000-000000000003', CURRENT_DATE - 10, 'insumos',
   'Guantes para las jornadas (demo)', 'de000001-0000-0000-0000-000000000001', NULL, NULL),
  ('de000010-0000-0000-0000-000000000004', 'de00000f-0000-0000-0000-000000000002', CURRENT_DATE - 5, 'servicios',
   'Transporte de la brigada (demo)', 'de000001-0000-0000-0000-000000000001', NULL, 'de00000e-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO donacion_detalle (id, donacion_id, descripcion, cantidad, unidad, monto, lote_id, medicamento_id) VALUES
  ('de000011-0000-0000-0000-000000000001', 'de000010-0000-0000-0000-000000000001', 'Aporte para jornadas', NULL, NULL, 2500, NULL, NULL),
  ('de000011-0000-0000-0000-000000000002', 'de000010-0000-0000-0000-000000000002', 'Amoxicilina 250 mg/5 ml', 80, 'frascos', NULL, 'de000009-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000003'),
  ('de000011-0000-0000-0000-000000000003', 'de000010-0000-0000-0000-000000000002', 'Acetaminofen 500 mg', 100, 'tabletas', NULL, NULL, 'de000007-0000-0000-0000-000000000001'),
  ('de000011-0000-0000-0000-000000000004', 'de000010-0000-0000-0000-000000000003', 'Guantes de nitrilo', 10, 'cajas', NULL, NULL, NULL),
  ('de000011-0000-0000-0000-000000000005', 'de000010-0000-0000-0000-000000000004', 'Transporte de la brigada', NULL, NULL, 300, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 14. Presupuesto: aportes y gastos
-- ============================================================================
-- El Rosario y Vista Hermosa ya traen su presupuesto inicial como aporte "sin clasificar"
-- (fn_origen_del_presupuesto_inicial, 00135). Aqui se suman un aporte de la donacion de dinero a
-- Vista Hermosa y fondos propios para la jornada planificada.
INSERT INTO jornada_presupuesto_origen (id, jornada_id, origen, donacion_id, monto, descripcion) VALUES
  ('de000012-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000002', 'donacion',
   'de000010-0000-0000-0000-000000000001', 2000, NULL),
  ('de000012-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000003', 'fondos_propios',
   NULL, 1500, 'Presupuesto de preparacion')
ON CONFLICT (id) DO NOTHING;

-- Vista Hermosa (en curso): uno aprobado, uno pendiente y uno rechazado. Nueva Esperanza
-- (planificada): un gasto de preparacion, de antes de la jornada.
INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, fecha, responsable_id, estado, registrado_por, aprobado_por, aprobado_en, motivo_rechazo) VALUES
  ('de000013-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000002', 'Combustible para el traslado', 'Logistica', 350, CURRENT_DATE,
   'de000001-0000-0000-0000-000000000007', 'aprobado', 'de000001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', NOW(), NULL),
  ('de000013-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000002', 'Refrigerios del equipo', 'Logistica', 150, CURRENT_DATE,
   'de000001-0000-0000-0000-000000000007', 'pendiente', 'de000001-0000-0000-0000-000000000007', NULL, NULL, NULL),
  ('de000013-0000-0000-0000-000000000003', 'de00000a-0000-0000-0000-000000000002', 'Compra sin factura', 'Medicamentos', 80, CURRENT_DATE,
   'de000001-0000-0000-0000-000000000007', 'rechazado', 'de000001-0000-0000-0000-000000000007', 'de000001-0000-0000-0000-000000000001', NOW(),
   'No se adjunto la factura'),
  ('de000013-0000-0000-0000-000000000004', 'de00000a-0000-0000-0000-000000000003', 'Impresion de fichas de registro', 'Educacion', 120, CURRENT_DATE - 1,
   'de000001-0000-0000-0000-000000000006', 'pendiente', 'de000001-0000-0000-0000-000000000006', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 15. Proyectos: equipo e hitos
-- ============================================================================
INSERT INTO proyecto_personal (id, proyecto_id, perfil_id, rol_en_proyecto) VALUES
  ('de00001a-0000-0000-0000-000000000001', 'de00000e-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000004', 'Coordinacion medica'),
  ('de00001a-0000-0000-0000-000000000002', 'de00000e-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000006', 'Logistica'),
  ('de00001a-0000-0000-0000-000000000003', 'de00000e-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000005', 'Coordinacion nutricional')
ON CONFLICT (id) DO NOTHING;

INSERT INTO proyecto_hitos (id, proyecto_id, nombre, fecha_prevista, fecha_real) VALUES
  ('de00001b-0000-0000-0000-000000000001', 'de00000e-0000-0000-0000-000000000001', 'Primera jornada en El Rosario', CURRENT_DATE - 30, CURRENT_DATE - 30),
  ('de00001b-0000-0000-0000-000000000002', 'de00000e-0000-0000-0000-000000000001', 'Jornada en Nueva Esperanza', CURRENT_DATE + 20, NULL),
  ('de00001b-0000-0000-0000-000000000003', 'de00000e-0000-0000-0000-000000000002', 'Tamizaje inicial de menores', CURRENT_DATE + 10, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 16. Atencion clinica: triaje, consulta, diagnostico y receta
-- ============================================================================
-- Vista Hermosa esta en curso: sus atenciones pasan por los triggers de siempre. Sofia y Juan ya
-- se atendieron, Rosa tiene triaje y espera consulta, Miguel acaba de llegar.
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('de000014-0000-0000-0000-000000000005', 'de000005-0000-0000-0000-000000000005', 'de00000a-0000-0000-0000-000000000002'),
  ('de000014-0000-0000-0000-000000000006', 'de000005-0000-0000-0000-000000000006', 'de00000a-0000-0000-0000-000000000002'),
  ('de000014-0000-0000-0000-000000000007', 'de000005-0000-0000-0000-000000000007', 'de00000a-0000-0000-0000-000000000002'),
  ('de000014-0000-0000-0000-000000000008', 'de000005-0000-0000-0000-000000000008', 'de00000a-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO triajes (id, atencion_id, presion_sistolica, presion_diastolica, glucosa, peso, talla, temperatura, frecuencia_cardiaca, tomado_por) VALUES
  ('de000015-0000-0000-0000-000000000005', 'de000014-0000-0000-0000-000000000005', 118, 76, 92, 58, 158, 37.8, 88, 'de000001-0000-0000-0000-000000000007'),
  ('de000015-0000-0000-0000-000000000006', 'de000014-0000-0000-0000-000000000006', 150, 95, 210, 72, 165, 36.6, 80, 'de000001-0000-0000-0000-000000000007'),
  ('de000015-0000-0000-0000-000000000007', 'de000014-0000-0000-0000-000000000007', NULL, NULL, NULL, 18, 105, 38.4, 120, 'de000001-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, sintomas, tratamiento, observaciones) VALUES
  ('de000016-0000-0000-0000-000000000005', 'de000006-0000-0000-0000-000000000005', 'de000014-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000005',
   'de00000a-0000-0000-0000-000000000002', 'Diarrea de dos dias', 'Evacuaciones liquidas, fiebre leve', 'Hidratacion oral e ibuprofeno', NULL),
  ('de000016-0000-0000-0000-000000000006', 'de000006-0000-0000-0000-000000000006', 'de000014-0000-0000-0000-000000000006', 'de000001-0000-0000-0000-000000000005',
   'de00000a-0000-0000-0000-000000000002', 'Control de diabetes', 'Sed, vision borrosa', 'Ajuste de dieta; referir a control', 'Glucosa elevada en triaje')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consulta_diagnostico (id, consulta_id, diagnostico_id, es_principal)
SELECT v.id, v.consulta_id, d.id, TRUE
FROM (VALUES
  ('de000017-0000-0000-0000-000000000005'::uuid, 'de000016-0000-0000-0000-000000000005'::uuid, 'A09'),
  ('de000017-0000-0000-0000-000000000006'::uuid, 'de000016-0000-0000-0000-000000000006'::uuid, 'E11')
) AS v(id, consulta_id, codigo)
JOIN diagnosticos d ON d.codigo = v.codigo
ON CONFLICT (id) DO NOTHING;

INSERT INTO recetas (id, consulta_id, medico_id, indicaciones_generales) VALUES
  ('de000018-0000-0000-0000-000000000005', 'de000016-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000005', 'Tomar abundantes liquidos.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO receta_detalle (id, receta_id, medicamento_id, lote_id, bodega_id, dosis, frecuencia, duracion, cantidad_entregada) VALUES
  ('de000019-0000-0000-0000-000000000005', 'de000018-0000-0000-0000-000000000005', 'de000007-0000-0000-0000-000000000002',
   'de000009-0000-0000-0000-000000000002', (SELECT id FROM bodegas WHERE nombre = 'Bodega Movil Demo'), '1 tableta', 'Cada 8 horas', '3 dias', 9)
ON CONFLICT (id) DO NOTHING;

-- El Rosario ya esta finalizada, y las atenciones, consultas y gastos solo entran en una jornada
-- que no cerro (trg_validar_jornada_en_curso y 00159). Para sembrar su historia se apagan los
-- triggers de esta sesion con session_replication_role = replica: las filas quedan como si se
-- hubieran capturado ese dia. Tambien apaga las llaves foraneas, asi que cada id de este bloque
-- apunta a una fila que ya existe arriba.
SET session_replication_role = replica;

INSERT INTO atenciones (id, paciente_id, jornada_id, created_at, updated_at) VALUES
  ('de000014-0000-0000-0000-000000000001', 'de000005-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000001', CURRENT_DATE - 30 + TIME '08:10', CURRENT_DATE - 30 + TIME '08:10'),
  ('de000014-0000-0000-0000-000000000002', 'de000005-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000001', CURRENT_DATE - 30 + TIME '08:40', CURRENT_DATE - 30 + TIME '08:40'),
  ('de000014-0000-0000-0000-000000000003', 'de000005-0000-0000-0000-000000000003', 'de00000a-0000-0000-0000-000000000001', CURRENT_DATE - 30 + TIME '09:15', CURRENT_DATE - 30 + TIME '09:15'),
  ('de000014-0000-0000-0000-000000000004', 'de000005-0000-0000-0000-000000000004', 'de00000a-0000-0000-0000-000000000001', CURRENT_DATE - 30 + TIME '10:05', CURRENT_DATE - 30 + TIME '10:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO triajes (id, atencion_id, presion_sistolica, presion_diastolica, glucosa, peso, talla, temperatura, frecuencia_cardiaca, tomado_por, tomado_en) VALUES
  ('de000015-0000-0000-0000-000000000001', 'de000014-0000-0000-0000-000000000001', 145, 90, 180, 61, 150, 36.5, 78, 'de000001-0000-0000-0000-000000000006', CURRENT_DATE - 30 + TIME '08:15'),
  ('de000015-0000-0000-0000-000000000002', 'de000014-0000-0000-0000-000000000002', 120, 80, NULL, 70, 170, 36.8, 72, 'de000001-0000-0000-0000-000000000006', CURRENT_DATE - 30 + TIME '08:45'),
  ('de000015-0000-0000-0000-000000000003', 'de000014-0000-0000-0000-000000000003', NULL, NULL, NULL, 24, 128, 37.2, 96, 'de000001-0000-0000-0000-000000000006', CURRENT_DATE - 30 + TIME '09:20'),
  ('de000015-0000-0000-0000-000000000004', 'de000014-0000-0000-0000-000000000004', 160, 100, NULL, 80, 168, 36.6, 84, 'de000001-0000-0000-0000-000000000006', CURRENT_DATE - 30 + TIME '10:10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, sintomas, tratamiento, created_at, updated_at) VALUES
  ('de000016-0000-0000-0000-000000000001', 'de000006-0000-0000-0000-000000000001', 'de000014-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000004',
   'de00000a-0000-0000-0000-000000000001', 'Control de diabetes e hipertension', 'Mareo ocasional', 'Continuar metformina', CURRENT_DATE - 30 + TIME '08:30', CURRENT_DATE - 30 + TIME '08:30'),
  ('de000016-0000-0000-0000-000000000002', 'de000006-0000-0000-0000-000000000002', 'de000014-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000004',
   'de00000a-0000-0000-0000-000000000001', 'Dolor lumbar', 'Dolor al cargar', 'Ibuprofeno y reposo', CURRENT_DATE - 30 + TIME '09:00', CURRENT_DATE - 30 + TIME '09:00'),
  ('de000016-0000-0000-0000-000000000003', 'de000006-0000-0000-0000-000000000003', 'de000014-0000-0000-0000-000000000003', 'de000001-0000-0000-0000-000000000004',
   'de00000a-0000-0000-0000-000000000001', 'Tos y fiebre', 'Tos productiva de cinco dias', 'Amoxicilina', CURRENT_DATE - 30 + TIME '09:35', CURRENT_DATE - 30 + TIME '09:35'),
  ('de000016-0000-0000-0000-000000000004', 'de000006-0000-0000-0000-000000000004', 'de000014-0000-0000-0000-000000000004', 'de000001-0000-0000-0000-000000000004',
   'de00000a-0000-0000-0000-000000000001', 'Presion alta', 'Cefalea', 'Referir a centro de salud', CURRENT_DATE - 30 + TIME '10:25', CURRENT_DATE - 30 + TIME '10:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO consulta_diagnostico (id, consulta_id, diagnostico_id, es_principal)
SELECT v.id, v.consulta_id, d.id, TRUE
FROM (VALUES
  ('de000017-0000-0000-0000-000000000001'::uuid, 'de000016-0000-0000-0000-000000000001'::uuid, 'E11'),
  ('de000017-0000-0000-0000-000000000003'::uuid, 'de000016-0000-0000-0000-000000000003'::uuid, 'B82.9')
) AS v(id, consulta_id, codigo)
JOIN diagnosticos d ON d.codigo = v.codigo
ON CONFLICT (id) DO NOTHING;

INSERT INTO recetas (id, consulta_id, medico_id, indicaciones_generales, created_at, updated_at) VALUES
  ('de000018-0000-0000-0000-000000000002', 'de000016-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000004', NULL, CURRENT_DATE - 30 + TIME '09:05', CURRENT_DATE - 30 + TIME '09:05'),
  ('de000018-0000-0000-0000-000000000003', 'de000016-0000-0000-0000-000000000003', 'de000001-0000-0000-0000-000000000004', 'Completar el tratamiento.', CURRENT_DATE - 30 + TIME '09:40', CURRENT_DATE - 30 + TIME '09:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO receta_detalle (id, receta_id, medicamento_id, lote_id, bodega_id, dosis, frecuencia, duracion, cantidad_entregada, created_at) VALUES
  ('de000019-0000-0000-0000-000000000002', 'de000018-0000-0000-0000-000000000002', 'de000007-0000-0000-0000-000000000004',
   'de000009-0000-0000-0000-000000000004', (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), '1 tableta', 'Cada 24 horas', '5 dias', 5, CURRENT_DATE - 30 + TIME '09:05'),
  ('de000019-0000-0000-0000-000000000003', 'de000018-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000003',
   'de000009-0000-0000-0000-000000000003', (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), '5 ml', 'Cada 8 horas', '7 dias', 1, CURRENT_DATE - 30 + TIME '09:40')
ON CONFLICT (id) DO NOTHING;

-- Gastos de El Rosario: lo que sobra de sus Q5,000 queda para liquidar desde la pestana Cierre.
INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, fecha, responsable_id, estado, registrado_por, aprobado_por, aprobado_en) VALUES
  ('de000013-0000-0000-0000-000000000005', 'de00000a-0000-0000-0000-000000000001', 'Transporte del equipo', 'Logistica', 600, CURRENT_DATE - 31,
   'de000001-0000-0000-0000-000000000006', 'aprobado', 'de000001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', CURRENT_DATE - 29 + TIME '10:00'),
  ('de000013-0000-0000-0000-000000000006', 'de00000a-0000-0000-0000-000000000001', 'Medicamentos complementarios', 'Medicamentos', 450, CURRENT_DATE - 32,
   'de000001-0000-0000-0000-000000000004', 'aprobado', 'de000001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', CURRENT_DATE - 29 + TIME '10:05'),
  ('de000013-0000-0000-0000-000000000007', 'de00000a-0000-0000-0000-000000000001', 'Honorarios de odontologia', 'Honorarios', 500, CURRENT_DATE - 30,
   'de000001-0000-0000-0000-000000000004', 'aprobado', 'de000001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', CURRENT_DATE - 29 + TIME '10:10')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 17. Historial de jornadas para el reporte de enfermedades (issue #916)
-- ============================================================================
-- Tres jornadas ya cerradas en meses anteriores, una por comunidad, con veinte pacientes cada una.
-- Sin ellas el reporte de enfermedades no tiene nada que comparar ni ninguna evolucion que
-- dibujar: el resto de este archivo trae dos diagnosticos en una sola jornada.
--
-- El reparto esta pensado para el reporte: la infeccion respiratoria sube y baja entre las tres
-- jornadas, algunas enfermedades pasan de cinco casos y otras no (para ver la cifra protegida
-- "< 5"), y uno de cada cuatro pacientes no tiene comunidad asignada o viene de otra, para que
-- "comunidad de la jornada" y "comunidad del paciente" den resultados distintos.
--
-- Sigue dentro del bloque con session_replication_role = replica, por la misma razon que El
-- Rosario: son jornadas finalizadas.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, proyecto_id, created_at, fecha_inicio_real, fecha_fin_real) VALUES
  ('de00000a-0000-0000-0000-000000000004', 'Jornada Demo Nueva Esperanza - primera visita', CURRENT_DATE - 150,
   (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo'), 'de000001-0000-0000-0000-000000000001', 'finalizada',
   'de00000e-0000-0000-0000-000000000001', CURRENT_DATE - 155, CURRENT_DATE - 150 + TIME '07:30', CURRENT_DATE - 150 + TIME '15:30'),
  ('de00000a-0000-0000-0000-000000000005', 'Jornada Demo El Rosario - seguimiento', CURRENT_DATE - 95,
   (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo'), 'de000001-0000-0000-0000-000000000004', 'finalizada',
   'de00000e-0000-0000-0000-000000000001', CURRENT_DATE - 100, CURRENT_DATE - 95 + TIME '07:30', CURRENT_DATE - 95 + TIME '15:30'),
  ('de00000a-0000-0000-0000-000000000006', 'Jornada Demo Vista Hermosa - primera visita', CURRENT_DATE - 60,
   (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo'), 'de000001-0000-0000-0000-000000000005', 'finalizada',
   'de00000e-0000-0000-0000-000000000002', CURRENT_DATE - 65, CURRENT_DATE - 60 + TIME '07:30', CURRENT_DATE - 60 + TIME '15:30')
ON CONFLICT (id) DO UPDATE SET
  fecha = EXCLUDED.fecha,
  created_at = EXCLUDED.created_at,
  fecha_inicio_real = EXCLUDED.fecha_inicio_real,
  fecha_fin_real = EXCLUDED.fecha_fin_real,
  updated_at = NOW();

INSERT INTO jornada_personal (id, jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin, responsabilidad) VALUES
  ('de00000b-0000-0000-0000-000000000007', 'de00000a-0000-0000-0000-000000000004', 'de000001-0000-0000-0000-000000000004', 'medico', '07:30', '15:30', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000008', 'de00000a-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000004', 'medico', '07:30', '15:30', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000009', 'de00000a-0000-0000-0000-000000000006', 'de000001-0000-0000-0000-000000000005', 'medico', '07:30', '15:30', 'Consulta general')
ON CONFLICT (id) DO NOTHING;

-- Sesenta pacientes inventados, del 101 al 160. Del 101 al 120 se atienden en Nueva Esperanza,
-- del 121 al 140 en El Rosario y del 141 al 160 en Vista Hermosa. La comunidad de cada uno rota
-- entre las tres y "sin comunidad", asi que muchos no son de la comunidad de su jornada. Las
-- edades van de 2 a 80 anios y el sexo se alterna.
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
SELECT
  ('de000005-0000-0000-0000-000000000' || n)::uuid,
  (ARRAY['Ixchel', 'Kenan', 'Itzel', 'Balam', 'Nayeli', 'Tecun', 'Sak', 'Ajpu', 'Ixmucane', 'Kaqchi'])[(n % 10) + 1],
  'Demo ' || n,
  CURRENT_DATE - ((n * 397) % 28500 + 730),
  (CASE WHEN n % 2 = 0 THEN 'Femenino' ELSE 'Masculino' END)::sexo_paciente,
  CASE n % 4
    WHEN 0 THEN (SELECT id FROM comunidades WHERE municipio_id = 106 AND nombre = 'Caserio El Rosario Demo')
    WHEN 1 THEN (SELECT id FROM comunidades WHERE municipio_id = 401 AND nombre = 'Aldea Vista Hermosa Demo')
    WHEN 2 THEN (SELECT id FROM comunidades WHERE municipio_id = 1601 AND nombre = 'Comunidad Nueva Esperanza Demo')
    ELSE NULL
  END,
  'espanol'
FROM generate_series(101, 160) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO expedientes (id, paciente_id, numero_ficha)
SELECT ('de000006-0000-0000-0000-000000000' || n)::uuid,
       ('de000005-0000-0000-0000-000000000' || n)::uuid,
       'DEMO-0' || n
FROM generate_series(101, 160) AS n
ON CONFLICT (id) DO NOTHING;

-- La jornada de cada paciente y la fecha de su consulta. Tabla temporal y no CTE porque la leen
-- tres INSERT; se borra al final del bloque.
DROP TABLE IF EXISTS demo_916_atendidos;
CREATE TEMP TABLE demo_916_atendidos AS
SELECT
  n,
  CASE WHEN n <= 120 THEN 'de00000a-0000-0000-0000-000000000004'
       WHEN n <= 140 THEN 'de00000a-0000-0000-0000-000000000005'
       ELSE 'de00000a-0000-0000-0000-000000000006' END::uuid AS jornada_id,
  CASE WHEN n <= 120 THEN CURRENT_DATE - 150
       WHEN n <= 140 THEN CURRENT_DATE - 95
       ELSE CURRENT_DATE - 60 END + TIME '08:00' + (((n - 1) % 20) * INTERVAL '20 minutes') AS momento,
  CASE WHEN n <= 140 THEN 'de000001-0000-0000-0000-000000000004'
       ELSE 'de000001-0000-0000-0000-000000000005' END::uuid AS medico_id,
  -- Diagnostico principal, por posicion dentro de su jornada.
  CASE
    WHEN n <= 120 THEN (ARRAY['J06.9', 'J06.9', 'A09', 'J06.9', 'B82.9', 'J06.9', 'A09', 'J06.9', 'E44.0', 'A09',
                              'J06.9', 'B82.9', 'A09', 'J06.9', 'A09', 'B82.9', 'J06.9', 'E44.0', 'A09', 'B82.9'])[n - 100]
    WHEN n <= 140 THEN (ARRAY['I10', 'J06.9', 'E11', 'I10', 'A09', 'J06.9', 'I10', 'E11', 'M54.5', 'J06.9',
                              'I10', 'A09', 'E11', 'J06.9', 'I10', 'M54.5', 'E11', 'A09', 'I10', 'J06.9'])[n - 120]
    ELSE (ARRAY['J06.9', 'A09', 'J06.9', 'K02.9', 'J06.9', 'B82.9', 'A09', 'J06.9', 'J06.9', 'K02.9',
                'A09', 'J06.9', 'B82.9', 'J06.9', 'A09', 'K02.9', 'J06.9', 'B82.9', 'A09', 'J06.9'])[n - 140]
  END AS principal
FROM generate_series(101, 160) AS n;

INSERT INTO atenciones (id, paciente_id, jornada_id, created_at, updated_at, cerrada_en, motivo_cierre)
SELECT ('de000014-0000-0000-0000-000000000' || n)::uuid,
       ('de000005-0000-0000-0000-000000000' || n)::uuid,
       jornada_id, momento, momento, momento + INTERVAL '40 minutes', 'Atencion completada'
FROM demo_916_atendidos
ON CONFLICT (id) DO NOTHING;

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, created_at, updated_at)
SELECT ('de000016-0000-0000-0000-000000000' || n)::uuid,
       ('de000006-0000-0000-0000-000000000' || n)::uuid,
       ('de000014-0000-0000-0000-000000000' || n)::uuid,
       medico_id, jornada_id, 'Consulta general', momento + INTERVAL '15 minutes', momento + INTERVAL '15 minutes'
FROM demo_916_atendidos
ON CONFLICT (id) DO NOTHING;

-- El principal de cada consulta, y dos secundarios frecuentes: fiebre en uno de cada tres y anemia
-- en uno de cada cuatro. Con "principal y secundarios" el reporte los cuenta; con "solo
-- principal", no.
INSERT INTO consulta_diagnostico (id, consulta_id, diagnostico_id, es_principal)
SELECT v.id, v.consulta_id, d.id, v.es_principal
FROM (
  SELECT ('de000017-0000-0000-0000-000000000' || n)::uuid AS id,
         ('de000016-0000-0000-0000-000000000' || n)::uuid AS consulta_id,
         principal AS codigo, TRUE AS es_principal
  FROM demo_916_atendidos
  UNION ALL
  SELECT ('de000017-0000-0000-0000-000000000' || (n + 100))::uuid,
         ('de000016-0000-0000-0000-000000000' || n)::uuid, 'R50.9', FALSE
  FROM demo_916_atendidos WHERE n % 3 = 0 AND principal <> 'R50.9'
  UNION ALL
  SELECT ('de000017-0000-0000-0000-000000000' || (n + 200))::uuid,
         ('de000016-0000-0000-0000-000000000' || n)::uuid, 'D50.9', FALSE
  FROM demo_916_atendidos WHERE n % 4 = 0
) AS v
JOIN diagnosticos d ON d.codigo = v.codigo
ON CONFLICT (id) DO NOTHING;

DROP TABLE demo_916_atendidos;

SET session_replication_role = DEFAULT;

-- Las alertas de vencimiento no se siembran: las genera la rutina programada
-- (supabase/functions/alertas-vencimiento), y las pruebas de alertas crean las suyas sobre estos
-- mismos lotes.
