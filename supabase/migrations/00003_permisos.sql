-- Ecopac Digital - Catalogo de permisos y su asignacion por rol y por usuario
-- Permite conceder accesos mas finos que el rol base (ej. habilitar a un voluntario
-- especifico a aprobar movimientos de inventario sin convertirlo en administrador).

-- ============================================================================
-- Tablas
-- ============================================================================
CREATE TABLE permisos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  clave VARCHAR(100) UNIQUE NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  descripcion TEXT
);

ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;

-- Asocia cada rol con su conjunto de permisos finos por defecto.
CREATE TABLE rol_permiso (
  rol rol_usuario NOT NULL,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol, permiso_id)
);

ALTER TABLE rol_permiso ENABLE ROW LEVEL SECURITY;

-- Concede o revoca un permiso puntual a un usuario especifico, por encima o por
-- debajo de lo que le darian los permisos por defecto de su rol.
CREATE TABLE usuario_permiso (
  perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  concedido BOOLEAN NOT NULL,
  otorgado_por UUID REFERENCES perfiles(id),
  motivo TEXT,
  PRIMARY KEY (perfil_id, permiso_id)
);

ALTER TABLE usuario_permiso ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Seed: catalogo de permisos de los seis modulos
-- ============================================================================
INSERT INTO permisos (clave, modulo, descripcion) VALUES
  ('usuarios.gestionar_permisos', 'usuarios', 'Otorgar o revocar permisos puntuales a otros perfiles.'),
  ('pacientes.editar', 'pacientes', 'Editar el registro de un paciente sin ser quien lo creo.'),
  ('inventario.aprobar', 'inventario', 'Aprobar movimientos de inventario en estado pendiente de validacion.'),
  ('jornadas.gestionar', 'jornadas', 'Crear, editar o cerrar jornadas sin ser administrador.'),
  ('donaciones.registrar', 'donaciones', 'Registrar donaciones y donantes.'),
  ('reportes.exportar', 'reportes', 'Exportar reportes agregados del sistema.');

-- Seed: permisos por defecto por rol, segun la matriz de permisos del entregable.
-- El administrador tiene todos los permisos finos por defecto.
INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'administrador', id FROM permisos;

-- El medico ya tiene CRU sobre pacientes por su rol; se refuerza como permiso fino.
INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'medico', id FROM permisos WHERE clave = 'pacientes.editar';

-- Junta directiva y socio fundador tienen acceso de solo lectura por rol; se les da
-- exportacion de reportes para su labor de gobernanza.
INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'junta directiva', id FROM permisos WHERE clave = 'reportes.exportar';

INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'socio fundador', id FROM permisos WHERE clave = 'reportes.exportar';
