-- ============================================================================
-- 00164: un insumo no tiene principio activo ni concentracion
-- ============================================================================
--
-- La 00142 separo los articulos del catalogo en medicamentos e insumos (tipo_articulo), pero el
-- alta seguia pidiendo lo de un medicamento a todos: fn_registrar_medicamento (00050) exigia al
-- menos un principio activo y medicamentos.concentracion era NOT NULL. Un insumo -guantes,
-- jeringas, agujas, gasas- no tiene ni lo uno ni lo otro, y la unica forma de registrarlo era
-- inventarle un principio activo.
--
-- Desde aqui el principio activo y la concentracion son obligatorios solo para un medicamento.
-- Un insumo conserva lo que si tiene: nombre, presentacion y marca.
--
-- El CHECK entra NOT VALID: vale para toda fila nueva o que se edite, y no revisa las que ya
-- existen, que venian de una columna NOT NULL.
-- ============================================================================

ALTER TABLE public.medicamentos ALTER COLUMN concentracion DROP NOT NULL;

ALTER TABLE public.medicamentos
  ADD CONSTRAINT chk_medicamentos_concentracion_de_medicamento
  CHECK (tipo_articulo <> 'medicamento' OR length(btrim(coalesce(concentracion, ''))) > 0)
  NOT VALID;

COMMENT ON COLUMN public.medicamentos.concentracion IS
  'Concentracion del medicamento (500 mg). Obligatoria para un medicamento; un insumo no la tiene y queda en NULL (00164).';

CREATE OR REPLACE FUNCTION public.fn_registrar_medicamento(
  p_nombre CHARACTER VARYING,
  p_concentracion CHARACTER VARYING,
  p_presentacion_id UUID,
  p_marca CHARACTER VARYING,
  p_principios_ids UUID[],
  p_forma_farmaceutica CHARACTER VARYING DEFAULT NULL,
  p_es_pediatrico BOOLEAN DEFAULT false,
  p_tipo_articulo public.tipo_articulo DEFAULT 'medicamento'
)
RETURNS public.medicamentos
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_medicamento public.medicamentos;
  v_principio_id UUID;
  v_es_medicamento BOOLEAN := p_tipo_articulo = 'medicamento';
BEGIN
  IF v_es_medicamento AND (p_principios_ids IS NULL OR array_length(p_principios_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'Un medicamento debe registrarse con al menos un principio activo.'
      USING ERRCODE = '23514';
  END IF;

  -- Un insumo no guarda datos farmacologicos aunque lleguen.
  INSERT INTO public.medicamentos (
    nombre, concentracion, presentacion_id, marca, forma_farmaceutica, es_pediatrico,
    tipo_articulo
  )
  VALUES (
    p_nombre,
    CASE WHEN v_es_medicamento THEN p_concentracion END,
    p_presentacion_id,
    p_marca,
    CASE WHEN v_es_medicamento THEN p_forma_farmaceutica END,
    v_es_medicamento AND coalesce(p_es_pediatrico, false),
    p_tipo_articulo
  )
  RETURNING * INTO v_medicamento;

  IF v_es_medicamento THEN
    FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
      INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
      VALUES (v_medicamento.id, v_principio_id);
    END LOOP;
  END IF;

  RETURN v_medicamento;
END;
$$;

COMMENT ON FUNCTION public.fn_registrar_medicamento(CHARACTER VARYING, CHARACTER VARYING, UUID, CHARACTER VARYING, UUID[], CHARACTER VARYING, BOOLEAN, public.tipo_articulo) IS
  'Registra un articulo del catalogo en una transaccion. Un medicamento exige al menos un principio activo y su concentracion; un insumo no guarda principio, concentracion, forma farmaceutica ni uso pediatrico (00164).';
