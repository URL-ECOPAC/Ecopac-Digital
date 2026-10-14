-- Ecopac Digital - Politicas RLS del modulo de inventario
-- Cubre medicamentos, principios_activos, medicamento_principio, proveedores,
-- bodegas, lotes, existencias, lotes_existencias, alertas_caducidad y
-- movimientos_inventario. La restriccion clave es la del flujo de aprobacion: quien
-- registra un movimiento no puede aprobarlo, ni siquiera si es administrador.
--
-- Nota sobre lotes_existencias: 00023/00024/00028 (issue #294) usan una tabla
-- lotes_existencias distinta de lotes/existencias (00019/00020), que ya tienen sus
-- propias referencias desde receta_detalle (00019), alertas_caducidad (00021) y
-- donaciones (00022). Son dos esquemas de stock paralelos que no se resuelven en esta
-- migracion (es un problema estructural, no de politicas): se dan politicas RLS
-- equivalentes a ambos para no dejar ninguno sin gobernar.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00031/00032/00033)
-- ============================================================================
GRANT SELECT ON medicamentos TO anon, authenticated;
GRANT INSERT, UPDATE ON medicamentos TO authenticated;
GRANT SELECT ON principios_activos TO anon, authenticated;
GRANT INSERT ON principios_activos TO authenticated;
GRANT SELECT ON medicamento_principio TO anon, authenticated;
GRANT INSERT ON medicamento_principio TO authenticated;
GRANT SELECT ON proveedores TO anon, authenticated;
GRANT INSERT, UPDATE ON proveedores TO authenticated;
GRANT SELECT ON bodegas TO anon, authenticated;
GRANT INSERT, UPDATE ON bodegas TO authenticated;
GRANT SELECT ON lotes TO anon, authenticated;
GRANT INSERT, UPDATE ON lotes TO authenticated;
GRANT SELECT ON existencias TO anon, authenticated;
GRANT INSERT, UPDATE ON existencias TO authenticated;
GRANT SELECT ON lotes_existencias TO anon, authenticated;
GRANT INSERT, UPDATE ON lotes_existencias TO authenticated;
GRANT SELECT ON alertas_caducidad TO anon, authenticated;
GRANT UPDATE ON alertas_caducidad TO authenticated;
GRANT SELECT, INSERT ON movimientos_inventario TO anon, authenticated;
GRANT UPDATE ON movimientos_inventario TO authenticated;

-- lotes_existencias no tenia RLS habilitado cuando se escribio la 00028 (ver su propio
-- comentario), pero la 00030 (posterior) lo habilito de todas formas al recorrer todas
-- las tablas de public sin RLS. ENABLE es idempotente: no falla si ya estaba activo,
-- asi que se deja explicito aqui para que esta migracion no dependa de ese detalle de
-- orden entre la 00028 y la 00030.
ALTER TABLE lotes_existencias ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Catalogo: medicamentos, principios_activos, medicamento_principio, proveedores,
-- bodegas, lotes, lotes_existencias. Lectura para cualquier autenticado (lo necesitan
-- medico/voluntario para elegir medicamento/lote al registrar un movimiento); solo
-- administrador administra el catalogo (DoD explicito). Sin politica de DELETE en
-- ningun lado del modulo, mismo criterio que el resto del esquema.
-- ============================================================================
CREATE POLICY "Autenticados leen medicamentos" ON medicamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea medicamentos" ON medicamentos FOR INSERT WITH CHECK (public.es_administrador());
CREATE POLICY "Solo administrador edita medicamentos" ON medicamentos FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen principios_activos" ON principios_activos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea principios_activos" ON principios_activos FOR INSERT WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen medicamento_principio" ON medicamento_principio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador asocia medicamento_principio" ON medicamento_principio FOR INSERT WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen proveedores" ON proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea proveedores" ON proveedores FOR INSERT WITH CHECK (public.es_administrador());
CREATE POLICY "Solo administrador edita proveedores" ON proveedores FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen bodegas" ON bodegas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea bodegas" ON bodegas FOR INSERT WITH CHECK (public.es_administrador());
CREATE POLICY "Solo administrador edita bodegas" ON bodegas FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen lotes" ON lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea lotes" ON lotes FOR INSERT WITH CHECK (public.es_administrador());
CREATE POLICY "Solo administrador edita lotes" ON lotes FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

CREATE POLICY "Autenticados leen lotes_existencias" ON lotes_existencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea lotes_existencias" ON lotes_existencias FOR INSERT WITH CHECK (public.es_administrador());
-- UPDATE lo necesita ademas el ajuste de stock de fn_aplicar_ajuste_existencias
-- (00028), que corre con los privilegios de quien inserta/aprueba el movimiento: como
-- solo administrador aprueba (ver mas abajo) y el auto-aprobado tambien es solo para
-- administrador, esta misma politica alcanza para ambos caminos.
CREATE POLICY "Solo administrador edita lotes_existencias" ON lotes_existencias FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

-- ============================================================================
-- existencias (00020): mismo criterio que lotes_existencias arriba.
-- ============================================================================
CREATE POLICY "Autenticados leen existencias" ON existencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador crea existencias" ON existencias FOR INSERT WITH CHECK (public.es_administrador());
CREATE POLICY "Solo administrador edita existencias" ON existencias FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

-- ============================================================================
-- alertas_caducidad: se generan por rutina programada (supabase/functions, con
-- service_role, que ignora RLS) y no por un rol de aplicacion, asi que no hay politica
-- de INSERT para anon/authenticated. Lectura abierta (le sirve a medico/voluntario
-- para evitar despachar algo por vencer); solo administrador la atiende.
-- ============================================================================
CREATE POLICY "Autenticados leen alertas_caducidad" ON alertas_caducidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo administrador atiende alertas_caducidad" ON alertas_caducidad FOR UPDATE USING (public.es_administrador()) WITH CHECK (public.es_administrador());

-- ============================================================================
-- movimientos_inventario: el flujo de aprobacion
-- ============================================================================
-- Lectura abierta: no es dato personal de un paciente, es operativo del inventario
-- compartido.
CREATE POLICY "Autenticados leen movimientos_inventario"
  ON movimientos_inventario FOR SELECT
  TO authenticated
  USING (true);

-- Medico y voluntario registran movimientos propios en estado pendiente (DoD
-- explicito); administrador registra cualquiera. El WITH CHECK deja pasar
-- estado = 'aprobado' para administrador a proposito: el trigger
-- tr_autoaprobar_movimiento_inventario (00028, BEFORE INSERT) ya corrio y fijo ese
-- valor antes de que esta politica se evalue, y la regla de auto-aprobacion (issue
-- #294) exige que la politica lo permita.
CREATE POLICY "Medico y voluntario registran movimientos propios pendientes; administrador cualquiera"
  ON movimientos_inventario FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR (
      (public.rol_actual() = 'medico' OR public.rol_actual() = 'voluntario general')
      AND estado = 'pendiente'
      AND registrado_por = auth.uid()
    )
  );

-- Solo administrador cambia el estado de un movimiento (aprobar/rechazar), y nunca el
-- de uno que el mismo registro (DoD explicito: separacion de responsabilidades, sin
-- excepcion para administrador). tr_bloquear_movimiento_finalizado (00023) ya bloquea
-- cualquier UPDATE una vez que el movimiento quedo aprobado o rechazado, asi que esta
-- politica solo se ejerce mientras esta pendiente.
CREATE POLICY "Administrador aprueba o rechaza, nunca lo que el mismo registro"
  ON movimientos_inventario FOR UPDATE
  USING (public.es_administrador() AND registrado_por <> auth.uid())
  WITH CHECK (public.es_administrador() AND registrado_por <> auth.uid());
