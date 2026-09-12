-- Version en lote de presupuesto_de_proyecto()/presupuesto_de_jornada() (issue #771).
--
-- useEjecucionPresupuestal.js y useDetalleProyectoPresupuesto.js llamaban a la RPC de un solo id
-- una vez por fila dentro de un Promise.all (documentado como aceptable en su momento en el
-- comentario de cabecera de useEjecucionPresupuestal.js, issue #301): con 40 proyectos o
-- jornadas eso son 40 RPC concurrentes solo para abrir la pantalla. La #771 pide sustituir ese
-- patron por una version que reciba todos los id de una vez.
--
-- presupuesto_de_jornada()/presupuesto_de_proyecto()/presupuesto_del_sistema() (00040) NO se
-- tocan: siguen siendo la forma correcta de pedir un solo id (por ejemplo, al guardar un gasto y
-- refrescar solo esa fila). Estas dos funciones son un complemento para cuando quien llama ya
-- tiene una lista de id.
--
-- Diferencia de contrato a tener en cuenta del lado del cliente: presupuesto_de_proyecto(id)
-- siempre devuelve una fila (en ceros si el proyecto no tiene jornadas, por el COALESCE sin
-- GROUP BY). presupuestos_de_proyectos(ids) NO puede replicar eso: agrupa por proyecto_id, asi
-- que un proyecto sin jornadas (o cuyas jornadas RLS no deja ver) simplemente no aparece en el
-- resultado. Quien llama tiene que tratar "id ausente" igual que "presupuesto en ceros" -- que es
-- exactamente lo que ya hacian combinarProyectosConPresupuesto()/combinarJornadasConPresupuesto()
-- (presupuestos/useEjecucionPresupuestal.js) para una llamada individual fallida, asi que no hace
-- falta cambiar esas funciones puras, solo como se arma el mapa que reciben.

CREATE OR REPLACE FUNCTION presupuestos_de_proyectos(p_proyecto_ids UUID[])
RETURNS TABLE (
  proyecto_id UUID,
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
    j.proyecto_id,
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
  WHERE j.proyecto_id = ANY(p_proyecto_ids)
  GROUP BY j.proyecto_id;
$$;

COMMENT ON FUNCTION presupuestos_de_proyectos(UUID[]) IS
  'Version en lote de presupuesto_de_proyecto(): un id por fila en vez de una RPC por proyecto (issue #771). Un proyecto sin jornadas visibles no genera fila -- a diferencia de presupuesto_de_proyecto(), que siempre devuelve una fila en ceros -- porque agrupa por proyecto_id y no hay nada que agrupar. Quien llama trata "id ausente en el resultado" igual que un presupuesto en ceros.';

CREATE OR REPLACE FUNCTION presupuestos_de_jornadas(p_jornada_ids UUID[])
RETURNS TABLE (
  jornada_id UUID,
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
    j.id,
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
  WHERE j.id = ANY(p_jornada_ids);
$$;

COMMENT ON FUNCTION presupuestos_de_jornadas(UUID[]) IS
  'Version en lote de presupuesto_de_jornada(): un id por fila en vez de una RPC por jornada (issue #771). Una jornada que no existe o que RLS no deja ver no genera fila.';

GRANT EXECUTE ON FUNCTION presupuestos_de_proyectos(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION presupuestos_de_jornadas(UUID[]) TO authenticated;

-- Toda funcion nueva nace con EXECUTE abierto a PUBLIC (y, en el proyecto real, tambien a anon de
-- forma explicita) hasta que se cierra a mano -- issue #706, migracion 00120. El
-- ALTER DEFAULT PRIVILEGES de esa migracion no lo evita en este Postgres local (limitacion ya
-- documentada ahi mismo), asi que cada funcion nueva repite el REVOKE.
REVOKE EXECUTE ON FUNCTION presupuestos_de_proyectos(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION presupuestos_de_proyectos(UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION presupuestos_de_jornadas(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION presupuestos_de_jornadas(UUID[]) FROM anon;
