-- ============================================================================
-- 00173: una donacion ya no se anula
-- ============================================================================
--
-- Desde la 00083 la administradora podia anular una donacion (UPDATE con estado = 'anulada' y
-- motivo), y la 00114 le dio la funcion fn_anular_donacion. Pero no hay ningun proceso para
-- devolver lo donado -dinero, medicamentos, servicios-: anularla solo la sacaba de los totales
-- mientras lo recibido seguia en caja, en bodega o ya entregado. La organizacion pidio quitar la
-- opcion.
--
-- Se quitan las dos puertas: la politica de UPDATE y la funcion. Sin politica de UPDATE, RLS
-- rechaza cualquier cambio a una fila de donaciones, para todos los roles. No queda ningun otro
-- UPDATE de donaciones en el esquema: fn_registrar_donacion inserta, y el proyecto de la jornada
-- lo pone un trigger BEFORE INSERT (00153).
--
-- Las donaciones que ya se anularon se quedan como estan: el enum estado_donacion, sus columnas
-- y el CHECK chk_donaciones_anulacion_coherente no se tocan, para no reescribir esa historia.
-- ============================================================================

DROP POLICY "Solo administrador anula donaciones" ON public.donaciones;

DROP FUNCTION public.fn_anular_donacion(UUID, TEXT);

COMMENT ON COLUMN public.donaciones.estado IS
  'Registrada o anulada. Desde la 00173 una donacion ya no se anula: solo las anuladas antes conservan ese estado.';
