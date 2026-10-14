-- Ecopac Digital - Insumos de un proyecto: tabla proyecto_insumos
--
-- La pestana "Insumos" del detalle de un proyecto no tenia de donde leer. Un insumo de proyecto es
-- un articulo del catalogo de inventario, no texto libre: el mismo catalogo que ofrece el campo
-- "Producto / Insumo" de "Registrar ingreso al inventario" (tabla medicamentos, que guarda tanto
-- medicamentos como insumos, 00142). Esta tabla es la LISTA DE LO PREVISTO para el proyecto:
-- articulo, cantidad, unidad y un costo estimado.
--
-- No se restringe por tipo_articulo a proposito: quien arma un proyecto puede prever un
-- medicamento igual que un insumo, y lo que se prevea tiene que poder salir del mismo catalogo
-- donde despues se registra su ingreso.
--
-- NO MUEVE INVENTARIO. Esta tabla no toca existencias, lotes ni movimientos_inventario, a
-- proposito: un movimiento es por lote y bodega, una salida aprobada no se puede deshacer
-- (tr_bloquear_movimiento_finalizado, 00023) y entra al circuito de aprobacion del administrador,
-- asi que atar la lista de un proyecto a stock real haria que "quitar un insumo" pidiera un
-- ingreso compensatorio. Es el mismo criterio de la 00089, que desacoplo los gastos del
-- inventario. Si algun dia hace falta descontar, se agrega una columna que enlace la fila con un
-- movimiento; esta tabla no lo impide.
--
-- Es informacion de planificacion con dinero (el costo estimado): la ve y la escribe la
-- administradora, o quien tenga proyectos.gestionar. El medico, que ve el proyecto de su jornada,
-- NO ve sus insumos (#864, mismo motivo por el que no ve los gastos).

-- ============================================================================
-- 1. Tabla
-- ============================================================================
-- UNIQUE (proyecto_id, medicamento_id): un articulo figura una vez por proyecto; cambiar cuanto se
-- necesita es editar la fila, no agregar otra.
-- medicamento_id ON DELETE RESTRICT: un articulo que un proyecto tiene previsto no se borra del
-- catalogo en silencio (a diferencia del equipo, aqui la fila ES el dato, no un vinculo).
-- costo_unitario_estimado y no el total: el total es cantidad x costo y se calcula al mostrar, asi
-- que cambiar la cantidad no obliga a rehacer el costo. Mismo NUMERIC(12,2) que gastos.monto.
CREATE TABLE proyecto_insumos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE RESTRICT,
  cantidad INT NOT NULL,
  unidad VARCHAR(30) NOT NULL,
  costo_unitario_estimado NUMERIC(12, 2),
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proyecto_id, medicamento_id),
  CONSTRAINT chk_proyecto_insumos_cantidad CHECK (cantidad > 0),
  -- Sin unidad no se sabe que se cuenta. Nunca solo espacios.
  CONSTRAINT chk_proyecto_insumos_unidad CHECK (length(btrim(unidad)) > 0),
  -- Sin costo se guarda NULL ("no estimado"), que no es lo mismo que 0.
  CONSTRAINT chk_proyecto_insumos_costo CHECK (
    costo_unitario_estimado IS NULL OR costo_unitario_estimado >= 0
  ),
  CONSTRAINT chk_proyecto_insumos_nota CHECK (
    nota IS NULL OR (length(btrim(nota)) > 0 AND length(nota) <= 500)
  )
);

COMMENT ON TABLE proyecto_insumos IS
  'Articulos (medicamentos o insumos del catalogo de inventario) PREVISTOS para un proyecto: su cantidad, unidad y costo unitario estimado. Es una lista de planificacion: NO descuenta ni reserva existencias ni crea movimientos de inventario (ver la cabecera de la 00147).';

COMMENT ON COLUMN proyecto_insumos.costo_unitario_estimado IS
  'Costo estimado de UNA unidad, en quetzales. NULL cuando no se estimo; 0 es un costo estimado de cero, no la ausencia de estimacion. El total de la fila es cantidad x este valor y no se guarda.';

CREATE INDEX idx_proyecto_insumos_medicamento_id ON proyecto_insumos (medicamento_id);

CREATE TRIGGER trg_proyecto_insumos_updated_at
BEFORE UPDATE ON proyecto_insumos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_proyecto_insumos_updated_at ON proyecto_insumos IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyecto_insumos.';

-- ============================================================================
-- 2. RLS y privilegios
-- ============================================================================
ALTER TABLE proyecto_insumos ENABLE ROW LEVEL SECURITY;

-- Sin anon (00049/00056, privilegios_anon.sql). DELETE se concede por nombre: desde la 00120 una
-- tabla nueva no lo hereda, y aqui si hay politica de DELETE que lo gobierna.
REVOKE ALL ON proyecto_insumos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON proyecto_insumos TO authenticated;

-- Lectura y escritura: la misma regla que editar un proyecto (00039, 00086). Leer tambien exige
-- proyectos.gestionar por el mismo motivo que en proyectos (00086): un INSERT ... RETURNING lee la
-- fila que acaba de escribir, y sin esta rama quien tiene el permiso recibiria 42501.
CREATE POLICY "Administrador o proyectos.gestionar leen insumos de proyectos"
  ON proyecto_insumos FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

CREATE POLICY "Administrador o proyectos.gestionar agregan insumos a proyectos"
  ON proyecto_insumos FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

CREATE POLICY "Administrador o proyectos.gestionar actualizan insumos de proyectos"
  ON proyecto_insumos FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

CREATE POLICY "Administrador o proyectos.gestionar quitan insumos de proyectos"
  ON proyecto_insumos FOR DELETE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));
