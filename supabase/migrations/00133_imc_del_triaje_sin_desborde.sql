-- El IMC del triaje deja de poder reventar el registro (issue #699).
--
-- QUE PASABA
--
-- La 00013 declara la columna asi:
--
--   imc NUMERIC(4, 1) GENERATED ALWAYS AS (ROUND(peso / POWER(talla / 100.0, 2), 1)) STORED
--
-- NUMERIC(4,1) llega hasta 999.9. Los CHECK de la misma tabla admiten peso hasta 400 y talla desde
-- 30, asi que la combinacion 400 kg con 30 cm da 4444.4 y el INSERT muere con `numeric field
-- overflow` (22003) -- un error crudo de Postgres, delante de quien esta atendiendo, sin decir que
-- campo revisar.
--
-- Y no es un caso rebuscado: la talla va en CENTIMETROS. Teclear 1.62 en vez de 162, con el peso de
-- un adulto, produce exactamente eso. Comprobado a mano contra el stack local durante la #818.
--
-- POR QUE HACEN FALTA LAS DOS COSAS, Y EN ESTE ORDEN
--
-- Una columna generada se calcula ANTES de comprobar las restricciones de la tabla. Un CHECK sobre
-- `imc` no habria evitado nunca el desborde: para cuando se evalua, el valor ya tuvo que caber en la
-- columna. Por eso primero se amplia -- con NUMERIC(6,1) ninguna combinacion que los CHECK de peso y
-- talla ADMITEN puede desbordar -- y solo despues se acota con un CHECK, que es el que convierte un
-- error de captura en un 23514 con nombre, que el cliente traduce a "revisa el peso y la talla".
--
-- Ampliar sola guardaria un IMC de cuatro cifras como si fuera un dato clinico. Acotar sola no
-- llegaria a ejecutarse. Van juntas.
--
-- LO QUE ESTO NO ARREGLA, Y NO PUEDE ARREGLAR
--
-- Por ese mismo orden, un valor que viola el CHECK de la propia talla sigue desbordando antes de
-- que ningun CHECK se evalue: con talla = 1.62 (la talla tecleada en metros) el IMC sale de 266.700
-- y no cabe ni en NUMERIC(6,1). Ampliar mas no lo cierra -- siempre hay una talla mas chica -- y la
-- unica salida seria un trigger BEFORE, que es mucha maquinaria para un caso que la aplicacion ya
-- para antes: validarTriaje() rechaza una talla menor de 30 cm sin salir del dispositivo.
--
-- El defecto de la issue es el otro: la combinacion de dos valores que la tabla SI admite -- 70 kg
-- con 52 cm, el peso de un adulto con la talla de un lactante -- que reventaba el INSERT con un
-- error que no nombra ninguna columna. Ese caso ahora se rechaza con nombre. Los dos estan fijados
-- en supabase/tests/database/triaje_imc_generado.sql.
--
-- Postgres acepta cambiar el tipo de una columna generada y conserva la expresion; se comprobo
-- contra el stack local antes de escribir esto.

ALTER TABLE triajes
  ALTER COLUMN imc TYPE NUMERIC(6, 1);

ALTER TABLE triajes
  ADD CONSTRAINT chk_triajes_imc_rango
  CHECK (imc IS NULL OR imc BETWEEN 5 AND 200);

COMMENT ON COLUMN triajes.imc IS
  'Indice de masa corporal, columna generada desde la 00013: ROUND(peso / (talla/100)^2, 1). Nunca '
  'se envia desde el cliente. NUMERIC(6,1) desde la 00133 (issue #699): con NUMERIC(4,1) una talla '
  'tecleada en metros desbordaba el INSERT con 22003 en vez de avisar.';

COMMENT ON CONSTRAINT chk_triajes_imc_rango ON triajes IS
  'Acota el IMC a un rango humano posible (issue #699). Fuera de el, lo que hay casi siempre es una '
  'talla en metros o un peso en libras, y un 23514 con nombre permite decir que campo revisar. El '
  'espejo en el cliente es validarTriaje() en packages/shared/pacientes/triaje.validaciones.js, que '
  'lo avisa antes de viajar a la base.';
