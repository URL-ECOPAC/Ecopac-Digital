-- ============================================================================
-- 00182: areas de atencion del paciente (issue #927, seccion 1)
-- ============================================================================
--
-- La organizacion atiende en areas -Odontologia, Psicologia, Medicina General, ...- y quiere saber
-- en cuales esta cada paciente y filtrar la lista por area. Mas adelante las citas (#927, seccion
-- 3) se agendan en un area.
--
-- 1. areas_atencion: catalogo, con las tres areas que pidio la organizacion. Se edita como
--    cualquier otro catalogo; no se borra, se retira (es_vigente), y solo la administradora retira
--    (impedir_retirar_sin_ser_administrador, 00148). Crear y editar tambien es de la
--    administradora: a diferencia de las condiciones cronicas, un area nueva no se descubre en
--    jornada con el paciente delante, es una decision de la organizacion.
-- 2. paciente_area: en que areas esta cada paciente (varias). La asigna quien puede editar al
--    paciente (administradora o permiso pacientes.editar) y quien lo registro.
-- 3. pacientes.registrado_por: quien registro al paciente. Hace falta para la regla de arriba -
--    sin ella "quien lo registro" no se puede escribir en una politica- y sigue la convencion
--    `_por` de la issue #412. Las filas anteriores quedan en NULL: no se sabe quien las registro.
-- 4. fn_registrar_paciente gana p_area_ids: el paciente, su expediente y sus areas entran en la
--    misma transaccion. Cambia la firma, asi que se suelta y se vuelve a crear con sus REVOKE,
--    GRANT y COMMENT (el DROP se los lleva).
-- 5. fn_buscar_pacientes gana p_area_id para filtrar la lista. Mismo motivo para el DROP. Un
--    paciente sin area sigue saliendo cuando no se filtra. Un area retirada se puede usar en el
--    filtro: los pacientes que ya la tienen la conservan.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catalogo de areas de atencion
-- ----------------------------------------------------------------------------
CREATE TABLE public.areas_atencion (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  es_vigente BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_areas_atencion_nombre_no_vacio CHECK (btrim(nombre) <> '')
);

-- Unico sin distinguir mayusculas ni acentos, como condiciones_cronicas (00140): "Psicologia" y
-- "psicología" son la misma area.
CREATE UNIQUE INDEX idx_areas_atencion_nombre_normalizado
  ON public.areas_atencion (lower(public.f_unaccent(btrim(nombre))));

COMMENT ON TABLE public.areas_atencion IS
  'Catalogo de areas de atencion (Odontologia, Psicologia, Medicina General, ...) que se asignan al paciente y en las que se agendan las citas (issue #927, 00182). No se borran: se retiran con es_vigente.';
COMMENT ON COLUMN public.areas_atencion.id IS 'Identificador del area.';
COMMENT ON COLUMN public.areas_atencion.nombre IS
  'Nombre del area. Unico sin distinguir mayusculas ni acentos (idx_areas_atencion_nombre_normalizado).';
COMMENT ON COLUMN public.areas_atencion.descripcion IS 'Que se atiende en el area. Opcional.';
COMMENT ON COLUMN public.areas_atencion.es_vigente IS
  'FALSE = retirada (borrado logico): no se ofrece al elegir, pero la conservan los pacientes, citas y consultas que ya la tienen, y se puede usar en los filtros. Solo la administradora la retira (00148).';
COMMENT ON COLUMN public.areas_atencion.created_at IS 'Cuando se creo el area.';
COMMENT ON COLUMN public.areas_atencion.updated_at IS 'Ultima modificacion del area.';
COMMENT ON INDEX public.idx_areas_atencion_nombre_normalizado IS
  'Un area por nombre, sin distinguir mayusculas, acentos ni espacios de los extremos (00182).';

-- Con tildes: son textos que se ven en pantalla, no identificadores.
INSERT INTO public.areas_atencion (nombre, descripcion) VALUES
  ('Odontología', 'Atención dental.'),
  ('Psicología', 'Atención de salud mental.'),
  ('Medicina General', 'Consulta médica general.');

CREATE TRIGGER trg_areas_atencion_updated_at
BEFORE UPDATE ON public.areas_atencion
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

CREATE TRIGGER trg_impedir_retirar_area_atencion
BEFORE UPDATE OF es_vigente ON public.areas_atencion
FOR EACH ROW EXECUTE FUNCTION public.impedir_retirar_sin_ser_administrador();

CREATE TRIGGER trg_areas_atencion_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.areas_atencion
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria();

ALTER TABLE public.areas_atencion ENABLE ROW LEVEL SECURITY;

-- Sin DELETE: un area no se borra (00120 retiro DELETE de todo el esquema y aqui no se concede).
GRANT SELECT, INSERT, UPDATE ON public.areas_atencion TO authenticated;

CREATE POLICY "Sesion activa lee areas_atencion"
  ON public.areas_atencion FOR SELECT
  USING (public.rol_actual() IS NOT NULL);

CREATE POLICY "Administracion crea areas_atencion"
  ON public.areas_atencion FOR INSERT
  WITH CHECK (public.es_administrador());

CREATE POLICY "Administracion edita areas_atencion"
  ON public.areas_atencion FOR UPDATE
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- ----------------------------------------------------------------------------
-- 2. Quien registro al paciente
-- ----------------------------------------------------------------------------
ALTER TABLE public.pacientes
  ADD COLUMN registrado_por UUID DEFAULT auth.uid()
    REFERENCES public.perfiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pacientes.registrado_por IS
  'Quien registro al paciente (00182). Lo llena el DEFAULT con auth.uid(); NULL en los pacientes anteriores a la 00182 y en los que carga el seed. Quien registro al paciente puede asignarle areas (politicas de paciente_area).';

CREATE INDEX idx_pacientes_registrado_por ON public.pacientes (registrado_por);

-- ----------------------------------------------------------------------------
-- 3. Areas de cada paciente
-- ----------------------------------------------------------------------------
CREATE TABLE public.paciente_area (
  paciente_id UUID NOT NULL REFERENCES public.pacientes (id) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES public.areas_atencion (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (paciente_id, area_id)
);

CREATE INDEX idx_paciente_area_area ON public.paciente_area (area_id);

COMMENT ON TABLE public.paciente_area IS
  'Areas de atencion en las que esta cada paciente; un paciente puede estar en varias (issue #927, 00182).';
COMMENT ON COLUMN public.paciente_area.paciente_id IS 'Paciente.';
COMMENT ON COLUMN public.paciente_area.area_id IS
  'Area de atencion. Una retirada no se puede asignar de nuevo (trg_paciente_area_area_vigente), pero la conserva quien ya la tenia.';
COMMENT ON COLUMN public.paciente_area.created_at IS 'Cuando se le asigno el area.';

-- Un area retirada no se asigna. La pantalla ya no la ofrece; esto es para quien llame directo.
CREATE FUNCTION public.fn_paciente_area_area_vigente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.areas_atencion a WHERE a.id = NEW.area_id AND a.es_vigente
  ) THEN
    RAISE EXCEPTION 'El area esta retirada: ya no se asigna a pacientes.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_paciente_area_area_vigente() IS
  'Rechaza asignar a un paciente un area de atencion retirada (00182).';

REVOKE EXECUTE ON FUNCTION public.fn_paciente_area_area_vigente() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_paciente_area_area_vigente
BEFORE INSERT ON public.paciente_area
FOR EACH ROW EXECUTE FUNCTION public.fn_paciente_area_area_vigente();

-- Sin columna `id`: la auditoria toma el paciente como fila afectada, como perfil_especialidad.
CREATE TRIGGER trg_paciente_area_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.paciente_area
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria('paciente_id');

ALTER TABLE public.paciente_area ENABLE ROW LEVEL SECURITY;

-- Sin UPDATE: cambiar de area es quitar una y poner otra.
GRANT SELECT, INSERT, DELETE ON public.paciente_area TO authenticated;

-- Lee quien lee pacientes (00148).
CREATE POLICY "Quien lee pacientes lee paciente_area"
  ON public.paciente_area FOR SELECT
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );

-- Asigna quien puede editar al paciente (00086) o quien lo registro.
CREATE POLICY "Quien edita o registro al paciente asigna areas"
  ON public.paciente_area FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('pacientes.editar')
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.registrado_por = auth.uid()
    )
  );

CREATE POLICY "Quien edita o registro al paciente quita areas"
  ON public.paciente_area FOR DELETE
  USING (
    public.es_administrador()
    OR public.tiene_permiso('pacientes.editar')
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id AND p.registrado_por = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Registrar al paciente con sus areas
-- ----------------------------------------------------------------------------
-- Cuerpo vigente de la 00132, con p_area_ids al final. Sigue siendo SECURITY INVOKER: las
-- politicas de INSERT de pacientes, expedientes y paciente_area deciden quien puede llamarla, y
-- como pacientes.registrado_por es auth.uid(), quien registra puede asignar las areas.
DROP FUNCTION public.fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  public.tipo_sanguineo, VARCHAR, VARCHAR
);

CREATE FUNCTION public.fn_registrar_paciente(
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_fecha_nacimiento DATE,
  p_sexo VARCHAR,
  p_comunidad_id UUID,
  p_telefono_contacto VARCHAR,
  p_idioma VARCHAR,
  p_dpi VARCHAR DEFAULT NULL,
  p_tipo_sangre public.tipo_sanguineo DEFAULT NULL,
  p_nombre_responsable VARCHAR DEFAULT NULL,
  p_parentesco_responsable VARCHAR DEFAULT NULL,
  p_area_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombres VARCHAR,
  apellidos VARCHAR,
  fecha_nacimiento DATE,
  sexo VARCHAR,
  comunidad_id UUID,
  telefono_contacto VARCHAR,
  idioma VARCHAR,
  dpi VARCHAR,
  tipo_sangre public.tipo_sanguineo,
  nombre_responsable VARCHAR,
  parentesco_responsable VARCHAR,
  fecha_baja DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  numero_ficha VARCHAR
) AS $$
DECLARE
  v_paciente public.pacientes;
  v_expediente public.expedientes;
BEGIN
  INSERT INTO public.pacientes (
    nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma,
    dpi, tipo_sangre, nombre_responsable, parentesco_responsable
  )
  VALUES (
    p_nombres, p_apellidos, p_fecha_nacimiento, p_sexo::public.sexo_paciente, p_comunidad_id,
    p_telefono_contacto, p_idioma, p_dpi, p_tipo_sangre, p_nombre_responsable,
    p_parentesco_responsable
  )
  RETURNING * INTO v_paciente;

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval de la 00081) lo genera aqui.
  INSERT INTO public.expedientes (paciente_id)
  VALUES (v_paciente.id)
  RETURNING * INTO v_expediente;

  -- 00182: las areas, en la misma transaccion. DISTINCT porque un id repetido chocaria con la PK.
  IF p_area_ids IS NOT NULL AND cardinality(p_area_ids) > 0 THEN
    INSERT INTO public.paciente_area (paciente_id, area_id)
    SELECT DISTINCT v_paciente.id, area FROM unnest(p_area_ids) AS area;
  END IF;

  RETURN QUERY SELECT
    v_paciente.id, v_paciente.nombres, v_paciente.apellidos, v_paciente.fecha_nacimiento,
    v_paciente.sexo::VARCHAR, v_paciente.comunidad_id, v_paciente.telefono_contacto,
    v_paciente.idioma, v_paciente.dpi, v_paciente.tipo_sangre, v_paciente.nombre_responsable,
    v_paciente.parentesco_responsable, v_paciente.fecha_baja, v_paciente.created_at,
    v_paciente.updated_at, v_expediente.numero_ficha;
END;
$$ LANGUAGE plpgsql SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  public.tipo_sanguineo, VARCHAR, VARCHAR, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  public.tipo_sanguineo, VARCHAR, VARCHAR, UUID[]
) TO authenticated;

COMMENT ON FUNCTION public.fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  public.tipo_sanguineo, VARCHAR, VARCHAR, UUID[]
) IS
  'Inserta un paciente, su expediente y sus areas de atencion (p_area_ids, 00182) en una sola transaccion. numero_ficha lo genera el DEFAULT de expedientes (nextval, 00081), asi que dos dispositivos registrando a la vez no colisionan. No es SECURITY DEFINER: las politicas de INSERT de pacientes, expedientes (00032) y paciente_area (00182) deciden quien puede llamarla. p_idioma es un codigo del catalogo idiomas (issue #663).';

-- ----------------------------------------------------------------------------
-- 5. Buscar pacientes por area
-- ----------------------------------------------------------------------------
-- Cuerpo vigente de la 00134 (con el limite de busquedas), con p_area_id al final.
--
-- Carga pg_trgm en la sesion para que la clausula SET de la funcion tenga una GUC real que fijar:
-- sin la libreria cargada, word_similarity_threshold es un placeholder y fijarlo exige
-- superusuario (issue #487, 00068; docs/CI-CD.md).
SELECT extensions.similarity('', '');

DROP FUNCTION public.fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT);

CREATE FUNCTION public.fn_buscar_pacientes(
  p_termino TEXT DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 20,
  p_condicion_cronica_id UUID DEFAULT NULL,
  p_sexo TEXT DEFAULT NULL,
  p_edad_min INT DEFAULT NULL,
  p_edad_max INT DEFAULT NULL,
  p_area_id UUID DEFAULT NULL
)
RETURNS TABLE (
  paciente_id UUID,
  nombres VARCHAR,
  apellidos VARCHAR,
  fecha_nacimiento DATE,
  sexo VARCHAR,
  comunidad_id UUID,
  comunidad_nombre VARCHAR,
  numero_ficha VARCHAR,
  ultima_atencion DATE,
  condiciones TEXT[],
  relevancia REAL,
  pagina INT,
  por_pagina INT,
  total BIGINT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
SET pg_trgm.word_similarity_threshold = 0.4
AS $$
  WITH _limite AS (
    SELECT public.fn_verificar_limite_busqueda_pacientes() AS ok
  ),
  coincidencias AS (
    SELECT
      pa.id AS paciente_id,
      pa.nombres,
      pa.apellidos,
      pa.fecha_nacimiento,
      pa.sexo::VARCHAR AS sexo,
      pa.comunidad_id,
      co.nombre AS comunidad_nombre,
      ex.numero_ficha,
      (
        SELECT max(jo.fecha)
        FROM public.atenciones at
        JOIN public.jornadas jo ON jo.id = at.jornada_id
        WHERE at.paciente_id = pa.id
      ) AS ultima_atencion,
      (
        SELECT coalesce(array_agg(cc.nombre::TEXT ORDER BY cc.nombre), ARRAY[]::TEXT[])
        FROM public.padecimientos_cronicos pc
        JOIN public.condiciones_cronicas cc ON cc.id = pc.condicion_id
        WHERE pc.paciente_id = pa.id
          AND pc.estado <> 'resuelta'
      ) AS condiciones,
      CASE
        WHEN nullif(btrim(p_termino), '') IS NULL THEN 0::REAL
        ELSE extensions.word_similarity(
               lower(public.f_unaccent(btrim(p_termino))),
               lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
             )
      END AS relevancia
    FROM public.pacientes pa
    CROSS JOIN _limite
    LEFT JOIN public.comunidades co ON co.id = pa.comunidad_id
    LEFT JOIN public.expedientes ex ON ex.paciente_id = pa.id
    WHERE pa.fecha_baja IS NULL
      AND (p_comunidad_id IS NULL OR pa.comunidad_id = p_comunidad_id)
      AND (
        p_condicion_cronica_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.padecimientos_cronicos pc
             WHERE pc.paciente_id = pa.id
               AND pc.condicion_id = p_condicion_cronica_id
               AND pc.estado <> 'resuelta'
           )
      )
      -- 00182: el area, vigente o retirada. Sin filtro, un paciente sin area sigue saliendo.
      AND (
        p_area_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.paciente_area pr
             WHERE pr.paciente_id = pa.id
               AND pr.area_id = p_area_id
           )
      )
      AND (p_sexo IS NULL OR upper(pa.sexo::TEXT) = upper(p_sexo))
      AND (
        p_edad_min IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT >= p_edad_min
      )
      AND (
        p_edad_max IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT <= p_edad_max
      )
      AND (
        nullif(btrim(p_termino), '') IS NULL
        OR lower(public.f_unaccent(btrim(p_termino)))
           OPERATOR(extensions.<%)
           lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
      )
  ),
  paginacion AS (
    SELECT
      least(greatest(coalesce(p_por_pagina, 20), 1), 100) AS por_pagina,
      count(*) AS total
    FROM coincidencias
  ),
  paginacion_clampeada AS (
    SELECT
      por_pagina,
      total,
      greatest(
        least(coalesce(p_pagina, 1), greatest(ceil(total::NUMERIC / por_pagina)::INT, 1)),
        1
      ) AS pagina
    FROM paginacion
  )
  SELECT
    c.paciente_id,
    c.nombres,
    c.apellidos,
    c.fecha_nacimiento,
    c.sexo,
    c.comunidad_id,
    c.comunidad_nombre,
    c.numero_ficha,
    c.ultima_atencion,
    c.condiciones,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;

REVOKE EXECUTE ON FUNCTION public.fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT, UUID) IS
  'Busca pacientes por nombre (tolerando acentos y errores de tipeo, via el indice de trigramas de 00011 y el operador <% de word_similarity), filtrando opcionalmente por comunidad, condicion cronica vigente, sexo, edad y area de atencion (p_area_id, 00182), con resultados paginados y ordenados por relevancia. Si la pagina pedida cae despues del final devuelve la ultima pagina real. Excluye pacientes con fecha_baja. Cuenta contra el limite de busquedas (00134). SECURITY INVOKER: respeta las politicas de SELECT de pacientes, padecimientos_cronicos y paciente_area.';
