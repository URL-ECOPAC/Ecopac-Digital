-- Ecopac Digital - Notificaciones al administrador: buzon interno y correo (issue #755, RF-19)
--
-- QUE FALTABA
--
-- RF-19 pide "alertas automaticas para medicamentos proximos a vencer". La cadena que las genera
-- ya existia (00088, 00129 y la Edge Function alertas-vencimiento), pero una alerta solo se veia
-- si alguien abria la pestana de alertas: nada avisaba. Lo mismo pasaba con el resto de lo que
-- espera una decision de administracion -un movimiento por validar, un gasto por aprobar- y con
-- un medicamento que se queda sin existencia: solo se enteraba quien entrara a buscarlo.
--
-- QUE SE NOTIFICA, Y CUANDO
--
-- Una notificacion por incidencia, en el momento en que se produce y una sola vez, a cada
-- administrador activo:
--
--   categoria     | incidencia                                   | nace en
--   --------------+----------------------------------------------+------------------------------
--   caducidad     | un lote por vencer o ya vencido              | INSERT en alertas_caducidad
--   stock         | un medicamento se queda sin existencia       | UPDATE de existencias que
--                 |                                              | lleva su total de >0 a 0
--   validacion    | un movimiento de inventario por validar      | INSERT en movimientos_
--                 |                                              | inventario en 'pendiente'
--   presupuestos  | un gasto por aprobar                         | INSERT en gastos en
--                 |                                              | 'pendiente'
--
-- "Una sola vez" sale de la forma de cada disparo, no de una deduplicacion posterior: una alerta
-- de caducidad se inserta una vez por lote pendiente (uq_alertas_caducidad_lote_pendiente, 00021),
-- un movimiento y un gasto se insertan una vez, y "sin stock" se detecta en la TRANSICION a cero,
-- no en el estado. uq_notificaciones_incidencia es el respaldo.
--
-- Un movimiento o un gasto que registra la propia administracion nace ya aprobado
-- (tr_autoaprobar_movimiento_inventario, tr_autoaprobar_gasto_administrador, BEFORE INSERT): el
-- trigger de aqui es AFTER, ve el estado final y no avisa de algo que no espera a nadie.
--
-- LOS DOS CANALES
--
-- 1. El buzon interno es la tabla notificaciones, que cada perfil lee y marca como leida desde
--    su perfil (web y movil).
-- 2. El correo lo manda la Edge Function enviar-notificaciones, porque Postgres no manda correo.
--    La tabla hace de bandeja de salida: correo_enviado_en queda NULL hasta que el envio sale
--    bien. Para que salga "en el momento" y no al dia siguiente, un trigger de sentencia sobre
--    notificaciones llama a la funcion con pg_net (lo que Supabase llama Database Webhooks, dentro
--    del plan gratuito). La URL y la llave de esa llamada se leen de Supabase Vault, que cada
--    ambiente configura una vez (docs/CI-CD.md): si no estan, el trigger no hace nada y el correo
--    sale en la siguiente corrida de la rutina diaria, que barre lo que haya quedado sin enviar.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 1. Tabla
-- ============================================================================

CREATE TYPE categoria_notificacion AS ENUM ('caducidad', 'stock', 'validacion', 'presupuestos');

COMMENT ON TYPE categoria_notificacion IS
  'De que trata una notificacion (issue #755). Es tambien el criterio por el que el buzon las '
  'agrupa. packages/shared/enums.js (CATEGORIAS_NOTIFICACION) replica estos valores.';

CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  categoria categoria_notificacion NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  enlace TEXT NOT NULL,
  origen_tabla TEXT NOT NULL,
  origen_id UUID NOT NULL,
  leida_en TIMESTAMPTZ,
  correo_enviado_en TIMESTAMPTZ,
  correo_intentado_en TIMESTAMPTZ,
  correo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_notificaciones_titulo_no_vacio CHECK (length(trim(titulo)) > 0),
  CONSTRAINT chk_notificaciones_enlace_es_ruta CHECK (enlace LIKE '/%')
);

COMMENT ON TABLE notificaciones IS
  'Buzon interno de cada perfil y bandeja de salida del correo (issue #755). Una fila por '
  'incidencia y por destinatario. Solo la escriben los triggers de esta migracion; cada perfil '
  'lee las suyas y solo puede cambiar leida_en.';
COMMENT ON COLUMN notificaciones.enlace IS
  'Ruta de la web donde se resuelve la incidencia (p. ej. /inventario?tab=alertas). La app movil '
  'no la usa tal cual: traduce la categoria a su propia pantalla '
  '(packages/shared/notificaciones/categorias.js).';
COMMENT ON COLUMN notificaciones.origen_tabla IS
  'Tabla de la incidencia que produjo la notificacion: alertas_caducidad, movimientos_inventario, '
  'gastos o medicamentos. Con origen_id identifica la incidencia sin FK, porque apunta a tablas '
  'distintas segun la categoria.';
COMMENT ON COLUMN notificaciones.correo_enviado_en IS
  'NULL mientras el correo no salio. La Edge Function enviar-notificaciones lo fija solo cuando '
  'el servidor SMTP acepto el mensaje, asi que un envio fallido se reintenta y uno exitoso no se '
  'repite.';
COMMENT ON COLUMN notificaciones.correo_intentado_en IS
  'Cuando una corrida de enviar-notificaciones reclamo esta fila. Evita que dos corridas '
  'simultaneas (el webhook y la rutina diaria) manden el mismo correo dos veces; si la corrida '
  'murio sin terminar, la fila se vuelve a reclamar pasados 15 minutos.';

CREATE INDEX idx_notificaciones_perfil_creada ON notificaciones (perfil_id, created_at DESC);
CREATE INDEX idx_notificaciones_correo_pendiente ON notificaciones (created_at)
  WHERE correo_enviado_en IS NULL;

-- "sin stock" (origen medicamentos) si puede repetirse para el mismo medicamento: se repone, se
-- vuelve a agotar, y es otra incidencia. Las demas no: una alerta, un movimiento o un gasto son
-- una incidencia cada uno.
CREATE UNIQUE INDEX uq_notificaciones_incidencia
  ON notificaciones (perfil_id, origen_tabla, origen_id)
  WHERE origen_tabla <> 'medicamentos';

-- ============================================================================
-- 2. Quien la lee y quien la toca
-- ============================================================================
-- Supabase concede por defecto todos los privilegios de una tabla nueva a authenticated (la 00120
-- solo cerro DELETE). Aqui se cierra todo y se abre lo justo: leer las propias y marcar leida_en.
-- Nadie inserta ni borra desde la aplicacion; escriben los triggers, que son SECURITY DEFINER.

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON notificaciones FROM anon, authenticated;
GRANT SELECT ON notificaciones TO authenticated;
GRANT UPDATE (leida_en) ON notificaciones TO authenticated;

CREATE POLICY "Cada perfil activo lee sus notificaciones"
  ON notificaciones FOR SELECT TO authenticated
  USING (perfil_id = auth.uid() AND public.rol_actual() IS NOT NULL);

CREATE POLICY "Cada perfil activo marca sus notificaciones"
  ON notificaciones FOR UPDATE TO authenticated
  USING (perfil_id = auth.uid() AND public.rol_actual() IS NOT NULL)
  WITH CHECK (perfil_id = auth.uid() AND public.rol_actual() IS NOT NULL);

-- ============================================================================
-- 3. El reparto: una fila por administrador activo
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notificar_administradores(
  p_categoria categoria_notificacion,
  p_titulo TEXT,
  p_cuerpo TEXT,
  p_enlace TEXT,
  p_origen_tabla TEXT,
  p_origen_id UUID
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH nuevas AS (
    INSERT INTO public.notificaciones
      (perfil_id, categoria, titulo, cuerpo, enlace, origen_tabla, origen_id)
    SELECT p.id, p_categoria, p_titulo, p_cuerpo, p_enlace, p_origen_tabla, p_origen_id
    FROM public.perfiles p
    WHERE p.rol = 'administrador' AND p.activo
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM nuevas;
$$;

COMMENT ON FUNCTION fn_notificar_administradores(
  categoria_notificacion, TEXT, TEXT, TEXT, TEXT, UUID
) IS
  'Crea la misma notificacion para cada administrador activo (un perfil desactivado no recibe '
  'nada, mismo criterio que la 00079). Devuelve cuantas creo. Solo la llaman los triggers de la '
  '00138: sin EXECUTE para ningun rol de aplicacion.';

-- ============================================================================
-- 4. Los cuatro disparos
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_notificar_alerta_caducidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_vence DATE;
BEGIN
  SELECT m.nombre, l.numero_lote, l.fecha_vencimiento
  INTO v_medicamento, v_numero_lote, v_vence
  FROM public.lotes l
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE l.id = NEW.lote_id;

  PERFORM public.fn_notificar_administradores(
    'caducidad',
    CASE
      WHEN v_vence < CURRENT_DATE THEN 'Lote vencido: ' || v_medicamento
      ELSE 'Lote por vencer: ' || v_medicamento
    END,
    format(
      'El lote %s %s el %s y tiene %s unidades en existencia. Registra la acción tomada en '
      'Inventario > Alertas.',
      v_numero_lote,
      CASE WHEN v_vence < CURRENT_DATE THEN 'venció' ELSE 'vence' END,
      to_char(v_vence, 'DD/MM/YYYY'),
      NEW.cantidad_afectada
    ),
    '/inventario?tab=alertas',
    'alertas_caducidad',
    NEW.id
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_alertas_caducidad_notificar
AFTER INSERT ON alertas_caducidad
FOR EACH ROW
EXECUTE FUNCTION fn_notificar_alerta_caducidad();

CREATE OR REPLACE FUNCTION fn_notificar_movimiento_por_validar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_bodega TEXT;
  v_registrado_por TEXT;
BEGIN
  SELECT m.nombre, l.numero_lote INTO v_medicamento, v_numero_lote
  FROM public.lotes l
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE l.id = NEW.lote_id;

  SELECT b.nombre INTO v_bodega FROM public.bodegas b WHERE b.id = NEW.bodega_id;

  SELECT p.nombres || ' ' || p.apellidos INTO v_registrado_por
  FROM public.perfiles p WHERE p.id = NEW.registrado_por;

  PERFORM public.fn_notificar_administradores(
    'validacion',
    format(
      'Movimiento por validar: %s de %s',
      CASE WHEN NEW.tipo = 'ingreso' THEN 'ingreso' ELSE 'salida' END,
      v_medicamento
    ),
    format(
      '%s registró %s de %s unidades del lote %s en %s. Motivo: %s',
      COALESCE(v_registrado_por, 'Alguien'),
      CASE WHEN NEW.tipo = 'ingreso' THEN 'un ingreso' ELSE 'una salida' END,
      NEW.cantidad,
      v_numero_lote,
      v_bodega,
      NEW.motivo
    ),
    '/inventario?tab=validacion',
    'movimientos_inventario',
    NEW.id
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_movimientos_inventario_notificar
AFTER INSERT ON movimientos_inventario
FOR EACH ROW
WHEN (NEW.estado = 'pendiente')
EXECUTE FUNCTION fn_notificar_movimiento_por_validar();

CREATE OR REPLACE FUNCTION fn_notificar_gasto_por_aprobar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada TEXT;
  v_registrado_por TEXT;
BEGIN
  SELECT j.nombre INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  SELECT p.nombres || ' ' || p.apellidos INTO v_registrado_por
  FROM public.perfiles p WHERE p.id = NEW.registrado_por;

  -- El monto se formatea con separadores fijos (',' y '.') y no con los de lc_numeric: el mismo
  -- numero no puede salir distinto segun la configuracion regional del servidor.
  PERFORM public.fn_notificar_administradores(
    'presupuestos',
    'Gasto por aprobar: ' || NEW.concepto,
    format(
      '%s registró un gasto de Q%s. Jornada: %s.',
      COALESCE(v_registrado_por, 'Alguien'),
      trim(to_char(NEW.monto, '999,999,990.00')),
      v_jornada
    ),
    '/presupuestos?tab=aprobaciones',
    'gastos',
    NEW.id
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_gastos_notificar
AFTER INSERT ON gastos
FOR EACH ROW
WHEN (NEW.estado = 'pendiente')
EXECUTE FUNCTION fn_notificar_gasto_por_aprobar();

-- "Sin stock" es la transicion del total del medicamento, sumado entre todos sus lotes y bodegas,
-- de mayor que cero a cero. Se calcula a nivel de SENTENCIA con tablas de transicion, no fila por
-- fila: un AFTER ROW ve el estado final de toda la sentencia, asi que si una misma sentencia
-- tocara dos filas del mismo medicamento, el "antes" calculado fila a fila saldria mal. Con las
-- dos tablas se obtiene el delta real por medicamento y el total previo es total_actual - delta.
--
-- Solo UPDATE: un INSERT en existencias no puede bajar el total (cantidad_disponible no es
-- negativa), y las existencias no se borran desde la aplicacion.
--
-- No existe un stock minimo en el esquema: "sin stock" es la unica regla de stock que se puede
-- aplicar hoy. Un umbral configurable es otra issue.
CREATE OR REPLACE FUNCTION fn_notificar_medicamento_sin_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fila RECORD;
BEGIN
  FOR v_fila IN
    WITH delta AS (
      SELECT l.medicamento_id, SUM(n.cantidad_disponible - o.cantidad_disponible) AS cambio
      FROM nuevas n
      JOIN viejas o ON o.id = n.id
      JOIN public.lotes l ON l.id = n.lote_id
      GROUP BY l.medicamento_id
      HAVING SUM(n.cantidad_disponible - o.cantidad_disponible) < 0
    ),
    totales AS (
      SELECT
        d.medicamento_id,
        d.cambio,
        (
          SELECT COALESCE(SUM(e.cantidad_disponible), 0)
          FROM public.existencias e
          JOIN public.lotes l ON l.id = e.lote_id
          WHERE l.medicamento_id = d.medicamento_id
        ) AS total_actual
      FROM delta d
    )
    SELECT t.medicamento_id, m.nombre, m.concentracion
    FROM totales t
    JOIN public.medicamentos m ON m.id = t.medicamento_id
    WHERE t.total_actual = 0 AND t.total_actual - t.cambio > 0
  LOOP
    PERFORM public.fn_notificar_administradores(
      'stock',
      'Sin stock: ' || trim(v_fila.nombre || ' ' || COALESCE(v_fila.concentracion, '')),
      format(
        'La existencia total de %s llegó a 0 en todas las bodegas.',
        trim(v_fila.nombre || ' ' || COALESCE(v_fila.concentracion, ''))
      ),
      '/inventario?tab=catalogo',
      'medicamentos',
      v_fila.medicamento_id
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_existencias_notificar_sin_stock
AFTER UPDATE ON existencias
REFERENCING OLD TABLE AS viejas NEW TABLE AS nuevas
FOR EACH STATEMENT
EXECUTE FUNCTION fn_notificar_medicamento_sin_stock();

-- ============================================================================
-- 5. El correo, en el momento: pg_net hacia enviar-notificaciones
-- ============================================================================
-- De SENTENCIA y no de fila: fn_notificar_administradores inserta a todos los administradores en
-- una sola sentencia, y una llamada basta para que la funcion barra todo lo pendiente.
--
-- net.http_post no espera la respuesta: encola la peticion y la manda el worker de pg_net despues
-- del COMMIT. Si la transaccion se deshace, la peticion tampoco sale. Que la funcion falle o no
-- responda no afecta a quien registro la incidencia; el correo queda pendiente y lo recoge la
-- rutina diaria.
--
-- Cualquier error aqui se degrada a WARNING y no se propaga: dejar de mandar un correo no puede
-- impedir registrar la salida de un medicamento. La notificacion ya quedo en el buzon.
CREATE OR REPLACE FUNCTION fn_disparar_correo_de_notificaciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url TEXT;
  v_llave TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'notificaciones_url';

  SELECT decrypted_secret INTO v_llave
  FROM vault.decrypted_secrets WHERE name = 'notificaciones_llave';

  IF v_url IS NULL OR v_llave IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_llave
    ),
    body := '{}'::jsonb
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_disparar_correo_de_notificaciones: no se pudo encolar el correo: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_notificaciones_disparar_correo
AFTER INSERT ON notificaciones
FOR EACH STATEMENT
EXECUTE FUNCTION fn_disparar_correo_de_notificaciones();

-- ============================================================================
-- 6. Reclamar lo pendiente de correo, sin que dos corridas manden lo mismo
-- ============================================================================
-- La llaman enviar-notificaciones y alertas-vencimiento con la llave de servicio. FOR UPDATE SKIP
-- LOCKED mas correo_intentado_en: si el webhook y la rutina diaria corren a la vez, cada fila la
-- reclama una sola. Una fila reclamada por una corrida que murio a medias vuelve a estar
-- disponible a los 15 minutos.
CREATE OR REPLACE FUNCTION fn_reclamar_correos_de_notificaciones(p_limite INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  email TEXT,
  nombres TEXT,
  categoria categoria_notificacion,
  titulo TEXT,
  cuerpo TEXT,
  enlace TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH reclamadas AS (
    UPDATE public.notificaciones n
    SET correo_intentado_en = NOW()
    WHERE n.id IN (
      SELECT c.id
      FROM public.notificaciones c
      WHERE c.correo_enviado_en IS NULL
        AND (c.correo_intentado_en IS NULL OR c.correo_intentado_en < NOW() - INTERVAL '15 minutes')
      ORDER BY c.created_at
      LIMIT p_limite
      FOR UPDATE SKIP LOCKED
    )
    RETURNING n.id, n.perfil_id, n.categoria, n.titulo, n.cuerpo, n.enlace, n.created_at
  )
  SELECT r.id, p.email::TEXT, p.nombres::TEXT, r.categoria, r.titulo, r.cuerpo, r.enlace,
    r.created_at
  FROM reclamadas r
  JOIN public.perfiles p ON p.id = r.perfil_id
  ORDER BY r.created_at;
$$;

COMMENT ON FUNCTION fn_reclamar_correos_de_notificaciones(INT) IS
  'Marca como en curso hasta p_limite notificaciones sin correo enviado, en orden de llegada, y '
  'las devuelve con el correo de su destinatario (issue #755). Solo service_role.';

-- ============================================================================
-- 7. Privilegios de las funciones
-- ============================================================================
-- Ninguna es para la aplicacion. Las de trigger no se invocan por RPC, pero igual se cierran:
-- toda funcion nueva nace con EXECUTE abierto (issue #706, 00120).
REVOKE EXECUTE ON FUNCTION fn_notificar_administradores(
  categoria_notificacion, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_notificar_alerta_caducidad() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_notificar_movimiento_por_validar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_notificar_gasto_por_aprobar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_notificar_medicamento_sin_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_disparar_correo_de_notificaciones() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_reclamar_correos_de_notificaciones(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_reclamar_correos_de_notificaciones(INT) TO service_role;

-- ============================================================================
-- 8. Atender una alerta descuenta el stock
-- ============================================================================
--
-- EL DEFECTO QUE SE VIO AL PROBAR ESTA MIGRACION
--
-- Atender una alerta era un UPDATE de alertas_caducidad (estado, accion, atendida_por,
-- atendida_en) y nada mas: las unidades seguian en existencias. Desde la 00129 el generador toma
-- todo lote con existencia y sin alerta pendiente, asi que en cuanto el panel volvia a cargar
-- -fn_sincronizar_alertas_caducidad corre al abrirlo- nacia otra alerta del mismo lote, y con ella
-- otra notificacion y otro correo. Una alerta nunca se podia cerrar de verdad mientras las unidades
-- siguieran registradas.
--
-- LO QUE HACE AHORA CADA ACCION
--
--   descartado / donado  Da de baja todo el stock del lote: una salida aprobada por cada bodega
--                        con existencia, con motivo "Baja por caducidad: <accion>", que queda en
--                        el Kardex como cualquier otro movimiento. El lote queda en cero.
--   reubicado            Traslada el stock a la bodega destino: salida de cada bodega de origen e
--                        ingreso en la destino. Solo para un lote que todavia no vencio: un
--                        medicamento vencido no se entrega (00044) y trasladarlo no lo resuelve.
--
-- Todo en una transaccion con el cierre de la alerta: si un movimiento falla, la alerta sigue
-- pendiente y el stock intacto.
--
-- POR QUE UNA BANDERA DE TRANSACCION PARA LA BAJA
--
-- fn_aplicar_ajuste_existencias (00047) rechaza toda salida de un lote vencido, y es la regla que
-- impide entregar un medicamento caducado (CP-RF03-04). Dar de baja un vencido es justo lo que esa
-- regla no contemplaba: sacarlo del inventario, no entregarlo. En vez de abrir una excepcion general,
-- fn_atender_alerta_caducidad fija la bandera ecopac.baja_por_caducidad solo durante su propia
-- transaccion (set_config con is_local), y la funcion de ajuste la respeta solo para salidas. Un
-- cliente no puede fijarla por su cuenta: PostgREST no expone set_config, y ninguna funcion de
-- public la acepta como parametro.
--
-- Y el UPDATE directo sobre alertas_caducidad se cierra (REVOKE UPDATE a authenticated): si
-- quedara abierto, cerrar una alerta sin descontar nada seguiria a una peticion de distancia.

CREATE OR REPLACE FUNCTION public.fn_aplicar_ajuste_existencias(
  p_lote_id uuid,
  p_bodega_id uuid,
  p_tipo tipo_movimiento,
  p_cantidad integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
    -- La unica excepcion es la baja de fn_atender_alerta_caducidad (issue #755): sacar del
    -- inventario un vencido no es entregarlo.
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE
       AND COALESCE(current_setting('ecopac.baja_por_caducidad', TRUE), '') <> 'on' THEN
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
$function$;

CREATE OR REPLACE FUNCTION fn_atender_alerta_caducidad(
  p_alerta_id UUID,
  p_accion accion_alerta,
  p_bodega_destino_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alerta public.alertas_caducidad;
  v_vence DATE;
  v_existencia RECORD;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo administracion puede atender una alerta de vencimiento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta FROM public.alertas_caducidad WHERE id = p_alerta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La alerta no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_alerta.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La alerta ya fue atendida.' USING ERRCODE = '23514';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = v_alerta.lote_id;

  IF p_accion = 'reubicado' THEN
    IF v_vence < CURRENT_DATE THEN
      RAISE EXCEPTION 'Un lote vencido no se reubica: se descarta o se dona.' USING ERRCODE = '23514';
    END IF;
    IF p_bodega_destino_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = p_bodega_destino_id) THEN
      RAISE EXCEPTION 'Reubicar exige una bodega destino que exista.' USING ERRCODE = '23502';
    END IF;

    FOR v_existencia IN
      SELECT e.bodega_id, e.cantidad_disponible
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id
        AND e.bodega_id <> p_bodega_destino_id
        AND e.cantidad_disponible > 0
      FOR UPDATE
    LOOP
      -- Primero el ingreso en la destino y despues la salida del origen: al reves, el total del
      -- medicamento pasaria por cero entre las dos sentencias y trg_existencias_notificar_sin_stock
      -- avisaria de un "sin stock" que nunca ocurrio.
      INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
      VALUES ('ingreso', v_alerta.lote_id, p_bodega_destino_id, v_existencia.cantidad_disponible,
              'Reubicacion por alerta de vencimiento', auth.uid());
      INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
      VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_existencia.cantidad_disponible,
              'Reubicacion por alerta de vencimiento', auth.uid());
    END LOOP;
  ELSE
    PERFORM set_config('ecopac.baja_por_caducidad', 'on', TRUE);

    FOR v_existencia IN
      SELECT e.bodega_id, e.cantidad_disponible
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id AND e.cantidad_disponible > 0
      FOR UPDATE
    LOOP
      INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
      VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_existencia.cantidad_disponible,
              'Baja por caducidad: ' || p_accion::TEXT, auth.uid());
    END LOOP;

    PERFORM set_config('ecopac.baja_por_caducidad', 'off', TRUE);
  END IF;

  -- Los INSERT de arriba los aprueba y aplica tr_autoaprobar_movimiento_inventario (es
  -- administracion quien llama), igual que cualquier movimiento suyo: quedan en el Kardex con
  -- aprobacion_automatica, y la auditoria de movimientos_inventario los registra.
  UPDATE public.alertas_caducidad
  SET estado = 'atendida',
      accion = p_accion,
      atendida_por = auth.uid(),
      atendida_en = NOW()
  WHERE id = p_alerta_id;

  RETURN p_alerta_id;
END;
$$;

COMMENT ON FUNCTION fn_atender_alerta_caducidad(UUID, accion_alerta, UUID) IS
  'Cierra una alerta de caducidad y ejecuta la accion sobre el stock, en una transaccion (issue '
  '#755): descartado/donado dan de baja todo el lote con salidas aprobadas; reubicado lo traslada '
  'a p_bodega_destino_id (solo si no vencio). Solo administracion; lanza 42501 a cualquier otro rol.';

REVOKE EXECUTE ON FUNCTION fn_atender_alerta_caducidad(UUID, accion_alerta, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_atender_alerta_caducidad(UUID, accion_alerta, UUID) TO authenticated;

REVOKE UPDATE ON alertas_caducidad FROM authenticated;

-- Una alerta por etapa. "Reubicado" deja las unidades en el inventario, asi que sin esta regla el
-- generador volveria a alertar el lote en la corrida siguiente. Se descarta como candidato el lote
-- que ya tiene una alerta atendida en la MISMA etapa: si se atendio mientras estaba por vencer,
-- vuelve a alertar una sola vez, cuando vence; si se atendio ya vencido, no vuelve. La etapa de una
-- alerta es la del dia en que se creo. Descartado y donado no necesitan la regla -el lote queda en
-- cero-, pero les aplica igual.
CREATE OR REPLACE FUNCTION fn_generar_alertas_caducidad()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidatos AS (
    SELECT
      l.id AS lote_id,
      SUM(e.cantidad_disponible) AS cantidad_total
    FROM public.lotes l
    JOIN public.existencias e ON e.lote_id = l.id
    WHERE l.fecha_vencimiento <= CURRENT_DATE + 30
      AND NOT EXISTS (
        SELECT 1
        FROM public.alertas_caducidad atendida
        WHERE atendida.lote_id = l.id
          AND atendida.estado = 'atendida'
          AND (l.fecha_vencimiento < atendida.created_at::DATE) = (l.fecha_vencimiento < CURRENT_DATE)
      )
    GROUP BY l.id
    HAVING SUM(e.cantidad_disponible) > 0
  ),
  nuevas AS (
    INSERT INTO public.alertas_caducidad (lote_id, cantidad_afectada)
    SELECT c.lote_id, c.cantidad_total
    FROM candidatos c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.alertas_caducidad a
      WHERE a.lote_id = c.lote_id AND a.estado = 'pendiente'
    )
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM nuevas;
$$;

COMMENT ON FUNCTION fn_generar_alertas_caducidad() IS
  'Genera una alerta pendiente por cada lote con existencia total mayor que cero que vence en '
  '30 dias o menos, incluidos los ya vencidos (00129), que no tenga ya una pendiente ni una '
  'atendida en la misma etapa -por vencer o vencido- (00138, issue #755). SECURITY DEFINER; la '
  'invocan la Edge Function programada y fn_sincronizar_alertas_caducidad().';

REVOKE ALL ON FUNCTION fn_generar_alertas_caducidad() FROM PUBLIC, anon, authenticated;
