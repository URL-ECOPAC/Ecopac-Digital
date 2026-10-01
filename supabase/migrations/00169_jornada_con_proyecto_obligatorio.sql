-- ============================================================================
-- 00169: toda jornada pertenece a un proyecto
-- ============================================================================
--
-- Desde la 00012 `jornadas.proyecto_id` era opcional. La organizacion pidio que no lo sea: una
-- jornada siempre se planifica dentro de un proyecto, y lo que cuelga del proyecto -su
-- presupuesto (00040/00123), su equipo (00150), sus insumos previstos (00151), la caja del
-- sobrante (00168)- no ve a una jornada suelta.
--
-- No es un SET NOT NULL a proposito. Las bases ya desplegadas pueden tener jornadas sin proyecto,
-- y con ellas el ALTER abortaria y bloquearia todos los despliegues hasta que alguien las
-- asignara a mano. En cambio, dos triggers:
--
-- 1. Al crear una jornada, el proyecto es obligatorio.
-- 2. A una jornada no se le quita el proyecto. El WHEN solo mira un CAMBIO de proyecto_id: una
--    jornada antigua que todavia no tiene se sigue moviendo en el kanban y se sigue usando en
--    campo, y el formulario (validarJornada, packages/shared/jornadas) le pide el proyecto la
--    proxima vez que alguien la edite.
--
-- Los dos se llaman trg_jornadas_proyecto_obligatorio_* para dispararse DESPUES de los
-- trg_jornadas_proyecto_no_cancelado_* de la 00154 (los BEFORE corren en orden alfabetico): sacar
-- una jornada de un proyecto cancelado sigue respondiendo que el proyecto esta cancelado.
--
-- El error usa `not_null_violation` (23502), que el cliente ya traduce como "Falta un dato
-- obligatorio" (errores-de-supabase.js).
--
-- La llave foranea pasa de ON DELETE SET NULL a ON DELETE RESTRICT: borrar un proyecto dejaria
-- sus jornadas sin proyecto, justo lo que esta migracion impide. Hoy ningun rol puede borrar un
-- proyecto (no hay politica DELETE sobre `proyectos`), asi que no cambia nada para nadie.
-- ============================================================================

-- Solo mira NEW: no consulta otras tablas, asi que no necesita SECURITY DEFINER.
CREATE FUNCTION public.fn_jornada_exige_proyecto()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.proyecto_id IS NULL THEN
    RAISE EXCEPTION 'Toda jornada pertenece a un proyecto: elige uno.'
      USING ERRCODE = 'not_null_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_exige_proyecto() IS
  'Rechaza crear una jornada sin proyecto o quitarle el que tiene (00169).';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_exige_proyecto() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_proyecto_obligatorio_al_crear
BEFORE INSERT ON public.jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_jornada_exige_proyecto();

CREATE TRIGGER trg_jornadas_proyecto_obligatorio_al_cambiar
BEFORE UPDATE OF proyecto_id ON public.jornadas
FOR EACH ROW
WHEN (OLD.proyecto_id IS DISTINCT FROM NEW.proyecto_id)
EXECUTE FUNCTION public.fn_jornada_exige_proyecto();

ALTER TABLE public.jornadas DROP CONSTRAINT jornadas_proyecto_id_fkey;
ALTER TABLE public.jornadas
  ADD CONSTRAINT jornadas_proyecto_id_fkey
  FOREIGN KEY (proyecto_id) REFERENCES public.proyectos (id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.jornadas.proyecto_id IS
  'Proyecto social al que pertenece. Obligatorio al crear la jornada y no se puede quitar (00169); solo las jornadas anteriores a la 00169 pueden no tenerlo.';
