-- Ecopac Digital - Costo unitario y moneda de un lote (issue #752, Modulo II: valorizacion de
-- stock)
--
-- No existia ninguna columna de precio o costo en todo el esquema: la propuesta pide "calculo
-- del valor monetario de los insumos disponibles para reportes financieros" y hoy no hay con que
-- calcularlo.
--
-- POR QUE EN LOTES Y NO EN MEDICAMENTOS
--
-- El mismo medicamento entra a distinto precio en compras distintas, y entra a precio cero
-- cuando llega por donacion (lotes.origen, 00020, ya distingue compra de donacion -- ver el
-- razonamiento completo en 00090). Ponerlo en medicamentos obligaria a un precio unico por
-- producto y haria imposible valorizar un inventario mixto, que es el caso real de esta
-- organizacion.
--
-- POR QUE NULLABLE
--
-- Un lote donado puede no tener costo conocido. Forzar un cero mentiria en los reportes tanto
-- como forzar un precio: cero significa "no cuesta nada", NULL significa "no sabemos cuanto
-- cuesta". La funcion de valorizacion (siguiente migracion) tiene que declarar cuanto del
-- inventario queda sin valorizar en vez de sumarlo como cero en silencio.
--
-- MONEDA: ENUM DE UN SOLO VALOR, NO UN CHAR(3) LIBRE
--
-- packages/shared/formato/moneda.js ya declara "todo el sistema opera en quetzales; no hay
-- multi-moneda en el esquema" (MONEDA = 'GTQ'). Un enum de un valor deja esa realidad escrita en
-- el esquema -y ANADIR un valor nuevo el dia que haga falta es una migracion de una linea
-- (ALTER TYPE ... ADD VALUE)-, mientras que un CHAR(3) libre invitaria a que una fila futura
-- traiga 'usd' o 'Gtq' sin que nada lo impida.
--
-- LIMITACION CONOCIDA DE PRIVILEGIOS, POR QUE NO SE INTENTA UN GRANT COLUMNA POR COLUMNA
--
-- El issue pide decidir quien ve el costo (informacion financiera que probablemente no le toca
-- a un voluntario ni a un medico). Se probo REVOKE SELECT (columna) ... FROM authenticated
-- para restringir solo estas dos columnas manteniendo el resto de `lotes` visible igual que hoy,
-- y NO funciona: `authenticated` ya tiene SELECT a nivel de TABLA sobre `lotes` (00034), y un
-- REVOKE a nivel de columna no retira nada mientras el grant de tabla siga vigente -- son dos
-- listas de control de acceso independientes en Postgres, y la de tabla gana. Comprobado contra
-- el stack local: una columna revocada asi seguia devolviendose completa via PostgREST con un
-- JWT de medico. La unica forma real de bloquear una columna especifica es retirar el SELECT de
-- toda la tabla y volver a concederlo columna por columna para cada rol -- una reescritura grande
-- y fragil de una politica que hoy protege 13 columnas, por dos columnas nuevas.
--
-- La proteccion real para "quien ve el costo" queda en la FUNCION de valorizacion (siguiente
-- migracion), que es SECURITY DEFINER y comprueba el rol ella misma antes de devolver nada: ahi
-- si se puede negar la respuesta completa sin el problema de arriba. costo_unitario y moneda
-- quedan tecnicamente legibles por cualquiera con SELECT en lotes (como el resto de sus
-- columnas); ninguna pantalla hoy se los muestra a medico ni a voluntario. Documentado en
-- docs/PERMISOS.md.

CREATE TYPE moneda_lote AS ENUM ('GTQ');

COMMENT ON TYPE moneda_lote IS
  'Un solo valor a proposito: todo el sistema opera en quetzales (packages/shared/formato/'
  'moneda.js, MONEDA). Anadir una moneda nueva el dia que haga falta es ALTER TYPE ... ADD '
  'VALUE, no una migracion de esquema. Issue #752.';

ALTER TABLE lotes
  ADD COLUMN costo_unitario NUMERIC(12, 2),
  ADD COLUMN moneda moneda_lote NOT NULL DEFAULT 'GTQ';

COMMENT ON COLUMN lotes.costo_unitario IS
  'Costo por unidad al momento del ingreso. NULL significa "no se conoce el costo" -- un lote '
  'donado, o uno de compra cuyo precio no se capturo-, NUNCA "cero": forzar un cero mentiria en '
  'los reportes financieros tanto como forzar un precio inventado. La funcion de valorizacion '
  '(fn_valor_de_inventario_disponible) tiene que declarar cuanto del inventario queda sin '
  'valorizar, no sumarlo como cero en silencio. Issue #752.';

COMMENT ON COLUMN lotes.moneda IS
  'GTQ por defecto porque hoy es la unica moneda del sistema (moneda_lote). No tiene sentido '
  'como NULL aunque costo_unitario lo sea: la moneda de un lote es un hecho del sistema, no un '
  'dato que se capture por lote. Issue #752.';
