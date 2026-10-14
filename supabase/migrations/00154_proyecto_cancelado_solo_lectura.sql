-- ============================================================================
-- 00154: un proyecto cancelado ya no se modifica
-- ============================================================================
--
-- Desde la 00029 `cancelado` es un estado terminal: no se sale de el. Pero solo se bloqueaba el
-- cambio de estado; el resto seguia abierto. A un proyecto cancelado se le podia cambiar el nombre,
-- mover el avance, anotar en su bitacora, agregar y marcar hitos, armar su equipo, asociarle
-- jornadas y tocar sus insumos previstos. La organizacion pidio que un proyecto cancelado quede
-- como quedo: se consulta, no se edita.
--
-- Dos triggers:
--
-- 1. En `proyectos`, cualquier UPDATE de una fila cuyo estado ya era `cancelado` se rechaza.
--    Cancelar (en curso -> cancelado) sigue funcionando: ahi el estado anterior todavia no lo es.
-- 2. En las tablas que cuelgan del proyecto -hitos, bitacora de seguimiento, equipo, insumos
--    previstos- y en la asociacion de una jornada (`jornadas.proyecto_id`), se rechaza escribir si
--    el proyecto de la fila, el de antes o el de despues, esta cancelado.
--
-- No se tocan las jornadas en si ni lo que cuelga de ellas (su equipo, sus insumos, sus gastos,
-- sus pacientes): una jornada tiene su propio estado, y cancelar el proyecto no la cancela.
--
-- El error usa `object_not_in_prerequisite_state` (55000), que el cliente ya clasifica como regla
-- de negocio (errores-de-supabase.js).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La fila del proyecto
-- ----------------------------------------------------------------------------
-- Solo mira OLD: no consulta otras tablas, asi que no necesita SECURITY DEFINER.
CREATE FUNCTION public.fn_proyecto_cancelado_no_se_modifica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado = 'cancelado' THEN
    RAISE EXCEPTION 'El proyecto esta cancelado: ya no se puede modificar.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_proyecto_cancelado_no_se_modifica() IS
  'Rechaza cualquier UPDATE de un proyecto cuyo estado ya es cancelado (00154).';

REVOKE EXECUTE ON FUNCTION public.fn_proyecto_cancelado_no_se_modifica() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_proyectos_cancelado_no_se_modifica
BEFORE UPDATE ON public.proyectos
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_cancelado_no_se_modifica();

-- ----------------------------------------------------------------------------
-- 2. Lo que cuelga del proyecto
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: quien asocia una jornada por delegacion (jornadas.gestionar) puede no leer
-- `proyectos` por RLS, y con una consulta de su lado el proyecto cancelado no apareceria y el
-- trigger lo dejaria pasar. Solo lee el estado; no devuelve nada a quien escribe.
--
-- Mira el proyecto de antes (UPDATE, DELETE) y el de despues (INSERT, UPDATE): sacar una jornada
-- de un proyecto cancelado tambien es modificarlo. Si el proyecto ya no existe (un borrado en
-- cascada desde `proyectos`), no hay nada que proteger.
CREATE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_proyectos UUID[] := ARRAY[]::UUID[];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_proyectos := array_append(v_proyectos, OLD.proyecto_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_proyectos := array_append(v_proyectos, NEW.proyecto_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.proyectos p
    WHERE p.id = ANY (v_proyectos)
      AND p.estado = 'cancelado'
  ) THEN
    RAISE EXCEPTION 'El proyecto esta cancelado: ya no se puede modificar.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado() IS
  'Rechaza escribir una fila que cuelga de un proyecto cancelado: hitos, seguimiento, equipo, insumos previstos y la asociacion de una jornada (00154).';

REVOKE EXECUTE ON FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_proyecto_hitos_proyecto_no_cancelado
BEFORE INSERT OR UPDATE OR DELETE ON public.proyecto_hitos
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();

-- La bitacora no tiene UPDATE ni DELETE (00053): una bitacora no se corrige.
CREATE TRIGGER trg_proyecto_seguimiento_proyecto_no_cancelado
BEFORE INSERT ON public.proyecto_seguimiento
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();

CREATE TRIGGER trg_proyecto_personal_proyecto_no_cancelado
BEFORE INSERT OR UPDATE OR DELETE ON public.proyecto_personal
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();

CREATE TRIGGER trg_proyecto_insumos_proyecto_no_cancelado
BEFORE INSERT OR UPDATE OR DELETE ON public.proyecto_insumos
FOR EACH ROW
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();

-- En `jornadas` solo cuenta el proyecto: el resto de la jornada se sigue editando. El WHEN deja
-- pasar el UPDATE que manda el formulario completo con el mismo proyecto_id de siempre.
CREATE TRIGGER trg_jornadas_proyecto_no_cancelado_al_crear
BEFORE INSERT ON public.jornadas
FOR EACH ROW
WHEN (NEW.proyecto_id IS NOT NULL)
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();

CREATE TRIGGER trg_jornadas_proyecto_no_cancelado_al_asociar
BEFORE UPDATE OF proyecto_id ON public.jornadas
FOR EACH ROW
WHEN (OLD.proyecto_id IS DISTINCT FROM NEW.proyecto_id)
EXECUTE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado();
