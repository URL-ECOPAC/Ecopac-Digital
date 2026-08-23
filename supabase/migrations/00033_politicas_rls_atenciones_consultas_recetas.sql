-- Ecopac Digital - Politicas RLS de atenciones, triaje, consultas y recetas
-- La informacion clinica propiamente dicha (diagnosticos, consultas, recetas) queda
-- estrictamente restringida a Medico y Administrador. atenciones y triajes son mas
-- amplios: son el registro de campo (registro -> triaje -> consulta -> receta, ver
-- 00013), asi que voluntario tambien participa ahi.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00031/00032)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON atenciones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON triajes TO anon, authenticated;
GRANT SELECT ON diagnosticos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON consultas TO anon, authenticated;
GRANT SELECT, INSERT ON consulta_diagnostico TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON recetas TO anon, authenticated;
GRANT SELECT, INSERT ON receta_detalle TO anon, authenticated;

-- ============================================================================
-- atenciones y triajes: registro de campo, administrador/medico/voluntario
-- ============================================================================
-- atenciones vincula un paciente con una jornada: es el paso previo al triaje, asi que
-- necesita el mismo grupo de roles que registra pacientes (#88).
CREATE POLICY "Administrador, medico y voluntario leen atenciones"
  ON atenciones FOR SELECT
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador, medico y voluntario registran atenciones"
  ON atenciones FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador y medico editan atenciones"
  ON atenciones FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

-- El voluntario puede registrar triaje (DoD explicito) y consultarlo: son signos
-- vitales medidos en el momento, no un diagnostico clinico.
CREATE POLICY "Administrador, medico y voluntario leen triajes"
  ON triajes FOR SELECT
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador, medico y voluntario registran triajes"
  ON triajes FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador y medico editan triajes"
  ON triajes FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

-- ============================================================================
-- diagnosticos, consultas, consulta_diagnostico, recetas, receta_detalle:
-- informacion clinica, solo medico y administrador (DoD explicito, incluye el
-- catalogo de diagnosticos: aqui no es un catalogo publico como condiciones_cronicas)
-- ============================================================================
CREATE POLICY "Medico y administrador leen diagnosticos"
  ON diagnosticos FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador leen consultas"
  ON consultas FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

-- Un medico solo registra una consulta en una jornada donde esta asignado (via
-- jornada_personal, funcion participa_en_jornada() de la 00004) y como si mismo
-- (medico_id = auth.uid()). El trigger validar_jornada_en_curso (00018) ya exige que
-- la jornada este en curso; esta politica agrega el requisito de asignacion que le
-- faltaba.
CREATE POLICY "Medico registra consultas en su jornada asignada; administrador en cualquiera"
  ON consultas FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      public.rol_actual() = 'medico'
      AND medico_id = auth.uid()
      AND public.participa_en_jornada(jornada_id)
    )
  );

-- Solo el medico que creo la consulta puede editarla; administrador cualquiera (DoD
-- explicito).
CREATE POLICY "El medico que creo la consulta la edita; administrador cualquiera"
  ON consultas FOR UPDATE
  USING (public.es_administrador() OR medico_id = auth.uid())
  WITH CHECK (public.es_administrador() OR medico_id = auth.uid());

CREATE POLICY "Medico y administrador leen consulta_diagnostico"
  ON consulta_diagnostico FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador registran consulta_diagnostico"
  ON consulta_diagnostico FOR INSERT
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador leen recetas"
  ON recetas FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico emite recetas como si mismo; administrador cualquiera"
  ON recetas FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (public.rol_actual() = 'medico' AND medico_id = auth.uid())
  );

CREATE POLICY "Medico y administrador editan recetas"
  ON recetas FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador leen receta_detalle"
  ON receta_detalle FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador registran receta_detalle"
  ON receta_detalle FOR INSERT
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');
