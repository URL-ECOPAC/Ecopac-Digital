-- Ecopac Digital - Conectar los permisos finos a las politicas que deberian consumirlos.
-- Issue #409.
--
-- 00003/00037 sembraron nueve permisos fino en permisos/rol_permiso/usuario_permiso y 00004
-- escribio tiene_permiso(clave) para consultarlos, pero solo tres los usaban de verdad:
-- jornadas.gestionar (00039) y presupuestos.registrar/presupuestos.aprobar sobre gastos (00052).
-- Los otros seis existian en el catalogo sin que ninguna politica los consultara: conceder o
-- revocar uno de ellos en usuario_permiso no cambiaba nada en el servidor. Esta migracion conecta
-- los seis restantes, siguiendo el mismo patron ya probado: es_administrador() OR
-- tiene_permiso('<clave>'), siempre sumado con OR, nunca en lugar de es_administrador().
--
-- pacientes.editar        -> UPDATE de pacientes y expedientes (00032)
-- inventario.aprobar      -> UPDATE de movimientos_inventario (00048, reemplazo de 00034)
-- donaciones.registrar    -> INSERT de donantes, donaciones y donacion_detalle (00083)
-- proyectos.gestionar     -> INSERT y UPDATE de proyectos (00039)
-- usuarios.gestionar_permisos -> INSERT/UPDATE/DELETE de usuario_permiso (00038)
-- reportes.exportar       -> vista_reporte_impacto, pacientes_reporte y
--                            fn_reporte_pacientes_atendidos (00080). No son politicas: Postgres
--                            no soporta RLS sobre vistas, asi que se redeclaran completas con
--                            CREATE OR REPLACE, cambiando solo el WHERE/la guarda.
--
-- Ademas cierra un vacio de diseno que el DoD exige y que no existia en ningun lado: nada
-- impedia que un administrador concediera por usuario_permiso un permiso de escritura a un
-- perfil junta directiva o socio fundador, que son consultivos por definicion (00037, 00080).
-- Se agrega un trigger, mismo patron que impedir_cambio_de_rol_propio (00038).
--
-- Nota sobre pacientes.editar: la politica de UPDATE de pacientes/expedientes (00032) ya traia
-- "OR rol_actual() = 'medico'" ademas de es_administrador(). medico tambien recibe
-- pacientes.editar por rol_permiso desde la 00003, cuyo propio comentario dice que el permiso
-- fino "refuerza" el acceso que el rol ya da: la lectura correcta es que ese refuerzo reemplaza
-- el chequeo de rol hardcodeado, no que conviva con el. Dejar los dos branches habria hecho
-- imposible de probar la revocacion puntual (el DoD exige una prueba que revoque un permiso que
-- el rol si daba: con "OR rol_actual() = 'medico'" todavia ahi, revocar pacientes.editar a un
-- medico no habria cambiado nada, porque el otro branch lo seguiria permitiendo). Por eso este
-- ALTER POLICY reemplaza el branch de rol por el permiso fino en vez de sumarlo.



-- ============================================================================
-- 0. Corregir la descripcion de inventario.aprobar (00003): el enum estado_movimiento (00023)
--    usa 'pendiente', nunca "pendiente de validacion".
-- ============================================================================
UPDATE permisos
SET descripcion = 'Aprobar movimientos de inventario en estado pendiente.'
WHERE clave = 'inventario.aprobar';

-- ============================================================================
-- 1. pacientes.editar (00032)
-- ============================================================================
ALTER POLICY "Administrador y medico editan pacientes"
  ON pacientes
  USING (public.es_administrador() OR public.tiene_permiso('pacientes.editar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('pacientes.editar'));

ALTER POLICY "Administrador y medico editan expedientes"
  ON expedientes
  USING (public.es_administrador() OR public.tiene_permiso('pacientes.editar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('pacientes.editar'));

-- ============================================================================
-- 2. inventario.aprobar (00048, nombre de politica vigente desde esa migracion)
-- ============================================================================
ALTER POLICY "Administrador aprueba o rechaza"
  ON movimientos_inventario
  USING (public.es_administrador() OR public.tiene_permiso('inventario.aprobar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('inventario.aprobar'));

-- ============================================================================
-- 3. donaciones.registrar (00083, nombres de politica vigentes desde esa migracion)
-- ============================================================================
ALTER POLICY "Solo administrador registra donantes"
  ON donantes
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Solo administrador registra donaciones"
  ON donaciones
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Solo administrador registra donacion_detalle"
  ON donacion_detalle
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

-- Las tres politicas de SELECT de la 00083 ("Administrador y consultivos leen <tabla>") tambien
-- se amplian con OR tiene_permiso('donaciones.registrar'). Encontrado probando en vivo contra
-- Postgres real (no en pgTAP): Postgres exige que la fila recien insertada tambien pase una
-- politica de SELECT cuando el INSERT lleva RETURNING -- y `.insert(...).select()` de
-- supabase-js (el patron real de packages/shared/donaciones/donantes.api.js) siempre pide
-- RETURNING. Sin este OR, quien recibe donaciones.registrar puntualmente registra la fila pero
-- Postgres la rechaza igual con "new row violates row-level security policy", porque no puede
-- devolverla: el INSERT nunca llega a confirmarse.
ALTER POLICY "Administrador y consultivos leen donantes"
  ON donantes
  USING (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Administrador y consultivos leen donaciones"
  ON donaciones
  USING (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Administrador y consultivos leen donacion_detalle"
  ON donacion_detalle
  USING (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('donaciones.registrar'));

-- ============================================================================
-- 4. proyectos.gestionar (00039)
-- ============================================================================
ALTER POLICY "Solo administrador crea proyectos"
  ON proyectos
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

ALTER POLICY "Solo administrador actualiza proyectos"
  ON proyectos
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

-- Mismo motivo que donantes/donaciones/donacion_detalle arriba: crearProyecto()
-- (packages/shared/proyectos/api.js) hace `.insert(...).select().single()`, y sin este OR en
-- la politica de SELECT, Postgres rechaza el INSERT con RETURNING aunque el WITH CHECK de la
-- politica de INSERT ya lo permitiera. Probado en vivo: sin este OR, un voluntario con
-- proyectos.gestionar concedido recibia 42501 al crear un proyecto a traves de la API real.
ALTER POLICY "Administrador y junta directiva leen proyectos"
  ON proyectos
  USING (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('proyectos.gestionar'));

-- ============================================================================
-- 5. usuarios.gestionar_permisos (00038)
-- ============================================================================
ALTER POLICY "Solo administrador escribe usuario_permiso"
  ON usuario_permiso
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('usuarios.gestionar_permisos'));

ALTER POLICY "Solo administrador actualiza usuario_permiso"
  ON usuario_permiso
  USING (public.es_administrador() OR public.tiene_permiso('usuarios.gestionar_permisos'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('usuarios.gestionar_permisos'));

ALTER POLICY "Solo administrador borra usuario_permiso"
  ON usuario_permiso
  USING (public.es_administrador() OR public.tiene_permiso('usuarios.gestionar_permisos'));

-- Mismo motivo que donantes/donaciones/donacion_detalle y proyectos arriba: un INSERT o UPDATE
-- con RETURNING (ej. `.insert(...).select()` de supabase-js) exige que la fila tambien pase una
-- politica de SELECT. La politica de SELECT de la 00038 solo deja ver la fila propia
-- (`perfil_id = auth.uid()`), asi que sin este OR, alguien con usuarios.gestionar_permisos que
-- conceda un permiso a UN TERCERO (el caso de uso real del permiso) no puede recibir esa fila
-- de vuelta: Postgres la trata como si el INSERT hubiera violado RLS. La API real
-- (permisos.api.js, escribirExcepcion) no pide RETURNING hoy, pero cualquier consulta directa a
-- la tabla o un cambio futuro que si lo pida se topaba con este mismo defecto.
ALTER POLICY "Administrador o el propio perfil leen usuario_permiso"
  ON usuario_permiso
  USING (public.es_administrador() OR perfil_id = auth.uid() OR public.tiene_permiso('usuarios.gestionar_permisos'));

-- ============================================================================
-- 6. reportes.exportar: vistas y funcion, no politicas. Se redeclaran completas (Postgres no
--    permite alterar solo el WHERE de una vista ni el cuerpo de una funcion). El cuerpo es
--    identico al vigente desde la 00080, solo cambia el WHERE/la guarda.
-- ============================================================================
CREATE OR REPLACE VIEW pacientes_reporte
AS
SELECT id, comunidad_id
FROM pacientes
WHERE public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('reportes.exportar');

COMMENT ON VIEW pacientes_reporte IS
  'Subconjunto no identificable de pacientes (id, comunidad_id) para reportes agregados. '
  'SECURITY DEFINER: el owner lee la tabla base pacientes (sin politica para los roles '
  'consultivos, 00032); el WHERE de la vista restringe filas a administrador, a los dos '
  'roles consultivos y a quien tenga el permiso fino reportes.exportar (issue #409). Acceso '
  'controlado por GRANT (las vistas no soportan RLS).';

CREATE OR REPLACE VIEW vista_reporte_impacto
WITH (security_invoker = FALSE)
AS
WITH pacientes_por_jornada AS (
  SELECT
    a.jornada_id,
    COUNT(DISTINCT a.paciente_id) AS pacientes_atendidos
  FROM atenciones a
  GROUP BY a.jornada_id
),
consultas_por_jornada AS (
  SELECT
    c.jornada_id,
    COUNT(*) AS consultas_realizadas
  FROM consultas c
  GROUP BY c.jornada_id
),
entregas_por_jornada AS (
  SELECT
    c.jornada_id,
    COUNT(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(SUM(rd.cantidad_entregada), 0) AS medicamentos_utilizados
  FROM consultas c
  JOIN recetas r ON r.consulta_id = c.id
  LEFT JOIN receta_detalle rd ON rd.receta_id = r.id
  GROUP BY c.jornada_id
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0) AS medicamentos_utilizados,
  j.proyecto_id,
  pr.nombre AS proyecto
FROM jornadas j
JOIN comunidades com ON com.id = j.comunidad_id
LEFT JOIN proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_jornada p ON p.jornada_id = j.id
LEFT JOIN consultas_por_jornada cs ON cs.jornada_id = j.id
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id
WHERE public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('reportes.exportar');

COMMENT ON COLUMN vista_reporte_impacto.proyecto_id IS
  'Proyecto al que pertenece la jornada, o NULL si la jornada no cuelga de ninguno. Permite la agrupacion por proyecto que pide la issue #205.';

COMMENT ON COLUMN vista_reporte_impacto.proyecto IS
  'Nombre del proyecto, para etiquetar el grupo sin una segunda consulta.';

-- CREATE OR REPLACE conserva los privilegios de la vista, pero se repiten para que quede
-- explicito, mismo criterio que ya siguieron 00064 y 00080.
GRANT SELECT ON vista_reporte_impacto TO authenticated;
REVOKE ALL ON vista_reporte_impacto FROM anon;

CREATE OR REPLACE FUNCTION fn_reporte_pacientes_atendidos(
  p_agrupar_por TEXT DEFAULT 'jornada',
  p_jornada_id UUID DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS TABLE(
  grupo_id TEXT,
  grupo TEXT,
  pacientes INT,
  nuevos INT,
  recurrentes INT,
  hombres INT,
  mujeres INT,
  menores INT,
  adultos INT,
  adultos_mayores INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('reportes.exportar')) THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene reportes.exportar consultan el reporte de pacientes atendidos.';
  END IF;

  IF p_agrupar_por NOT IN ('jornada', 'comunidad', 'periodo') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use jornada, comunidad o periodo.', p_agrupar_por;
  END IF;

  RETURN QUERY
  WITH atendidos AS (
    SELECT
      a.paciente_id,
      j.id AS jornada_id,
      j.nombre AS jornada_nombre,
      j.fecha AS jornada_fecha,
      c.id AS comunidad_id,
      c.nombre AS comunidad_nombre,
      p.sexo,
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad,
      MIN(j.fecha) OVER (PARTITION BY a.paciente_id) AS primera_fecha_del_periodo
    FROM public.atenciones a
    JOIN public.jornadas j ON j.id = a.jornada_id
    JOIN public.pacientes p ON p.id = a.paciente_id
    JOIN public.comunidades c ON c.id = j.comunidad_id
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Un paciente es nuevo si la primera jornada en la que aparece en este reporte es tambien la
  -- primera en la que se le atendio en toda su historia. Si ya lo habian atendido en una
  -- jornada anterior, es recurrente. Se compara contra atenciones completo, no contra el
  -- subconjunto filtrado: de otro modo, filtrar por una jornada haria pasar por nuevo a quien
  -- ya venia asistiendo.
  --
  -- La cronologia sale de jornadas.fecha y no de atenciones.created_at a proposito:
  -- created_at es la marca tecnica de cuando se capturo la fila, que en una carga masiva o en
  -- una misma transaccion es identica para todas y no ordena nada. La fecha de la jornada es
  -- la fecha clinica real, que es la que este reporte mide.
  clasificados AS (
    SELECT DISTINCT ON (t.paciente_id, t.jornada_id)
      t.*,
      NOT EXISTS (
        SELECT 1
        FROM public.atenciones previa
        JOIN public.jornadas jp ON jp.id = previa.jornada_id
        WHERE previa.paciente_id = t.paciente_id
          AND jp.fecha < t.primera_fecha_del_periodo
      ) AS es_nuevo
    FROM atendidos t
  ),
  -- Una fila por paciente y grupo: si alguien fue atendido dos veces en la misma jornada,
  -- cuenta como un paciente atendido, no como dos.
  por_grupo AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_id::TEXT
        WHEN 'comunidad' THEN cl.comunidad_id::TEXT
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_nombre
        WHEN 'comunidad' THEN cl.comunidad_nombre
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_nombre,
      cl.paciente_id,
      bool_or(cl.es_nuevo) AS es_nuevo,
      min(cl.sexo) AS sexo,
      min(cl.edad) AS edad
    FROM clasificados cl
    GROUP BY 1, 2, cl.paciente_id
  )
  SELECT
    pg.g_id,
    pg.g_nombre,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE NOT pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE upper(pg.sexo) = 'M')::INT,
    COUNT(*) FILTER (WHERE upper(pg.sexo) = 'F')::INT,
    COUNT(*) FILTER (WHERE pg.edad < 18)::INT,
    COUNT(*) FILTER (WHERE pg.edad BETWEEN 18 AND 59)::INT,
    COUNT(*) FILTER (WHERE pg.edad >= 60)::INT
  FROM por_grupo pg
  GROUP BY pg.g_id, pg.g_nombre
  ORDER BY pg.g_nombre;
END;
$$;

COMMENT ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE) IS
  'Pacientes atendidos agregados por jornada, comunidad o mes, con el desglose por sexo y por '
  'rango de edad y la distincion entre pacientes nuevos y recurrentes (issue #202, RF-31). '
  'Cuenta pacientes distintos, no atenciones: dos atenciones del mismo paciente en la misma '
  'jornada son un solo paciente atendido. La edad se calcula a la fecha de la jornada, no a la '
  'de hoy, para que un reporte de hace tres anios no envejezca con el tiempo. SECURITY DEFINER '
  'con guarda de rol explicita, mismo criterio que la vista pacientes_reporte (00041): los '
  'roles consultivos no tienen politica de SELECT sobre pacientes (00032), y esta funcion '
  'necesita sexo y fecha_nacimiento para los desgloses. Devuelve UNICAMENTE agregados: ninguna '
  'fila del resultado identifica a un paciente, que es la regla que fija la 00054 (issue #407). '
  'La guarda tambien admite reportes.exportar (issue #409).';

GRANT EXECUTE ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE)
  TO authenticated;

-- ============================================================================
-- 7. Guardia: ningun permiso fino de escritura sube a un rol consultivo. reportes.exportar es
--    el unico de lectura y queda exento a proposito (junta directiva/socio fundador ya lo
--    reciben por defecto, 00003). Mismo patron que impedir_cambio_de_rol_propio (00038): no es
--    expresable en un USING/WITH CHECK porque necesita mirar el rol del PERFIL objetivo de la
--    fila, no el de quien ejecuta la operacion.
-- ============================================================================
CREATE OR REPLACE FUNCTION impedir_permiso_escritura_a_consultivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.concedido
     AND EXISTS (
       SELECT 1 FROM public.perfiles pe
       WHERE pe.id = NEW.perfil_id AND pe.rol IN ('junta directiva', 'socio fundador')
     )
     AND EXISTS (
       SELECT 1 FROM public.permisos p
       WHERE p.id = NEW.permiso_id AND p.clave <> 'reportes.exportar'
     )
  THEN
    RAISE EXCEPTION 'Un rol consultivo no puede recibir un permiso de escritura.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION impedir_permiso_escritura_a_consultivo() IS
  'Bloquea conceder (usuario_permiso.concedido = true) cualquier permiso fino distinto de '
  'reportes.exportar a un perfil junta directiva o socio fundador: son consultivos por '
  'definicion (00037, 00080) y ningun permiso fino los debe convertir en escritores (issue #409).';

CREATE TRIGGER trg_usuario_permiso_impedir_escalada_consultivo
BEFORE INSERT OR UPDATE ON usuario_permiso
FOR EACH ROW
EXECUTE FUNCTION impedir_permiso_escritura_a_consultivo();

-- ============================================================================
-- 8. fn_aplicar_ajuste_existencias pasa a SECURITY DEFINER. Encontrado al probar
--    inventario.aprobar en la practica: aprobar un movimiento dispara fn_actualizar_existencias
--    (00047), que llama a esta funcion para ajustar existencias. Como esta funcion corria
--    SECURITY INVOKER, un administrador podia aprobar (tiene GRANT de escritura sobre
--    existencias, 00034) pero un no-administrador con inventario.aprobar concedido por
--    usuario_permiso no: su UPDATE sobre movimientos_inventario pasaba la politica de la
--    seccion 2 de arriba, pero el trigger fallaba con 42501 al intentar escribir existencias,
--    porque ese GRANT sigue siendo exclusivo de administrador (00034) y no tiene sentido
--    dárselo a nivel de tabla solo para este caso. Mismo criterio que el resto de triggers de
--    efecto secundario del esquema (impedir_cambio_de_rol_propio, registrar_evento_auditoria):
--    la autorizacion real ya la decidio la politica de la tabla que dispara el trigger
--    (movimientos_inventario); el efecto secundario sobre otra tabla debe correr con los
--    privilegios del dueno, no con los de quien disparo el trigger. Firma identica a la de
--    00047, asi que CREATE OR REPLACE la reemplaza sin necesitar DROP FUNCTION.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_aplicar_ajuste_existencias(
  p_lote_id UUID,
  p_bodega_id UUID,
  p_tipo tipo_movimiento,
  p_cantidad INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  SELECT fecha_vencimiento INTO v_fecha_vencimiento
  FROM public.lotes
  WHERE id = p_lote_id;

  SELECT cantidad_disponible INTO v_stock_actual
  FROM public.existencias
  WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id
  FOR UPDATE;

  v_stock_actual := COALESCE(v_stock_actual, 0);

  IF p_tipo = 'salida' THEN
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
    END IF;

    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
    END IF;

    UPDATE public.existencias
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        updated_at = NOW()
    WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id;

  ELSIF p_tipo = 'ingreso' THEN
    INSERT INTO public.existencias (lote_id, bodega_id, cantidad_disponible)
    VALUES (p_lote_id, p_bodega_id, p_cantidad)
    ON CONFLICT (lote_id, bodega_id) DO UPDATE
    SET cantidad_disponible = existencias.cantidad_disponible + EXCLUDED.cantidad_disponible,
        updated_at = NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_aplicar_ajuste_existencias(UUID, UUID, tipo_movimiento, INT) IS
  'Ajusta existencias.cantidad_disponible para la fila (lote_id, bodega_id). En salida exige '
  'stock suficiente y lote vigente (fecha_vencimiento contra lotes); en ingreso hace upsert '
  'porque puede no existir aun fila de existencias para esa combinacion. Issue #369: '
  'reemplaza el ajuste sobre lotes_existencias (00028). SECURITY DEFINER desde la 00086: el '
  'efecto secundario de aprobar un movimiento (issue #409, inventario.aprobar delegado a un '
  'no-administrador) no debe depender de que quien aprueba tenga tambien GRANT de escritura '
  'sobre existencias.';
