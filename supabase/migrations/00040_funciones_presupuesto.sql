CREATE OR REPLACE FUNCTION presupuesto_de_jornada(p_jornada_id UUID)
RETURNS TABLE (
  asignado NUMERIC,
  gastado NUMERIC,
  disponible NUMERIC,
  pendiente NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    j.presupuesto_asignado,
    COALESCE(g.aprobado, 0),
    j.presupuesto_asignado - COALESCE(g.aprobado, 0),
    COALESCE(g.pendiente, 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.id = p_jornada_id;
$$;

COMMENT ON FUNCTION presupuesto_de_jornada(UUID) IS
  'Presupuesto de una jornada con el disponible ya restado. gastado suma solo los gastos aprobados; los que esperan aprobacion van en pendiente para que la pantalla pueda avisar de lo comprometido sin mezclarlo con el gasto real. SECURITY INVOKER para que las politicas RLS de jornadas y gastos se apliquen con la identidad de quien consulta. Devuelve cero filas si la jornada no existe o si RLS no la deja ver.';

CREATE OR REPLACE FUNCTION presupuesto_de_proyecto(p_proyecto_id UUID)
RETURNS TABLE (
  asignado NUMERIC,
  gastado NUMERIC,
  disponible NUMERIC,
  pendiente NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    COALESCE(SUM(j.presupuesto_asignado), 0),
    COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(j.presupuesto_asignado), 0) - COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(g.pendiente), 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.proyecto_id = p_proyecto_id;
$$;

COMMENT ON FUNCTION presupuesto_de_proyecto(UUID) IS
  'Presupuesto de un proyecto como sumatoria del de sus jornadas. La suma ocurre en la base de datos: el cliente nunca recibe la lista de jornadas. Un proyecto sin jornadas devuelve una fila en ceros, no cero filas.';

CREATE OR REPLACE FUNCTION presupuesto_del_sistema()
RETURNS TABLE (
  asignado NUMERIC,
  gastado NUMERIC,
  disponible NUMERIC,
  pendiente NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    COALESCE(SUM(j.presupuesto_asignado), 0),
    COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(j.presupuesto_asignado), 0) - COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(g.pendiente), 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE;
$$;

COMMENT ON FUNCTION presupuesto_del_sistema() IS
  'Presupuesto total del sistema, sumatoria de todas las jornadas visibles para quien consulta. Al ser SECURITY INVOKER, dos roles distintos pueden obtener totales distintos: cada uno ve lo que sus politicas RLS le permiten.';

GRANT EXECUTE ON FUNCTION presupuesto_de_jornada(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION presupuesto_de_proyecto(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION presupuesto_del_sistema() TO authenticated;
