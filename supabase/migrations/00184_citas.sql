-- ============================================================================
-- 00184: agenda de citas por jornada, con consulta agendada (issue #927, secciones 3 y 4)
-- ============================================================================
--
-- Una cita es de un paciente, en una jornada, una clinica y un area, a una hora. Al atenderla se
-- registra la consulta de siempre, y esa consulta queda marcada como agendada (consultas.cita_id).
--
-- 1. estado_cita y la tabla citas.
-- 2. consultas.cita_id (UNIQUE: una consulta por cita) y consultas.area_id (el area en que se
--    atendio; las consultas anteriores quedan en NULL).
-- 3. fn_validar_cita (trigger): las reglas que la base hace cumplir, no solo el cliente.
--    - Cupo por clinica: en ningun momento las citas no canceladas que se traslapan superan
--      salas_disponibles. Resiste dos personas agendando a la vez: toma pg_advisory_xact_lock por
--      clinica antes de contar (un count(*) sin bloqueo deja pasar el exceso).
--    - Un paciente no tiene dos citas no canceladas que se traslapen; un profesional tampoco.
--    - El profesional esta en el cuadro de turnos de la jornada como medico. Puede faltar.
--    - Para agendar o mover una cita la jornada esta planificada o en curso, y la cita no es antes
--      de jornadas.fecha (en America/Guatemala). Para atenderla, la jornada esta en curso.
--    - No se agenda a un paciente dado de baja, ni en una clinica o un area retiradas.
--    - Transiciones: creada -> en_atencion -> atendida; creada -> cancelada; en_atencion ->
--      creada (se abrio por error); en_atencion -> cancelada. Atendida solo la pone la consulta.
--      Una cita atendida o cancelada ya no se edita, salvo las notas.
-- 4. Al guardar una consulta con cita_id, la cita pasa a atendida en la misma transaccion
--    (trigger en consultas), y si no tenia profesional, queda el que registro la consulta.
-- 5. Al cancelar o finalizar la jornada, sus citas creadas o en atencion se cancelan con su motivo.
-- 6. Clinicas: no se bajan las salas por debajo de lo agendado a futuro, y fn_eliminar_clinica
--    retira en vez de borrar la que ya tuvo citas (completa la 00183).
-- 7. vista_cola_jornada: una fila por atencion. Ya duplicaba al paciente por consulta x receta, y
--    con varias consultas por visita (una por cita) pasaria siempre.
-- 8. fn_fusionar_pacientes mueve citas y areas del absorbido; si quedan citas traslapadas se
--    conservan y la fusion lo dice (fusiones_pacientes.citas_traslapadas).
-- 9. RLS: ve la administradora, quien tiene jornadas.gestionar y el personal que pertenece a la
--    jornada; la junta directiva y los socios fundadores no ven citas.
--
-- Zona horaria: inicia_en y termina_en son timestamptz; las fechas se comparan y se muestran en
-- America/Guatemala, como la 00165.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La tabla
-- ----------------------------------------------------------------------------
CREATE TYPE public.estado_cita AS ENUM ('creada', 'en_atencion', 'atendida', 'cancelada');

COMMENT ON TYPE public.estado_cita IS
  'Estado de una cita (issue #927, 00184). En pantalla: Creado, En atencion, Atendido, Cancelado. Espejo de ESTADOS_CITA en packages/shared/citas/estados.js.';

CREATE TABLE public.citas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes (id) ON DELETE RESTRICT,
  jornada_id UUID NOT NULL REFERENCES public.jornadas (id) ON DELETE RESTRICT,
  clinica_id UUID NOT NULL REFERENCES public.clinicas (id) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES public.areas_atencion (id) ON DELETE RESTRICT,
  profesional_id UUID REFERENCES public.perfiles (id) ON DELETE SET NULL,
  inicia_en TIMESTAMPTZ NOT NULL,
  termina_en TIMESTAMPTZ NOT NULL,
  estado public.estado_cita NOT NULL DEFAULT 'creada',
  notas TEXT,
  registrada_por UUID DEFAULT auth.uid() REFERENCES public.perfiles (id) ON DELETE SET NULL,
  cancelada_por UUID REFERENCES public.perfiles (id) ON DELETE SET NULL,
  cancelada_en TIMESTAMPTZ,
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_citas_termina_despues CHECK (termina_en > inicia_en),
  CONSTRAINT chk_citas_cancelacion CHECK ((estado = 'cancelada') = (cancelada_en IS NOT NULL))
);

CREATE INDEX idx_citas_clinica_horario ON public.citas (clinica_id, inicia_en, termina_en)
  WHERE estado <> 'cancelada';
CREATE INDEX idx_citas_paciente ON public.citas (paciente_id);
CREATE INDEX idx_citas_jornada ON public.citas (jornada_id, inicia_en);
CREATE INDEX idx_citas_profesional ON public.citas (profesional_id) WHERE profesional_id IS NOT NULL;

COMMENT ON TABLE public.citas IS
  'Agenda de citas: un paciente, en una jornada, una clinica y un area, a una hora (issue #927, 00184). No se borran: se cancelan. La consulta que sale de una cita la referencia con consultas.cita_id.';
COMMENT ON COLUMN public.citas.id IS 'Identificador de la cita.';
COMMENT ON COLUMN public.citas.paciente_id IS 'Paciente de la cita. No se agenda a uno dado de baja.';
COMMENT ON COLUMN public.citas.jornada_id IS 'Jornada en que se atiende. Planificada o en curso para agendar; en curso para atender.';
COMMENT ON COLUMN public.citas.clinica_id IS 'Clinica donde se atiende; su cupo es salas_disponibles.';
COMMENT ON COLUMN public.citas.area_id IS 'Area de atencion de la cita; pasa a la consulta (consultas.area_id).';
COMMENT ON COLUMN public.citas.profesional_id IS
  'Quien va a registrar la consulta: un medico del cuadro de turnos de la jornada, sin dos citas traslapadas. Opcional al agendar; si falta, queda quien registra la consulta.';
COMMENT ON COLUMN public.citas.inicia_en IS 'Inicio de la cita. No antes de la fecha de la jornada (America/Guatemala).';
COMMENT ON COLUMN public.citas.termina_en IS 'Fin de la cita; por defecto inicia_en + 30 minutos, siempre despues de inicia_en.';
COMMENT ON COLUMN public.citas.estado IS 'creada, en_atencion, atendida o cancelada; transiciones en fn_validar_cita.';
COMMENT ON COLUMN public.citas.notas IS 'Notas libres. Es lo unico que se edita en una cita atendida o cancelada.';
COMMENT ON COLUMN public.citas.registrada_por IS 'Quien agendo la cita (DEFAULT auth.uid()).';
COMMENT ON COLUMN public.citas.cancelada_por IS 'Quien la cancelo, o quien cerro o cancelo la jornada cuando la cancelo ese cambio (motivo_cancelacion lo dice).';
COMMENT ON COLUMN public.citas.cancelada_en IS 'Cuando se cancelo. Presente si y solo si estado = cancelada.';
COMMENT ON COLUMN public.citas.motivo_cancelacion IS 'Por que se cancelo (opcional).';
COMMENT ON COLUMN public.citas.created_at IS 'Cuando se agendo.';
COMMENT ON COLUMN public.citas.updated_at IS 'Ultima modificacion.';

CREATE TRIGGER trg_citas_updated_at
BEFORE UPDATE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

CREATE TRIGGER trg_citas_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria();

-- ----------------------------------------------------------------------------
-- 2. La consulta agendada
-- ----------------------------------------------------------------------------
ALTER TABLE public.consultas
  ADD COLUMN cita_id UUID UNIQUE REFERENCES public.citas (id) ON DELETE RESTRICT,
  ADD COLUMN area_id UUID REFERENCES public.areas_atencion (id) ON DELETE RESTRICT;

CREATE INDEX idx_consultas_area ON public.consultas (area_id) WHERE area_id IS NOT NULL;

COMMENT ON COLUMN public.consultas.cita_id IS
  'La cita de la que salio la consulta (00184): es lo que la marca como agendada. UNIQUE: una consulta por cita. NULL en una consulta sin cita.';
COMMENT ON COLUMN public.consultas.area_id IS
  'Area de atencion de la consulta (00184). Con cita, la de la cita; sin cita, opcional. Las consultas anteriores quedan en NULL.';

-- ----------------------------------------------------------------------------
-- 3. Las reglas de la cita
-- ----------------------------------------------------------------------------
-- Concurrencia simultanea maxima de las citas no canceladas de una clinica dentro de un intervalo,
-- sin contar una cita (la que se esta guardando). Devuelve la cuenta y el momento en que ocurre.
-- La concurrencia maxima de un intervalo se alcanza en un inicio: el del propio intervalo o el de
-- alguna cita que empieza dentro de el.
CREATE FUNCTION public.fn_maximo_de_citas_simultaneas(
  p_clinica_id UUID,
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ,
  p_excluir_id UUID DEFAULT NULL,
  OUT cantidad INTEGER,
  OUT momento TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH puntos AS (
    SELECT p_desde AS punto
    UNION
    SELECT o.inicia_en
    FROM public.citas o
    WHERE o.clinica_id = p_clinica_id
      AND o.estado <> 'cancelada'
      AND o.id IS DISTINCT FROM p_excluir_id
      AND o.inicia_en > p_desde
      AND o.inicia_en < p_hasta
  )
  SELECT
    (SELECT count(*)::INT FROM public.citas o
      WHERE o.clinica_id = p_clinica_id
        AND o.estado <> 'cancelada'
        AND o.id IS DISTINCT FROM p_excluir_id
        AND o.inicia_en <= pu.punto
        AND o.termina_en > pu.punto) AS cantidad,
    pu.punto AS momento
  FROM puntos pu
  ORDER BY 1 DESC, 2
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_maximo_de_citas_simultaneas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) IS
  'Cuantas citas no canceladas de la clinica coinciden a la vez como maximo dentro del intervalo, y en que momento (00184). La usan fn_validar_cita y la regla de salas de clinicas.';

REVOKE EXECUTE ON FUNCTION public.fn_maximo_de_citas_simultaneas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_maximo_de_citas_simultaneas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID)
  TO authenticated;

-- Una fecha y hora como se lee en Guatemala, para los mensajes.
CREATE FUNCTION public.fn_texto_de_hora_guatemala(p_momento TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT to_char(p_momento AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI');
$$;

COMMENT ON FUNCTION public.fn_texto_de_hora_guatemala(TIMESTAMPTZ) IS
  'Fecha y hora en America/Guatemala (DD/MM/YYYY HH24:MI) para los mensajes de la agenda (00184).';

REVOKE EXECUTE ON FUNCTION public.fn_texto_de_hora_guatemala(TIMESTAMPTZ) FROM PUBLIC, anon;

-- SECURITY DEFINER: cuenta citas de jornadas que quien agenda quiza no ve (una clinica se usa en
-- varias jornadas), y lee jornadas, pacientes y el cuadro de turnos sin depender de su RLS.
CREATE FUNCTION public.fn_validar_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_salas INTEGER;
  v_maximo RECORD;
  v_fusionando BOOLEAN := current_setting('ecopac.fusionando_pacientes', TRUE) = 'on';
  v_por_consulta BOOLEAN := current_setting('ecopac.cita_atendida_por_consulta', TRUE) = 'on';
  v_cambia_agenda BOOLEAN;
BEGIN
  IF NEW.termina_en IS NULL AND NEW.inicia_en IS NOT NULL THEN
    NEW.termina_en := NEW.inicia_en + INTERVAL '30 minutes';
  END IF;

  -- La fusion solo cambia el paciente: lo demas de la cita se queda como estaba.
  IF TG_OP = 'UPDATE' AND v_fusionando THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'creada' THEN
      RAISE EXCEPTION 'Una cita nueva nace creada.' USING ERRCODE = 'check_violation';
    END IF;
    v_cambia_agenda := TRUE;
  ELSE
    -- Una cita atendida o cancelada ya no se edita, salvo las notas.
    IF OLD.estado IN ('atendida', 'cancelada') THEN
      IF (to_jsonb(NEW) - 'notas' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'notas' - 'updated_at') THEN
        RAISE EXCEPTION 'Una cita % ya no se edita; solo sus notas.', OLD.estado
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;

    -- Transiciones.
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      IF NOT (
        (OLD.estado = 'creada' AND NEW.estado IN ('en_atencion', 'cancelada'))
        OR (OLD.estado = 'en_atencion' AND NEW.estado IN ('creada', 'atendida', 'cancelada'))
      ) THEN
        RAISE EXCEPTION 'Una cita no pasa de % a %.', OLD.estado, NEW.estado
          USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.estado = 'atendida' AND NOT v_por_consulta THEN
        RAISE EXCEPTION 'Una cita queda atendida al guardar su consulta, no a mano.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    -- La consulta la marca atendida y pone su profesional si faltaba (fn_consulta_de_cita_despues):
    -- ese cambio no es reagendar, y quien la atiende puede ser la administradora.
    IF v_por_consulta THEN
      RETURN NEW;
    END IF;

    v_cambia_agenda := (NEW.paciente_id, NEW.jornada_id, NEW.clinica_id, NEW.area_id,
                        NEW.profesional_id, NEW.inicia_en, NEW.termina_en)
      IS DISTINCT FROM (OLD.paciente_id, OLD.jornada_id, OLD.clinica_id, OLD.area_id,
                        OLD.profesional_id, OLD.inicia_en, OLD.termina_en);

    IF v_cambia_agenda AND OLD.estado <> 'creada' THEN
      RAISE EXCEPTION 'Solo se cambia la agenda de una cita creada.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Cancelar: quien y cuando. Al salir de cancelada no se vuelve (no hay esa transicion).
  IF NEW.estado = 'cancelada' THEN
    NEW.cancelada_en := COALESCE(NEW.cancelada_en, now());
    NEW.cancelada_por := COALESCE(NEW.cancelada_por, auth.uid());
    RETURN NEW;
  END IF;

  SELECT j.estado, j.fecha INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  -- Atender: con la jornada en curso.
  IF TG_OP = 'UPDATE' AND NEW.estado = 'en_atencion' AND OLD.estado = 'creada'
     AND v_jornada.estado <> 'en curso' THEN
    RAISE EXCEPTION 'Una cita se atiende con la jornada en curso.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF NOT v_cambia_agenda THEN
    RETURN NEW;
  END IF;

  IF v_jornada.estado NOT IN ('planificada', 'en curso') THEN
    RAISE EXCEPTION 'Solo se agenda en una jornada planificada o en curso.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF (NEW.inicia_en AT TIME ZONE 'America/Guatemala')::DATE < v_jornada.fecha THEN
    RAISE EXCEPTION 'La cita no puede ser antes de la fecha de la jornada (%).',
      to_char(v_jornada.fecha, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = NEW.paciente_id AND p.fecha_baja IS NOT NULL) THEN
    RAISE EXCEPTION 'El paciente esta dado de baja: no se le agendan citas.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id)
     AND NOT EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = NEW.clinica_id AND c.es_vigente) THEN
    RAISE EXCEPTION 'La clinica esta retirada: no se agenda en ella.' USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.area_id IS DISTINCT FROM OLD.area_id)
     AND NOT EXISTS (SELECT 1 FROM public.areas_atencion a WHERE a.id = NEW.area_id AND a.es_vigente) THEN
    RAISE EXCEPTION 'El area esta retirada: no se agenda en ella.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.profesional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.jornada_personal jp
    JOIN public.perfiles pe ON pe.id = jp.perfil_id
    WHERE jp.jornada_id = NEW.jornada_id
      AND jp.perfil_id = NEW.profesional_id
      AND jp.rol_en_jornada = 'medico'
      AND pe.activo
  ) THEN
    RAISE EXCEPTION 'El profesional tiene que estar como medico en el cuadro de turnos de la jornada.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloqueos, siempre en el mismo orden (clinica, paciente, profesional) para no trabarse con otra
  -- transaccion que agenda a la vez. Duran hasta el fin de la transaccion.
  PERFORM pg_advisory_xact_lock(hashtextextended('cita_clinica:' || NEW.clinica_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('cita_paciente:' || NEW.paciente_id::TEXT, 0));
  IF NEW.profesional_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('cita_profesional:' || NEW.profesional_id::TEXT, 0));
  END IF;

  -- Primero lo del paciente y el profesional, que es lo mas especifico; despues el cupo.
  IF EXISTS (
    SELECT 1 FROM public.citas o
    WHERE o.paciente_id = NEW.paciente_id
      AND o.id IS DISTINCT FROM NEW.id
      AND o.estado <> 'cancelada'
      AND o.inicia_en < NEW.termina_en
      AND o.termina_en > NEW.inicia_en
  ) THEN
    RAISE EXCEPTION 'El paciente ya tiene otra cita a esa hora.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.profesional_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.citas o
    WHERE o.profesional_id = NEW.profesional_id
      AND o.id IS DISTINCT FROM NEW.id
      AND o.estado <> 'cancelada'
      AND o.inicia_en < NEW.termina_en
      AND o.termina_en > NEW.inicia_en
  ) THEN
    RAISE EXCEPTION 'El profesional ya tiene otra cita a esa hora.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT c.salas_disponibles INTO v_salas FROM public.clinicas c WHERE c.id = NEW.clinica_id;
  SELECT * INTO v_maximo
  FROM public.fn_maximo_de_citas_simultaneas(NEW.clinica_id, NEW.inicia_en, NEW.termina_en, NEW.id);

  IF COALESCE(v_maximo.cantidad, 0) + 1 > v_salas THEN
    RAISE EXCEPTION 'La clinica ya tiene sus % salas ocupadas el %.', v_salas,
      public.fn_texto_de_hora_guatemala(v_maximo.momento)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_validar_cita() IS
  'Reglas de la cita (00184): cupo de la clinica con bloqueo, traslapes de paciente y profesional, profesional del cuadro de turnos, estado de la jornada, fecha, paciente sin baja, clinica y area vigentes, transiciones e inmutabilidad de la atendida o cancelada.';

REVOKE EXECUTE ON FUNCTION public.fn_validar_cita() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_citas_validar
BEFORE INSERT OR UPDATE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_cita();

-- ----------------------------------------------------------------------------
-- 4. La consulta de una cita
-- ----------------------------------------------------------------------------
-- Antes: la cita tiene que estar en atencion, ser del mismo paciente y jornada, y la consulta toma
-- su area. Si la cita tiene profesional, solo el o la administradora registran la consulta.
CREATE FUNCTION public.fn_consulta_de_cita_antes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cita RECORD;
BEGIN
  IF NEW.cita_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.*, e.id AS expediente_id INTO v_cita
  FROM public.citas c
  LEFT JOIN public.expedientes e ON e.paciente_id = c.paciente_id
  WHERE c.id = NEW.cita_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cita indicada no existe.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.cita_id IS NOT DISTINCT FROM NEW.cita_id THEN
    NEW.area_id := v_cita.area_id;
    RETURN NEW;
  END IF;

  IF v_cita.estado <> 'en_atencion' THEN
    RAISE EXCEPTION 'Abre la cita con Atender antes de registrar su consulta.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_cita.jornada_id <> NEW.jornada_id OR v_cita.expediente_id IS DISTINCT FROM NEW.expediente_id THEN
    RAISE EXCEPTION 'La consulta no es del paciente y la jornada de la cita.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_cita.profesional_id IS NOT NULL
     AND v_cita.profesional_id <> NEW.medico_id
     AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Esta cita la atiende otro profesional.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.area_id := v_cita.area_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_consulta_de_cita_antes() IS
  'Antes de guardar una consulta con cita (00184): la cita esta en atencion, es del mismo paciente y jornada, la atiende su profesional o la administradora, y la consulta toma el area de la cita.';

REVOKE EXECUTE ON FUNCTION public.fn_consulta_de_cita_antes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_consultas_cita_antes
BEFORE INSERT OR UPDATE OF cita_id, area_id ON public.consultas
FOR EACH ROW EXECUTE FUNCTION public.fn_consulta_de_cita_antes();

-- Despues: la cita pasa a atendida en la misma transaccion, y si no tenia profesional queda el de
-- la consulta.
CREATE FUNCTION public.fn_consulta_de_cita_despues()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.cita_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.cita_id IS NOT DISTINCT FROM NEW.cita_id) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('ecopac.cita_atendida_por_consulta', 'on', TRUE);
  UPDATE public.citas c
  SET estado = 'atendida',
      profesional_id = COALESCE(c.profesional_id, NEW.medico_id)
  WHERE c.id = NEW.cita_id;
  PERFORM set_config('ecopac.cita_atendida_por_consulta', 'off', TRUE);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_consulta_de_cita_despues() IS
  'Despues de guardar una consulta con cita (00184): la cita pasa a atendida y, si no tenia profesional, queda quien registro la consulta.';

REVOKE EXECUTE ON FUNCTION public.fn_consulta_de_cita_despues() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_consultas_cita_despues
AFTER INSERT OR UPDATE OF cita_id ON public.consultas
FOR EACH ROW EXECUTE FUNCTION public.fn_consulta_de_cita_despues();

-- ----------------------------------------------------------------------------
-- 5. Cancelar o finalizar la jornada cancela sus citas pendientes
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_jornada_cancela_citas_pendientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado OR NEW.estado NOT IN ('cancelada', 'finalizada') THEN
    RETURN NEW;
  END IF;

  UPDATE public.citas c
  SET estado = 'cancelada',
      cancelada_en = now(),
      motivo_cancelacion = CASE NEW.estado
        WHEN 'cancelada' THEN 'Jornada cancelada'
        ELSE 'No atendida al cerrar la jornada'
      END
  WHERE c.jornada_id = NEW.id
    AND c.estado IN ('creada', 'en_atencion');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_cancela_citas_pendientes() IS
  'Al cancelar o finalizar una jornada, cancela sus citas creadas o en atencion con el motivo que corresponde (00184).';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_cancela_citas_pendientes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_cancela_citas_pendientes
AFTER UPDATE OF estado ON public.jornadas
FOR EACH ROW EXECUTE FUNCTION public.fn_jornada_cancela_citas_pendientes();

-- ----------------------------------------------------------------------------
-- 6. Clinicas: salas y eliminacion
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_clinica_salas_cubren_lo_agendado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_peor RECORD;
BEGIN
  IF NEW.salas_disponibles >= OLD.salas_disponibles THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cita_clinica:' || NEW.id::TEXT, 0));

  -- Lo agendado a futuro: en cada inicio de una cita que no termino, cuantas coinciden.
  SELECT x.cantidad, x.momento INTO v_peor
  FROM public.citas c
  CROSS JOIN LATERAL public.fn_maximo_de_citas_simultaneas(NEW.id, c.inicia_en, c.termina_en, c.id) x
  WHERE c.clinica_id = NEW.id
    AND c.estado <> 'cancelada'
    AND c.termina_en > now()
  ORDER BY x.cantidad DESC, x.momento
  LIMIT 1;

  IF FOUND AND v_peor.cantidad + 1 > NEW.salas_disponibles THEN
    RAISE EXCEPTION 'No se puede bajar a % salas: el % hay % citas a la vez.',
      NEW.salas_disponibles, public.fn_texto_de_hora_guatemala(v_peor.momento), v_peor.cantidad + 1
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_clinica_salas_cubren_lo_agendado() IS
  'Rechaza bajar salas_disponibles por debajo de las citas que ya coinciden en algun horario futuro, diciendo en que fecha y hora (00184).';

REVOKE EXECUTE ON FUNCTION public.fn_clinica_salas_cubren_lo_agendado() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_clinicas_salas_cubren_lo_agendado
BEFORE UPDATE OF salas_disponibles ON public.clinicas
FOR EACH ROW EXECUTE FUNCTION public.fn_clinica_salas_cubren_lo_agendado();

CREATE OR REPLACE FUNCTION public.fn_eliminar_clinica(p_clinica_id UUID)
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

  -- Con citas, cualquiera, no se borra: se retira y las conserva.
  IF EXISTS (SELECT 1 FROM public.citas c WHERE c.clinica_id = p_clinica_id) THEN
    UPDATE public.clinicas c SET es_vigente = FALSE WHERE c.id = p_clinica_id;
    RETURN 'retirada';
  END IF;

  DELETE FROM public.clinicas c WHERE c.id = p_clinica_id;
  RETURN 'eliminada';
END;
$$;

COMMENT ON FUNCTION public.fn_eliminar_clinica(UUID) IS
  'Borra una clinica que nunca tuvo citas; si las tuvo, la retira (es_vigente = false). Devuelve eliminada o retirada. Solo la administradora (00183, 00184).';

-- ----------------------------------------------------------------------------
-- 7. La cola de la jornada: una fila por atencion
-- ----------------------------------------------------------------------------
-- Mismas columnas y en el mismo orden que la 00136, asi CREATE OR REPLACE conserva el GRANT.
CREATE OR REPLACE VIEW public.vista_cola_jornada AS
SELECT
  a.id           AS atencion_id,
  a.jornada_id,
  a.paciente_id,
  p.nombres,
  p.apellidos,
  a.created_at   AS iniciada_en,

  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.consultas c JOIN public.recetas r ON r.consulta_id = c.id
      WHERE c.atencion_id = a.id
    ) THEN 'espera entrega'
    WHEN ultima.creada_en IS NOT NULL THEN 'lista para cerrar'
    WHEN t.id IS NOT NULL THEN 'espera consulta'
    ELSE 'espera triaje'
  END AS etapa,

  CASE
    WHEN ultima.creada_en IS NOT NULL THEN ultima.creada_en
    WHEN t.id IS NOT NULL THEN t.created_at
    ELSE a.created_at
  END AS esperando_desde

FROM public.atenciones a
JOIN public.pacientes p ON p.id = a.paciente_id
LEFT JOIN public.triajes t ON t.atencion_id = a.id
LEFT JOIN LATERAL (
  SELECT max(c.created_at) AS creada_en FROM public.consultas c WHERE c.atencion_id = a.id
) ultima ON TRUE
WHERE a.cerrada_en IS NULL
  AND (public.es_administrador() OR public.participa_en_jornada(a.jornada_id));

COMMENT ON VIEW public.vista_cola_jornada IS
  'Cola de pacientes de una jornada, por etapa del flujo (issue #173, RF-24): una fila por atencion abierta. La etapa se decide de lo mas avanzado a lo menos (00136). Desde la 00184 (issue #927) una visita con varias consultas o recetas no repite al paciente.';

-- ----------------------------------------------------------------------------
-- 8. Fusion de pacientes
-- ----------------------------------------------------------------------------
ALTER TABLE public.fusiones_pacientes
  ADD COLUMN citas_traslapadas INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fusiones_pacientes.citas_traslapadas IS
  'Cuantas citas no canceladas del sobreviviente quedaron traslapadas con otra suya tras la fusion (00184). Se conservan; la pantalla lo avisa.';

-- Cuerpo de la 00119, con las areas y las citas.
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

-- ----------------------------------------------------------------------------
-- 9. Permisos
-- ----------------------------------------------------------------------------
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

-- Sin DELETE: las citas se cancelan.
GRANT SELECT, INSERT, UPDATE ON public.citas TO authenticated;

-- La junta directiva y los socios fundadores no ven citas: tampoco leen datos de pacientes
-- (docs/PROTECCION-DE-DATOS.md).
CREATE POLICY "Administracion, gestion de jornadas y su personal leen citas"
  ON public.citas FOR SELECT
  USING (
    NOT public.es_consultivo()
    AND (
      public.es_administrador()
      OR public.tiene_permiso('jornadas.gestionar')
      OR public.pertenece_a_jornada(jornada_id)
    )
  );

CREATE POLICY "Administracion, gestion de jornadas y su personal de campo agendan citas"
  ON public.citas FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR (public.es_personal_de_campo() AND public.pertenece_a_jornada(jornada_id))
  );

CREATE POLICY "Administracion, gestion de jornadas y su personal de campo editan citas"
  ON public.citas FOR UPDATE
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR (public.es_personal_de_campo() AND public.pertenece_a_jornada(jornada_id))
  )
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR (public.es_personal_de_campo() AND public.pertenece_a_jornada(jornada_id))
  );
