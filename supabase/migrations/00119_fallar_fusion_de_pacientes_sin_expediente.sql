-- Ecopac Digital - fn_fusionar_pacientes falla si falta un expediente, en vez de saltarse las
-- consultas en silencio (issue #637)
--
-- POR QUE EXISTE ESTA MIGRACION
--
-- fn_fusionar_pacientes() (00101) reasigna consultas solo dentro de un
-- IF v_expediente_absorbido IS NOT NULL AND v_expediente_sobreviviente IS NOT NULL. Si algun dia
-- alguno de los dos pacientes no tuviera expediente, esa rama simplemente no corre: la fusion
-- sigue de largo, da de baja al absorbido e inserta la fila en fusiones_pacientes como si todo
-- hubiera salido bien, y las consultas de ese paciente quedan colgando de un expediente cuyo
-- dueno esta dado de baja -- justo el "fusionado a medias" que la funcion entera existe para
-- evitar (comentario de 00101: "Transaccional: todo o nada, para no dejar un paciente a medio
-- fusionar si algo falla a mitad de camino").
--
-- Hoy esto no es alcanzable con los datos que la aplicacion puede producir: registrarPaciente()
-- (packages/shared/pacientes/api.js) es el unico punto de escritura de la tabla pacientes y llama
-- a fn_registrar_paciente, que crea paciente y expediente juntos; expedientes no tiene ninguna
-- politica de DELETE (00032), asi que con RLS habilitado el borrado esta prohibido de fabrica. Es
-- decir: la rama que aqui se cierra es defensiva, no un bug activo hoy. Pero fallar en silencio
-- sobre una operacion irreversible es la clase de guarda que no queremos dejar dormida para el
-- dia en que ese supuesto deje de sostenerse (una importacion de datos legacy, una migracion de
-- otro sistema, un DELETE hecho con service_role saltandose RLS).
--
-- QUE CAMBIA
--
-- Se agrega el ELSE que faltaba: si no estan los dos expedientes, la funcion completa aborta con
-- RAISE EXCEPTION en vez de continuar con una fusion parcial. Mismo ERRCODE que ya usa la rama de
-- "el paciente sobreviviente o el absorbido no existen" (00101, linea 155-158): es la misma
-- familia de problema -una fila relacionada que deberia existir y no esta-, asi que
-- normalizarError() (packages/shared/api/errores-de-supabase.js) ya la clasifica como
-- LLAVE_FORANEA sin que haga falta tocar esa capa.
--
-- Ninguna otra linea de la funcion cambia: mismo cuerpo que 00101, verificado contra el archivo
-- antes de copiarlo. CREATE OR REPLACE basta -- no cambia la firma ni el tipo de retorno, asi que
-- el REVOKE/GRANT que la funcion ya tiene (00101, lineas 209-210) se conserva sin repetirlo, mismo
-- criterio que documenta la 00111.
CREATE OR REPLACE FUNCTION fn_fusionar_pacientes(
  p_sobreviviente_id UUID,
  p_absorbido_id UUID
)
RETURNS fusiones_pacientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expediente_sobreviviente UUID;
  v_expediente_absorbido UUID;
  v_fusion public.fusiones_pacientes;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora puede fusionar expedientes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_sobreviviente_id = p_absorbido_id THEN
    RAISE EXCEPTION 'Un paciente no se puede fusionar consigo mismo.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloquea las dos filas para que dos fusiones concurrentes sobre el mismo par no se pisen.
  PERFORM 1 FROM public.pacientes
    WHERE id IN (p_sobreviviente_id, p_absorbido_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El paciente sobreviviente o el absorbido no existen.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pacientes WHERE id = p_absorbido_id AND fecha_baja IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El expediente que se quiere absorber ya esta dado de baja o ya fue fusionado.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_expediente_sobreviviente FROM public.expedientes WHERE paciente_id = p_sobreviviente_id;
  SELECT id INTO v_expediente_absorbido FROM public.expedientes WHERE paciente_id = p_absorbido_id;

  UPDATE public.atenciones a
  SET paciente_id = p_sobreviviente_id
  WHERE a.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.atenciones s
      WHERE s.paciente_id = p_sobreviviente_id AND s.jornada_id = a.jornada_id
    );

  UPDATE public.padecimientos_cronicos p
  SET paciente_id = p_sobreviviente_id
  WHERE p.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.padecimientos_cronicos s
      WHERE s.paciente_id = p_sobreviviente_id AND s.condicion_id = p.condicion_id
    );

  IF v_expediente_absorbido IS NOT NULL AND v_expediente_sobreviviente IS NOT NULL THEN
    UPDATE public.consultas
    SET expediente_id = v_expediente_sobreviviente
    WHERE expediente_id = v_expediente_absorbido;
  ELSE
    RAISE EXCEPTION 'No se puede fusionar con seguridad: uno de los dos pacientes no tiene expediente.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Baja logica del absorbido: el mismo mecanismo que ya excluye buscarPacientes()/
  -- fn_buscar_pacientes (00068) de sus resultados. Resuelve el criterio 5 sin codigo nuevo.
  UPDATE public.pacientes
  SET fecha_baja = CURRENT_DATE
  WHERE id = p_absorbido_id;

  INSERT INTO public.fusiones_pacientes (paciente_absorbido_id, paciente_sobreviviente_id, realizada_por)
  VALUES (p_absorbido_id, p_sobreviviente_id, auth.uid())
  RETURNING * INTO v_fusion;

  RETURN v_fusion;
END;
$$;

COMMENT ON FUNCTION fn_fusionar_pacientes(UUID, UUID) IS
  'Fusiona dos expedientes: reasigna atenciones/condiciones/consultas sin violar sus UNIQUE, da de baja al absorbido y registra la fusion. Solo administrador (issue #140). Aborta si a alguno de los dos les falta el expediente, en vez de fusionar a medias (issue #637).';
