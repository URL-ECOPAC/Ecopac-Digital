-- La anulacion de recetas deja de ser un UPDATE cualquiera (issue #510).
--
-- EL AGUJERO
--
-- Las tres politicas de recetas vienen de la 00033, y entre ellas hay una asimetria:
--
--   INSERT: es_administrador() OR (rol_actual() = 'medico' AND medico_id = auth.uid())
--   UPDATE: es_administrador() OR rol_actual() = 'medico'          <-- no mira medico_id
--
-- La 00066 (issue #120) agrego las columnas de anulacion -estado, motivo_anulacion, anulada_por,
-- anulada_en- y su CHECK de coherencia, pero no agrego politica. Anular es un UPDATE como
-- cualquier otro, y el unico que gobierna la tabla no compara con la sesion. Resultado:
-- cualquier perfil con rol 'medico' anula la receta de cualquier otro, y queda registrado como
-- responsable de una anulacion que no le corresponde. Reproducido contra el stack local antes de
-- escribir esta migracion: medico.demo anulo la receta firmada por medico2.demo sin estar
-- siquiera asignado a esa jornada, y el servidor respondio 200.
--
-- Es la Divergencia 11 de docs/PERMISOS.md. Importa mas que un permiso de mas: la receta es lo
-- que el paciente se lleva y lo que justifica la salida de medicamento del inventario. Alterar
-- quien receto que es justo lo que la auditoria de la 00026 existe para proteger.
--
-- POR QUE SE BORRA LA POLITICA VIEJA EN VEZ DE ANADIR UNA
--
-- Porque las politicas permisivas de Postgres se combinan con OR: dejar la de la 00033 en pie y
-- agregar otra mas estrecha no restringe nada, la vieja seguiria concediendo. Es exactamente el
-- defecto que docs/PERMISOS.md documenta como Divergencia 10 sobre comunidades. La 00033 no se
-- toca -esta aplicada-; se borra su politica desde aqui y se recrea, como hicieron la 00042 y la
-- 00054.
--
-- LA REGLA
--
--   Medico:        solo sus recetas (medico_id = auth.uid()) y solo mientras sigan 'emitida'.
--                  Al anular queda registrado el como anulada_por.
--   Administrador: cualquier receta, en cualquier estado. Es la via de correccion.
--
-- Una receta anulada queda cerrada para el medico. Anular es un hecho registrado -con quien,
-- cuando y por que-, y dejar reescribirlo destruiria la trazabilidad. Si la anulacion fue un
-- error, la administradora la corrige o se emite una receta nueva.
--
-- POR QUE EL ESTADO VA EN EL USING Y NO EN EL WITH CHECK
--
-- USING decide que filas se pueden tocar; WITH CHECK, como pueden quedar. Exigir estado =
-- 'emitida' en el WITH CHECK bloquearia la propia anulacion, que deja la fila en 'anulada'.
--
-- No se repite rol_actual() = 'medico': medico_id = auth.uid() ya implica serlo, porque solo un
-- medico puede figurar ahi. Es el estilo de la politica de UPDATE de consultas (00033:98-101),
-- que es el precedente exacto de esta.

DROP POLICY "Medico y administrador editan recetas" ON recetas;

CREATE POLICY "El medico anula su receta emitida; administrador cualquiera"
  ON recetas FOR UPDATE
  USING (
    public.es_administrador()
    OR (medico_id = auth.uid() AND estado = 'emitida')
  )
  WITH CHECK (
    -- anulada_por = auth.uid() cierra la otra mitad: sin esto un medico podria anular su propia
    -- receta registrando a otra persona como responsable, porque anularReceta() recibe ese UUID
    -- como parametro del cliente.
    public.es_administrador()
    OR (medico_id = auth.uid() AND anulada_por = auth.uid())
  );

COMMENT ON COLUMN recetas.anulada_por IS
  'Quien anulo la receta. Desde la 00075, la politica de UPDATE exige que coincida con la sesion cuando quien anula es el medico: solo la administradora puede registrar a un tercero.';
