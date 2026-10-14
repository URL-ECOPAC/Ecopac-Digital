-- Ecopac Digital - Proveedores y bodegas
--
-- Proveedores: origen de las compras y donaciones de medicamentos. Bodegas:
-- ubicaciones fisicas donde se guarda el inventario, incluida la bodega movil
-- que viaja a cada jornada. Base del modulo de inventario (issues #153 a #162).
--
-- Decisiones de diseno:
-- - tipo_proveedor es enum ('comercial', 'donante') y no boolean: el dominio
--   puede crecer ('gubernamental', 'ong aliada'). Patron de estado_proyecto
--   (00007): el enum vive en la migracion de su modulo.
-- - es_movil es boolean: dominio binario (fija o movil), simetrico con
--   es_pediatrico de 00016.
-- - contacto y ubicacion son nullable: forzarlos empujaria datos basura ('N/A').
--   La bodega movil no tiene ubicacion fija: su ubicacion es la jornada en curso.
-- - La bodega principal se siembra DENTRO de la migracion y no en seed.sql:
--   seed.sql solo corre en local/CI con db reset, mientras que las migraciones
--   llegan a ecopac-dev y ecopac-prod. Es dato operativo necesario desde el dia
--   uno (los movimientos de inventario necesitan una bodega origen), mismo
--   criterio que el seed de permisos (00003). ubicacion queda NULL: el equipo
--   registra la direccion real desde la app.
-- - RLS habilitado en ambas tablas pero sin politicas (deny-all), igual que el
--   resto de modulos: la matriz de politicas se define en un issue posterior.

-- ============================================================================
-- Tipo enumerado del dominio
-- ============================================================================
CREATE TYPE tipo_proveedor AS ENUM ('comercial', 'donante');

-- ============================================================================
-- Tabla proveedores
-- ============================================================================
CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(150) UNIQUE NOT NULL,
  contacto VARCHAR(150),
  tipo tipo_proveedor NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_proveedores_updated_at
BEFORE UPDATE ON proveedores
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Tabla bodegas
-- ============================================================================
CREATE TABLE bodegas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  -- Nullable: la bodega movil no tiene ubicacion fija.
  ubicacion VARCHAR(200),
  es_movil BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_bodegas_updated_at
BEFORE UPDATE ON bodegas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Seed: bodega principal
-- ============================================================================
-- La unica bodega que existe al arrancar el sistema; las demas (incluidas las
-- moviles de cada jornada) se crean desde la app.
INSERT INTO bodegas (nombre, ubicacion, es_movil) VALUES
  ('Bodega Principal', NULL, FALSE);
