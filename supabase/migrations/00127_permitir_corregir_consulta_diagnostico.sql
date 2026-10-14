-- Ecopac Digital - Permitir corregir un diagnostico mal elegido en una consulta
--
-- consulta_diagnostico (00018) solo tenia SELECT e INSERT: un diagnostico elegido por error no se
-- podia quitar de una consulta, solo agregar otro al lado. Igual que padecimientos_cronicos.
-- condicion_id (issue #756, ver docs/MODELO-DE-DATOS.md), a que diagnostico se refiere un vinculo
-- no es un dato que se "corrija" con un UPDATE -es otro hecho clinico distinto-, asi que la
-- correccion es quitar el vinculo equivocado (DELETE) y agregar el correcto (INSERT, que ya
-- existia), no editar la fila en su lugar.
--
-- EL ACTOR ES EL DE LA 00082, NO EL DE LA 00033. La politica de INSERT original de la 00033
-- ("Medico y administrador registran consulta_diagnostico") solo exigia el rol, sin comprobar que
-- la consulta fuera del medico que la registro -un agujero de IDOR que la 00082 cerro,
-- reemplazandola por "Administrador registra en cualquier consulta; medico solo en la suya" (EXISTS
-- contra consultas.medico_id = auth.uid()). Copiar el actor de la 00033 aqui habria reabierto el
-- mismo agujero para el DELETE. Se mide contra la politica vigente, no contra la primera versión.
--
-- SOLO authenticated, NUNCA anon (issue #408, migracion 00049): anon no tiene ningun privilegio
-- sobre ningun esquema publico, y la 00033 conceder "anon, authenticated" por costumbre en tablas
-- clinicas fue justo el patron que la 00049 declaro que no se repite. GRANT ... TO anon aqui
-- habria reabierto ese agujero para consulta_diagnostico y hecho fallar privilegios_anon.sql.
--
-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00031/00032)
-- ============================================================================
GRANT DELETE ON consulta_diagnostico TO authenticated;

-- ============================================================================
-- Politica de DELETE
-- ============================================================================
CREATE POLICY "Administrador quita cualquier diagnostico; medico solo el de su consulta"
  ON consulta_diagnostico FOR DELETE
  USING (
    public.es_administrador()
    OR (
      public.rol_actual() = 'medico'
      AND EXISTS (
        SELECT 1 FROM consultas c
        WHERE c.id = consulta_id AND c.medico_id = auth.uid()
      )
    )
  );
