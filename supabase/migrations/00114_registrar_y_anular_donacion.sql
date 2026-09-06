-- Ecopac Digital - Registro y anulacion atomicos de una donacion (issue #635)
--
-- La #191 dejo sin implementar el camino de escritura de donaciones: solo existia lectura
-- (donantes.api.js, historial.api.js, ingreso.api.js). Esta migracion agrega las dos funciones
-- que packages/shared/donaciones/registro.api.js necesita para escribir sin dejar al cliente
-- hacer transacciones multi-sentencia (que supabase-js no soporta).
--
-- Mismo patron que fn_registrar_paciente (00057) para la atomicidad donacion+detalle, y que
-- fn_generar_receta (00066) para el detalle de longitud variable via JSONB. Ninguna de las dos
-- funciones es SECURITY DEFINER: corren con los privilegios de quien llama, asi que las
-- politicas de INSERT/UPDATE de donaciones y donacion_detalle (00083) siguen siendo las que
-- deciden quien puede escribir. `registrado_por` y `anulada_por` se fijan con auth.uid() dentro
-- de la funcion -nunca desde un parametro del cliente- para que no se puedan falsear, mismo
-- criterio que los triggers de aprobado_por en movimientos_inventario y gastos
-- (00028/00047/00094/00109).

-- RETURNS JSONB y no `donaciones`: quien llama (registrarDonacion(), registro.api.js) necesita
-- tambien el id real de cada renglon de donacion_detalle para poder ofrecer despues el paso de
-- generar el ingreso de inventario (generarIngresoDesdeDonacion() exige un donacion_detalle_id
-- real, ver ingreso.api.js). Se devuelven en el mismo orden en que se insertaron -exactamente el
-- orden de p_detalle- porque donacion_detalle no tiene ninguna columna de orden y todos sus
-- renglones comparten el mismo `created_at` (NOW() es constante dentro de una transaccion): un
-- SELECT posterior de vuelta al cliente no podria reconstruir con certeza que id le toca a cada
-- renglon local. Solo esta funcion, que controla el orden de insercion, puede darle esa garantia
-- al cliente. Es la unica razon por la que este archivo se aparta del patron de fn_generar_receta
-- (00066), que devuelve un UUID escalar y deja que el cliente vuelva a leer con un SELECT aparte
-- (generarReceta() -> obtenerReceta() en recetas.api.js): ese patron sirve cuando no hace falta
-- reasociar cada renglon devuelto con un dato que solo vive en el estado local del cliente, que
-- es justo lo que aqui hace falta (el medicamento elegido por renglon, medicamentoId, que no es
-- columna de donacion_detalle).
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
    INSERT INTO public.donacion_detalle (donacion_id, descripcion, cantidad, unidad, monto)
    VALUES (
      v_donacion.id,
      v_renglon ->> 'descripcion',
      NULLIF(v_renglon ->> 'cantidad', '')::NUMERIC,
      v_renglon ->> 'unidad',
      NULLIF(v_renglon ->> 'monto', '')::NUMERIC
    )
    RETURNING id INTO v_detalle_id;

    v_ids_detalle := v_ids_detalle || to_jsonb(v_detalle_id);
  END LOOP;

  RETURN jsonb_build_object('donacion', to_jsonb(v_donacion), 'detalleIds', v_ids_detalle);
END;
$$;

COMMENT ON FUNCTION fn_registrar_donacion(UUID, tipo_donacion, DATE, JSONB, UUID, TEXT) IS
  'Inserta una donacion y todos sus renglones de donacion_detalle en una sola transaccion '
  '(issue #635, criterio 1): si un renglon falla, revierte tambien la donacion. registrado_por '
  'sale de auth.uid(), nunca de un parametro del cliente (criterio 4). No es SECURITY DEFINER: '
  'la politica de INSERT de donaciones y donacion_detalle (00083, es_administrador()) sigue '
  'siendo la que decide quien puede llamarla (criterio 5). Devuelve JSONB '
  '{ donacion, detalleIds } en vez de RETURNS donaciones: detalleIds trae el id real de cada '
  'renglon de donacion_detalle, en el mismo orden que p_detalle, que es lo que necesita el paso '
  'posterior (fuera de alcance de #635) de generar el ingreso de inventario por renglon.';

GRANT EXECUTE ON FUNCTION fn_registrar_donacion(UUID, tipo_donacion, DATE, JSONB, UUID, TEXT)
  TO authenticated;

-- Sin este REVOKE la funcion nace ejecutable por PUBLIC, que es el comportamiento por defecto de
-- Postgres (ver 00102, issue #511). La prueba privilegios_anon.sql lo comprueba.
REVOKE EXECUTE ON FUNCTION fn_registrar_donacion(UUID, tipo_donacion, DATE, JSONB, UUID, TEXT)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION fn_anular_donacion(
  p_donacion_id UUID,
  p_motivo TEXT
)
RETURNS donaciones
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_donacion public.donaciones;
BEGIN
  UPDATE public.donaciones
  SET estado = 'anulada',
      motivo_anulacion = p_motivo,
      anulada_por = auth.uid(),
      anulada_en = NOW()
  WHERE id = p_donacion_id
    AND estado = 'registrada'
  RETURNING * INTO v_donacion;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La donacion no existe o ya esta anulada.';
  END IF;

  RETURN v_donacion;
END;
$$;

COMMENT ON FUNCTION fn_anular_donacion(UUID, TEXT) IS
  'Anula una donacion en vez de borrarla, exigiendo el motivo (issue #635, criterio 7). '
  'anulada_por y anulada_en salen de auth.uid()/NOW() dentro de la funcion, nunca de un '
  'parametro del cliente, mismo criterio que fn_registrar_donacion. El WHERE estado = '
  '''registrada'' mas el IF NOT FOUND impiden anular dos veces la misma donacion (o anular una '
  'que no existe) sin depender de que ninguna columna de donaciones sea nullable. No es '
  'SECURITY DEFINER: la politica de UPDATE de donaciones (00083, es_administrador() y '
  'motivo_anulacion no vacio) sigue siendo la que decide quien puede llamarla.';

GRANT EXECUTE ON FUNCTION fn_anular_donacion(UUID, TEXT) TO authenticated;

-- Sin este REVOKE la funcion nace ejecutable por PUBLIC, que es el comportamiento por defecto de
-- Postgres (ver 00102, issue #511). La prueba privilegios_anon.sql lo comprueba.
REVOKE EXECUTE ON FUNCTION fn_anular_donacion(UUID, TEXT) FROM PUBLIC;
