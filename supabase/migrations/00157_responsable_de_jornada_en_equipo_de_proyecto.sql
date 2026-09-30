-- ============================================================================
-- 00157: el responsable de una jornada es parte del equipo del proyecto
-- ============================================================================
--
-- Desde la 00150 el equipo de un proyecto es la union de proyecto_personal y del cuadro de turnos
-- (jornada_personal) de sus jornadas. Quien organiza una jornada -jornadas.responsable_id- no
-- tiene por que tener un turno en ella, asi que quedaba fuera del equipo del proyecto aunque ya
-- pertenece a el para RLS: pertenece_a_jornada() (00141) lo cuenta, y pertenece_a_proyecto()
-- (00148) se apoya en ella. La administracion pidio que aparezca.
--
-- No se le crea una fila en jornada_personal: esa tabla es el cuadro de turnos, con horario y rol
-- obligatorios, y un turno inventado entraria en los traslapes y en el cuadro impreso. Se suma solo
-- en la lectura, igual que el personal de las jornadas.
--
-- El tipo de retorno no cambia, asi que alcanza CREATE OR REPLACE y conserva sus privilegios. La
-- regla de quien la ve tampoco cambia.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipo_de_proyecto(p_proyecto_id UUID)
RETURNS TABLE(
  id UUID,
  proyecto_id UUID,
  perfil_id UUID,
  rol_en_proyecto TEXT,
  created_at TIMESTAMPTZ,
  nombres VARCHAR,
  apellidos VARCHAR,
  en_equipo_del_proyecto BOOLEAN,
  jornadas TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH de_jornadas AS (
    -- El cuadro de turnos de cada jornada del proyecto y su responsable.
    SELECT d.perfil_id,
           array_agg(DISTINCT d.jornada ORDER BY d.jornada) AS jornadas,
           min(d.desde) AS desde
    FROM (
      SELECT jp.perfil_id, j.nombre::TEXT AS jornada, jp.created_at AS desde
      FROM public.jornada_personal jp
      JOIN public.jornadas j ON j.id = jp.jornada_id
      WHERE j.proyecto_id = p_proyecto_id
      UNION ALL
      SELECT j.responsable_id, j.nombre::TEXT, j.created_at
      FROM public.jornadas j
      WHERE j.proyecto_id = p_proyecto_id
    ) d
    GROUP BY d.perfil_id
  ),
  personas AS (
    SELECT pp.perfil_id FROM public.proyecto_personal pp WHERE pp.proyecto_id = p_proyecto_id
    UNION
    SELECT dj.perfil_id FROM de_jornadas dj
  )
  SELECT pp.id,
         p_proyecto_id,
         per.perfil_id,
         pp.rol_en_proyecto,
         coalesce(pp.created_at, dj.desde),
         pe.nombres,
         pe.apellidos,
         pp.id IS NOT NULL,
         coalesce(dj.jornadas, ARRAY[]::TEXT[])
  FROM personas per
  JOIN public.perfiles pe ON pe.id = per.perfil_id
  LEFT JOIN public.proyecto_personal pp
    ON pp.proyecto_id = p_proyecto_id AND pp.perfil_id = per.perfil_id
  LEFT JOIN de_jornadas dj ON dj.perfil_id = per.perfil_id
  WHERE public.es_administrador()
     OR public.tiene_permiso('proyectos.gestionar')
     OR public.pertenece_a_proyecto(p_proyecto_id)
     OR public.accede_a_modulo_por_matriz('proyectos')
  -- Primero el equipo asignado al proyecto, en el orden en que se armo; despues quien solo esta
  -- en sus jornadas.
  ORDER BY (pp.id IS NULL), coalesce(pp.created_at, dj.desde), pe.nombres;
$$;

COMMENT ON FUNCTION public.equipo_de_proyecto(UUID) IS
  'Equipo de un proyecto: la union de proyecto_personal, del cuadro de turnos de sus jornadas y de sus responsables, una fila por persona, con sus nombres (00150, 00157).';
