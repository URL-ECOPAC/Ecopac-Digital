-- Ecopac Digital - Catalogo de medicamentos: estado activo/inactivo y registro atomico
--
-- Issue #142 ("API del catalogo de medicamentos en shared"). Dos necesidades que
-- packages/shared/inventario/medicamentos.api.js no puede resolver por su cuenta:
--
-- - medicamentos no tiene forma de marcarse inactivo (00016 no la declara). El criterio de
--   aceptacion "desactivar un medicamento muestra un error si tiene existencias" no tiene donde
--   aterrizar sin esta columna.
-- - Registrar un medicamento escribe en dos tablas (medicamentos y medicamento_principio: el
--   principio activo es obligatorio, ver campos.js). Sin una transaccion, un fallo entre el
--   primer insert y el segundo dejaria un medicamento sin principio activo.
--   fn_registrar_medicamento hace ambos inserts en una sola sentencia de nivel superior:
--   cualquier error dentro revierte todo el cuerpo, incluido el insert de medicamentos.
--
-- Ninguna de las dos funciones es SECURITY DEFINER: corren con los privilegios de quien llama,
-- para seguir dependiendo de las politicas RLS que ya existen en 00034 en vez de duplicar el
-- chequeo de rol (mismo criterio que fn_aplicar_ajuste_existencias, 00047).

-- ============================================================================
-- 1. Columna activo
-- ============================================================================
ALTER TABLE medicamentos
  ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================================
-- 2. Registro atomico de un medicamento con sus principios activos
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
  v_medicamento medicamentos;
  v_principio_id UUID;
BEGIN
  IF p_principios_ids IS NULL OR array_length(p_principios_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Un medicamento debe registrarse con al menos un principio activo.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO medicamentos (nombre, concentracion, presentacion, marca, forma_farmaceutica, es_pediatrico)
  VALUES (p_nombre, p_concentracion, p_presentacion, p_marca, p_forma_farmaceutica, p_es_pediatrico)
  RETURNING * INTO v_medicamento;

  FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
    INSERT INTO medicamento_principio (medicamento_id, principio_id)
    VALUES (v_medicamento.id, v_principio_id);
  END LOOP;

  RETURN v_medicamento;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN
) IS
  'Inserta un medicamento y sus principios activos en una sola transaccion: si algun '
  'principio_id no existe (FK de medicamento_principio) o el arreglo viene vacio, revierte '
  'tambien el insert de medicamentos. No es SECURITY DEFINER: las politicas de INSERT de '
  'medicamentos y medicamento_principio (00034) siguen decidiendo quien puede llamarla.';

-- ============================================================================
-- 3. Chequeo de existencias para el guard de desactivar
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_medicamento_tiene_existencias(p_medicamento_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM existencias e
    JOIN lotes l ON l.id = e.lote_id
    WHERE l.medicamento_id = p_medicamento_id
      AND e.cantidad_disponible > 0
      AND l.fecha_vencimiento >= CURRENT_DATE
  );
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION fn_medicamento_tiene_existencias(UUID) TO authenticated;

COMMENT ON FUNCTION fn_medicamento_tiene_existencias(UUID) IS
  'TRUE si el medicamento tiene stock positivo no vencido (existencias.cantidad_disponible > 0 '
  'y lote con fecha_vencimiento >= hoy) en algun lote. medicamentos.api.js la consulta antes de '
  'desactivar un medicamento (issue #142); un medicamento con lotes historicos ya agotados o '
  'vencidos si se puede desactivar.';
