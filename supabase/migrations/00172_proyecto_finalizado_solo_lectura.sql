-- ============================================================================
-- 00172: un proyecto finalizado tampoco se modifica
-- ============================================================================
--
-- La 00154 dejo de solo consulta a un proyecto cancelado. Uno finalizado (cerrado) seguia abierto:
-- se le cambiaba el nombre, el avance, la bitacora, los hitos, el equipo, las jornadas y los
-- insumos previstos. `finalizado` es tan terminal como `cancelado` desde la 00029 -no se reabre-, y
-- la organizacion pidio lo mismo para los dos: cerrado no tiene vuelta atras.
--
-- Se reemplazan los cuerpos de las dos funciones de la 00154; los triggers que las llaman no
-- cambian. Los nombres siguen diciendo "cancelado" porque renombrarlas obligaria a soltar y volver
-- a crear ocho triggers por un nombre; el COMMENT dice lo que hacen ahora.
--
-- Finalizar (en curso -> finalizado) sigue funcionando: ahi el estado anterior todavia no lo es.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_proyecto_cancelado_no_se_modifica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.estado IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', OLD.estado
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_proyecto_cancelado_no_se_modifica() IS
  'Rechaza cualquier UPDATE de un proyecto cuyo estado ya es cancelado (00154) o finalizado (00172).';

CREATE OR REPLACE FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_proyectos UUID[] := ARRAY[]::UUID[];
  v_estado TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_proyectos := array_append(v_proyectos, OLD.proyecto_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_proyectos := array_append(v_proyectos, NEW.proyecto_id);
  END IF;

  SELECT p.estado::TEXT INTO v_estado
  FROM public.proyectos p
  WHERE p.id = ANY (v_proyectos)
    AND p.estado IN ('cancelado', 'finalizado')
  LIMIT 1;

  IF v_estado IS NOT NULL THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', v_estado
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado() IS
  'Rechaza escribir una fila que cuelga de un proyecto cancelado (00154) o finalizado (00172): hitos, seguimiento, equipo, insumos previstos y la asociacion de una jornada.';

REVOKE EXECUTE ON FUNCTION public.fn_proyecto_cancelado_no_se_modifica() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_proyecto_de_la_fila_no_esta_cancelado() FROM PUBLIC, anon, authenticated;
