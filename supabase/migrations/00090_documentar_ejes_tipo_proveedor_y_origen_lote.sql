-- Ecopac Digital - Documentar por que tipo_proveedor y origen_lote quedan separados (issue #412)
--
-- tipo_proveedor ('comercial', 'donante', 00017) y origen_lote ('compra', 'donacion', 00020)
-- codifican el mismo eje del negocio -si el medicamento se pago o se recibio donado- pero
-- describen sujetos gramaticales distintos: el primero es la naturaleza de una entidad
-- (proveedores.tipo), el segundo es como se adquirio una transaccion puntual (lotes.origen). Un
-- proveedor "comercial" no es lo mismo que decir que un lote se "comercial" -no es un adjetivo
-- que se le pueda poner a un lote-, asi que unificar el vocabulario literal (por ejemplo, usar
-- 'comercial'/'donante' tambien en lotes.origen) leeria mal en ese contexto. Se documenta la
-- correspondencia en vez de forzar un solo enum.
--
-- No hay ningun CHECK ni trigger que obligue a que lotes.origen coincida con el tipo del
-- proveedor.id referenciado (lotes.proveedor_id): nada impide hoy un lote con origen = 'compra'
-- cuyo proveedor tenga tipo = 'donante'. Es una inconsistencia de datos posible, no de nombres;
-- se deja fuera de esta migracion (issue #412 es de nomenclatura) y se anota aqui para que quede
-- visible si alguien decide abrir una issue de validacion cruzada mas adelante.

COMMENT ON TYPE tipo_proveedor IS
  'Naturaleza de un proveedor: comercial (se le compra) o donante (dona). Mismo eje del negocio '
  'que origen_lote (compra/donacion, 00020), con vocabulario propio porque describe la entidad '
  '(un proveedor) y no la transaccion (un lote); se documenta la relacion en vez de unificar el '
  'vocabulario (issue #412). Sin CHECK que ate esto al origen de los lotes de ese proveedor.';

COMMENT ON TYPE origen_lote IS
  'Como se adquirio un lote: compra o donacion. Mismo eje del negocio que tipo_proveedor '
  '(comercial/donante, 00017), con vocabulario propio porque describe la transaccion (un lote) '
  'y no la entidad (un proveedor); se documenta la relacion en vez de unificar el vocabulario '
  '(issue #412). Sin CHECK que ate esto al tipo del proveedor referenciado.';
