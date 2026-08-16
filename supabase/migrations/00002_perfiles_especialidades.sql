-- Ecopac Digital - Tabla de perfiles de usuario y especialidades
-- De esta tabla dependen todas las politicas RLS del sistema: perfiles.id es el mismo
-- UUID que auth.users.id, no una llave separada.

-- ============================================================================
-- Tablas
-- ============================================================================
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  telefono VARCHAR(20),
  rol rol_usuario NOT NULL DEFAULT 'voluntario general',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_ingreso DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE perfil_especialidad (
  perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre_especialidad VARCHAR(100) NOT NULL,
  PRIMARY KEY (perfil_id, nombre_especialidad)
);

ALTER TABLE perfil_especialidad ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Triggers
-- ============================================================================
CREATE TRIGGER trg_perfiles_updated_at
BEFORE UPDATE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- Crea el perfil automaticamente cuando se registra un usuario en auth.users, tomando
-- nombres/apellidos de los metadatos de registro si el cliente los envio. SECURITY
-- DEFINER porque perfiles tiene RLS habilitado y el registro ocurre antes de que el
-- usuario tenga una sesion con permisos sobre esa tabla.
CREATE OR REPLACE FUNCTION crear_perfil_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombres, apellidos, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombres', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellidos', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION crear_perfil_nuevo_usuario() IS
  'Crea el perfil correspondiente cada vez que se inserta un usuario en auth.users.';

CREATE TRIGGER trg_auth_users_crear_perfil
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION crear_perfil_nuevo_usuario();
