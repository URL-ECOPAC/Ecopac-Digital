-- Ecopac Digital - El catalogo de diagnosticos se puede usar y se puede mantener (issue #625)
--
-- QUE ESTABA MAL
--
-- La tabla diagnosticos existe desde la 00018 y nunca tuvo una sola fila: ninguna migracion ni
-- seed la cargaba. Y tampoco se podia cargar desde la aplicacion, porque la 00033 le dio
-- unicamente GRANT SELECT y una politica de SELECT. docs/PERMISOS.md lo describia tal cual
-- -"Catalogo de solo lectura: nadie lo puede poblar por la API"- pero como una caracteristica,
-- no como lo que era: el paso "diagnostico CIE-10" del flujo de atencion clinica no existia.
-- consulta_diagnostico (00018) y registrarConsulta() estaban listos para recibir diagnosticos que
-- el medico no tenia forma de elegir.
--
-- QUE HACE ESTA MIGRACION
--
-- 1. Vuelve unico el codigo, que es lo que identifica a un diagnostico de verdad.
-- 2. Siembra un conjunto inicial de codigos CIE-10.
-- 3. Deja que la administradora mantenga el catalogo desde la aplicacion.
--
-- SOBRE EL CONJUNTO SEMBRADO
--
-- Son 34 codigos CIE-10 escogidos por frecuencia en jornadas medicas y dentales de primer nivel:
-- respiratorio agudo, gastrointestinal, parasitosis, piel, cronicos (hipertension, diabetes,
-- asma), salud bucal y los sintomas que mas se registran como motivo. **No es el CIE-10
-- completo**, que son mas de catorce mil codigos y no se escribe a mano en una migracion: es el
-- minimo con el que una jornada puede trabajar el primer dia. El catalogo queda editable
-- justamente para que crezca con el uso, y si algun dia se carga el CIE-10 oficial entero, entra
-- por importacion contra esta misma tabla sin cambiar el esquema.
--
-- Los nombres son la descripcion clinica en espaniol de cada codigo, no una traduccion literal
-- del titulo oficial de la OMS. Quien necesite el texto oficial lo corrige desde la aplicacion,
-- que es precisamente lo que esta migracion habilita.

-- ============================================================================
-- 1. El codigo identifica al diagnostico: no se puede repetir
-- ============================================================================
-- Parcial (WHERE codigo IS NOT NULL) porque la columna es nullable desde la 00018 y se deja asi:
-- un diagnostico local sin codigo CIE-10 es legitimo -"control de embarazo", "referencia a
-- segundo nivel"- y varios sin codigo no chocan entre si. Lo que no puede haber es dos filas
-- diciendo ser el mismo codigo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnosticos_codigo_unico
  ON diagnosticos (codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON COLUMN diagnosticos.codigo IS
  'Codigo CIE-10. Unico entre las filas que lo tienen (idx_diagnosticos_codigo_unico, 00105). '
  'Nullable a proposito: un diagnostico local sin equivalente CIE-10 es valido.';

-- ============================================================================
-- 2. Conjunto inicial
-- ============================================================================
-- ON CONFLICT DO NOTHING sobre el codigo: la migracion es idempotente y, sobre todo, no pisa una
-- correccion que alguien haya hecho ya desde la aplicacion.
INSERT INTO diagnosticos (codigo, nombre, descripcion) VALUES
  -- Respiratorio agudo: el motivo de consulta mas frecuente en jornada
  ('J00',   'Rinofaringitis aguda (resfriado comun)', NULL),
  ('J02.9', 'Faringitis aguda, no especificada', NULL),
  ('J03.9', 'Amigdalitis aguda, no especificada', NULL),
  ('J06.9', 'Infeccion aguda de las vias respiratorias superiores, no especificada', NULL),
  ('J18.9', 'Neumonia, no especificada', 'Sospecha clinica; referir a segundo nivel.'),
  ('J20.9', 'Bronquitis aguda, no especificada', NULL),
  ('J45',   'Asma', NULL),
  -- Gastrointestinal y parasitosis
  ('A09',   'Diarrea y gastroenteritis de presunto origen infeccioso', NULL),
  ('B82.9', 'Parasitosis intestinal, no especificada', NULL),
  ('K21.9', 'Enfermedad por reflujo gastroesofagico sin esofagitis', NULL),
  ('K29.7', 'Gastritis, no especificada', NULL),
  ('K30',   'Dispepsia', NULL),
  -- Salud bucal: las jornadas dentales son la mitad del programa
  ('K02.9', 'Caries dental, no especificada', NULL),
  ('K04.7', 'Absceso periapical sin fistula', NULL),
  ('K05.1', 'Gingivitis cronica', NULL),
  ('K05.3', 'Periodontitis cronica', NULL),
  ('K08.1', 'Perdida de dientes por extraccion o enfermedad periodontal', NULL),
  -- Cronicos: los que exigen seguimiento entre jornadas
  ('E11',   'Diabetes mellitus tipo 2', NULL),
  ('I10',   'Hipertension esencial (primaria)', NULL),
  ('E66.9', 'Obesidad, no especificada', NULL),
  ('E44.0', 'Desnutricion proteicocalorica moderada', NULL),
  ('E43',   'Desnutricion proteicocalorica severa, no especificada', 'Referir a segundo nivel.'),
  ('D50.9', 'Anemia por deficiencia de hierro, no especificada', NULL),
  -- Piel
  ('B35.9', 'Dermatofitosis, no especificada', NULL),
  ('B86',   'Escabiosis', NULL),
  ('L20.9', 'Dermatitis atopica, no especificada', NULL),
  ('L23.9', 'Dermatitis alergica de contacto, de causa no especificada', NULL),
  ('L30.9', 'Dermatitis, no especificada', NULL),
  -- Ojo y oido
  ('H10.9', 'Conjuntivitis, no especificada', NULL),
  ('H66.9', 'Otitis media, no especificada', NULL),
  -- Genitourinario
  ('N39.0', 'Infeccion de vias urinarias, sitio no especificado', NULL),
  -- Musculoesqueletico
  ('M54.5', 'Lumbago no especificado', NULL),
  ('M79.1', 'Mialgia', NULL),
  -- Sintomas y contacto sin diagnostico cerrado
  ('R05',   'Tos', NULL),
  ('R50.9', 'Fiebre, no especificada', NULL),
  ('R51',   'Cefalea', NULL),
  ('Z00.0', 'Examen medico general', 'Consulta preventiva sin enfermedad identificada.')
ON CONFLICT (codigo) WHERE codigo IS NOT NULL DO NOTHING;

-- ============================================================================
-- 3. La administradora mantiene el catalogo
-- ============================================================================
-- RLS no sustituye a los privilegios SQL (mismo criterio que 00031/00032/00033): sin GRANT, el
-- INSERT muere en 42501 antes de llegar a la politica.
--
-- Solo INSERT y UPDATE, sin DELETE, igual que el resto de los catalogos del esquema
-- (medicamentos, bodegas, proveedores). Y aqui hay una razon extra: consulta_diagnostico
-- referencia diagnosticos ON DELETE RESTRICT (00018), asi que borrar uno ya usado en una consulta
-- fallaria de todas formas -- y debe fallar, porque el diagnostico de una consulta pasada es
-- historia clinica. Un diagnostico que ya no se quiera ofrecer se corrige, no se borra.
GRANT INSERT, UPDATE ON diagnosticos TO authenticated;

CREATE POLICY "Solo administrador crea diagnosticos" ON diagnosticos
  FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador edita diagnosticos" ON diagnosticos
  FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- La lectura no se toca: sigue siendo de medico y administrador (00033). Un voluntario no ve
-- diagnosticos, que es informacion clinica.
