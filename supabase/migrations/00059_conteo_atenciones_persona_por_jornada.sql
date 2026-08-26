-- Ecopac Digital - Conteo de atenciones de una persona, por jornada (issue #175, criterio 4)
--
-- Ni consultas ni triajes son propiedad de jornadas/api.js (ver el encabezado de ese
-- archivo): mismo motivo por el que personal_registro_atenciones (00044) y
-- fn_contar_atenciones_incompletas (00051) existen como funciones SQL invocadas por RPC en vez
-- de una consulta directa desde ahi. Esta funcion reusa el mismo join que
-- personal_registro_atenciones entre triajes y atenciones para llegar a jornada_id, pero
-- agrupado por jornada en vez de EXISTS de una sola jornada, para que
-- obtenerJornadasDePersona() no dispare una llamada RPC por cada jornada de la lista (N+1).
--
-- Tres contadores, no uno: "consultas" y "triajes" son conteos de eventos clinicos
-- (consultas.medico_id y triajes.tomado_por, tal como los nombra el criterio de aceptacion);
-- "pacientes" es COUNT(DISTINCT paciente_id) sobre la union de ambos, porque una misma persona
-- puede triajear y despues consultar al mismo paciente en la misma jornada -- dos eventos
-- legitimos, pero un solo paciente atendido. Este ultimo numero es el que hay que usar contra
-- el total de la jornada: vista_reporte_impacto.pacientes_atendidos (00027) tambien es
-- COUNT(DISTINCT paciente_id), no un conteo de eventos, asi que "pacientes" es el unico de los
-- tres que se puede comparar contra ese total en una barra de avance.
--
-- SECURITY INVOKER, igual que personal_registro_atenciones: respeta las politicas de SELECT de
-- consultas y triajes (00033) tal como estan hoy (administrador y medico para consultas;
-- administrador, medico y voluntario para triajes), y como el join a atenciones para llegar al
-- paciente exige esos mismos roles como minimo (00033: "Administrador, medico y voluntario
-- leen atenciones", identico conjunto que triajes), ninguna de las dos rutas queda mas
-- restringida por el join de lo que ya estaba por su propia tabla. Junta directiva y socio
-- fundador no tienen SELECT sobre ninguna de las tres tablas (consultas, triajes, atenciones):
-- para esos dos roles el CTE eventos queda vacio y esta funcion no devuelve ninguna fila para
-- ninguna jornada, aunque la persona si haya atendido pacientes -- quien la invoca por RPC no
-- puede distinguir "sin actividad" de "sin permiso para verla". Es responsabilidad de quien
-- consume esta funcion (obtenerJornadasDePersona() de packages/shared/jornadas/api.js) asignar
-- { consultas: 0, triajes: 0, pacientes: 0 } a toda jornada que no aparezca en este resultado;
-- esta funcion no rellena ceros por su cuenta. Con voluntario general el efecto es mas sutil:
-- si lee triajes y atenciones pero no consultas, el conteo de "pacientes" tambien queda
-- incompleto (solo cuenta los alcanzados por triaje), sin que nada lo distinga de un conteo
-- completo. No es un defecto de esta funcion: es el limite conocido de que RLS filtra filas en
-- un SELECT sin avisar. No se corrige aqui porque hacerlo (por ejemplo con SECURITY DEFINER)
-- significaria que esta funcion decida permisos por su cuenta, que es justo lo que el
-- criterio de aceptacion 6 de la issue #175 prohibe.
CREATE OR REPLACE FUNCTION fn_atenciones_de_persona_por_jornada(p_perfil_id UUID)
RETURNS TABLE(jornada_id UUID, consultas INT, triajes INT, pacientes INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH eventos AS (
    SELECT
      con.jornada_id AS jid,
      a.paciente_id AS paciente_id,
      'consulta' AS tipo
    FROM public.consultas con
    JOIN public.atenciones a ON a.id = con.atencion_id
    WHERE con.medico_id = p_perfil_id

    UNION ALL

    SELECT
      a.jornada_id AS jid,
      a.paciente_id AS paciente_id,
      'triaje' AS tipo
    FROM public.triajes t
    JOIN public.atenciones a ON a.id = t.atencion_id
    WHERE t.tomado_por = p_perfil_id
  )
  SELECT
    eventos.jid AS jornada_id,
    COUNT(*) FILTER (WHERE eventos.tipo = 'consulta')::INT AS consultas,
    COUNT(*) FILTER (WHERE eventos.tipo = 'triaje')::INT AS triajes,
    COUNT(DISTINCT eventos.paciente_id)::INT AS pacientes
  FROM eventos
  GROUP BY eventos.jid;
$$;

COMMENT ON FUNCTION fn_atenciones_de_persona_por_jornada(UUID) IS
  'Cuenta, por jornada, las consultas (consultas.medico_id), los triajes (triajes.tomado_por) y los pacientes distintos alcanzados por cualquiera de las dos vias, para un perfil dado. Solo devuelve una fila por jornada donde hubo al menos un evento visible para quien llama; una jornada sin actividad clinica de esa persona, o cuya actividad RLS no deja ver, simplemente no aparece en el resultado -- son el mismo caso para esta funcion. Quien la consume (obtenerJornadasDePersona() de packages/shared/jornadas/api.js) le asigna { consultas: 0, triajes: 0, pacientes: 0 } a toda jornada ausente. Issue #175, criterio 4. No es SECURITY DEFINER: respeta las politicas de SELECT de consultas, triajes y atenciones (00033), igual que personal_registro_atenciones (00044) y fn_contar_atenciones_incompletas (00051). Junta directiva y socio fundador no tienen SELECT sobre ninguna de las tres tablas: para ellos esta funcion no devuelve ninguna fila, para ninguna jornada, sin importar la actividad real. Voluntario general lee triajes y atenciones pero no consultas: para ese rol el conteo de pacientes tambien queda incompleto (solo cuenta los alcanzados por triaje), sin que nada lo distinga de un conteo completo -- limite conocido de RLS, no de esta funcion.';

GRANT EXECUTE ON FUNCTION fn_atenciones_de_persona_por_jornada(UUID) TO authenticated;
