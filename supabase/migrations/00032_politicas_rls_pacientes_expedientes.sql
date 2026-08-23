-- Ecopac Digital - Politicas RLS de pacientes, expedientes y condiciones cronicas
-- La informacion de pacientes es el dato mas sensible del sistema. condiciones_cronicas
-- y padecimientos_cronicos ya tienen sus politicas reales desde la 00010 (issue #71):
-- no se tocan aqui salvo por el GRANT que les faltaba (ver mas abajo). Esta migracion
-- se enfoca en pacientes y expedientes.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00031)
-- ============================================================================
-- pacientes/expedientes nunca tuvieron GRANT. condiciones_cronicas y
-- padecimientos_cronicos tampoco lo tenian desde la 00010, que ya esta aplicada: se
-- corrige hacia adelante aqui en vez de editarla, mismo criterio que la 00031 con la
-- 00026.
GRANT SELECT, INSERT, UPDATE ON pacientes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON expedientes TO anon, authenticated;
GRANT SELECT ON condiciones_cronicas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON padecimientos_cronicos TO anon, authenticated;

-- eventos_auditoria (00026) tiene el mismo vacio y ya se corrigio en la 00031 (issue
-- #87). Se repite aqui, de forma redundante pero inofensiva (GRANT es idempotente),
-- porque las pruebas de esta migracion leen eventos_auditoria y el #87 y el #88 son
-- PRs paralelos: no hay garantia de cual de los dos se mergea primero.
GRANT SELECT ON eventos_auditoria TO anon, authenticated;

-- ============================================================================
-- pacientes
-- ============================================================================
-- Administrador, medico y voluntario registran y consultan pacientes. Junta directiva
-- y socio fundador no tienen ninguna politica sobre esta tabla a proposito: a
-- diferencia de perfiles (donde telefono/email eran columnas separables de una fila
-- por lo demas util), en pacientes el nombre, apellidos y DPI son la fila misma, asi
-- que no existe un subconjunto de columnas "no identificable" que enmascarar con una
-- vista. Sin fila visible, junta directiva no accede a datos identificables de
-- pacientes, tal como pide el DoD del issue.
CREATE POLICY "Administrador, medico y voluntario leen pacientes"
  ON pacientes FOR SELECT
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador, medico y voluntario registran pacientes"
  ON pacientes FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

-- Editar un paciente ya registrado (incluida la baja logica: UPDATE de fecha_baja) es
-- mas restringido que registrarlo: solo administrador y medico, igual que expedientes
-- abajo. Nadie tiene politica de DELETE: ademas del default-deny de la 00030, la 00026
-- ya bloquea con un trigger cualquier intento de borrado fisico de pacientes.
CREATE POLICY "Administrador y medico editan pacientes"
  ON pacientes FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

-- ============================================================================
-- expedientes
-- ============================================================================
-- Mismos lectores/creadores que pacientes: el expediente se crea junto con el
-- paciente, y quien puede consultar un paciente necesita poder ver que tiene
-- expediente y su numero de ficha.
CREATE POLICY "Administrador, medico y voluntario leen expedientes"
  ON expedientes FOR SELECT
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

CREATE POLICY "Administrador, medico y voluntario crean expedientes"
  ON expedientes FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.rol_actual() = 'medico'
    OR public.rol_actual() = 'voluntario general'
  );

-- Solo administrador y medico pueden editar un expediente ya creado (DoD explicito).
CREATE POLICY "Administrador y medico editan expedientes"
  ON expedientes FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');
