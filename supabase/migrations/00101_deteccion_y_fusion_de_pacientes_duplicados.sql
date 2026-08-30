-- Ecopac Digital - Deteccion y fusion de expedientes duplicados (issue #140, RF-06)
--
-- Sin DPI obligatorio y con registro en campo por varias personas a la vez, un mismo paciente
-- puede terminar con dos expedientes. Esta migracion agrega:
--   1. fusiones_pacientes: registra que expediente absorbio a cual (criterio de aceptacion 4).
--   2. fn_detectar_pacientes_duplicados(): posibles duplicados por similitud de nombre y misma
--      fecha de nacimiento, reusando el indice de trigramas que ya existe (00011) y el patron de
--      pg_trgm ya probado en fn_buscar_pacientes (00068).
--   3. fn_fusionar_pacientes(): fusiona dos expedientes en una transaccion, solo administrador.
--
-- ============================================================================
-- 1. fusiones_pacientes
-- ============================================================================
-- paciente_absorbido_id es UNIQUE: un paciente no se puede fusionar dos veces. Sin politicas de
-- INSERT/UPDATE/DELETE -con RLS habilitado, lo que no tiene politica esta prohibido-: el unico
-- que escribe es fn_fusionar_pacientes(), SECURITY DEFINER, mismo criterio que eventos_auditoria
-- (00026) con su trigger.
--
-- GRANT SELECT va en esta misma migracion, no como arreglo posterior: eventos_auditoria (00026)
-- declaro su politica de SELECT sin el GRANT correspondiente y quedo inalcanzable por PostgREST
-- hasta que la 00038 lo corrigio. No se repite ese olvido aqui.
CREATE TABLE fusiones_pacientes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  paciente_absorbido_id UUID UNIQUE NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  paciente_sobreviviente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  realizada_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  realizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fusiones_pacientes_no_autofusion
    CHECK (paciente_absorbido_id <> paciente_sobreviviente_id)
);

CREATE INDEX idx_fusiones_pacientes_sobreviviente_id
  ON fusiones_pacientes (paciente_sobreviviente_id);

ALTER TABLE fusiones_pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo administrador lee fusiones_pacientes"
  ON fusiones_pacientes FOR SELECT TO authenticated
  USING (public.es_administrador());

GRANT SELECT ON fusiones_pacientes TO authenticated;

COMMENT ON TABLE fusiones_pacientes IS
  'Registra que expediente absorbio a cual (issue #140). Se escribe solo por fn_fusionar_pacientes; sin politicas de escritura.';

-- ============================================================================
-- 2. fn_detectar_pacientes_duplicados()
-- ============================================================================
-- Carga pg_trgm en esta sesion para que la clausula SET de abajo tenga una GUC real que fijar y
-- no un placeholder que exigiria superusuario (mismo problema documentado en la 00068). Sin
-- efectos: devuelve 0.
SELECT extensions.similarity('', '');

CREATE OR REPLACE FUNCTION fn_detectar_pacientes_duplicados()
RETURNS TABLE (
  paciente_a_id UUID,
  nombres_a VARCHAR,
  apellidos_a VARCHAR,
  numero_ficha_a VARCHAR,
  paciente_b_id UUID,
  nombres_b VARCHAR,
  apellidos_b VARCHAR,
  numero_ficha_b VARCHAR,
  fecha_nacimiento DATE,
  similitud REAL
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
SET pg_trgm.similarity_threshold = 0.4
AS $$
  SELECT
    a.id,
    a.nombres,
    a.apellidos,
    ea.numero_ficha,
    b.id,
    b.nombres,
    b.apellidos,
    eb.numero_ficha,
    a.fecha_nacimiento,
    extensions.similarity(
      lower(public.f_unaccent(a.nombres || ' ' || a.apellidos)),
      lower(public.f_unaccent(b.nombres || ' ' || b.apellidos))
    ) AS similitud
  FROM public.pacientes a
  JOIN public.pacientes b
    ON a.id < b.id
    AND a.fecha_nacimiento = b.fecha_nacimiento
    AND lower(public.f_unaccent(a.nombres || ' ' || a.apellidos))
        OPERATOR(extensions.%) lower(public.f_unaccent(b.nombres || ' ' || b.apellidos))
  LEFT JOIN public.expedientes ea ON ea.paciente_id = a.id
  LEFT JOIN public.expedientes eb ON eb.paciente_id = b.id
  WHERE a.fecha_baja IS NULL
    AND b.fecha_baja IS NULL
  ORDER BY similitud DESC
  LIMIT 100;
$$;

COMMENT ON FUNCTION fn_detectar_pacientes_duplicados() IS
  'Posibles pacientes duplicados: misma fecha de nacimiento y nombre similar (pg_trgm), ordenados por similitud. SECURITY INVOKER: la ve quien ya puede leer pacientes (00032).';

REVOKE ALL ON FUNCTION fn_detectar_pacientes_duplicados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_detectar_pacientes_duplicados() TO authenticated;

-- ============================================================================
-- 3. fn_fusionar_pacientes(p_sobreviviente_id, p_absorbido_id)
-- ============================================================================
-- SECURITY DEFINER porque tiene que quedar restringida a solo administrador, mas estrecho que
-- la politica UPDATE de pacientes (es_administrador() OR tiene_permiso('pacientes.editar'),
-- 00086, que tambien alcanza a medico). Transaccional: todo o nada, para no dejar un paciente a
-- medio fusionar si algo falla a mitad de camino.
--
-- atenciones tiene UNIQUE (paciente_id, jornada_id) y padecimientos_cronicos tiene
-- UNIQUE (paciente_id, condicion_id): si el sobreviviente ya tiene una fila que chocaria con la
-- reasignada (mismo paciente atendido en la misma jornada, o la misma condicion cronica ya
-- registrada), esa fila puntual NO se reasigna y se conserva tal cual bajo el absorbido -que
-- sigue existiendo, solo dado de baja-. Nada se pierde ni se borra, solo no queda bajo el
-- sobreviviente. Decision tomada con el equipo: mas conservador que abortar toda la fusion por
-- un solo choque puntual.
--
-- consultas cuelga de expedientes, no de pacientes directamente, y no tiene UNIQUE sobre
-- expediente_id: se reasigna entera sin choque posible. recetas no se toca: cuelga de
-- consultas.id, asi que viaja sola con la consulta que ya se reasigno.
CREATE OR REPLACE FUNCTION fn_fusionar_pacientes(
  p_sobreviviente_id UUID,
  p_absorbido_id UUID
)
RETURNS fusiones_pacientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expediente_sobreviviente UUID;
  v_expediente_absorbido UUID;
  v_fusion public.fusiones_pacientes;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora puede fusionar expedientes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_sobreviviente_id = p_absorbido_id THEN
    RAISE EXCEPTION 'Un paciente no se puede fusionar consigo mismo.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloquea las dos filas para que dos fusiones concurrentes sobre el mismo par no se pisen.
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

  IF v_expediente_absorbido IS NOT NULL AND v_expediente_sobreviviente IS NOT NULL THEN
    UPDATE public.consultas
    SET expediente_id = v_expediente_sobreviviente
    WHERE expediente_id = v_expediente_absorbido;
  END IF;

  -- Baja logica del absorbido: el mismo mecanismo que ya excluye buscarPacientes()/
  -- fn_buscar_pacientes (00068) de sus resultados. Resuelve el criterio 5 sin codigo nuevo.
  UPDATE public.pacientes
  SET fecha_baja = CURRENT_DATE
  WHERE id = p_absorbido_id;

  INSERT INTO public.fusiones_pacientes (paciente_absorbido_id, paciente_sobreviviente_id, realizada_por)
  VALUES (p_absorbido_id, p_sobreviviente_id, auth.uid())
  RETURNING * INTO v_fusion;

  RETURN v_fusion;
END;
$$;

COMMENT ON FUNCTION fn_fusionar_pacientes(UUID, UUID) IS
  'Fusiona dos expedientes: reasigna atenciones/condiciones/consultas sin violar sus UNIQUE, da de baja al absorbido y registra la fusion. Solo administrador (issue #140).';

REVOKE ALL ON FUNCTION fn_fusionar_pacientes(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_fusionar_pacientes(UUID, UUID) TO authenticated;
