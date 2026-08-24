-- Ecopac Digital - Acceso a vistas agregadas (reporte de impacto y lotes disponibles)
-- Issue #90. Permite que Administrador y Junta Directiva consulten las vistas
-- agregadas, respetando RLS en tablas base (security_invoker) y sin exponer
-- datos sensibles individuales (nombres, DPI, diagnosticos).
--
-- Decisiones de diseno:
-- - vista_reporte_impacto (00027) ya tiene security_invoker = TRUE y nunca toca
--   la tabla pacientes (cuenta DISTINCT paciente_id desde atenciones). El problema
--   que resuelve esta migracion: con las politicas de 00032/00033, junta directiva
--   ve 0 filas en atenciones/consultas/recetas/receta_detalle, asi que la vista le
--   devolvia todos los indicadores en cero. Se otorgan politicas SELECT a junta
--   directiva en esas cuatro tablas: lo que la vista toca de ellas son solo llaves
--   foraneas y contadores (jornada_id, paciente_id, medico_id, cantidad_entregada),
--   no datos sensibles individuales.
-- - pacientes NO recibe politica directa (00032: "no existe subconjunto no
--   identificable"). Para futuros agregados de pacientes se crea la vista
--   pacientes_reporte (id, comunidad_id) SIN security_invoker (SECURITY DEFINER por
--   defecto, patron perfiles_directorio de 00038): el owner (postgres) lee la tabla
--   base aunque el usuario no tenga politica en pacientes, y el WHERE de la vista
--   restringe las filas a administrador y junta directiva. Las vistas no soportan
--   ENABLE ROW LEVEL SECURITY ni CREATE POLICY (error 42809): el acceso se controla
--   solo con GRANT/REVOKE.
-- - vista_lotes_disponibles (00024) se migra a security_invoker = TRUE para que
--   respete RLS de lotes_existencias/medicamentos (00034) en vez de leer como owner.
-- - Sin politicas de DELETE en ninguna tabla (patron del esquema).

-- ============================================================================
-- 1. Vista pacientes_reporte (patron perfiles_directorio, 00038)
-- ============================================================================
-- SECURITY DEFINER (por defecto, sin security_invoker) para que el owner (postgres)
-- lea la tabla base pacientes aunque el usuario no tenga politica en pacientes
-- (00032: no hay politica para junta). El WHERE replica la misma restriccion que
-- perfiles_directorio: solo administrador y junta directiva ven filas.
CREATE VIEW pacientes_reporte
AS
SELECT id, comunidad_id
FROM pacientes
WHERE public.es_administrador() OR public.rol_actual() = 'junta directiva';

COMMENT ON VIEW pacientes_reporte IS
  'Subconjunto no identificable de pacientes (id, comunidad_id) para reportes agregados.
   SECURITY DEFINER: el owner lee la tabla base pacientes (sin politica para junta,
   00032); el WHERE de la vista restringe filas a administrador y junta directiva.
   Acceso controlado por GRANT (las vistas no soportan RLS).';

-- ============================================================================
-- 2. Politicas SELECT para junta directiva en tablas base de vista_reporte_impacto
-- ============================================================================
-- comunidades: id, nombre (necesario para el JOIN en vista_reporte_impacto)
CREATE POLICY "Administrador y junta directiva leen comunidades para reportes"
  ON comunidades FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.rol_actual() = 'junta directiva');

-- atenciones: jornada_id, paciente_id (FKs, no dato sensible individual)
CREATE POLICY "Junta directiva lee atenciones para reportes"
  ON atenciones FOR SELECT TO authenticated
  USING (public.rol_actual() = 'junta directiva');

-- consultas: jornada_id, medico_id
CREATE POLICY "Junta directiva lee consultas para reportes"
  ON consultas FOR SELECT TO authenticated
  USING (public.rol_actual() = 'junta directiva');

-- recetas: consulta_id, id
CREATE POLICY "Junta directiva lee recetas para reportes"
  ON recetas FOR SELECT TO authenticated
  USING (public.rol_actual() = 'junta directiva');

-- receta_detalle: receta_id, cantidad_entregada
CREATE POLICY "Junta directiva lee receta_detalle para reportes"
  ON receta_detalle FOR SELECT TO authenticated
  USING (public.rol_actual() = 'junta directiva');

-- ============================================================================
-- 3. vista_lotes_disponibles: migrar a security_invoker = TRUE
-- ============================================================================
ALTER VIEW vista_lotes_disponibles SET (security_invoker = TRUE);

COMMENT ON VIEW vista_lotes_disponibles IS
  'Muestra los lotes con stock positivo que no han alcanzado su fecha de vencimiento.
   security_invoker = TRUE hace que respete las politicas RLS de lotes_existencias,
   medicamentos y bodegas (00034).';

-- ============================================================================
-- 4. Grants en vistas agregadas y tablas base necesarias: SELECT para autenticados
-- ============================================================================
GRANT SELECT ON vista_reporte_impacto TO authenticated;
REVOKE ALL ON vista_reporte_impacto FROM anon;

GRANT SELECT ON vista_lotes_disponibles TO authenticated;
REVOKE ALL ON vista_lotes_disponibles FROM anon;

GRANT SELECT ON pacientes_reporte TO authenticated;
REVOKE ALL ON pacientes_reporte FROM anon;

-- comunidades es necesaria para el JOIN en vista_reporte_impacto
GRANT SELECT ON comunidades TO authenticated;

-- ============================================================================
-- RLS ya esta habilitado en todas las tablas base por 00030 (denegacion por
-- defecto). Las politicas de arriba otorgan acceso SELECT a junta directiva donde
-- procede; las vistas agregadas se gobiernan por GRANT/REVOKE, no por RLS.
