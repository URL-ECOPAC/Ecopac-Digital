-- Ecopac Digital - Una atencion solo se registra en una jornada en curso
-- Issue #172, RF-24. La regla de negocio dice que el personal solo puede registrar atenciones y
-- consultas mientras la jornada esta en curso.
--
-- POR QUE FALTABA LA MITAD
--
-- La 00018 ya protege `consultas` con el trigger trg_validar_jornada_en_curso. Pero `atenciones`
-- se quedo sin equivalente, y `atenciones` es la puerta ANTERIOR: es la fila que encola al
-- paciente en la jornada, y la consulta viene despues. Hasta ahora se podia encolar un paciente
-- en una jornada planificada, finalizada o cancelada, y el bloqueo recien aparecia al escribir
-- la consulta -- ya con la persona esperando.
--
-- POR QUE UNA FUNCION NUEVA Y NO REUSAR LA DE LA 00018
--
-- validar_jornada_en_curso() sirve tal cual: lee NEW.jornada_id, que `atenciones` tambien tiene
-- (00013). Lo que no sirve es su mensaje, que dice literalmente "No se puede registrar la
-- consulta", y aqui lo que se registra es una atencion. Un mensaje que nombra la tabla
-- equivocada manda a buscar el problema donde no esta.
--
-- La 00018 ya esta aplicada y no se edita (regla de AGENTS.md): se corrige hacia adelante con
-- una funcion propia para atenciones.
--
-- ESTA REGLA NO DEPENDE DEL CLIENTE
--
-- Es el criterio de aceptacion 4 de la issue. packages/shared/jornadas/validaciones.js publica
-- puedeRegistrarEnJornada(estado) y api.js publica puedeRegistrarConsulta(jornadaId), pero eso
-- es para deshabilitar el formulario y explicar el motivo. Quien de verdad lo impide es este
-- trigger, que corre aunque la peticion llegue por fuera de la aplicacion.

CREATE OR REPLACE FUNCTION validar_jornada_en_curso_atenciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_jornada;
BEGIN
  SELECT estado INTO v_estado
  FROM public.jornadas
  WHERE id = NEW.jornada_id;

  IF v_estado IS NULL OR v_estado != 'en curso' THEN
    RAISE EXCEPTION
      'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: %).',
      COALESCE(v_estado::text, 'NO ENCONTRADA');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validar_jornada_en_curso_atenciones() IS
  'Valida que la jornada de la atencion este en curso antes de guardar (issue #172, RF-24). Es el
   equivalente para atenciones de validar_jornada_en_curso(), que la 00018 aplica a consultas.';

-- BEFORE INSERT OR UPDATE, igual que el de consultas: mover una atencion a otra jornada por UPDATE
-- es la misma operacion prohibida que crearla ahi.
CREATE TRIGGER trg_validar_jornada_en_curso_atenciones
BEFORE INSERT OR UPDATE ON atenciones
FOR EACH ROW
EXECUTE FUNCTION validar_jornada_en_curso_atenciones();
