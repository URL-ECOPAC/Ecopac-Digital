-- ============================================================================
-- 00151: los insumos se planean por jornada
-- ============================================================================
--
-- Hasta aqui los insumos previstos se anotaban en el proyecto (proyecto_insumos, 00147). La
-- administracion decidio que se planean en cada jornada, igual que los gastos se registran contra
-- una jornada, y que el proyecto solo los muestra, agrupados por jornada, sin poder agregar.
--
-- jornada_insumos tiene la misma forma y las mismas reglas que proyecto_insumos: es una LISTA DE LO
-- PREVISTO, no mueve inventario (ver la cabecera de la 00147). Lo que cambia es de quien cuelga.
--
-- proyecto_insumos no se borra: sus filas son lo que ya se habia planeado a nivel proyecto y no
-- tienen jornada. La aplicacion las muestra como "sin jornada" y ofrece pasarlas a una jornada del
-- mismo proyecto con fn_pasar_insumo_de_proyecto_a_jornada(). No se agregan filas nuevas desde la
-- aplicacion.
-- ============================================================================

-- ============================================================================
-- 1. Tabla
-- ============================================================================
CREATE TABLE public.jornada_insumos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id) ON DELETE RESTRICT,
  cantidad INT NOT NULL,
  unidad VARCHAR(30) NOT NULL,
  costo_unitario_estimado NUMERIC(12, 2),
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un articulo figura una vez por jornada: cambiar cuanto se necesita es editar la fila.
  CONSTRAINT uq_jornada_insumos_articulo UNIQUE (jornada_id, medicamento_id),
  CONSTRAINT chk_jornada_insumos_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_jornada_insumos_unidad CHECK (length(btrim(unidad)) > 0),
  CONSTRAINT chk_jornada_insumos_costo CHECK (
    costo_unitario_estimado IS NULL OR costo_unitario_estimado >= 0
  ),
  CONSTRAINT chk_jornada_insumos_nota CHECK (
    nota IS NULL OR (length(btrim(nota)) > 0 AND length(nota) <= 500)
  )
);

COMMENT ON TABLE public.jornada_insumos IS
  'Articulos del catalogo de inventario PREVISTOS para una jornada: cantidad, unidad y costo unitario estimado. Lista de planificacion: no descuenta ni reserva existencias (mismo criterio que proyecto_insumos, 00147).';

COMMENT ON COLUMN public.jornada_insumos.costo_unitario_estimado IS
  'Costo estimado de UNA unidad, en quetzales. NULL cuando no se estimo. El total es cantidad x este valor y no se guarda.';

CREATE INDEX idx_jornada_insumos_medicamento_id ON public.jornada_insumos (medicamento_id);

CREATE TRIGGER trg_jornada_insumos_updated_at
BEFORE UPDATE ON public.jornada_insumos
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

-- ============================================================================
-- 2. RLS y privilegios
-- ============================================================================
-- Planificacion con dinero: la escribe quien administra la jornada (administradora o
-- jornadas.gestionar). La leen ellos, quien gestiona proyectos (el proyecto la muestra) y el rol al
-- que la matriz le abrio Jornadas o Proyectos. El personal de campo no la ve, igual que no ve los
-- insumos ni los gastos del proyecto (#864, 00148).
ALTER TABLE public.jornada_insumos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.jornada_insumos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jornada_insumos TO authenticated;

CREATE POLICY "Leen insumos de jornada quien administra o gestiona"
  ON public.jornada_insumos FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  );

CREATE POLICY "Administrador o jornadas.gestionar agregan insumos a jornadas"
  ON public.jornada_insumos FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE POLICY "Administrador o jornadas.gestionar actualizan insumos de jornadas"
  ON public.jornada_insumos FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE POLICY "Administrador o jornadas.gestionar quitan insumos de jornadas"
  ON public.jornada_insumos FOR DELETE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- ============================================================================
-- 3. Pasar un insumo planeado en el proyecto a una de sus jornadas
-- ============================================================================
-- SECURITY INVOKER: corre con la RLS de quien llama. Hace falta poder quitar la fila del proyecto
-- (proyectos.gestionar) y agregarla a la jornada (jornadas.gestionar); la administradora puede las
-- dos. Todo en una transaccion: o el insumo queda en la jornada y sale del proyecto, o nada cambia.
CREATE FUNCTION public.fn_pasar_insumo_de_proyecto_a_jornada(
  p_insumo_id UUID,
  p_jornada_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_insumo public.proyecto_insumos%ROWTYPE;
  v_nuevo_id UUID;
BEGIN
  SELECT * INTO v_insumo FROM public.proyecto_insumos WHERE id = p_insumo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El insumo no existe o no tienes permiso para verlo.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jornadas
    WHERE id = p_jornada_id AND proyecto_id = v_insumo.proyecto_id
  ) THEN
    RAISE EXCEPTION 'La jornada no pertenece al proyecto del insumo.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.jornada_insumos
    (jornada_id, medicamento_id, cantidad, unidad, costo_unitario_estimado, nota)
  VALUES
    (p_jornada_id, v_insumo.medicamento_id, v_insumo.cantidad, v_insumo.unidad,
     v_insumo.costo_unitario_estimado, v_insumo.nota)
  RETURNING id INTO v_nuevo_id;

  DELETE FROM public.proyecto_insumos WHERE id = p_insumo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para quitar el insumo del proyecto.'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_nuevo_id;
END;
$$;

COMMENT ON FUNCTION public.fn_pasar_insumo_de_proyecto_a_jornada(UUID, UUID) IS
  'Pasa un insumo previsto a nivel proyecto (proyecto_insumos) a una jornada de ese proyecto (jornada_insumos), en una sola transaccion (00151).';

REVOKE EXECUTE ON FUNCTION public.fn_pasar_insumo_de_proyecto_a_jornada(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pasar_insumo_de_proyecto_a_jornada(UUID, UUID) TO authenticated;
