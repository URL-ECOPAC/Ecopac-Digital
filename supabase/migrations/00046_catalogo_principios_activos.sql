-- Ecopac Digital - Administracion completa del catalogo de principios activos
--
-- 00034_politicas_rls_inventario.sql dejo principios_activos con SELECT e INSERT
-- (solo administrador crea), pero sin UPDATE ni DELETE: ni siquiera la administradora
-- podia editar o borrar una fila, porque sin GRANT el intento falla con 42501
-- (insufficient_privilege) antes de que RLS llegue a evaluarse -- mismo caso que
-- describe el comentario de 00044_desasignar_personal_jornada.sql para
-- jornada_personal. Se agregan el GRANT y las dos politicas que faltan, con el mismo
-- criterio que ya rige el resto del catalogo de inventario: solo administrador.
--
-- Ademas se agrega nombre_normalizado, para que el nombre del principio activo sea
-- unico y se pueda buscar sin distinguir acentos ni mayusculas (packages/shared,
-- "API del catalogo de principios activos"). El UNIQUE nombre_normalizado no
-- reemplaza el UNIQUE(nombre) de 00016: ese seguia sirviendo para el error mas comun
-- (nombre identico), este cubre el caso que no detectaba ("Paracetamol" vs
-- "paracétamol" deben tratarse como el mismo principio). Se usa una columna generada
-- y no una funcion de busqueda aparte para poder seguir filtrando con .ilike() desde
-- el cliente, igual que packages/shared/usuarios/api.js, sin introducir un patron de
-- busqueda distinto (RPC) solo para este modulo.

-- ============================================================================
-- UPDATE y DELETE de principios_activos: solo administrador
-- ============================================================================
GRANT UPDATE, DELETE ON principios_activos TO authenticated;

CREATE POLICY "Solo administrador edita principios_activos"
  ON principios_activos FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- El RESTRICT de medicamento_principio.principio_id (00016) ya impide borrar un
-- principio activo en uso: Postgres devuelve 23503 (foreign_key_violation) antes de
-- que esta politica importe. Esta politica solo decide QUIEN puede intentarlo.
CREATE POLICY "Solo administrador elimina principios_activos"
  ON principios_activos FOR DELETE TO authenticated
  USING (public.es_administrador());

-- ============================================================================
-- Nombre normalizado: unico y buscable sin acentos
-- ============================================================================
-- public.f_unaccent() es el wrapper IMMUTABLE de extensions.unaccent creado en
-- 00011_indices_busqueda_pacientes.sql; se reutiliza tal cual, sin duplicar logica de
-- normalizacion.
ALTER TABLE principios_activos
  ADD COLUMN nombre_normalizado VARCHAR(100)
  GENERATED ALWAYS AS (lower(public.f_unaccent(nombre))) STORED;

CREATE UNIQUE INDEX idx_principios_activos_nombre_normalizado
  ON principios_activos (nombre_normalizado);

COMMENT ON COLUMN principios_activos.nombre_normalizado IS
  'nombre en minusculas y sin acentos, calculado por la base de datos. Garantiza que dos nombres que solo difieren en acentos o mayusculas no coexistan, y es lo que packages/shared/inventario/principios-activos.api.js usa con .ilike() para buscar sin depender de como la persona haya escrito los acentos.';
