-- Ecopac Digital - Presentaciones como catalogo administrable (PLAN.md punto 11)
--
-- `presentacion_medicamento` era un enum fijo de 7 valores (00001): agregar una presentacion
-- nueva significaba editar codigo y desplegar, no una pantalla. Se reemplaza por una tabla
-- `presentaciones`, mismo patron que `principios_activos` (00016 + 00034 + 00046): catalogo
-- abierto a lectura, escritura solo administrador.
--
-- SEMBRADO: dos de los siete valores del enum tenian el termino medico en ingles por error
-- ('gotas ophthalmic', 'gotas otic'; ver el comentario de ETIQUETAS_PRESENTACION que tenia
-- packages/shared/enums.js: "el valor del enum esta en ingles y la etiqueta en espanol; no se
-- corrige el enum, se traduce"). `presentaciones.nombre` siembra con la ETIQUETA en espanol (lo
-- que una persona administrando el catalogo realmente escribiria o leeria), no con el slug
-- interno -- igual que `principios_activos.nombre` siempre fue texto libre, nunca un codigo.
--
-- BLAST RADIUS: `medicamentos.presentacion` no era el unico lugar que leia el enum. Se corrigen
-- en esta misma migracion, para que el esquema no quede roto ni un instante:
--   - fn_registrar_medicamento (00050, extendida por 00142): p_presentacion cambia de
--     presentacion_medicamento a UUID (FK).
--   - fn_existencias_disponibles (00065): hacia `m.presentacion::TEXT`; ahora une contra
--     presentaciones. El contrato de salida (presentacion TEXT) no cambia.
--   - fn_registrar_donacion (00135): hacia `v_medicamento.presentacion::TEXT` sobre un RECORD de
--     medicamentos%ROWTYPE -- sin este arreglo compilaria bien pero reventaria en tiempo de
--     ejecucion la proxima vez que alguien registrara una donacion de medicamentos.
-- Revisadas y sin cambios: vista_lotes_disponibles (00047, no referencia presentacion);
-- 00102 (REVOKE sobre una firma vieja de fn_registrar_medicamento, corre contra su punto
-- historico) y 00131 (recreo fn_registrar_medicamento con el mismo enum, solo por
-- search_path) -- ninguna migracion aplicada se edita, esta corrige hacia adelante.
--
-- El resto del blast radius (los SELECT embebidos de pacientes/recetas.api.js,
-- pacientes/historial.api.js, reportes/api.js, reportes/inventario.api.js,
-- reportes/vencimientos.api.js, y los dos formularios de alta rapida de medicamento) se corrige
-- en el mismo PR, del lado de JS -- no hay nada mas que corregir del lado de la base para esos.

-- ============================================================================
-- 1. Tabla presentaciones (mismo patron que principios_activos: 00016 + 00034 + 00046,
--    aqui en un solo lugar porque no hay necesidad de repartirlo en dos migraciones)
-- ============================================================================
CREATE TABLE presentaciones (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE presentaciones ENABLE ROW LEVEL SECURITY;

-- Sin anon: 00049/00056 le retiraron todo privilegio sobre el esquema publico (issue #408/#435),
-- y la prueba supabase/tests/database/privilegios_anon.sql lo comprueba tabla por tabla. anon no
-- pasa por PostgREST en este proyecto, asi que no necesita acceso a ningun catalogo, tampoco a
-- este.
GRANT SELECT ON presentaciones TO authenticated;
GRANT INSERT, UPDATE, DELETE ON presentaciones TO authenticated;

CREATE POLICY "Autenticados leen presentaciones"
  ON presentaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administrador crea presentaciones"
  ON presentaciones FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador edita presentaciones"
  ON presentaciones FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- Igual que principios_activos (00046): esta politica solo decide QUIEN puede intentar borrar.
-- Que una presentacion en uso no se pueda borrar lo impone el RESTRICT de
-- medicamentos.presentacion_id, mas abajo.
CREATE POLICY "Solo administrador elimina presentaciones"
  ON presentaciones FOR DELETE TO authenticated
  USING (public.es_administrador());

-- ============================================================================
-- 2. Sembrado: las 7 presentaciones vigentes, con su etiqueta en espanol
-- ============================================================================
INSERT INTO presentaciones (nombre) VALUES
  ('Tableta'),
  ('Jarabe'),
  ('Cápsula'),
  ('Inyectable'),
  ('Pomada'),
  ('Gotas oftálmicas'),
  ('Gotas óticas');

-- ============================================================================
-- 3. medicamentos.presentacion_id: columna nueva, backfill, luego se retira la vieja
-- ============================================================================
-- RESTRICT y no CASCADE: una presentacion en uso no se borra del catalogo (mismo criterio que
-- principios_activos.principio_id en medicamento_principio, 00016).
ALTER TABLE medicamentos
  ADD COLUMN presentacion_id UUID REFERENCES presentaciones(id) ON DELETE RESTRICT;

UPDATE medicamentos m
SET presentacion_id = p.id
FROM presentaciones p
WHERE (m.presentacion = 'tableta' AND p.nombre = 'Tableta')
   OR (m.presentacion = 'jarabe' AND p.nombre = 'Jarabe')
   OR (m.presentacion = 'capsula' AND p.nombre = 'Cápsula')
   OR (m.presentacion = 'inyectable' AND p.nombre = 'Inyectable')
   OR (m.presentacion = 'pomada' AND p.nombre = 'Pomada')
   OR (m.presentacion = 'gotas ophthalmic' AND p.nombre = 'Gotas oftálmicas')
   OR (m.presentacion = 'gotas otic' AND p.nombre = 'Gotas óticas');

-- Mensaje especifico en vez del generico "column contains null values" que tiraria el
-- SET NOT NULL de abajo si un valor del enum se hubiera quedado sin mapear.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM medicamentos WHERE presentacion_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill de presentacion_id incompleto: hay medicamentos sin presentacion mapeada.';
  END IF;
END $$;

ALTER TABLE medicamentos
  ALTER COLUMN presentacion_id SET NOT NULL;

ALTER TABLE medicamentos
  DROP COLUMN presentacion;

-- fn_registrar_medicamento (00050, extendida por 00142) todavia tiene un parametro
-- `presentacion_medicamento` en su firma: DROP TYPE falla con "cannot drop type ... because
-- other objects depend on it" mientras esa funcion exista, asi que su DROP tiene que pasar
-- ANTES del DROP TYPE, no despues (la funcion nueva, con UUID en vez del enum, se crea mas
-- abajo en la seccion 4). Se dropea la firma que dejo la 00142 (con p_tipo_articulo), no la
-- original de la 00050: esa migracion ya se aplico con su propia firma y no se edita.
DROP FUNCTION IF EXISTS fn_registrar_medicamento(
  VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
);

DROP TYPE presentacion_medicamento;

-- ============================================================================
-- 4. fn_registrar_medicamento: p_presentacion pasa de enum a UUID (FK)
-- ============================================================================
CREATE FUNCTION fn_registrar_medicamento(
  p_nombre VARCHAR,
  p_concentracion VARCHAR,
  p_presentacion_id UUID,
  p_marca VARCHAR,
  p_principios_ids UUID[],
  p_forma_farmaceutica VARCHAR DEFAULT NULL,
  p_es_pediatrico BOOLEAN DEFAULT FALSE,
  p_tipo_articulo tipo_articulo DEFAULT 'medicamento'
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

  INSERT INTO public.medicamentos (
    nombre, concentracion, presentacion_id, marca, forma_farmaceutica, es_pediatrico,
    tipo_articulo
  )
  VALUES (
    p_nombre, p_concentracion, p_presentacion_id, p_marca, p_forma_farmaceutica, p_es_pediatrico,
    p_tipo_articulo
  )
  RETURNING * INTO v_medicamento;

  FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
    INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
    VALUES (v_medicamento.id, v_principio_id);
  END LOOP;

  RETURN v_medicamento;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Funcion recien creada (no CREATE OR REPLACE de una firma existente): nace con EXECUTE abierto
-- a PUBLIC, el default nativo de Postgres para funciones (00102 documenta por que esto no se
-- puede suprimir de una vez para todo el esquema). Sin este REVOKE, anon vuelve a poder
-- ejecutarla via RPC.
REVOKE EXECUTE ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, UUID, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, UUID, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
) TO authenticated;

COMMENT ON FUNCTION fn_registrar_medicamento(
  VARCHAR, VARCHAR, UUID, VARCHAR, UUID[], VARCHAR, BOOLEAN, tipo_articulo
) IS
  'Inserta un medicamento y sus principios activos en una sola transaccion: si algun '
  'principio_id no existe (FK de medicamento_principio) o el arreglo viene vacio, revierte '
  'tambien el insert de medicamentos. No es SECURITY DEFINER: las politicas de INSERT de '
  'medicamentos y medicamento_principio (00034) siguen decidiendo quien puede llamarla. '
  'p_presentacion_id referencia presentaciones (00144); p_tipo_articulo default ''medicamento'' '
  'preserva el comportamiento de quien llame sin mandarlo.';

-- ============================================================================
-- 5. fn_existencias_disponibles: la presentacion sale de un JOIN, no de un cast al enum
-- ============================================================================
-- Firma identica (UUID, TEXT, INT, INT) y contrato de salida identico (presentacion sigue
-- siendo TEXT): CREATE OR REPLACE alcanza, sin DROP, y conserva el GRANT ya otorgado.
CREATE OR REPLACE FUNCTION fn_existencias_disponibles(
  p_bodega_id UUID DEFAULT NULL,
  p_busqueda TEXT DEFAULT NULL,
  p_limite INT DEFAULT 50,
  p_desplazamiento INT DEFAULT 0
)
RETURNS TABLE(
  medicamento_id UUID,
  medicamento TEXT,
  concentracion TEXT,
  presentacion TEXT,
  marca TEXT,
  componentes TEXT[],
  cantidad_disponible INT,
  fecha_vencimiento_proxima DATE,
  lotes_disponibles INT,
  total_medicamentos BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH disponibles AS (
    SELECT
      v.medicamento_id,
      v.lote_id,
      v.cantidad_disponible,
      v.fecha_vencimiento
    FROM public.vista_lotes_disponibles v
    WHERE p_bodega_id IS NULL OR v.bodega_id = p_bodega_id
  ),
  agregado AS (
    SELECT
      d.medicamento_id AS med_id,
      SUM(d.cantidad_disponible)::INT AS cantidad,
      MIN(d.fecha_vencimiento) AS vence,
      COUNT(DISTINCT d.lote_id)::INT AS lotes
    FROM disponibles d
    GROUP BY d.medicamento_id
  ),
  con_catalogo AS (
    SELECT
      a.med_id,
      a.cantidad,
      a.vence,
      a.lotes,
      m.nombre::TEXT AS nombre,
      m.concentracion::TEXT AS concentracion,
      p.nombre::TEXT AS presentacion,
      m.marca::TEXT AS marca,
      ARRAY(
        SELECT pa.nombre::TEXT
        FROM public.medicamento_principio mp
        JOIN public.principios_activos pa ON pa.id = mp.principio_id
        WHERE mp.medicamento_id = a.med_id
        ORDER BY pa.nombre
      ) AS componentes
    FROM agregado a
    JOIN public.medicamentos m ON m.id = a.med_id
    JOIN public.presentaciones p ON p.id = m.presentacion_id
  ),
  filtrado AS (
    SELECT c.*
    FROM con_catalogo c
    WHERE p_busqueda IS NULL
       OR btrim(p_busqueda) = ''
       OR lower(public.f_unaccent(c.nombre))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.marca))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.concentracion))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR EXISTS (
            SELECT 1
            FROM unnest(c.componentes) AS componente
            WHERE lower(public.f_unaccent(componente))
                    LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
          )
  )
  SELECT
    f.med_id,
    f.nombre,
    f.concentracion,
    f.presentacion,
    f.marca,
    f.componentes,
    f.cantidad,
    f.vence,
    f.lotes,
    COUNT(*) OVER ()::BIGINT
  FROM filtrado f
  ORDER BY f.nombre, f.concentracion, f.marca
  LIMIT p_limite
  OFFSET p_desplazamiento;
$$;

-- ============================================================================
-- 6. fn_registrar_donacion: la unidad de un renglon de medicamento sale de un lookup, no de
--    un cast sobre el RECORD de medicamentos%ROWTYPE
-- ============================================================================
-- Sin este arreglo, v_medicamento.presentacion no fallaria al desplegar esta migracion -- PL/pgSQL
-- no revisa los campos de un RECORD hasta ejecutarlo -- sino la proxima vez que alguien registrara
-- una donacion de medicamentos, con un error de "record has no field presentacion" en produccion.
-- Firma identica a la de la 00135: CREATE OR REPLACE alcanza.
CREATE OR REPLACE FUNCTION fn_registrar_donacion(
  p_donante_id UUID,
  p_tipo tipo_donacion,
  p_fecha DATE,
  p_detalle JSONB,
  p_proyecto_id UUID DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_donacion public.donaciones;
  v_renglon JSONB;
  v_detalle_id UUID;
  v_ids_detalle JSONB := '[]'::JSONB;
  v_medicamento_id UUID;
  v_medicamento public.medicamentos;
  v_descripcion TEXT;
  v_unidad TEXT;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una donacion necesita al menos un renglon de detalle.';
  END IF;

  INSERT INTO public.donaciones (
    donante_id, proyecto_id, tipo, fecha, observaciones, registrado_por
  )
  VALUES (
    p_donante_id, p_proyecto_id, p_tipo, p_fecha, p_observaciones, auth.uid()
  )
  RETURNING * INTO v_donacion;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_medicamento_id := NULLIF(v_renglon ->> 'medicamentoId', '')::UUID;
    v_descripcion := v_renglon ->> 'descripcion';
    v_unidad := v_renglon ->> 'unidad';

    IF p_tipo = 'medicamentos' THEN
      IF v_medicamento_id IS NULL THEN
        RAISE EXCEPTION 'Cada renglon de una donacion de medicamentos tiene que elegir un medicamento del catalogo.'
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT * INTO v_medicamento FROM public.medicamentos WHERE id = v_medicamento_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El medicamento elegido no existe en el catalogo.'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      -- El catalogo manda: lo que el cliente haya mandado como texto se ignora.
      v_descripcion := concat_ws(' ', v_medicamento.nombre, v_medicamento.concentracion);
      SELECT nombre INTO v_unidad FROM public.presentaciones WHERE id = v_medicamento.presentacion_id;
    ELSIF v_medicamento_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo una donacion de medicamentos lleva un medicamento del catalogo.'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.donacion_detalle (
      donacion_id, descripcion, cantidad, unidad, monto, medicamento_id
    )
    VALUES (
      v_donacion.id,
      v_descripcion,
      NULLIF(v_renglon ->> 'cantidad', '')::NUMERIC,
      v_unidad,
      NULLIF(v_renglon ->> 'monto', '')::NUMERIC,
      v_medicamento_id
    )
    RETURNING id INTO v_detalle_id;

    v_ids_detalle := v_ids_detalle || to_jsonb(v_detalle_id);
  END LOOP;

  RETURN jsonb_build_object('donacion', to_jsonb(v_donacion), 'detalleIds', v_ids_detalle);
END;
$$;
