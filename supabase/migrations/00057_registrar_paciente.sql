-- Ecopac Digital - Registro atomico de un paciente con su expediente
--
-- Issue #113 ("API de pacientes en shared: registrar, consultar y actualizar"). Registrar un
-- paciente escribe en dos tablas (pacientes y expedientes: cada paciente tiene un expediente
-- clinico unico, regla de negocio central desde la 00009). Sin una transaccion, un fallo entre
-- el insert de pacientes y el de expedientes (por ejemplo, un numero_ficha duplicado) dejaria un
-- paciente sin expediente. fn_registrar_paciente hace ambos inserts en una sola sentencia de
-- nivel superior: cualquier error dentro revierte todo el cuerpo, incluido el insert de
-- pacientes. Mismo patron que fn_registrar_medicamento (00050) y fn_aplicar_ajuste_existencias
-- (00047).
--
-- No es SECURITY DEFINER: corre con los privilegios de quien llama, para seguir dependiendo de
-- las politicas RLS que ya existen en 00032 (administrador, medico y voluntario general
-- registran pacientes y crean expedientes) en vez de duplicar el chequeo de rol.

CREATE OR REPLACE FUNCTION fn_registrar_paciente(
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_fecha_nacimiento DATE,
  p_sexo VARCHAR,
  p_comunidad_id UUID,
  p_telefono_contacto VARCHAR,
  p_idioma idioma_preferido,
  p_numero_ficha VARCHAR,
  p_dpi VARCHAR DEFAULT NULL,
  p_tipo_sangre tipo_sanguineo DEFAULT NULL,
  p_nombre_responsable VARCHAR DEFAULT NULL,
  p_parentesco_responsable VARCHAR DEFAULT NULL
)
RETURNS pacientes AS $$
DECLARE
  v_paciente pacientes;
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

  INSERT INTO expedientes (paciente_id, numero_ficha)
  VALUES (v_paciente.id, p_numero_ficha);

  RETURN v_paciente;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) TO authenticated;

COMMENT ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) IS
  'Inserta un paciente y su expediente en una sola transaccion: si el numero_ficha ya existe '
  '(UNIQUE de expedientes) o cualquier otro dato viola una restriccion, revierte tambien el '
  'insert de pacientes. No es SECURITY DEFINER: las politicas de INSERT de pacientes y '
  'expedientes (00032) siguen decidiendo quien puede llamarla.';
