-- Ecopac Digital - Un voluntario da de alta el lote de su ingreso, provisional (issue #625)
--
-- QUE ESTABA MAL
--
-- La politica de INSERT de `lotes` (00034) es es_administrador(), asi que el ingreso "en campo"
-- de un medico o un voluntario solo funcionaba sobre lotes que ya existian. Pero quien recibe una
-- donacion o una compra en la comunidad **si registra lotes**: es parte de registrar inventario,
-- y es lo unico que hace `registrarIngreso()` cuando no le pasan lote_id -- el camino por el que
-- entra el ingreso de donaciones entero.
--
-- LO QUE SI TIENE QUE SEGUIR SIENDO CIERTO
--
-- Que ese lote no se vuelva inventario firme por su cuenta. Nace provisional y **lo confirma la
-- administradora al aprobar el ingreso que lo trajo**, exactamente igual que el movimiento que lo
-- acompania. Mientras siga provisional no es un lote del que se pueda dispensar: es la propuesta
-- de un lote.
--
-- POR QUE UNA COLUMNA Y NO DEDUCIRLO
--
-- Se podria deducir ("un lote es firme si tiene algun ingreso aprobado"), y de hecho hoy un lote
-- provisional ya es indispensable de facto: existencias solo se crea cuando el movimiento se
-- aprueba (fn_aplicar_ajuste_existencias, 00047), asi que un lote sin aprobar tiene stock cero y
-- ni vista_lotes_disponibles ni fn_generar_receta lo dejan pasar. Pero eso es una consecuencia
-- afortunada, no una regla declarada: nada impide que maniana alguien cree una fila de
-- existencias por otro camino. La columna dice la regla en voz alta, deja que la pantalla
-- distinga los dos casos sin recalcular nada, y da algo concreto que probar.

-- ============================================================================
-- 1. Columnas nuevas
-- ============================================================================
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES perfiles(id);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT FALSE;

-- Los lotes que ya existen son firmes: son los del seed y los que dio de alta la administradora
-- cuando era la unica que podia. El DEFAULT queda en FALSE para los que vengan, que es el
-- comportamiento nuevo. Se escribe como un UPDATE explicito y no como un DEFAULT TRUE que luego
-- se cambia, porque asi se lee lo que pasa en vez de tener que deducirlo del orden de dos ALTER.
UPDATE lotes SET confirmado = TRUE WHERE confirmado = FALSE;

COMMENT ON COLUMN lotes.registrado_por IS
  'Quien dio de alta el lote. NULL en los lotes anteriores a la 00107 y en los que siembra el '
  'seed. Es lo que permite que su autor lo corrija mientras siga provisional.';

COMMENT ON COLUMN lotes.confirmado IS
  'FALSE mientras el lote sea la propuesta que acompania a un ingreso pendiente; TRUE cuando la '
  'administradora aprueba ese ingreso (fn_aplicar_ajuste_existencias, 00107). Un lote sin '
  'confirmar no tiene existencias, asi que no se puede dispensar ni recetar.';

-- ============================================================================
-- 2. Aprobar el ingreso es lo que confirma el lote
-- ============================================================================
-- Se agrega dentro de fn_aplicar_ajuste_existencias y no en un trigger aparte a proposito: esta
-- funcion es el unico punto por el que un ingreso llega a existencias, y la llaman los DOS
-- caminos de aprobacion -- tr_actualizar_existencias cuando alguien aprueba un pendiente, y
-- tr_autoaprobar_movimiento_inventario cuando el que registra es administrador y nace aprobado
-- (00094). Confirmar aqui cubre los dos sin duplicar la regla.
--
-- Se conserva integra la logica de la 00047, y con ella las dos propiedades que la 00086 le dio y
-- que un CREATE OR REPLACE descuidado borraria en silencio:
--
--   SECURITY DEFINER  -- sin esto, un no-administrador con inventario.aprobar concedido por
--                        usuario_permiso pasa la politica de movimientos_inventario pero muere en
--                        42501 al escribir existencias, cuyo GRANT sigue siendo solo de
--                        administrador (00034). Es el caso que la 00086 arreglo.
--   SET search_path = ''  -- por eso cada tabla va calificada con public.
CREATE OR REPLACE FUNCTION fn_aplicar_ajuste_existencias(
  p_lote_id UUID,
  p_bodega_id UUID,
  p_tipo tipo_movimiento,
  p_cantidad INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  SELECT fecha_vencimiento INTO v_fecha_vencimiento
  FROM public.lotes
  WHERE id = p_lote_id;

  SELECT cantidad_disponible INTO v_stock_actual
  FROM public.existencias
  WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id
  FOR UPDATE;

  v_stock_actual := COALESCE(v_stock_actual, 0);

  IF p_tipo = 'salida' THEN
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
    END IF;

    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
    END IF;

    UPDATE public.existencias
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        updated_at = NOW()
    WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id;

  ELSIF p_tipo = 'ingreso' THEN
    INSERT INTO public.existencias (lote_id, bodega_id, cantidad_disponible)
    VALUES (p_lote_id, p_bodega_id, p_cantidad)
    ON CONFLICT (lote_id, bodega_id) DO UPDATE
    SET cantidad_disponible = existencias.cantidad_disponible + EXCLUDED.cantidad_disponible,
        updated_at = NOW();

    -- Aprobar el ingreso vuelve firme al lote que lo acompania (issue #625). Idempotente: un
    -- segundo ingreso aprobado sobre el mismo lote no cambia nada.
    --
    -- Va aqui dentro, y no en la politica RLS, porque quien aprueba no necesita GRANT de UPDATE
    -- sobre lotes para que esto ocurra: la confirmacion es una consecuencia de aprobar el
    -- movimiento, no una edicion del catalogo. SECURITY DEFINER es lo que lo hace posible.
    UPDATE public.lotes
    SET confirmado = TRUE,
        updated_at = NOW()
    WHERE id = p_lote_id AND confirmado = FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_aplicar_ajuste_existencias(UUID, UUID, tipo_movimiento, INT) IS
  'Ajusta existencias.cantidad_disponible para la fila (lote_id, bodega_id). En salida exige '
  'stock suficiente y lote vigente (fecha_vencimiento contra lotes); en ingreso hace upsert '
  'porque puede no existir aun fila de existencias para esa combinacion, y ademas confirma el '
  'lote si venia provisional (issue #625). Issue #369: reemplaza el ajuste sobre '
  'lotes_existencias (00028).';

-- ============================================================================
-- 3. Quien puede crear y editar un lote
-- ============================================================================
-- La administradora, como siempre. Y ademas medico y voluntario general, con tres condiciones que
-- se comprueban sobre la fila NUEVA: que el lote nazca provisional, que se lo atribuyan a si
-- mismos y nada mas. No se les concede a junta directiva ni a socio fundador, que son roles
-- consultivos (00037, 00080).
DROP POLICY IF EXISTS "Solo administrador crea lotes" ON lotes;

CREATE POLICY "Administrador crea lotes; medico y voluntario los proponen" ON lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.es_administrador()
    OR (
      public.rol_actual() IN ('medico', 'voluntario general')
      AND confirmado = FALSE
      AND registrado_por = auth.uid()
    )
  );

-- Editar: la administradora siempre; su autor solo mientras el lote siga provisional. En cuanto
-- se confirma deja de ser suyo, igual que pasa con el movimiento (00106). El WITH CHECK repite
-- las dos condiciones para que no pueda confirmarse el lote a si mismo ni cambiarle el autor.
DROP POLICY IF EXISTS "Solo administrador edita lotes" ON lotes;

CREATE POLICY "Administrador edita lotes; su autor mientras sean provisionales" ON lotes
  FOR UPDATE TO authenticated
  USING (
    public.es_administrador()
    OR (registrado_por = auth.uid() AND confirmado = FALSE)
  )
  WITH CHECK (
    public.es_administrador()
    OR (registrado_por = auth.uid() AND confirmado = FALSE)
  );

-- La lectura no se toca: cualquier sesion activa ve los lotes (00034/00079). Un lote provisional
-- se ve, y debe verse -- quien lo registro tiene que poder encontrarlo, y la administradora tiene
-- que poder revisarlo antes de aprobar el ingreso.
--
-- Sobre vista_lotes_disponibles (00024): no hace falta filtrarla por `confirmado`. Parte de
-- existencias con INNER JOIN, y un lote provisional no tiene fila ahi porque existencias solo se
-- crea al aprobar. Agregar el filtro seria repetir la misma verdad en dos sitios.
