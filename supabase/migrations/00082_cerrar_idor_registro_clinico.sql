-- Cierra cuatro casos de IDOR (Insecure Direct Object Reference) en el registro clinico.
-- Issue #237 (auditoria OWASP A01).
--
-- EL PATRON, YA CONOCIDO
--
-- La 00075 (issue #510) cerro exactamente este mismo defecto en la politica de UPDATE de
-- recetas: una politica que solo mira el ROL de quien escribe, sin comparar la fila contra
-- la sesion, deja que cualquiera con ese rol toque filas que no le pertenecen. Esa migracion
-- documenta el precedente; esta migracion generaliza la misma correccion a los cuatro INSERT
-- de la 00033 que se quedaron con el defecto original y nunca se revisaron.
--
-- LOS CUATRO AGUJEROS
--
-- 1. atenciones INSERT: exige el rol (medico/voluntario) pero no participa_en_jornada(), a
--    diferencia de consultas INSERT (00033:85-94), que si la exige. El trigger
--    validar_jornada_en_curso_atenciones (00055) solo confirma que la jornada este 'en curso',
--    no que quien inserta este asignado a ella. Cualquier medico o voluntario puede registrar
--    una atencion en una jornada ajena, mientras este en curso.
--
-- 2. triajes INSERT: mismo agujero de jornada, mas uno adicional: tomado_por (00013:63) no
--    tiene default auth.uid() ni política que lo ate, así que quien inserta puede firmar el
--    triaje con el UUID de perfil de otra persona -- suplantacion de autoria en la bitacora
--    clinica.
--
-- 3. consulta_diagnostico INSERT: exige el rol (medico) pero no que consulta_id pertenezca a
--    una consulta propia (medico_id = auth.uid()). Cualquier medico adjunta un diagnostico a
--    la consulta de otro medico.
--
-- 4. receta_detalle INSERT: mismo agujero que el anterior, contra recetas.medico_id. Se
--    aprovecha para cerrar tambien que se agreguen renglones a una receta ya anulada (mismo
--    criterio de la 00075: una receta anulada queda cerrada).
--
-- POR QUE DROP + CREATE Y NO ALTER POLICY
--
-- Mismo criterio que la 00075: las politicas permisivas se combinan con OR, asi que dejar la
-- politica vieja en pie y agregar una mas estrecha no restringe nada. La 00033 no se toca -esta
-- aplicada-; se borra su politica desde aqui y se recrea.

-- ============================================================================
-- 1. atenciones: agrega participa_en_jornada(jornada_id) al ramal de medico/voluntario.
--    administrador sigue sin restriccion, igual que en consultas (00033:85-94).
-- ============================================================================
DROP POLICY "Administrador, medico y voluntario registran atenciones" ON atenciones;

CREATE POLICY "Administrador registra en cualquier jornada; medico y voluntario en la suya"
  ON atenciones FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      (public.rol_actual() = 'medico' OR public.rol_actual() = 'voluntario general')
      AND public.participa_en_jornada(jornada_id)
    )
  );

-- ============================================================================
-- 2. triajes: agrega tomado_por = auth.uid() y la misma participacion en jornada, resuelta a
--    traves de la atencion (triajes no tiene jornada_id propio, cuelga de atencion_id).
-- ============================================================================
DROP POLICY "Administrador, medico y voluntario registran triajes" ON triajes;

CREATE POLICY "Administrador registra cualquier triaje; medico y voluntario el suyo, en su jornada"
  ON triajes FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      (public.rol_actual() = 'medico' OR public.rol_actual() = 'voluntario general')
      AND tomado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM atenciones a
        WHERE a.id = atencion_id AND public.participa_en_jornada(a.jornada_id)
      )
    )
  );

-- ============================================================================
-- 3. consulta_diagnostico: exige que consulta_id sea una consulta propia del medico.
-- ============================================================================
DROP POLICY "Medico y administrador registran consulta_diagnostico" ON consulta_diagnostico;

CREATE POLICY "Administrador registra en cualquier consulta; medico solo en la suya"
  ON consulta_diagnostico FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      public.rol_actual() = 'medico'
      AND EXISTS (
        SELECT 1 FROM consultas c
        WHERE c.id = consulta_id AND c.medico_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. receta_detalle: exige que receta_id sea una receta propia del medico y siga emitida (no
--    anulada) -- mismo criterio de "receta anulada queda cerrada" de la 00075.
-- ============================================================================
DROP POLICY "Medico y administrador registran receta_detalle" ON receta_detalle;

CREATE POLICY "Administrador registra en cualquier receta; medico solo en la suya y emitida"
  ON receta_detalle FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      public.rol_actual() = 'medico'
      AND EXISTS (
        SELECT 1 FROM recetas r
        WHERE r.id = receta_id AND r.medico_id = auth.uid() AND r.estado = 'emitida'
      )
    )
  );
