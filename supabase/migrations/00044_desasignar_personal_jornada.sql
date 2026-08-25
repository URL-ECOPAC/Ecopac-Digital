-- Ecopac Digital - Permite desasignar personal de una jornada (issue #174, criterio 4)
--
-- jornada_personal solo tenia GRANT y politicas RLS para SELECT, INSERT y UPDATE (00039): ni
-- siquiera la administradora podia borrar una fila, porque sin GRANT DELETE el intento falla
-- con 42501 (insufficient_privilege) antes de que RLS llegue a evaluarse -- el mismo caso que
-- describe el comentario de jornada_estado_historial en esa misma migracion. Se agrega el GRANT
-- y una politica de DELETE que espeja exactamente las de INSERT y UPDATE: solo administrador.
--
-- personal_registro_atenciones() es la funcion que packages/shared/jornadas/api.js invoca por
-- RPC antes de intentar el DELETE, para cumplir la regla de negocio del criterio 4 ("no se
-- puede desasignar a alguien que ya registro atenciones en esa jornada"), que RLS no puede
-- expresar por si sola. Cuenta tanto una consulta medica (consultas.medico_id) como un triaje
-- (triajes.tomado_por): un voluntario que solo hizo triaje tambien dejo trazabilidad clinica que
-- se perderia si su asignacion desaparece, y consultas.medico_id por si solo no lo cubre.
-- SECURITY INVOKER, igual que presupuesto_de_jornada() (00040): la unica persona que de verdad
-- puede llegar al DELETE es la administradora (politica de abajo), que ya tiene SELECT sobre
-- consultas y triajes (00033), asi que no hace falta escalar privilegios con SECURITY DEFINER.

-- ============================================================================
-- DELETE de jornada_personal: solo administrador
-- ============================================================================
GRANT DELETE ON jornada_personal TO authenticated;

CREATE POLICY "Solo administrador desasigna personal de jornadas"
  ON jornada_personal FOR DELETE TO authenticated
  USING (public.es_administrador());

-- ============================================================================
-- Funcion de apoyo: ¿esta persona ya registro una atencion en esta jornada?
-- ============================================================================
CREATE OR REPLACE FUNCTION personal_registro_atenciones(p_jornada_id UUID, p_perfil_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.consultas c
      WHERE c.jornada_id = p_jornada_id AND c.medico_id = p_perfil_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.triajes t
      JOIN public.atenciones a ON a.id = t.atencion_id
      WHERE a.jornada_id = p_jornada_id AND t.tomado_por = p_perfil_id
    );
$$;

COMMENT ON FUNCTION personal_registro_atenciones(UUID, UUID) IS
  'Indica si un perfil ya registro trabajo clinico (una consulta o un triaje) en una jornada. La usa desasignarPersonal() de packages/shared/jornadas/api.js antes de borrar una fila de jornada_personal, para cumplir el criterio de aceptacion de la issue #174 que RLS no puede expresar por si solo. SECURITY INVOKER porque el unico llamador real es la administradora (la politica de DELETE de jornada_personal ya lo exige), que tiene SELECT sobre consultas y triajes.';

GRANT EXECUTE ON FUNCTION personal_registro_atenciones(UUID, UUID) TO authenticated;
