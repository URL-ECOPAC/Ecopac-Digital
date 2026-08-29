-- Ecopac Digital - Numero de ficha generado por el servidor (issue #114)
--
-- Hasta hoy numero_ficha (expedientes, 00009) lo escribia quien registraba al paciente:
-- fn_registrar_paciente (00057) recibia p_numero_ficha como parametro obligatorio. Nada
-- impedia que dos dispositivos, registrando a la vez durante la misma jornada, tecleraran
-- el mismo numero.
--
-- La organizacion decidio que la numeracion empieza de cero (no continua el archivo fisico),
-- asi que se genera con una secuencia de Postgres: nextval() nunca devuelve el mismo valor
-- dos veces, incluso si dos sesiones lo llaman en el mismo instante exacto, sin necesidad de
-- un pg_advisory_xact_lock (ese patron, usado en la 00072, resuelve un problema distinto:
-- serializar una comprobacion de condicion sobre toda la tabla, no repartir un contador).
-- Es una garantia del motor, no algo que este codigo tenga que reforzar.
--
-- Formato acordado: texto con ceros a la izquierda, ancho fijo de 6 digitos (000000, 000001,
-- ...). Da margen hasta 999,999 expedientes y es estable en el tiempo porque el ancho no
-- cambia aunque crezca el conteo.

CREATE SEQUENCE expedientes_numero_ficha_seq
  AS BIGINT
  START WITH 0
  MINVALUE 0
  INCREMENT BY 1
  OWNED BY expedientes.numero_ficha;

ALTER TABLE expedientes
  ALTER COLUMN numero_ficha SET DEFAULT LPAD(nextval('expedientes_numero_ficha_seq')::text, 6, '0');

-- fn_registrar_paciente cambia de firma (quita p_numero_ficha, que no estaba al final sino en
-- medio de la lista) y de tipo de retorno (RETURNS pacientes -> RETURNS TABLE con las mismas
-- columnas mas numero_ficha, para que el numero generado vuelva al cliente en la misma
-- llamada). CREATE OR REPLACE no reemplaza una funcion cuando cambia la firma: sin este DROP
-- explicito quedaria una sobrecarga vieja huerfana, inalcanzable pero todavia registrada.
DROP FUNCTION IF EXISTS fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
);

CREATE FUNCTION fn_registrar_paciente(
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_fecha_nacimiento DATE,
  p_sexo VARCHAR,
  p_comunidad_id UUID,
  p_telefono_contacto VARCHAR,
  p_idioma idioma_preferido,
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
  idioma idioma_preferido,
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
  v_paciente pacientes;
  v_expediente expedientes;
BEGIN
  INSERT INTO pacientes (
    nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma,
    dpi, tipo_sangre, nombre_responsable, parentesco_responsable
  )
  VALUES (
    p_nombres, p_apellidos, p_fecha_nacimiento, p_sexo, p_comunidad_id, p_telefono_contacto,
    p_idioma, p_dpi, p_tipo_sangre, p_nombre_responsable, p_parentesco_responsable
  )
  RETURNING * INTO v_paciente;

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval() de arriba) lo genera aqui.
  INSERT INTO expedientes (paciente_id)
  VALUES (v_paciente.id)
  RETURNING * INTO v_expediente;

  RETURN QUERY SELECT
    v_paciente.id, v_paciente.nombres, v_paciente.apellidos, v_paciente.fecha_nacimiento,
    v_paciente.sexo, v_paciente.comunidad_id, v_paciente.telefono_contacto, v_paciente.idioma,
    v_paciente.dpi, v_paciente.tipo_sangre, v_paciente.nombre_responsable,
    v_paciente.parentesco_responsable, v_paciente.fecha_baja, v_paciente.created_at,
    v_paciente.updated_at, v_expediente.numero_ficha;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) TO authenticated;

COMMENT ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) IS
  'Inserta un paciente y su expediente en una sola transaccion. numero_ficha ya no es un '
  'parametro: lo genera el DEFAULT de expedientes (nextval de expedientes_numero_ficha_seq, '
  '00081), formateado a 6 digitos con ceros a la izquierda. nextval() es atomico y nunca '
  'repite valor entre sesiones concurrentes, asi que dos dispositivos registrando a la vez '
  'en la misma jornada no pueden colisionar. No es SECURITY DEFINER: las politicas de INSERT '
  'de pacientes y expedientes (00032) siguen decidiendo quien puede llamarla.';
