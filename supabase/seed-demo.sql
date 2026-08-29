-- Ecopac Digital - Datos ficticios de demostracion (issue #94)
--
-- TODO INVENTADO. Ningun nombre, telefono, DPI, comunidad o credencial de este archivo
-- corresponde a una persona o lugar real (regla de confidencialidad de AGENTS.md). Sirve
-- para desarrollar y demostrar el sistema sin arrancar con la base vacia: un usuario por
-- rol, comunidades, pacientes, una jornada finalizada y una en curso, medicamentos, lotes
-- con distintas fechas de vencimiento y movimientos de inventario en los tres estados.
--
-- NUNCA ejecutar este archivo contra Ecopac-Digital-Prod. Por diseno del pipeline actual
-- (.github/workflows/supabase.yml) ya es imposible que llegue ahi de forma automatica:
-- "supabase db push" (lo unico que corre contra ecopac-dev/ecopac-prod) nunca ejecuta
-- archivos de seed, solo migraciones. Este archivo solo corre via "supabase db reset"
-- (local, y el job "validar" del CI, ambos desechables) o si alguien lo aplica a mano
-- contra ecopac-dev. Ver docs/DATOS-DEMO.md para las credenciales y el procedimiento.
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
  ('de000002-0000-0000-0000-000000000001', 'Bodega Movil Demo', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO proveedores (id, nombre, contacto, tipo) VALUES
  ('de000003-0000-0000-0000-000000000001', 'Distribuidora Farmaceutica Demo, S.A.', 'ventas@distribuidorademo.test', 'comercial'),
  ('de000003-0000-0000-0000-000000000002', 'Fundacion Manos Solidarias Demo', 'contacto@manossolidariasdemo.test', 'donante')
ON CONFLICT (id) DO NOTHING;

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
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Pacientes y expedientes
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma, dpi) VALUES
  ('de000005-0000-0000-0000-000000000001', 'Marta', 'Xiloj Demo', '1958-03-12', 'Femenino', 'de000004-0000-0000-0000-000000000001', '5999-1001', 'quiche', '9999900000001'),
  ('de000005-0000-0000-0000-000000000002', 'Pedro', 'Vasquez Demo', '1990-07-22', 'Masculino', 'de000004-0000-0000-0000-000000000001', '5999-1002', 'espanol', '9999900000002'),
  ('de000005-0000-0000-0000-000000000003', 'Elena', 'Ramirez Demo', '2015-01-05', 'Femenino', 'de000004-0000-0000-0000-000000000001', '5999-1003', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000004', 'Carlos', 'Tzul Demo', '1975-11-30', 'Masculino', 'de000004-0000-0000-0000-000000000001', '5999-1004', 'quiche', NULL),
  ('de000005-0000-0000-0000-000000000005', 'Sofia', 'Morales Demo', '2001-09-14', 'Femenino', 'de000004-0000-0000-0000-000000000002', '5999-1005', 'espanol', '9999900000005'),
  ('de000005-0000-0000-0000-000000000006', 'Juan', 'Perez Demo', '1948-05-02', 'Masculino', 'de000004-0000-0000-0000-000000000002', '5999-1006', 'espanol', '9999900000006'),
  ('de000005-0000-0000-0000-000000000007', 'Rosa', 'Cotzojay Demo', '2018-06-19', 'Femenino', 'de000004-0000-0000-0000-000000000002', '5999-1007', 'mam', NULL),
  ('de000005-0000-0000-0000-000000000008', 'Miguel', 'Gomez Demo', '1983-02-27', 'Masculino', 'de000004-0000-0000-0000-000000000002', '5999-1008', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000009', 'Ana', 'Lopez Demo', '1995-12-08', 'Femenino', 'de000004-0000-0000-0000-000000000003', '5999-1009', 'espanol', '9999900000009'),
  ('de000005-0000-0000-0000-000000000010', 'Diego', 'Us Demo', '1965-04-17', 'Masculino', 'de000004-0000-0000-0000-000000000003', '5999-1010', 'mam', NULL),
  ('de000005-0000-0000-0000-000000000011', 'Luisa', 'Chavez Demo', '2010-10-25', 'Femenino', 'de000004-0000-0000-0000-000000000003', '5999-1011', 'espanol', NULL),
  ('de000005-0000-0000-0000-000000000012', 'Andres', 'Tum Demo', '1937-08-09', 'Masculino', 'de000004-0000-0000-0000-000000000003', '5999-1012', 'quiche', '9999900000012')
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
INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca, forma_farmaceutica, es_pediatrico) VALUES
  ('de000007-0000-0000-0000-000000000001', 'Acetaminofen', '500 mg', 'tableta', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000002', 'Ibuprofeno', '400 mg', 'tableta', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000003', 'Amoxicilina', '250 mg/5 ml', 'jarabe', 'Generico', 'suspension', TRUE),
  ('de000007-0000-0000-0000-000000000004', 'Loratadina', '10 mg', 'tableta', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000005', 'Omeprazol', '20 mg', 'capsula', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000006', 'Hidrocortisona', '1%', 'pomada', 'Generico', NULL, FALSE),
  ('de000007-0000-0000-0000-000000000007', 'Ciprofloxacino', '0.3%', 'gotas ophthalmic', 'Generico', NULL, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO principios_activos (id, nombre) VALUES
  ('de000008-0000-0000-0000-000000000001', 'Paracetamol'),
  ('de000008-0000-0000-0000-000000000002', 'Ibuprofeno'),
  ('de000008-0000-0000-0000-000000000003', 'Amoxicilina')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medicamento_principio (medicamento_id, principio_id) VALUES
  ('de000007-0000-0000-0000-000000000001', 'de000008-0000-0000-0000-000000000001'),
  ('de000007-0000-0000-0000-000000000002', 'de000008-0000-0000-0000-000000000002'),
  ('de000007-0000-0000-0000-000000000003', 'de000008-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Lotes (fechas relativas a CURRENT_DATE: DO UPDATE las refresca en cada corrida)
-- ============================================================================
-- L1 vencido, L2 vence dentro del mes, L3/L4 vencimiento lejano (flujo sano).
INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  ('de000009-0000-0000-0000-000000000001', 'de000007-0000-0000-0000-000000000001',
   'LOTE-DEMO-VENCIDO', 'de000003-0000-0000-0000-000000000001', 'compra', 200, CURRENT_DATE - 400, CURRENT_DATE - 10),
  ('de000009-0000-0000-0000-000000000002', 'de000007-0000-0000-0000-000000000002',
   'LOTE-DEMO-POR-VENCER', 'de000003-0000-0000-0000-000000000001', 'compra', 150, CURRENT_DATE - 60, CURRENT_DATE + 20),
  ('de000009-0000-0000-0000-000000000003', 'de000007-0000-0000-0000-000000000003',
   'LOTE-DEMO-DONACION', 'de000003-0000-0000-0000-000000000002', 'donacion', 80, CURRENT_DATE - 30, CURRENT_DATE + 400),
  ('de000009-0000-0000-0000-000000000004', 'de000007-0000-0000-0000-000000000004',
   'LOTE-DEMO-SANO', 'de000003-0000-0000-0000-000000000001', 'compra', 300, CURRENT_DATE - 200, CURRENT_DATE + 500)
ON CONFLICT (id) DO UPDATE SET
  cantidad_ingresada = EXCLUDED.cantidad_ingresada,
  fecha_ingreso = EXCLUDED.fecha_ingreso,
  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
  updated_at = NOW();

-- ============================================================================
-- 8. Jornadas y personal asignado
-- ============================================================================
-- J1 finalizada: created_at se fija antes de "fecha" a proposito (chk_jornadas_fecha_no
-- _anterior_a_creacion, 00012, exige fecha >= created_at::date; con el DEFAULT NOW() una
-- fecha en el pasado violaria el CHECK).
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, presupuesto_asignado, created_at) VALUES
  ('de00000a-0000-0000-0000-000000000001', 'Jornada Demo El Rosario', CURRENT_DATE - 30,
   'de000004-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', 'finalizada', 5000, CURRENT_DATE - 35),
  ('de00000a-0000-0000-0000-000000000002', 'Jornada Demo Vista Hermosa', CURRENT_DATE,
   'de000004-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000004', 'en curso', 3000, NOW())
ON CONFLICT (id) DO UPDATE SET
  fecha = EXCLUDED.fecha,
  estado = EXCLUDED.estado,
  created_at = EXCLUDED.created_at,
  updated_at = NOW();

INSERT INTO jornada_personal (id, jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin, responsabilidad) VALUES
  ('de00000b-0000-0000-0000-000000000001', 'de00000a-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000004', 'medico', '07:00', '15:00', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000002', 'de00000a-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000006', 'voluntario general', '07:00', '15:00', 'Registro y triaje'),
  ('de00000b-0000-0000-0000-000000000003', 'de00000a-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000005', 'medico', '07:00', '16:00', 'Consulta general'),
  ('de00000b-0000-0000-0000-000000000004', 'de00000a-0000-0000-0000-000000000002', 'de000001-0000-0000-0000-000000000007', 'voluntario general', '07:00', '16:00', 'Dispensacion de farmacia')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. Movimientos de inventario en los tres estados
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
   'de000002-0000-0000-0000-000000000001', 150,
   'Ingreso a bodega movil para la jornada en curso (demo)', 'de000001-0000-0000-0000-000000000005'),
  ('de00000c-0000-0000-0000-000000000003', 'ingreso', 'de000009-0000-0000-0000-000000000003',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 80,
   'Ingreso por donacion (demo)', 'de000001-0000-0000-0000-000000000007'),
  ('de00000c-0000-0000-0000-000000000004', 'ingreso', 'de000009-0000-0000-0000-000000000004',
   (SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'), 300,
   'Ingreso inicial de compra (demo)', 'de000001-0000-0000-0000-000000000004'),
  ('de00000c-0000-0000-0000-000000000005', 'salida', 'de000009-0000-0000-0000-000000000002',
   'de000002-0000-0000-0000-000000000001', 40,
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
  SET estado = 'aprobado', aprobado_por = 'de000001-0000-0000-0000-000000000001', fecha_aprobacion = NOW()
  WHERE id IN (
    'de00000c-0000-0000-0000-000000000001', 'de00000c-0000-0000-0000-000000000002',
    'de00000c-0000-0000-0000-000000000003', 'de00000c-0000-0000-0000-000000000004'
  ) AND estado = 'pendiente';

-- La salida depende de que el ingreso al lote por vencer ya haya creado stock en la
-- bodega movil (fila anterior), por eso va en un UPDATE aparte y despues.
UPDATE movimientos_inventario
  SET estado = 'aprobado', aprobado_por = 'de000001-0000-0000-0000-000000000001', fecha_aprobacion = NOW()
  WHERE id = 'de00000c-0000-0000-0000-000000000005' AND estado = 'pendiente';

-- Rechazado: no ajusta existencias (fn_actualizar_existencias solo actua si NEW.estado
-- = 'aprobado'). motivo_rechazo es obligatorio en este estado desde la 00084 (issue #491).
UPDATE movimientos_inventario
  SET estado = 'rechazado', aprobado_por = 'de000001-0000-0000-0000-000000000001',
      fecha_aprobacion = NOW(), motivo_rechazo = 'Cantidad reportada no coincide con el conteo fisico'
  WHERE id = 'de00000c-0000-0000-0000-000000000007' AND estado = 'pendiente';

-- 'de00000c-...-0000000006' se deja tal cual, en 'pendiente': es la fila que puebla la
-- bandeja de validacion (DoD del issue #94).
