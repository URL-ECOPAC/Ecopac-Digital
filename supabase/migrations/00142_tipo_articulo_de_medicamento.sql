-- Ecopac Digital - Distingue insumo de medicamento en el catalogo (PLAN.md punto 1)
--
-- Hasta hoy `medicamentos` no distinguia un medicamento propiamente dicho de un insumo (gasas,
-- jeringas, guantes...). Un intento anterior de filtrar por "categoria" en la pantalla web
-- comparaba contra una columna que nunca existio en este esquema -- issue previa, documentada en
-- el encabezado de packages/shared/inventario/catalogoMedicamentos.js -- y el filtro se retiro
-- por completo en vez de dejarlo comparando contra undefined.
--
-- tipo_articulo es NOT NULL con DEFAULT 'medicamento': todo lo que ya esta en el catalogo hoy es
-- un medicamento, asi que el backfill de las filas existentes es automatico -- Postgres aplica el
-- DEFAULT sin necesitar un UPDATE aparte ni dejar ningun NULL detras.
--
-- fn_registrar_medicamento (00050) tambien se extiende con el parametro nuevo: sin esto, el
-- formulario de alta podria elegir "insumo" y el INSERT lo ignoraria en silencio -- todo
-- medicamento CREADO (no editado) quedaria siempre en el DEFAULT 'medicamento' sin importar lo
-- que la persona eligiera, el mismo fallo silencioso que describe AGENTS.md para las issues
-- #818/#821. actualizarMedicamento() (medicamentos.api.js) no pasa por esta funcion -- es un
-- UPDATE directo -- asi que editar el tipo de un medicamento ya existente no necesita este
-- cambio, pero crearlo si.

-- ============================================================================
-- 1. Enum y columna
-- ============================================================================
CREATE TYPE tipo_articulo AS ENUM ('medicamento', 'insumo');

ALTER TABLE medicamentos
  ADD COLUMN tipo_articulo tipo_articulo NOT NULL DEFAULT 'medicamento';

-- ============================================================================
-- 2. fn_registrar_medicamento: nuevo parametro al final, con DEFAULT propio
-- ============================================================================
-- CREATE OR REPLACE no reemplaza una funcion cuando cambia la firma: sin este DROP explicito
-- quedaria una sobrecarga vieja huerfana, inalcanzable pero todavia registrada (mismo criterio
-- que 00081_generar_numero_ficha_por_secuencia.sql).
DROP FUNCTION IF EXISTS fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN
);

CREATE FUNCTION fn_registrar_medicamento(
  p_nombre VARCHAR,
  p_concentracion VARCHAR,
  p_presentacion presentacion_medicamento,
  p_marca VARCHAR,
  p_principios_ids UUID[],
  p_forma_farmaceutica VARCHAR DEFAULT NULL,
  p_es_pediatrico BOOLEAN DEFAULT FALSE,
  p_tipo_articulo tipo_articulo DEFAULT 'medicamento'
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

  INSERT INTO medicamentos (
    nombre, concentracion, presentacion, marca, forma_farmaceutica, es_pediatrico, tipo_articulo
  )
  VALUES (
    p_nombre, p_concentracion, p_presentacion, p_marca, p_forma_farmaceutica, p_es_pediatrico,
    p_tipo_articulo
  )
  RETURNING * INTO v_medicamento;

  FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
    INSERT INTO medicamento_principio (medicamento_id, principio_id)
    VALUES (v_medicamento.id, v_principio_id);
  END LOOP;

  RETURN v_medicamento;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
) TO authenticated;

COMMENT ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
) IS
  'Inserta un medicamento y sus principios activos en una sola transaccion: si algun '
  'principio_id no existe (FK de medicamento_principio) o el arreglo viene vacio, revierte '
  'tambien el insert de medicamentos. No es SECURITY DEFINER: las politicas de INSERT de '
  'medicamentos y medicamento_principio (00034) siguen decidiendo quien puede llamarla. '
  'p_tipo_articulo default ''medicamento'' preserva el comportamiento de quien llame con la '
  'firma vieja de siete parametros.';
