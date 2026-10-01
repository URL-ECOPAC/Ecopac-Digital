-- ============================================================================
-- 00166: el principio activo de un medicamento se puede cambiar
-- ============================================================================
--
-- El principio activo se asociaba solo al dar de alta el medicamento (fn_registrar_medicamento,
-- 00050) y despues no habia forma de corregirlo: medicamento_principio tenia INSERT y SELECT,
-- pero ni GRANT ni politica de DELETE. El formulario de edicion lo mostraba bloqueado con "no se
-- puede cambiar desde aqui", y no habia otro lugar donde hacerlo.
--
-- Cambiarlo es quitar la asociacion anterior y poner la nueva, y las dos cosas tienen que pasar
-- juntas: fn_cambiar_principio_de_medicamento lo hace en una sola transaccion. Si el articulo es
-- un insumo, se le quitan los principios que tenga (00164: un insumo no tiene principio activo),
-- que es lo que pasa al corregir un articulo que se habia dado de alta como medicamento.
--
-- Quien puede: los mismos que lo asocian al dar de alta (00148: administracion y personal de
-- campo). La funcion no es SECURITY DEFINER, como fn_registrar_medicamento: la deciden las
-- politicas de medicamento_principio. Por eso entra aqui el DELETE, con la misma condicion que el
-- INSERT.
-- ============================================================================

GRANT DELETE ON public.medicamento_principio TO authenticated;

CREATE POLICY "Administrador y personal de campo quitan principios"
  ON public.medicamento_principio
  FOR DELETE
  TO authenticated
  USING (public.es_administrador() OR public.es_personal_de_campo());

COMMENT ON POLICY "Administrador y personal de campo quitan principios"
  ON public.medicamento_principio IS
  'Quitar un principio activo de un medicamento, para cambiarlo (00166). Misma condicion que el INSERT (00148).';

CREATE OR REPLACE FUNCTION public.fn_cambiar_principio_de_medicamento(
  p_medicamento_id UUID,
  p_principio_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_tipo public.tipo_articulo;
BEGIN
  SELECT tipo_articulo INTO v_tipo FROM public.medicamentos WHERE id = p_medicamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El medicamento no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_tipo = 'medicamento' AND p_principio_id IS NULL THEN
    RAISE EXCEPTION 'Un medicamento debe tener un principio activo.' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.medicamento_principio
  WHERE medicamento_id = p_medicamento_id
    AND (v_tipo <> 'medicamento' OR principio_id <> p_principio_id);

  IF v_tipo = 'medicamento' THEN
    INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
    VALUES (p_medicamento_id, p_principio_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_cambiar_principio_de_medicamento(UUID, UUID) IS
  'Deja al medicamento con este principio activo y ningun otro, en una transaccion (00166). A un insumo le quita los que tenga. No es SECURITY DEFINER: la deciden las politicas de medicamento_principio.';

REVOKE EXECUTE ON FUNCTION public.fn_cambiar_principio_de_medicamento(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cambiar_principio_de_medicamento(UUID, UUID) TO authenticated;
