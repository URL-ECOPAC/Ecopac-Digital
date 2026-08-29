-- Ecopac Digital - Corregir las politicas RLS de donaciones y agregar sus GRANT.
-- Issue #403.
--
-- LOS DEFECTOS
--
-- Las siete politicas de la 00042 tienen cuatro problemas independientes:
--
-- 1. Leen el rol de un sitio que nadie escribe: (auth.jwt() -> 'app_metadata' ->> 'role').
--    app_metadata no aparece en ningun otro archivo de este repositorio; el resto del esquema
--    resuelve el rol con rol_actual()/es_administrador()/es_consultivo() (00004/00080), que leen
--    perfiles.rol. Para cualquier usuario real la expresion de la 00042 es NULL IN (...), que da
--    NULL: ninguna politica es permisiva nunca, para nadie, ni siquiera para administrador.
-- 2. Los valores del rol no existen: 'Administrador' y 'Junta Directiva' estan capitalizados; el
--    enum rol_usuario define 'administrador', 'junta directiva', 'socio fundador', 'medico' y
--    'voluntario general', todo en minusculas. Aunque el punto 1 se corrigiera, la comparacion
--    seguiria fallando, y ademas deja fuera a socio fundador.
-- 3. "Permitir insercion/actualizacion de donantes..." es FOR ALL, que incluye DELETE. El resto
--    del esquema nunca concede DELETE (patron documentado en cada migracion de politicas: el
--    historial no se borra, se anula cambiando estado). Ademas FOR ALL tambien duplica el SELECT
--    que la politica de lectura ya cubre.
-- 4. La politica de anulacion exige estado::text IN ('ANULADA', 'anulada'); estado_donacion
--    (00022) solo define 'registrada' y 'anulada', nunca 'ANULADA' en mayusculas.
--
-- Falta ademas, en las tres tablas, el GRANT a nivel SQL: RLS no lo sustituye (mismo patron que
-- 00041/00052/00073). Sin GRANT, PostgREST nunca llega a evaluar la politica.
--
-- LA REGLA (confirmada con la organizacion, igual que el resto de modulos de gobernanza)
--
--   administrador escribe (SELECT, INSERT, UPDATE); junta directiva y socio fundador solo leen.
--   Sin DELETE para nadie.
--
-- es_consultivo() (00080) ya existe, asi que no hace falta escribir la comparacion de los dos
-- roles a mano -- la nota tecnica original de esta issue quedo resuelta.
--
-- SOBRE LOS DROP POLICY IF EXISTS DE LA 00042
--
-- "Impedir eliminacion fisica de donantes" e "Impedir eliminacion fisica de donaciones"
-- (00042:9,14) son DROP POLICY IF EXISTS contra politicas que ninguna migracion crea jamas. No
-- rompen nada por el IF EXISTS, pero indican que ese archivo se escribio contra un esquema que
-- no era este. La 00042 ya esta aplicada y no se edita; se dejan ahi, documentadas, sin
-- reproducirlas en esta migracion.
--
-- POR QUE DROP + CREATE Y NO ALTER POLICY
--
-- Mismo criterio que 00075/00082: las politicas permisivas se combinan con OR, asi que dejar la
-- politica vieja en pie y agregar una mas estrecha no restringe nada.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar. Solo authenticated (00049 retiro todo
-- privilegio de anon sobre el esquema publico a proposito; nada aqui justifica devolverselo).
-- Sin GRANT de DELETE para nadie.
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON donantes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON donaciones TO authenticated;
GRANT SELECT, INSERT ON donacion_detalle TO authenticated;

-- ============================================================================
-- donantes
-- ============================================================================
DROP POLICY "Permitir lectura de donantes a Administrador y Junta Directiva" ON donantes;
DROP POLICY "Permitir insercion/actualizacion de donantes a Administrador y Junta Directiva" ON donantes;

CREATE POLICY "Administrador y consultivos leen donantes"
  ON donantes FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.es_consultivo());

CREATE POLICY "Solo administrador registra donantes"
  ON donantes FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador actualiza donantes"
  ON donantes FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- ============================================================================
-- donaciones
-- ============================================================================
DROP POLICY "Permitir lectura de donaciones a Administrador y Junta Directiva" ON donaciones;
DROP POLICY "Permitir insercion de donaciones a Administrador y Junta Directiva" ON donaciones;
DROP POLICY "Permitir anular donaciones a Administrador y Junta Directiva" ON donaciones;

CREATE POLICY "Administrador y consultivos leen donaciones"
  ON donaciones FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.es_consultivo());

CREATE POLICY "Solo administrador registra donaciones"
  ON donaciones FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

-- Anular es un UPDATE restringido: solo cambia estado/motivo_anulacion/anulada_por/anulada_en
-- (el CHECK chk_donaciones_anulacion_coherente de la 00022 ya obliga a que vayan juntos), nunca
-- reescribe datos historicos de la donacion.
CREATE POLICY "Solo administrador anula donaciones"
  ON donaciones FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (
    public.es_administrador()
    AND estado = 'anulada'
    AND motivo_anulacion IS NOT NULL
    AND length(trim(motivo_anulacion)) > 0
  );

-- ============================================================================
-- donacion_detalle
-- ============================================================================
DROP POLICY "Permitir lectura de detalle a Administrador y Junta Directiva" ON donacion_detalle;
DROP POLICY "Permitir insercion de detalle a Administrador y Junta Directiva" ON donacion_detalle;

CREATE POLICY "Administrador y consultivos leen donacion_detalle"
  ON donacion_detalle FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.es_consultivo());

CREATE POLICY "Solo administrador registra donacion_detalle"
  ON donacion_detalle FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());
