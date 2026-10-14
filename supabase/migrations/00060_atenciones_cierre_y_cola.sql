-- Ecopac Digital - Cierre de la atencion y vista de la cola de la jornada
-- Issue #173, RF-24. El flujo de campo es registro, triaje, consulta y entrega. Sin una cola
-- compartida, dos medicos pueden llamar al mismo paciente.
--
-- POR QUE HACE FALTA UNA COLUMNA DE CIERRE
--
-- atenciones (00013) solo tiene id, paciente_id, jornada_id y las marcas de tiempo. La etapa del
-- flujo se puede deducir de que filas existen -- triaje, consulta, receta -- pero el final no:
-- un paciente que se va sin pasar por consulta no deja ningun rastro, y sin cerrada_en se
-- quedaria en la cola para siempre. El criterio de aceptacion 5 pide poder retirarlo.
--
-- cerrada_en IS NULL significa "abierta". No se usa un enum de estado porque el unico dato que
-- falta es cuando termino, y una marca de tiempo lo dice y ademas registra el momento.
--
-- POR QUE LA VISTA ES SECURITY DEFINER Y NO security_invoker
--
-- Este es el punto que decide el diseno. Las politicas de la 00033 dejan leer consultas y
-- recetas SOLO a administrador y medico: un voluntario general no las ve.
--
-- Con security_invoker = TRUE, la vista se evaluaria con los permisos de quien consulta, y un
-- voluntario veria la cola EQUIVOCADA: todo paciente ya atendido le seguiria apareciendo en
-- "espera consulta", porque la fila de la consulta le esta oculta. Es exactamente el problema
-- que esta issue quiere evitar.
--
-- Se usa entonces el patron que la 00041 ya documenta con pacientes_reporte: el owner lee las
-- tablas base, el WHERE de la vista restringe las filas y el acceso lo gobierna el GRANT (las
-- vistas no soportan RLS). La cola expone QUE hubo consulta, nunca lo que dice: ni motivo, ni
-- diagnostico, ni signos vitales.
--
-- El WHERE limita a quien participa en la jornada, con participa_en_jornada() de la 00004, mas
-- la administradora. Quien no esta asignado no ve esa cola.

-- ============================================================================
-- 1. Cierre de la atencion
-- ============================================================================
ALTER TABLE atenciones
  ADD COLUMN cerrada_en TIMESTAMPTZ,
  ADD COLUMN motivo_cierre TEXT;

COMMENT ON COLUMN atenciones.cerrada_en IS
  'Cuando se retiro la atencion de la cola de la jornada. NULL = sigue abierta. La escribe
   cerrarAtencion() de packages/shared/atenciones/api.js (issue #173).';

COMMENT ON COLUMN atenciones.motivo_cierre IS
  'Por que se cerro: entrega completada, el paciente se retiro, se refirio a otro nivel. Texto
   libre y opcional; sirve para entender una cola que se vacio sin consultas.';

-- La cola solo mira las abiertas, y las jornadas se acumulan: un indice parcial mantiene esa
-- consulta barata sin cargar con las atenciones ya cerradas de jornadas viejas.
CREATE INDEX idx_atenciones_jornada_abiertas
  ON atenciones (jornada_id)
  WHERE cerrada_en IS NULL;

-- ============================================================================
-- 2. La cola de la jornada
-- ============================================================================
-- Sin security_invoker a proposito: ver la cabecera.
CREATE VIEW vista_cola_jornada AS
SELECT
  a.id           AS atencion_id,
  a.jornada_id,
  a.paciente_id,
  p.nombres,
  p.apellidos,
  a.created_at   AS iniciada_en,

  -- Las cuatro etapas. "lista para cerrar" existe para no perder de vista a quien termino su
  -- consulta sin receta: si no apareciera, nadie la cerraria y quedaria invisible para siempre.
  CASE
    WHEN t.id IS NULL THEN 'espera triaje'
    WHEN c.id IS NULL THEN 'espera consulta'
    WHEN r.id IS NOT NULL THEN 'espera entrega'
    ELSE 'lista para cerrar'
  END AS etapa,

  -- Desde cuando espera EN SU ETAPA ACTUAL, no desde que se registro. Es lo que pide el criterio
  -- de aceptacion 3 y lo que el panel de #187 muestra al lado de cada paciente: a quien acaban
  -- de pasar a consulta no lleva esperando dos horas.
  CASE
    WHEN t.id IS NULL THEN a.created_at
    WHEN c.id IS NULL THEN t.created_at
    ELSE c.created_at
  END AS esperando_desde

FROM atenciones a
JOIN pacientes p ON p.id = a.paciente_id
LEFT JOIN triajes t ON t.atencion_id = a.id
LEFT JOIN consultas c ON c.atencion_id = a.id
LEFT JOIN recetas r ON r.consulta_id = c.id
WHERE a.cerrada_en IS NULL
  AND (public.es_administrador() OR public.participa_en_jornada(a.jornada_id));

COMMENT ON VIEW vista_cola_jornada IS
  'Cola de pacientes de una jornada, por etapa del flujo (issue #173, RF-24). Solo atenciones
   abiertas (cerrada_en IS NULL).
   SECURITY DEFINER a proposito: un voluntario general no puede leer consultas ni recetas
   (00033), asi que con security_invoker veria a todo paciente ya atendido como si siguiera
   esperando consulta. El owner lee las tablas base y el WHERE restringe las filas a quien
   participa en la jornada, mas la administradora.
   No expone ningun dato clinico: se ve QUE hubo consulta, no lo que dice.';

-- Solo a authenticated. anon no tiene acceso a nada de public (00049, 00056), y el CI lo
-- verifica en cada PR con supabase/tests/database/privilegios_anon.sql.
GRANT SELECT ON vista_cola_jornada TO authenticated;
