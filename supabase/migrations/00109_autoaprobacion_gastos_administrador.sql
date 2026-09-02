-- Ecopac Digital - El administrador aprueba lo que registra, tambien en gastos
--
-- Issues #303/#304: los dos asumen que "un gasto registrado por la administradora nace
-- aprobado". Esa regla existe para movimientos_inventario desde la 00028/00047/00094
-- (fn_autoaprobar_movimiento_inventario, BEFORE INSERT), pero nunca se replico para gastos:
-- registrarGasto() (packages/shared/presupuestos/api.js) nunca envia `estado`, asi que
-- cualquier INSERT -sin importar el rol- cae en el DEFAULT 'pendiente' de la columna
-- (00025_presupuesto_gastos.sql). Sin esta migracion, el criterio 4 de #303 y el criterio 3
-- de #304 se cumplirian solo en apariencia: nada en el servidor lo garantiza.
--
-- Mismo patron que fn_autoaprobar_movimiento_inventario (00094): BEFORE INSERT, si
-- es_administrador() fija estado/aprobado_por/aprobado_en. A diferencia de aquella, no hay
-- ajuste de existencias que aplicar: 00089_desacoplar_gastos_de_inventario.sql desacoplo a
-- proposito gastos de movimientos_inventario, y un gasto no mueve stock.
--
-- No hace falta tocar la politica de INSERT de gastos (00052): ya admite a
-- es_administrador() sin condicion sobre `estado`, asi que el WITH CHECK pasa igual con la
-- fila que este trigger deja en 'aprobado'.

CREATE OR REPLACE FUNCTION fn_autoaprobar_gasto_administrador()
RETURNS TRIGGER AS $$
BEGIN
  IF es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_autoaprobar_gasto_administrador
BEFORE INSERT ON gastos
FOR EACH ROW
EXECUTE FUNCTION fn_autoaprobar_gasto_administrador();

COMMENT ON FUNCTION fn_autoaprobar_gasto_administrador() IS
  'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via '
  'auth.uid(), nunca de un campo del cliente), hace nacer el gasto en estado aprobado, con '
  'aprobado_por y aprobado_en fijados automaticamente. Espejo de '
  'fn_autoaprobar_movimiento_inventario (00094), sin ajuste de existencias: un gasto no '
  'mueve inventario (00089). Cualquier otro rol conserva el DEFAULT ''pendiente'' de la '
  'columna estado (00025), sin cambios.';
