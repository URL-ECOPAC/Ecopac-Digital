-- ============================================================================
-- 00183: catalogo de clinicas (issue #927, seccion 2)
-- ============================================================================
--
-- Una clinica es donde se atiende una cita, y tiene un numero de salas: cuantas citas pueden
-- atenderse a la vez. La agenda (#927, seccion 3) valida contra ese numero.
--
-- 1. clinicas: nombre unico (sin distinguir mayusculas ni acentos), salas_disponibles > 0 y
--    es_vigente. Leen todas las sesiones activas; crean y editan la administradora y quien tiene
--    jornadas.gestionar; retirar (es_vigente = false) es solo de la administradora.
-- 2. fn_eliminar_clinica(): borrar una clinica que nunca tuvo citas, o retirarla si las tuvo. Lo
--    decide la base, no el cliente. Aqui todavia no existe la tabla citas, asi que borra; la
--    migracion de las citas la reemplaza con esa comprobacion y agrega la de las salas.
-- ============================================================================

CREATE TABLE public.clinicas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  salas_disponibles INTEGER NOT NULL,
  es_vigente BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_clinicas_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT chk_clinicas_salas_positivas CHECK (salas_disponibles > 0)
);

CREATE UNIQUE INDEX idx_clinicas_nombre_normalizado
  ON public.clinicas (lower(public.f_unaccent(btrim(nombre))));

COMMENT ON TABLE public.clinicas IS
  'Catalogo de clinicas donde se atienden las citas, con su numero de salas (issue #927, 00183). No se borra una clinica con citas: se retira con es_vigente (fn_eliminar_clinica).';
COMMENT ON COLUMN public.clinicas.id IS 'Identificador de la clinica.';
COMMENT ON COLUMN public.clinicas.nombre IS
  'Nombre de la clinica. Unico sin distinguir mayusculas ni acentos (idx_clinicas_nombre_normalizado).';
COMMENT ON COLUMN public.clinicas.salas_disponibles IS
  'Cuantas citas se pueden atender a la vez en la clinica. Mayor que cero. No baja de lo que ya hay agendado en algun horario futuro.';
COMMENT ON COLUMN public.clinicas.es_vigente IS
  'FALSE = retirada: no se ofrece al agendar, pero la conservan las citas que ya la tienen. Solo la administradora la retira (00148).';
COMMENT ON COLUMN public.clinicas.created_at IS 'Cuando se creo la clinica.';
COMMENT ON COLUMN public.clinicas.updated_at IS 'Ultima modificacion de la clinica.';
COMMENT ON INDEX public.idx_clinicas_nombre_normalizado IS
  'Una clinica por nombre, sin distinguir mayusculas, acentos ni espacios de los extremos (00183).';

CREATE TRIGGER trg_clinicas_updated_at
BEFORE UPDATE ON public.clinicas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

CREATE TRIGGER trg_impedir_retirar_clinica
BEFORE UPDATE OF es_vigente ON public.clinicas
FOR EACH ROW EXECUTE FUNCTION public.impedir_retirar_sin_ser_administrador();

CREATE TRIGGER trg_clinicas_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.clinicas
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria();

ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas TO authenticated;

CREATE POLICY "Sesion activa lee clinicas"
  ON public.clinicas FOR SELECT
  USING (public.rol_actual() IS NOT NULL);

CREATE POLICY "Administracion o jornadas.gestionar crea clinicas"
  ON public.clinicas FOR INSERT
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE POLICY "Administracion o jornadas.gestionar edita clinicas"
  ON public.clinicas FOR UPDATE
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- Borrar es de la administradora, y solo por fn_eliminar_clinica, que decide si se puede.
CREATE POLICY "Administracion borra clinicas"
  ON public.clinicas FOR DELETE
  USING (public.es_administrador());

-- ----------------------------------------------------------------------------
-- Eliminar una clinica
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER: la politica de DELETE (y la de UPDATE para retirar) decide quien puede.
-- Devuelve 'eliminada' o 'retirada'.
CREATE FUNCTION public.fn_eliminar_clinica(p_clinica_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora elimina una clinica.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = p_clinica_id) THEN
    RAISE EXCEPTION 'La clinica indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  DELETE FROM public.clinicas c WHERE c.id = p_clinica_id;
  RETURN 'eliminada';
END;
$$;

COMMENT ON FUNCTION public.fn_eliminar_clinica(UUID) IS
  'Borra una clinica que nunca tuvo citas; si las tuvo, la retira (es_vigente = false). Devuelve eliminada o retirada. Solo la administradora (00183; la comprobacion de citas la agrega la migracion de las citas).';

REVOKE EXECUTE ON FUNCTION public.fn_eliminar_clinica(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_eliminar_clinica(UUID) TO authenticated;
