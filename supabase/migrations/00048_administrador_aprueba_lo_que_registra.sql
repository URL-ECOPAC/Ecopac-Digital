-- Ecopac Digital - El administrador aprueba lo que el mismo registra
--
-- Issue #410: 00028 (trigger BEFORE INSERT tr_autoaprobar_movimiento_inventario) y 00034
-- (politica de UPDATE "Administrador aprueba o rechaza, nunca lo que el mismo registro")
-- se contradicen. 00028 deja nacer aprobado cualquier movimiento que inserte un
-- administrador, sin excepcion; 00034 en cambio bloqueaba por UPDATE al administrador que
-- intentara aprobar manualmente un movimiento pendiente propio (por ejemplo, uno que quedo
-- pendiente porque se registro con el trigger desactivado, o cualquier fixture/caso border).
-- No hay separacion de responsabilidades real en el INSERT, asi que la del UPDATE era una
-- restriccion a medias que solo alcanzaba a una de las dos rutas de aprobacion.
--
-- Decision: gana el comportamiento de 00028. El administrador aprueba lo que registra, en
-- INSERT (automatico) y en UPDATE (manual) por igual. El trigger de 00028 y la columna
-- aprobacion_automatica no se tocan. La trazabilidad de quien registro y quien aprobo cada
-- movimiento no depende de bloquear la operacion: ya vive en las columnas registrado_por /
-- aprobado_por / fecha_aprobacion de la propia fila y, ademas, en cada evento de
-- eventos_auditoria que escribe trg_movimientos_inventario_auditoria (00026) en cada INSERT,
-- UPDATE o DELETE de movimientos_inventario. Por eso quitar esta condicion no reduce la
-- trazabilidad: solo deja de usar RLS como sustituto de un control que ya existe en la
-- auditoria.
--
-- Se reviso el resto de supabase/migrations/ (grep de auth.uid() y de creado_por/
-- solicitado_por) buscando la misma condicion "quien registra != quien aprueba" en otra
-- politica: no aparece en ninguna otra tabla. Constancia de esa revision en el comentario
-- del issue #410 (tabla completa archivo:linea/tabla/patron/dentro-o-fuera de alcance).
--
-- No se edita 00034 (migracion ya aplicada): esta migracion reemplaza su politica de UPDATE
-- con DROP POLICY + CREATE POLICY, mismo patron que ya uso 00024 para
-- fn_actualizar_existencias y 00042 para las politicas de donaciones.

DROP POLICY IF EXISTS "Administrador aprueba o rechaza, nunca lo que el mismo registro"
  ON movimientos_inventario;

CREATE POLICY "Administrador aprueba o rechaza"
  ON movimientos_inventario FOR UPDATE
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());
