-- ============================================================================
-- 00150: el equipo de un proyecto es la union de su equipo y el de sus jornadas
-- ============================================================================
--
-- Hasta aqui equipo_de_proyecto() (00146, redefinida en la 00148) devolvia solo a quien estaba
-- asignado en proyecto_personal. Quien trabaja en una jornada del proyecto -el cuadro de turnos
-- de jornada_personal- no aparecia en el equipo del proyecto, aunque ya "pertenece" a el para RLS
-- (pertenece_a_proyecto(), 00148). La administracion pidio que el equipo del proyecto sea la union
-- de los dos.
--
-- Cada persona aparece una sola vez:
--   - en_equipo_del_proyecto: esta asignada en proyecto_personal (la unica que se puede quitar
--     desde el proyecto: la de una jornada se quita en su jornada).
--   - jornadas: los nombres de las jornadas del proyecto en cuyo cuadro de turnos esta.
--
-- Cambia el tipo de retorno (dos columnas nuevas), asi que no alcanza CREATE OR REPLACE: se borra y
-- se vuelve a crear, con sus mismos privilegios. La regla de quien la ve no cambia: es la de la
-- politica de SELECT de proyecto_personal (00148), repetida a mano porque la funcion es DEFINER.
-- ============================================================================

DROP FUNCTION public.equipo_de_proyecto(UUID);

CREATE FUNCTION public.equipo_de_proyecto(p_proyecto_id UUID)
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
    SELECT jp.perfil_id,
           array_agg(DISTINCT j.nombre ORDER BY j.nombre) AS jornadas,
           min(jp.created_at) AS desde
    FROM public.jornada_personal jp
    JOIN public.jornadas j ON j.id = jp.jornada_id
    WHERE j.proyecto_id = p_proyecto_id
    GROUP BY jp.perfil_id
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
  'Equipo de un proyecto: la union de proyecto_personal y del cuadro de turnos de sus jornadas, una fila por persona, con sus nombres (00150).';

REVOKE EXECUTE ON FUNCTION public.equipo_de_proyecto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipo_de_proyecto(UUID) TO authenticated;
