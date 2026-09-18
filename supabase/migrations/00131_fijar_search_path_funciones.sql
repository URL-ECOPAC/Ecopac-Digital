-- Ecopac Digital - Fijar search_path en las funciones que quedaban sin el (issue #760).
--
-- Supabase Advisor marca function_search_path_mutable en toda funcion de public sin
-- `search_path` fijo (supabase db lint no lo detecta: revisa sintaxis/plpgsql_check, no las
-- heuristicas del Advisor). Sin esto, alguien con permiso para crear un esquema puede anteponer
-- al search_path de su sesion un esquema con una tabla/funcion del mismo nombre que una de las
-- que esta funcion referencia sin calificar, y la funcion la usa sin darse cuenta.
--
-- El patron del repo (00004, rol_actual()) es SET search_path = '' -vacio, no 'public, pg_temp'-
-- combinado con toda referencia calificada public.tabla o esquema.funcion. Con search_path vacio
-- solo se busca pg_catalog de forma implicita.
--
-- Quedaban 11 funciones sin la clausula. La revision inicial (por texto, sobre los .sql) conto
-- 12, incluyendo fn_gastos_updated_at (00025) -- pero esa funcion ya no existe: la 00089 la
-- elimino (duplicaba, literalmente igual, a actualizar_timestamp_updated_at) y paso el trigger
-- tr_gastos_updated_at a la funcion compartida. Un CREATE OR REPLACE FUNCTION sobre un nombre
-- borrado no falla, la resucita, y desacoplar_gastos_de_inventario.sql (pgTAP) lo detecto: su
-- prueba 5 exige `to_regprocedure('fn_gastos_updated_at()') IS NULL`. Queda como recordatorio de
-- por que la guarda de este mismo archivo (funciones_search_path_fijo.sql) lee el catalogo real
-- despues de aplicar todo, y no una lista armada leyendo los .sql: a esa lista se le escapo
-- exactamente este caso.
--
-- Ninguna de las 11 cambia de firma, asi que CREATE OR REPLACE FUNCTION alcanza: conserva los
-- GRANT/REVOKE y los COMMENT ON ya existentes sobre cada una, no hace falta repetirlos ni un
-- DROP FUNCTION.
--
-- 6 de las 11 referencian algo sin calificar en su cuerpo y necesitan mas que la clausula sola:
--   - fn_registrar_paciente y fn_registrar_medicamento hacen INSERT INTO sin calificar, Y ADEMAS
--     declaran variables PL/pgSQL con el tipo fila de una tabla (`DECLARE v_x nombre_tabla;`).
--     Ese DECLARE tambien se resuelve con el search_path de la funcion en tiempo de ejecucion,
--     no solo las consultas: sin calificarlo, la funcion compila pero revienta en su primera
--     llamada real, no en este CREATE. Es facil pasarlo por alto porque no es una consulta.
--   - fn_medicamento_tiene_existencias y fn_contar_atenciones_incompletas hacen FROM/JOIN sin
--     calificar.
--   - fn_autoaprobar_gasto_administrador llama a es_administrador() sin calificar.
-- Las otras 5 (es_administrador, es_consultivo, f_unaccent, fn_validar_transicion_estado_proyecto,
-- fn_bloquear_gasto_finalizado, fn_validar_transicion_estado_jornada) ya calificaban todo lo que
-- usaban o no referenciaban ninguna tabla: solo ganan la clausula.
--
-- Migraciones de origen, para quien audite: 00004, 00011, 00029, 00050 (x2), 00051 (x2), 00052,
-- 00080, 00109, 00110. La guarda que impide que esto se repita es la suite pgTAP
-- supabase/tests/database/funciones_search_path_fijo.sql, que corre en el job "Validar
-- migraciones y funciones" y detecta sola cualquier funcion nueva sin la clausula.

-- ============================================================================
-- 1. es_administrador() -- 00004
-- ============================================================================
CREATE OR REPLACE FUNCTION es_administrador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.rol_actual() = 'administrador', FALSE);
$$;

-- ============================================================================
-- 2. es_consultivo() -- 00080
-- ============================================================================
CREATE OR REPLACE FUNCTION es_consultivo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.rol_actual() IN ('junta directiva', 'socio fundador'), FALSE);
$$;

-- ============================================================================
-- 3. f_unaccent(texto) -- 00011
-- ============================================================================
CREATE OR REPLACE FUNCTION public.f_unaccent(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, texto);
$$;

-- ============================================================================
-- 4. fn_registrar_paciente(...) -- 00110
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_registrar_paciente(
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_fecha_nacimiento DATE,
  p_sexo VARCHAR,
  p_comunidad_id UUID,
  p_telefono_contacto VARCHAR,
  p_idioma VARCHAR,
  p_dpi VARCHAR DEFAULT NULL,
  p_tipo_sangre tipo_sanguineo DEFAULT NULL,
  p_nombre_responsable VARCHAR DEFAULT NULL,
  p_parentesco_responsable VARCHAR DEFAULT NULL
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
  tipo_sangre tipo_sanguineo,
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
    p_nombres, p_apellidos, p_fecha_nacimiento, p_sexo, p_comunidad_id, p_telefono_contacto,
    p_idioma, p_dpi, p_tipo_sangre, p_nombre_responsable, p_parentesco_responsable
  )
  RETURNING * INTO v_paciente;

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval de la 00081) lo genera aqui.
  INSERT INTO public.expedientes (paciente_id)
  VALUES (v_paciente.id)
  RETURNING * INTO v_expediente;

  RETURN QUERY SELECT
    v_paciente.id, v_paciente.nombres, v_paciente.apellidos, v_paciente.fecha_nacimiento,
    v_paciente.sexo, v_paciente.comunidad_id, v_paciente.telefono_contacto, v_paciente.idioma,
    v_paciente.dpi, v_paciente.tipo_sangre, v_paciente.nombre_responsable,
    v_paciente.parentesco_responsable, v_paciente.fecha_baja, v_paciente.created_at,
    v_paciente.updated_at, v_expediente.numero_ficha;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 5. fn_validar_transicion_estado_proyecto() -- 00029
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_validar_transicion_estado_proyecto()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    (OLD.estado = 'planificado' AND NEW.estado = 'en curso')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'finalizado')
    OR (OLD.estado = 'planificado' AND NEW.estado = 'cancelado')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'cancelado')
  ) THEN
    RAISE EXCEPTION 'Transicion de estado invalida para proyectos: % -> %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. fn_registrar_medicamento(...) -- 00050
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_registrar_medicamento(
  p_nombre VARCHAR,
  p_concentracion VARCHAR,
  p_presentacion presentacion_medicamento,
  p_marca VARCHAR,
  p_principios_ids UUID[],
  p_forma_farmaceutica VARCHAR DEFAULT NULL,
  p_es_pediatrico BOOLEAN DEFAULT FALSE
)
RETURNS medicamentos AS $$
DECLARE
  v_medicamento public.medicamentos;
  v_principio_id UUID;
BEGIN
  IF p_principios_ids IS NULL OR array_length(p_principios_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Un medicamento debe registrarse con al menos un principio activo.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.medicamentos (nombre, concentracion, presentacion, marca, forma_farmaceutica, es_pediatrico)
  VALUES (p_nombre, p_concentracion, p_presentacion, p_marca, p_forma_farmaceutica, p_es_pediatrico)
  RETURNING * INTO v_medicamento;

  FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
    INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
    VALUES (v_medicamento.id, v_principio_id);
  END LOOP;

  RETURN v_medicamento;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 7. fn_medicamento_tiene_existencias(p_medicamento_id) -- 00050
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_medicamento_tiene_existencias(p_medicamento_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.existencias e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE l.medicamento_id = p_medicamento_id
      AND e.cantidad_disponible > 0
      AND l.fecha_vencimiento >= CURRENT_DATE
  );
$$ LANGUAGE sql STABLE SET search_path = '';

-- ============================================================================
-- 8. fn_bloquear_gasto_finalizado() -- 00052
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_bloquear_gasto_finalizado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un gasto en estado %', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 9. fn_validar_transicion_estado_jornada() -- 00051
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_validar_transicion_estado_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado = 'planificada' AND NEW.estado = 'en curso' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'en curso' AND NEW.estado = 'finalizada' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'finalizada' AND NEW.estado = 'en curso' THEN
    IF NOT public.es_administrador() THEN
      RAISE EXCEPTION 'Solo un administrador puede reabrir una jornada finalizada.';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Transicion de estado invalida para jornadas: % -> %', OLD.estado, NEW.estado;
  END IF;
END;
$$;

-- ============================================================================
-- 10. fn_contar_atenciones_incompletas(p_jornada_id) -- 00051
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_contar_atenciones_incompletas(p_jornada_id UUID)
RETURNS INT AS $$
  SELECT count(*)::INT
  FROM public.atenciones a
  WHERE a.jornada_id = p_jornada_id
    AND NOT EXISTS (SELECT 1 FROM public.consultas c WHERE c.atencion_id = a.id);
$$ LANGUAGE sql STABLE SET search_path = '';

-- ============================================================================
-- 11. fn_autoaprobar_gasto_administrador() -- 00109
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_autoaprobar_gasto_administrador()
RETURNS TRIGGER AS $$
BEGIN
  IF public.es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
