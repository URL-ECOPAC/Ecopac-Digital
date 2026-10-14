-- Deja que un lote venza el mismo dia en que ingresa (issue #597).
--
-- CORRECCION DEL DIAGNOSTICO DE LA ISSUE. La issue #597 decia que la restriccion
-- chk_lotes_vencimiento_posterior impedia registrar lotes historicos ya vencidos, y que eso
-- bloqueaba la carga inicial del inventario que hoy vive en papel. Eso NO es cierto y la issue
-- se equivocaba: la restriccion compara fecha_vencimiento contra fecha_ingreso, no contra
-- CURRENT_DATE. Un lote de 2024 que vencio en 2024 se registra sin problema poniendo su
-- fecha_ingreso real, y esa fecha es un campo editable del formulario -CAMPOS_LOTE la declara
-- como TIPOS_DE_CAMPO.FECHA en inventario/campos.js, y ModalAltaLote.jsx solo la inicializa en
-- hoy-. El DEFAULT CURRENT_DATE es un valor por defecto, no un techo.
--
-- Lo que si hay, y es lo que esta migracion arregla, es un desacuerdo mas chico entre la base y
-- la aplicacion sobre un solo dia.
--
-- La restriccion exige fecha_vencimiento > fecha_ingreso, estricto. Pero en todo el resto del
-- sistema un lote que vence HOY todavia se puede entregar:
--
--   - vista_lotes_disponibles (00047) filtra con `l.fecha_vencimiento >= CURRENT_DATE`.
--   - fn_aplicar_ajuste_existencias (00047) rechaza la salida solo si `< CURRENT_DATE`.
--   - esLoteEntregable() en inventario/lotes.validaciones.js devuelve true con `dias >= 0`, y
--     su comentario dice explicitamente "Un lote que vence hoy SI es entregable".
--
-- Con `>` estricto, un lote que llega el mismo dia en que caduca -una donacion de ultimo
-- momento, que es justamente el caso que a esta organizacion le ocurre- no se puede registrar,
-- aunque las tres reglas de arriba lo considerarian utilizable durante esa jornada. La base
-- rechaza crear algo que el resto del sistema si sabe manejar.
--
-- Se relaja a >=. El invariante que de verdad importa se conserva: un lote no puede vencer
-- ANTES de haber ingresado, que eso si es un dato imposible.
--
-- La validacion de cliente ya es consistente con >= sin tocarla: CAMPOS_LOTE declara
-- fechaVencimiento con `minFechaDesdeCampo: 'fechaIngreso'`, un minimo inclusivo.

ALTER TABLE lotes DROP CONSTRAINT chk_lotes_vencimiento_posterior;

ALTER TABLE lotes
  ADD CONSTRAINT chk_lotes_vencimiento_posterior
    CHECK (fecha_vencimiento >= fecha_ingreso);

COMMENT ON CONSTRAINT chk_lotes_vencimiento_posterior ON lotes IS
  'Un lote no puede vencer antes de haber ingresado. El limite es inclusivo desde la 00096 '
  '(issue #597): que venza el mismo dia en que ingresa es valido, porque un lote que vence hoy '
  'se sigue considerando entregable en vista_lotes_disponibles, en '
  'fn_aplicar_ajuste_existencias y en esLoteEntregable(). Antes era estricto y la base se '
  'negaba a registrar un lote que el resto del sistema si sabia despachar. No compara contra '
  'CURRENT_DATE: un lote historico ya vencido se registra con su fecha_ingreso real.';
