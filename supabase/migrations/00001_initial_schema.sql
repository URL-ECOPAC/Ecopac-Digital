-- Ecopac Digital - Esquema de base de datos (versionado)
-- Convenciones para todas las migraciones de esta carpeta:
--   - Una migracion por archivo, nombradas con prefijo numerico: 00001_, 00002_, ...
--   - Tablas y columnas en snake_case.
--   - RLS habilitado en todas las tablas: la base de datos es la ultima linea de defensa.
--   - Nunca se suben datos reales de pacientes (regla de confidencialidad).
--
-- Esta primera migracion define las extensiones, los tipos enumerados del dominio y la
-- funcion de timestamps que reutilizaran las migraciones siguientes al crear tablas.

-- ============================================================================
-- Extensiones
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() para llaves primarias UUID
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- busqueda por similitud de texto (trigramas)
CREATE EXTENSION IF NOT EXISTS unaccent; -- busqueda insensible a acentos
CREATE EXTENSION IF NOT EXISTS citext; -- texto case-insensitive (ej. email)
CREATE EXTENSION IF NOT EXISTS btree_gist; -- indices GiST para constraints de exclusion

-- ============================================================================
-- Tipos enumerados del dominio
-- ============================================================================
CREATE TYPE estado_jornada AS ENUM (
  'planificada',
  'en curso',
  'finalizada',
  'cancelada'
);

CREATE TYPE estado_movimiento AS ENUM (
  'pendiente de validacion',
  'aprobado',
  'rechazado'
);

CREATE TYPE tipo_movimiento AS ENUM (
  'ingreso compra',
  'ingreso donacion',
  'salida dispensacion',
  'salida ajuste',
  'traslado'
);

CREATE TYPE rol_usuario AS ENUM (
  'administrador',
  'junta directiva',
  'socio fundador',
  'medico',
  'voluntario general'
);

CREATE TYPE presentacion_medicamento AS ENUM (
  'tableta',
  'jarabe',
  'capsula',
  'inyectable',
  'pomada',
  'gotas ophthalmic',
  'gotas otic'
);

CREATE TYPE idioma_preferido AS ENUM (
  'espanol',
  'quiche',
  'mam',
  'otros'
);

-- ============================================================================
-- Funciones de soporte
-- ============================================================================
-- Actualiza la columna updated_at con la hora actual en cada UPDATE de fila.
-- Se usa como funcion de trigger BEFORE UPDATE en cada tabla que tenga la columna
-- updated_at (ver migraciones posteriores). search_path se fija vacio por buena
-- practica de seguridad, ya que la funcion no referencia objetos de ningun esquema.
CREATE OR REPLACE FUNCTION actualizar_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

COMMENT ON FUNCTION actualizar_timestamp_updated_at() IS
  'Actualiza automaticamente updated_at antes de cada UPDATE; usada por los triggers BEFORE UPDATE de las tablas con esa columna.';
