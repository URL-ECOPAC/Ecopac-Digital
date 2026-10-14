-- Ecopac Digital - es_consultivo() y correccion de las politicas que dejaban fuera a socio
-- fundador. Issue #404.
--
-- socio fundador es uno de los cinco valores de rol_usuario, esta en ROLES_CONSULTIVOS
-- (packages/shared/usuarios/roles.js) y el equipo decidio que tiene los mismos permisos que
-- junta directiva: gobernanza de solo lectura. Pero ninguna politica RLS lo incluia: diez
-- puntos del esquema comparaban el rol a mano contra 'junta directiva' y ninguno consideraba
-- al otro rol consultivo. Resultado: un socio fundador ve los modulos en el menu y la base le
-- devuelve cero filas en todos.
--
-- Correccion del comentario de la 00039 (lineas 11-12: "Socio fundador queda fuera de las
-- cinco tablas, lectura literal del DoD"): esa lectura era la de la issue #90 en su momento,
-- pero contradice el seed de permisos (00003), ROLES_CONSULTIVOS y navegacion.js, que siempre
-- trataron a socio fundador como igual a junta directiva. La 00039 no se edita (una migracion
-- aplicada no se toca), pero la decision vigente desde esta migracion en adelante es que los
-- dos roles consultivos tienen exactamente los mismos permisos, sin excepcion en jornadas,
-- jornada_personal ni proyectos.
--
-- Fuera de alcance a proposito: las cuatro politicas de lectura sobre atenciones, consultas,
-- recetas y receta_detalle (00041) NO se tocan aqui. Junta directiva y socio fundador no deben
-- ver filas clinicas (issue #407, ver 00054): esas cuatro son un caso deliberadamente distinto
-- de "solo lectura de gobernanza", no un olvido que esta migracion venga a corregir.

-- ============================================================================
-- 1. es_consultivo() -- mismo patron que es_administrador() (00004): STABLE, delega en
--    rol_actual(), sin SECURITY DEFINER propio.
-- ============================================================================
CREATE OR REPLACE FUNCTION es_consultivo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.rol_actual() IN ('junta directiva', 'socio fundador'), FALSE);
$$;

COMMENT ON FUNCTION es_consultivo() IS
  'TRUE si el usuario autenticado es junta directiva o socio fundador: los dos roles de '
  'gobernanza de solo lectura, con permisos identicos (issue #404). Reemplaza las '
  'comparaciones a mano contra ''junta directiva'' que dejaban fuera a socio fundador.';

-- ============================================================================
-- 2. jornadas, jornada_personal y proyectos (00039)
-- ============================================================================
ALTER POLICY "Administrador y junta directiva leen todas las jornadas; el personal asignado lee las suyas"
  ON jornadas
  USING (
    public.es_administrador()
    OR public.es_consultivo()
    OR public.participa_en_jornada(id)
  );

ALTER POLICY "Administrador y junta directiva leen asignaciones; cada quien lee la suya"
  ON jornada_personal
  USING (
    public.es_administrador()
    OR public.es_consultivo()
    OR perfil_id = auth.uid()
  );

ALTER POLICY "Administrador y junta directiva leen proyectos"
  ON proyectos
  USING (public.es_administrador() OR public.es_consultivo());

-- ============================================================================
-- 3. comunidades, para reportes (00041)
-- ============================================================================
ALTER POLICY "Administrador y junta directiva leen comunidades para reportes"
  ON comunidades
  USING (public.es_administrador() OR public.es_consultivo());

-- ============================================================================
-- 4. gastos (00052). El comentario de cabecera de esa migracion ya anunciaba este refactor:
--    "es_consultivo() (issue #404) resolveria esto en una sola condicion... queda pendiente
--    de refactor cuando el #404 se mergee".
-- ============================================================================
ALTER POLICY "Administrador, junta directiva y socio fundador leen todos los gastos; el personal asignado lee los de su jornada"
  ON gastos
  USING (
    public.es_administrador()
    OR public.es_consultivo()
    OR public.participa_en_jornada(jornada_id)
  );

-- ============================================================================
-- 5. proyecto_hitos y proyecto_seguimiento (00053)
-- ============================================================================
ALTER POLICY "Administrador y junta directiva leen los hitos"
  ON proyecto_hitos
  USING (public.es_administrador() OR public.es_consultivo());

ALTER POLICY "Administrador y junta directiva leen la bitacora"
  ON proyecto_seguimiento
  USING (public.es_administrador() OR public.es_consultivo());

-- ============================================================================
-- 6. Vistas: no soportan RLS ni ALTER POLICY, se vuelven a declarar con CREATE OR REPLACE
--    VIEW (mismo mecanismo que ya uso la 00064 para vista_reporte_impacto). El cuerpo es
--    identico al original, solo cambia el WHERE.
-- ============================================================================

-- perfiles_directorio (00038)
CREATE OR REPLACE VIEW perfiles_directorio AS
SELECT
  id,
  nombres,
  apellidos,
  rol,
  activo,
  fecha_ingreso,
  created_at,
  updated_at,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN telefono END AS telefono,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN email END AS email
FROM perfiles
WHERE public.es_administrador() OR public.es_consultivo() OR id = auth.uid();

COMMENT ON VIEW perfiles_directorio IS
  'Perfiles sin datos de contacto sensibles (telefono, email) salvo para administrador y para '
  'el propio perfil. Los roles consultivos leen perfiles exclusivamente por aqui: la politica '
  'de SELECT sobre la tabla base perfiles no les da acceso de fila, para que no puedan '
  'saltarse la mascara con un SELECT directo a la tabla.';

-- pacientes_reporte (00041): subconjunto no identificable (id, comunidad_id), no una de las
-- cuatro tablas clinicas excluidas.
CREATE OR REPLACE VIEW pacientes_reporte
AS
SELECT id, comunidad_id
FROM pacientes
WHERE public.es_administrador() OR public.es_consultivo();

COMMENT ON VIEW pacientes_reporte IS
  'Subconjunto no identificable de pacientes (id, comunidad_id) para reportes agregados. '
  'SECURITY DEFINER: el owner lee la tabla base pacientes (sin politica para los roles '
  'consultivos, 00032); el WHERE de la vista restringe filas a administrador y a los dos '
  'roles consultivos. Acceso controlado por GRANT (las vistas no soportan RLS).';

-- vista_reporte_impacto: la version vigente es la de la 00064 (agrega proyecto_id/proyecto a
-- la de la 00054); se repite completa aqui, solo con el WHERE corregido.
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
WHERE public.es_administrador() OR public.es_consultivo();

COMMENT ON COLUMN vista_reporte_impacto.proyecto_id IS
  'Proyecto al que pertenece la jornada, o NULL si la jornada no cuelga de ninguno. Permite la agrupacion por proyecto que pide la issue #205.';

COMMENT ON COLUMN vista_reporte_impacto.proyecto IS
  'Nombre del proyecto, para etiquetar el grupo sin una segunda consulta.';

-- CREATE OR REPLACE conserva los privilegios de la vista, pero se repiten para que quede
-- explicito, mismo criterio que ya siguio la 00064.
GRANT SELECT ON vista_reporte_impacto TO authenticated;
REVOKE ALL ON vista_reporte_impacto FROM anon;

-- ============================================================================
-- 7. fn_reporte_pacientes_atendidos (00067): funcion, no vista. Se redeclara completa porque
--    Postgres no permite alterar solo el cuerpo; solo cambia la guarda de rol y el mensaje.
-- ============================================================================
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
  IF NOT (public.es_administrador() OR public.es_consultivo()) THEN
    RAISE EXCEPTION 'Solo administracion y los roles consultivos consultan el reporte de pacientes atendidos.';
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
  'fila del resultado identifica a un paciente, que es la regla que fija la 00054 (issue #407).';

GRANT EXECUTE ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE)
  TO authenticated;
