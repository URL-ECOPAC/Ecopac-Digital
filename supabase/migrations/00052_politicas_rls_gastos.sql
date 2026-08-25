-- Ecopac Digital - Politicas RLS de gastos y presupuestos
-- Issue #292. gastos se creo en 00025 con RLS habilitado pero sin GRANT ni politicas: con
-- denegacion por defecto la tabla no responde a nadie, ni siquiera a administrador, lo cual
-- deja en cero a presupuesto_de_jornada(), presupuesto_de_proyecto() y
-- presupuesto_del_sistema() (00040, SECURITY INVOKER, leen gastos bajo la identidad de quien
-- llama) y bloquea en silencio las issues de presupuestos #296, #298, #299, #300, #302 y #304.
--
-- Matriz del DoD (revision de la issue, 2026-08-24):
-- - Administrador conserva acceso total y asigna presupuesto de jornada. Lo segundo ya lo
--   cubre la politica de UPDATE de jornadas (00039, columna jornadas.presupuesto_asignado);
--   esta migracion solo gobierna la tabla gastos.
-- - Junta directiva y socio fundador leen gastos/presupuestos sin poder modificar. es_consultivo()
--   (issue #404) resolveria esto en una sola condicion, pero esa funcion no existe todavia en
--   este repo: se escriben los dos roles a mano y queda pendiente de refactor cuando el #404 se
--   mergee.
-- - El personal de campo asignado a una jornada (participa_en_jornada(), 00004) solo registra
--   gastos de esa jornada, igual que medico/voluntario con movimientos_inventario en 00034.
-- - Solo administrador o quien tenga presupuestos.aprobar (sembrado en 00037) aprueba o rechaza.
--   A diferencia de movimientos_inventario (00034/00048), aqui no hubo nunca una restriccion de
--   "nunca lo que el mismo registro": se alinea directo con la decision de la issue #410
--   (00048_administrador_aprueba_lo_que_registra.sql) para no reintroducir la contradiccion que
--   esa migracion ya corrigio.
-- - Un gasto aprobado o rechazado queda inmutable: mismo mecanismo que
--   fn_bloquear_movimiento_finalizado/tr_bloquear_movimiento_finalizado (00023), aplicado aqui
--   como fn_bloquear_gasto_finalizado/tr_bloquear_gasto_finalizado. El rastro de quien registro
--   y quien aprobo ya vive en las columnas registrado_por/aprobado_por/fecha_aprobacion de la
--   propia fila.
-- - gastos.estado reutiliza el enum estado_movimiento; los valores vigentes desde 00023 son
--   'pendiente', 'aprobado' y 'rechazado' (no 'pendiente de validacion' del 00001 original).
-- - Sin politica de DELETE, como en el resto del esquema: sin GRANT de DELETE, cualquier intento
--   muere con 42501 antes de que RLS se evalue.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00034/00039)
-- ============================================================================
GRANT SELECT ON gastos TO anon, authenticated;
GRANT INSERT, UPDATE ON gastos TO authenticated;

-- ============================================================================
-- SELECT: administrador, junta directiva y socio fundador leen todo; el personal
-- asignado a la jornada lee solo los gastos de esa jornada.
-- ============================================================================
CREATE POLICY "Administrador, junta directiva y socio fundador leen todos los gastos; el personal asignado lee los de su jornada"
  ON gastos FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'junta directiva'
    OR public.rol_actual() = 'socio fundador'
    OR public.participa_en_jornada(jornada_id)
  );

-- ============================================================================
-- INSERT: administrador o quien tenga presupuestos.registrar registra cualquier
-- gasto; el personal asignado a la jornada solo registra los de su propia jornada,
-- en estado pendiente y como propio registrado_por.
-- ============================================================================
CREATE POLICY "Administrador registra cualquier gasto; el personal asignado registra los de su jornada"
  ON gastos FOR INSERT TO authenticated
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('presupuestos.registrar')
    OR (
      public.participa_en_jornada(jornada_id)
      AND estado = 'pendiente'
      AND registrado_por = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE: solo administrador o quien tenga presupuestos.aprobar cambia el estado
-- (aprobar/rechazar). Sin excepcion para lo que el mismo registro (issue #410).
-- tr_bloquear_gasto_finalizado (mas abajo) ya bloquea cualquier UPDATE una vez que
-- el gasto quedo aprobado o rechazado, asi que esta politica solo se ejerce
-- mientras esta pendiente.
-- ============================================================================
CREATE POLICY "Administrador o quien tiene presupuestos.aprobar aprueba o rechaza"
  ON gastos FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('presupuestos.aprobar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('presupuestos.aprobar'));

-- ============================================================================
-- Inmutabilidad: un gasto aprobado o rechazado no se edita ni se elimina.
-- Mismo patron que fn_bloquear_movimiento_finalizado (00023).
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_bloquear_gasto_finalizado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un gasto en estado %', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bloquear_gasto_finalizado
BEFORE UPDATE OR DELETE ON gastos
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_gasto_finalizado();
