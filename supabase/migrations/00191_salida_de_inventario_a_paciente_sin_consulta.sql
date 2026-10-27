-- Ecopac Digital - La salida de inventario a un paciente que no pasa a consulta (issue #964).
--
-- Hay pacientes que solo compran medicamentos y no pasan a consulta. Hasta aqui la unica salida
-- de inventario ligada a un paciente era la de una receta (fn_generar_receta, 00186), y una receta
-- cuelga de una consulta (recetas.consulta_id NOT NULL, 00019). La salida "Entrega a paciente" de
-- Inventario no decia a quien: el medicamento salia y no quedaba en ningun expediente.
--
-- POR QUE UNA COLUMNA EN movimientos_inventario Y NO UNA RECETA SIN CONSULTA
--
-- Hacer opcional recetas.consulta_id parecia lo directo, pero la consulta es el camino por el que
-- casi todo lo que lee recetas llega a la jornada y al paciente: el consumo de la jornada, los
-- reportes, la cola, la bodega de entrega (fn_bodega_de_entrega_de_consulta). Una receta sin
-- consulta se caeria en silencio de todos esos JOIN. La salida de Inventario ya existe, ya pasa por
-- la validacion de la administradora y ya descuenta existencias; lo unico que le faltaba era el
-- paciente.

-- ----------------------------------------------------------------------------
-- 1. El paciente de la salida
-- ----------------------------------------------------------------------------
ALTER TABLE public.movimientos_inventario
  ADD COLUMN paciente_id UUID REFERENCES public.pacientes (id) ON DELETE RESTRICT;

-- Solo una salida va a un paciente: un ingreso o un traslado no tienen a quien.
ALTER TABLE public.movimientos_inventario
  ADD CONSTRAINT chk_movimientos_inventario_paciente_solo_en_salida
    CHECK (paciente_id IS NULL OR tipo = 'salida');

CREATE INDEX idx_movimientos_inventario_paciente_id
  ON public.movimientos_inventario (paciente_id)
  WHERE paciente_id IS NOT NULL;

COMMENT ON COLUMN public.movimientos_inventario.paciente_id IS
  'Paciente al que se le entrego o vendio la salida sin pasar a consulta (00191, issue #964). Obligatorio al registrar una salida con motivo entrega; NULL en cualquier otro movimiento. La salida de una receta no lo usa: su paciente llega por receta_id.';

-- ----------------------------------------------------------------------------
-- 2. Una entrega a paciente nueva dice a quien
-- ----------------------------------------------------------------------------
-- Es un trigger de INSERT y no un CHECK a proposito. Las entregas ya registradas no tienen
-- paciente y no hay forma de saber cual era: un CHECK las haria invalidas, y uno NOT VALID se
-- volveria a evaluar al aprobar una que siga pendiente, o al corregir su motivo, y lo impediria.
-- Lo que se quiere es que ninguna entrega NUEVA salga sin paciente, y eso solo lo mira el INSERT.
CREATE FUNCTION public.fn_exigir_paciente_en_entrega()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.tipo = 'salida' AND NEW.motivo = 'entrega' AND NEW.paciente_id IS NULL THEN
    RAISE EXCEPTION 'Una entrega o venta a paciente dice a que paciente: elige al paciente.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_exigir_paciente_en_entrega() IS
  'Rechaza una salida nueva con motivo entrega que no indica el paciente (00191, issue #964). Solo al insertar: las entregas anteriores no tenian paciente y se pueden seguir aprobando.';

REVOKE EXECUTE ON FUNCTION public.fn_exigir_paciente_en_entrega() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_movimientos_inventario_exigir_paciente_en_entrega
BEFORE INSERT ON public.movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION public.fn_exigir_paciente_en_entrega();

COMMENT ON TRIGGER trg_movimientos_inventario_exigir_paciente_en_entrega
  ON public.movimientos_inventario IS
  'Una entrega o venta a paciente nueva tiene que decir a que paciente (00191).';

-- ----------------------------------------------------------------------------
-- 3. La fusion de pacientes mueve tambien estas salidas
-- ----------------------------------------------------------------------------
-- Cuerpo de la 00184 con un UPDATE mas: sin el, lo que se le entrego al expediente absorbido
-- quedaria colgado de un paciente dado de baja y no se veria en la ficha del que se conserva.
-- paciente_id no esta entre lo que fn_bloquear_movimiento_finalizado (00106) congela, y la
-- funcion solo la ejecuta la administradora, asi que puede cambiarlo tambien en lo ya aprobado.
CREATE OR REPLACE FUNCTION public.fn_fusionar_pacientes(
  p_sobreviviente_id UUID,
  p_absorbido_id UUID
)
RETURNS public.fusiones_pacientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expediente_sobreviviente UUID;
  v_expediente_absorbido UUID;
  v_fusion public.fusiones_pacientes;
  v_traslapadas INTEGER;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora puede fusionar expedientes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_sobreviviente_id = p_absorbido_id THEN
    RAISE EXCEPTION 'Un paciente no se puede fusionar consigo mismo.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.pacientes
    WHERE id IN (p_sobreviviente_id, p_absorbido_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El paciente sobreviviente o el absorbido no existen.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pacientes WHERE id = p_absorbido_id AND fecha_baja IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El expediente que se quiere absorber ya esta dado de baja o ya fue fusionado.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_expediente_sobreviviente FROM public.expedientes WHERE paciente_id = p_sobreviviente_id;
  SELECT id INTO v_expediente_absorbido FROM public.expedientes WHERE paciente_id = p_absorbido_id;

  UPDATE public.atenciones a
  SET paciente_id = p_sobreviviente_id
  WHERE a.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.atenciones s
      WHERE s.paciente_id = p_sobreviviente_id AND s.jornada_id = a.jornada_id
    );

  UPDATE public.padecimientos_cronicos p
  SET paciente_id = p_sobreviviente_id
  WHERE p.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.padecimientos_cronicos s
      WHERE s.paciente_id = p_sobreviviente_id AND s.condicion_id = p.condicion_id
    );

  -- 00184: las areas, sin duplicar. Las que el sobreviviente ya tiene se quedan con el absorbido.
  UPDATE public.paciente_area pa
  SET paciente_id = p_sobreviviente_id
  WHERE pa.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.paciente_area s
      WHERE s.paciente_id = p_sobreviviente_id AND s.area_id = pa.area_id
    );

  -- 00184: todas las citas. fn_validar_cita no revisa traslapes durante la fusion: si quedan
  -- traslapadas se conservan y se cuentan.
  PERFORM set_config('ecopac.fusionando_pacientes', 'on', TRUE);
  UPDATE public.citas c SET paciente_id = p_sobreviviente_id WHERE c.paciente_id = p_absorbido_id;
  PERFORM set_config('ecopac.fusionando_pacientes', 'off', TRUE);

  -- 00191: las salidas de inventario sin consulta, todas.
  UPDATE public.movimientos_inventario m
  SET paciente_id = p_sobreviviente_id
  WHERE m.paciente_id = p_absorbido_id;

  SELECT count(*)::INT INTO v_traslapadas
  FROM public.citas c
  WHERE c.paciente_id = p_sobreviviente_id
    AND c.estado <> 'cancelada'
    AND EXISTS (
      SELECT 1 FROM public.citas o
      WHERE o.paciente_id = p_sobreviviente_id
        AND o.id <> c.id
        AND o.estado <> 'cancelada'
        AND o.inicia_en < c.termina_en
        AND o.termina_en > c.inicia_en
    );

  IF v_expediente_absorbido IS NOT NULL AND v_expediente_sobreviviente IS NOT NULL THEN
    UPDATE public.consultas
    SET expediente_id = v_expediente_sobreviviente
    WHERE expediente_id = v_expediente_absorbido;
  ELSE
    RAISE EXCEPTION 'No se puede fusionar con seguridad: uno de los dos pacientes no tiene expediente.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.pacientes
  SET fecha_baja = CURRENT_DATE
  WHERE id = p_absorbido_id;

  INSERT INTO public.fusiones_pacientes (
    paciente_absorbido_id, paciente_sobreviviente_id, realizada_por, citas_traslapadas
  )
  VALUES (p_absorbido_id, p_sobreviviente_id, auth.uid(), v_traslapadas)
  RETURNING * INTO v_fusion;

  RETURN v_fusion;
END;
$$;
