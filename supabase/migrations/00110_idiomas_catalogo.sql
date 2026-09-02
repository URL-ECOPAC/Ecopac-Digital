-- Ecopac Digital - El idioma del paciente pasa de enum a catalogo (issue #663)
--
-- idioma_preferido era un CREATE TYPE ... AS ENUM de la 00001 con cuatro valores: espanol,
-- quiche, mam y otros. Un enum no admite valores nuevos desde el cliente -- hace falta ALTER
-- TYPE, que es DDL -- asi que agregar un idioma exigia desplegar una migracion. Guatemala
-- reconoce mas de veinte idiomas mayas, y con solo dos nombrados casi todo lo que no es espanol
-- acaba en 'otros'. Esa es justamente la informacion que hace falta para asignar interprete en
-- una jornada.
--
-- POR QUE LA COLUMNA QUEDA EN TEXTO Y NO EN UUID
--
-- La conversion obvia -- columna UUID referenciando idiomas(id) -- obliga a reescribir los
-- INSERT de once pruebas pgTAP y de las dos semillas, que escriben el idioma por su valor
-- ('espanol'). Referenciar idiomas(codigo), que es UNIQUE, da la misma integridad sin tocar
-- ninguno de esos archivos: los valores que ya se escriben siguen siendo validos porque son
-- exactamente los codigos del catalogo.
--
-- Es ademas mas integridad de la que habia: hasta hoy pacientes.sexo y pacientes.idioma no
-- tenian ninguna restriccion referencial, solo la del enum.

CREATE TABLE idiomas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  -- El codigo es la clave estable que guardan las filas de pacientes y el que escriben las
  -- pruebas y las semillas. El nombre es lo que se muestra y puede corregirse sin migrar datos.
  codigo VARCHAR(30) UNIQUE NOT NULL,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE idiomas ENABLE ROW LEVEL SECURITY;

-- Catalogo publico para quien tenga sesion, mismo criterio que condiciones_cronicas (00010) y
-- que departamentos/municipios/comunidades. Escribirlo queda para el issue de politicas de
-- escritura de catalogos, igual que en aquella.
CREATE POLICY "Sesion activa lee idiomas"
  ON idiomas FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON idiomas TO authenticated;

-- Los cuatro valores del enum, con la etiqueta que ya mostraba ETIQUETAS_IDIOMA en shared.
INSERT INTO idiomas (codigo, nombre) VALUES
  ('espanol', 'Español'),
  ('quiche', 'K''iche'''),
  ('mam', 'Mam'),
  ('otros', 'Otro');

-- La columna deja de ser el enum y pasa a texto. USING la convierte fila por fila; ningun
-- paciente cambia de idioma porque el texto del enum y el codigo del catalogo son el mismo.
ALTER TABLE pacientes
  ALTER COLUMN idioma TYPE VARCHAR(30) USING idioma::TEXT;

-- Guarda antes de atar la clave foranea: si algun paciente tuviera un idioma que no esta en el
-- catalogo, la migracion se detiene aqui en vez de fallar a medias mas adelante.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE NOT EXISTS (SELECT 1 FROM public.idiomas i WHERE i.codigo = pa.idioma)
  ) THEN
    RAISE EXCEPTION 'Hay pacientes con un idioma que no esta en el catalogo: revisar antes de migrar.';
  END IF;
END
$$;

ALTER TABLE pacientes
  ADD CONSTRAINT pacientes_idioma_fkey
  FOREIGN KEY (idioma) REFERENCES idiomas(codigo) ON UPDATE CASCADE ON DELETE RESTRICT;

-- fn_registrar_paciente recibia el idioma tipado como el enum. Cambia de firma, asi que hay que
-- soltarla y recrearla: CREATE OR REPLACE no reemplaza una funcion cuando la firma cambia.
DROP FUNCTION IF EXISTS fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR, tipo_sanguineo,
  VARCHAR, VARCHAR
);

-- Ya sin columna ni funcion que lo usen, el tipo queda huerfano.
DROP TYPE IF EXISTS idioma_preferido;

CREATE FUNCTION fn_registrar_paciente(
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

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval de la 00081) lo genera aqui.
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
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) TO authenticated;

-- Sin este REVOKE la funcion nace ejecutable por PUBLIC, que es el comportamiento por defecto de
-- Postgres y exactamente lo que cerro la 00102 (issue #511) sobre la firma anterior. Al cambiar
-- la firma, aquel REVOKE ya no la cubre. La prueba privilegios_anon.sql lo comprueba.
REVOKE EXECUTE ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) FROM PUBLIC;

COMMENT ON FUNCTION fn_registrar_paciente(
  VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR,
  tipo_sanguineo, VARCHAR, VARCHAR
) IS
  'Inserta un paciente y su expediente en una sola transaccion. numero_ficha ya no es un '
  'parametro: lo genera el DEFAULT de expedientes (nextval de expedientes_numero_ficha_seq, '
  '00081), formateado a 6 digitos con ceros a la izquierda. nextval() es atomico y nunca '
  'repite valor entre sesiones concurrentes, asi que dos dispositivos registrando a la vez '
  'en la misma jornada no pueden colisionar. No es SECURITY DEFINER: las politicas de INSERT '
  'de pacientes y expedientes (00032) siguen decidiendo quien puede llamarla. '
  'Issue #663: p_idioma pasa de idioma_preferido a VARCHAR. El idioma ya no es un enum sino un '
  'codigo del catalogo idiomas, con clave foranea, para poder agregar idiomas sin desplegar.';

COMMENT ON TABLE idiomas IS
  'Catalogo de idiomas del paciente (issue #663). Sustituye al enum idioma_preferido de la '
  '00001, que obligaba a una migracion por cada idioma nuevo. pacientes.idioma referencia '
  'codigo, no id, para que las pruebas y las semillas que ya escriben el valor por su nombre '
  'sigan siendo validas. Agregar un idioma es un INSERT.';
