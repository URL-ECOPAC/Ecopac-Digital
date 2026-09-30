-- ============================================================================
-- 00162: avisos de vencimiento configurables, uno por cada antelacion (issue #899)
-- ============================================================================
--
-- EL SINTOMA. La administracion recibia un solo aviso por lote: "Lote por vencer" cuando entraba
-- a los 30 dias. Cuando el lote vencia no llegaba "Lote vencido", y la antelacion no se podia
-- cambiar.
--
-- POR QUE.
--
--   1. fn_generar_alertas_caducidad() (00138) crea una alerta por lote y, mientras siga
--      pendiente, no vuelve a crear nada. La notificacion salia del INSERT de alertas_caducidad
--      (trg_alertas_caducidad_notificar) y uq_notificaciones_incidencia deja una sola por
--      alerta. Cruzar la fecha de vencimiento con la alerta pendiente no producia ningun aviso.
--   2. La ventana de 30 dias estaba escrita en la funcion.
--   3. CURRENT_DATE es la fecha UTC: entre las 18:00 y las 23:59 de Guatemala la sincronizacion
--      que dispara el panel (fn_sincronizar_alertas_caducidad, 00129) calculaba con el dia
--      siguiente.
--   4. Una alerta pendiente cuyo lote se quedaba sin existencia por otra via (entrega, ajuste)
--      no se podia cerrar: fn_atender_alerta_caducidad (00143) rechaza un lote en cero. Quedaba
--      pendiente para siempre.
--
-- EL ARREGLO.
--
--   - configuracion_alertas_caducidad guarda de cero a cuatro antelaciones (dias antes del
--     vencimiento). Por defecto 90. Sin ninguna, solo se avisa el dia del vencimiento: segun quien
--     use el sistema y en que momento, puede no querer avisos previos. El aviso del dia del
--     vencimiento no se configura: siempre
--     existe (etapa 0).
--   - avisos_caducidad guarda un renglon por alerta y por antelacion notificada. La notificacion
--     sale ahora del INSERT de un aviso, con origen_tabla = 'avisos_caducidad', asi que
--     uq_notificaciones_incidencia sigue impidiendo duplicados sin impedir el siguiente aviso.
--     notificaciones no cambia: la categoria sigue siendo 'caducidad' y el buzon, la campana, los
--     avisos del celular y el correo funcionan igual.
--   - alertas_caducidad.umbral_notificado_dias recuerda la etapa mas cercana ya avisada. Una
--     alerta nueva recibe un solo aviso, el de su etapa actual: un lote que se registra a 20 dias
--     con antelaciones 90, 60 y 30 avisa una vez ("30"), no tres.
--   - Las fechas se calculan con la de Guatemala (fn_hoy_guatemala).
--   - Una alerta pendiente sin existencia se cierra sola (cerrada_sin_existencia).
--
-- Las migraciones aplicadas no se editan: todo se reemplaza hacia adelante.
-- ============================================================================

-- ============================================================================
-- 1. Funciones auxiliares
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_hoy_guatemala(p_instante TIMESTAMPTZ DEFAULT now())
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (p_instante AT TIME ZONE 'America/Guatemala')::DATE;
$$;

COMMENT ON FUNCTION fn_hoy_guatemala(TIMESTAMPTZ) IS
  'Fecha calendario de Guatemala en el instante dado (por defecto, ahora). La base corre en UTC, '
  'asi que CURRENT_DATE se adelanta un dia entre las 18:00 y las 23:59 de Guatemala (issue #899).';

REVOKE ALL ON FUNCTION fn_hoy_guatemala(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_hoy_guatemala(TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION fn_umbrales_caducidad_validos(p_umbrales INT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_umbrales IS NOT NULL
    AND cardinality(p_umbrales) BETWEEN 0 AND 4
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_umbrales) u WHERE u IS NULL OR u < 1 OR u > 365
    )
    AND (SELECT count(DISTINCT u) FROM unnest(p_umbrales) u) = cardinality(p_umbrales);
$$;

COMMENT ON FUNCTION fn_umbrales_caducidad_validos(INT[]) IS
  'Regla de las antelaciones de aviso de vencimiento: de 0 a 4 valores, distintos, entre 1 y 365 '
  'dias. La usa el CHECK de configuracion_alertas_caducidad; '
  'packages/shared/inventario/configuracionAlertas.validaciones.js replica la misma regla.';

REVOKE ALL ON FUNCTION fn_umbrales_caducidad_validos(INT[]) FROM PUBLIC, anon;
-- El CHECK la evalua con los privilegios de quien guarda la configuracion.
GRANT EXECUTE ON FUNCTION fn_umbrales_caducidad_validos(INT[]) TO authenticated;

CREATE OR REPLACE FUNCTION fn_etapa_caducidad(p_dias INT, p_umbrales INT[])
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_dias IS NULL THEN NULL
    WHEN p_dias <= 0 THEN 0
    ELSE (SELECT min(u) FROM unnest(p_umbrales) u WHERE p_dias <= u)
  END;
$$;

COMMENT ON FUNCTION fn_etapa_caducidad(INT, INT[]) IS
  'Etapa de aviso de un lote a p_dias de vencer: 0 si vence hoy o ya vencio (aviso obligatorio), '
  'si no la antelacion mas corta que ya alcanzo, o NULL si todavia esta fuera de la ventana. '
  'packages/shared/inventario/configuracionAlertas.validaciones.js (etapaDeVencimiento) la replica.';

REVOKE ALL ON FUNCTION fn_etapa_caducidad(INT, INT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_etapa_caducidad(INT, INT[]) TO authenticated;

-- ============================================================================
-- 2. Configuracion de las antelaciones
-- ============================================================================
-- Por defecto solo la administracion la cambia. Se puede delegar a un colaborador con el permiso
-- fino inventario.configurar_alertas (Colaboradores > Permisos), igual que inventario.aprobar.

INSERT INTO permisos (clave, modulo, descripcion) VALUES
  ('inventario.configurar_alertas', 'inventario',
   'Configurar con cuántos días de antelación se avisa que un lote va a vencer.');

INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'administrador', id FROM permisos WHERE clave = 'inventario.configurar_alertas';

-- Una sola fila. Un arreglo en una fila, y no una fila por antelacion, porque asi el limite de
-- cuatro y la ausencia de repetidos son un CHECK, y cada cambio es un solo evento de bitacora.
-- `unica` es la forma de garantizar la fila unica conservando la llave UUID que exige
-- registrar_evento_auditoria().

CREATE TABLE configuracion_alertas_caducidad (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  unica BOOLEAN NOT NULL DEFAULT TRUE,
  umbrales_dias INT[] NOT NULL DEFAULT '{90}',
  actualizado_por UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_configuracion_alertas_caducidad_unica UNIQUE (unica),
  CONSTRAINT chk_configuracion_alertas_caducidad_unica CHECK (unica),
  CONSTRAINT chk_configuracion_alertas_caducidad_umbrales_validos
    CHECK (public.fn_umbrales_caducidad_validos(umbrales_dias))
);

COMMENT ON TABLE configuracion_alertas_caducidad IS
  'Antelaciones con las que se avisa que un lote va a vencer (issue #899). Una sola fila. El aviso '
  'del dia del vencimiento no se configura: siempre se envia. La cambia la administracion, o quien '
  'tenga el permiso inventario.configurar_alertas, desde la web.';
COMMENT ON COLUMN configuracion_alertas_caducidad.id IS 'Identificador de la fila.';
COMMENT ON COLUMN configuracion_alertas_caducidad.unica IS
  'Siempre TRUE; con su UNIQUE garantiza que la tabla tenga una sola fila.';
COMMENT ON COLUMN configuracion_alertas_caducidad.umbrales_dias IS
  'Dias antes del vencimiento en que se avisa, de mayor a menor. De 0 a 4 valores distintos entre '
  '1 y 365. Por defecto {90}. La mayor es la ventana: un lote mas lejos no genera alerta. Vacio: '
  'solo se avisa el dia del vencimiento (la ventana es 0).';
COMMENT ON COLUMN configuracion_alertas_caducidad.actualizado_por IS
  'Perfil que guardo el ultimo cambio. Lo fija el trigger con auth.uid().';
COMMENT ON COLUMN configuracion_alertas_caducidad.created_at IS 'Fecha de creacion de la fila.';
COMMENT ON COLUMN configuracion_alertas_caducidad.updated_at IS 'Fecha del ultimo cambio.';

INSERT INTO configuracion_alertas_caducidad DEFAULT VALUES;

CREATE OR REPLACE FUNCTION fn_normalizar_configuracion_alertas_caducidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.umbrales_dias := ARRAY(
    SELECT u FROM unnest(NEW.umbrales_dias) u ORDER BY u DESC NULLS LAST
  );
  NEW.actualizado_por := auth.uid();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_normalizar_configuracion_alertas_caducidad() IS
  'Trigger: ordena las antelaciones de mayor a menor y registra quien guardo el cambio.';

REVOKE ALL ON FUNCTION fn_normalizar_configuracion_alertas_caducidad() FROM PUBLIC, anon;

CREATE TRIGGER trg_configuracion_alertas_caducidad_normalizar
BEFORE INSERT OR UPDATE ON configuracion_alertas_caducidad
FOR EACH ROW EXECUTE FUNCTION fn_normalizar_configuracion_alertas_caducidad();

CREATE TRIGGER trg_configuracion_alertas_caducidad_updated_at
BEFORE UPDATE ON configuracion_alertas_caducidad
FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp_updated_at();

CREATE TRIGGER trg_configuracion_alertas_caducidad_auditoria
AFTER INSERT OR UPDATE OR DELETE ON configuracion_alertas_caducidad
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria();

ALTER TABLE configuracion_alertas_caducidad ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON configuracion_alertas_caducidad FROM anon, authenticated;
GRANT SELECT ON configuracion_alertas_caducidad TO authenticated;
GRANT UPDATE (umbrales_dias) ON configuracion_alertas_caducidad TO authenticated;

-- La leen todos los roles con sesion activa: las listas de inventario marcan "por vencer" con la
-- misma ventana, en web y en movil.
CREATE POLICY "Sesion activa lee configuracion_alertas_caducidad"
  ON configuracion_alertas_caducidad FOR SELECT TO authenticated
  USING (public.rol_actual() IS NOT NULL);

CREATE POLICY "Administracion o permiso configura alertas de caducidad"
  ON configuracion_alertas_caducidad FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('inventario.configurar_alertas'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('inventario.configurar_alertas'));

-- ============================================================================
-- 3. alertas_caducidad: etapa avisada y cierre automatico
-- ============================================================================

ALTER TABLE alertas_caducidad
  ADD COLUMN umbral_notificado_dias INT,
  ADD COLUMN cerrada_sin_existencia BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT chk_alertas_caducidad_umbral_no_negativo CHECK (umbral_notificado_dias >= 0);

COMMENT ON COLUMN alertas_caducidad.umbral_notificado_dias IS
  'Etapa mas cercana ya avisada: la antelacion en dias, o 0 para el aviso del dia del vencimiento. '
  'NULL mientras no se ha avisado nada. Evita repetir un aviso y permite enviar el siguiente '
  '(issue #899).';
COMMENT ON COLUMN alertas_caducidad.cerrada_sin_existencia IS
  'TRUE si la rutina cerro la alerta porque el lote se quedo sin existencia por otra via. No tiene '
  'accion ni atendida_por: nadie la atendio (issue #899).';

-- El cierre automatico no tiene quien lo atienda ni accion. Mismo patron que la 00143.
ALTER TABLE alertas_caducidad
  DROP CONSTRAINT chk_alertas_caducidad_cierre_coherente;

ALTER TABLE alertas_caducidad
  ADD CONSTRAINT chk_alertas_caducidad_cierre_coherente CHECK (
    (estado = 'pendiente'
      AND accion IS NULL AND atendida_por IS NULL AND atendida_en IS NULL
      AND NOT cerrada_sin_existencia)
    OR
    (estado = 'atendida' AND atendida_en IS NOT NULL
      AND (
        (NOT cerrada_sin_existencia AND atendida_por IS NOT NULL)
        OR (cerrada_sin_existencia AND atendida_por IS NULL AND accion IS NULL)
      ))
  );

-- Las alertas pendientes que ya existen ya avisaron una vez, con la etapa del dia en que se
-- crearon. Se les registra esa etapa con la antelacion por defecto: asi las que vencieron desde
-- entonces reciben el aviso de vencimiento que les faltaba, y las demas no repiten el que ya
-- tuvieron. Este UPDATE deja su evento en la bitacora como cualquier otro.
UPDATE alertas_caducidad a
SET umbral_notificado_dias = COALESCE(
  public.fn_etapa_caducidad(l.fecha_vencimiento - public.fn_hoy_guatemala(a.created_at), '{90}'),
  90
)
FROM lotes l
WHERE l.id = a.lote_id AND a.estado = 'pendiente';

-- ============================================================================
-- 4. Un aviso por alerta y por etapa
-- ============================================================================
-- Lo escribe solo fn_generar_alertas_caducidad(). No se audita, como notificaciones (00152): lo
-- escribe el sistema, y la alerta de la que cuelga si se audita.

CREATE TABLE avisos_caducidad (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  alerta_id UUID NOT NULL REFERENCES alertas_caducidad(id) ON DELETE CASCADE,
  umbral_dias INT NOT NULL,
  dias_restantes INT NOT NULL,
  cantidad_en_existencia INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_avisos_caducidad_alerta_umbral UNIQUE (alerta_id, umbral_dias),
  CONSTRAINT chk_avisos_caducidad_umbral_no_negativo CHECK (umbral_dias >= 0),
  CONSTRAINT chk_avisos_caducidad_cantidad_positiva CHECK (cantidad_en_existencia > 0)
);

COMMENT ON TABLE avisos_caducidad IS
  'Cada aviso de vencimiento enviado: uno por alerta y por etapa (antelacion configurada o dia del '
  'vencimiento). Su INSERT genera la notificacion a la administracion (issue #899).';
COMMENT ON COLUMN avisos_caducidad.id IS 'Identificador del aviso; es el origen_id de su notificacion.';
COMMENT ON COLUMN avisos_caducidad.alerta_id IS 'Alerta de caducidad a la que pertenece.';
COMMENT ON COLUMN avisos_caducidad.umbral_dias IS
  'Etapa avisada: la antelacion en dias, o 0 para el dia del vencimiento.';
COMMENT ON COLUMN avisos_caducidad.dias_restantes IS
  'Dias que faltaban para el vencimiento al avisar (negativo si ya habia vencido).';
COMMENT ON COLUMN avisos_caducidad.cantidad_en_existencia IS
  'Unidades del lote en existencia al avisar.';
COMMENT ON COLUMN avisos_caducidad.created_at IS 'Momento del aviso.';

ALTER TABLE avisos_caducidad ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON avisos_caducidad FROM anon, authenticated;
GRANT SELECT ON avisos_caducidad TO authenticated;

CREATE POLICY "Solo administrador lee avisos_caducidad"
  ON avisos_caducidad FOR SELECT TO authenticated
  USING (public.es_administrador());

-- ============================================================================
-- 5. La notificacion sale del aviso, no de la alerta
-- ============================================================================

DROP TRIGGER trg_alertas_caducidad_notificar ON alertas_caducidad;
DROP FUNCTION fn_notificar_alerta_caducidad();

CREATE OR REPLACE FUNCTION fn_notificar_aviso_caducidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_vence DATE;
  v_titulo TEXT;
BEGIN
  SELECT m.nombre, l.numero_lote, l.fecha_vencimiento
  INTO v_medicamento, v_numero_lote, v_vence
  FROM public.alertas_caducidad a
  JOIN public.lotes l ON l.id = a.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE a.id = NEW.alerta_id;

  v_titulo := CASE
    WHEN NEW.dias_restantes < 0 THEN 'Lote vencido: ' || v_medicamento
    WHEN NEW.dias_restantes = 0 THEN 'Lote vence hoy: ' || v_medicamento
    ELSE format(
      'Lote por vencer en %s %s: %s',
      NEW.dias_restantes,
      CASE WHEN NEW.dias_restantes = 1 THEN 'día' ELSE 'días' END,
      v_medicamento
    )
  END;

  PERFORM public.fn_notificar_administradores(
    'caducidad',
    v_titulo,
    format(
      'El lote %s %s el %s y tiene %s unidades en existencia. Registra la acción tomada en '
      'Inventario > Alertas.',
      v_numero_lote,
      CASE WHEN NEW.dias_restantes < 0 THEN 'venció' ELSE 'vence' END,
      to_char(v_vence, 'DD/MM/YYYY'),
      NEW.cantidad_en_existencia
    ),
    '/inventario?tab=alertas',
    'avisos_caducidad',
    NEW.id
  );

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION fn_notificar_aviso_caducidad() IS
  'Trigger: avisa en el buzon (y por correo) de la administracion cada vez que se registra un '
  'aviso de vencimiento: "Lote por vencer en N dias", "Lote vence hoy" o "Lote vencido" (issue '
  '#899). Reemplaza a fn_notificar_alerta_caducidad (00138), que avisaba una sola vez por alerta.';

REVOKE ALL ON FUNCTION fn_notificar_aviso_caducidad() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_avisos_caducidad_notificar
AFTER INSERT ON avisos_caducidad
FOR EACH ROW EXECUTE FUNCTION fn_notificar_aviso_caducidad();

COMMENT ON COLUMN notificaciones.origen_tabla IS
  'Tabla de la incidencia que produjo la notificacion: avisos_caducidad (desde la 00162; antes '
  'alertas_caducidad), movimientos_inventario, gastos o medicamentos. Con origen_id identifica la '
  'incidencia sin FK, porque apunta a tablas distintas segun la categoria.';

-- ============================================================================
-- 6. Generador
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_lotes_en_ventana_de_caducidad(p_hoy DATE, p_umbrales INT[])
RETURNS TABLE (lote_id UUID, dias INT, etapa INT, cantidad INT)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    l.id,
    (l.fecha_vencimiento - p_hoy)::INT,
    public.fn_etapa_caducidad(l.fecha_vencimiento - p_hoy, p_umbrales),
    SUM(e.cantidad_disponible)::INT
  FROM public.lotes l
  JOIN public.existencias e ON e.lote_id = l.id
  -- Sin antelaciones la ventana es 0: solo entra lo que vence hoy o ya vencio.
  WHERE l.fecha_vencimiento - p_hoy <= COALESCE((SELECT max(u) FROM unnest(p_umbrales) u), 0)
  GROUP BY l.id, l.fecha_vencimiento
  HAVING SUM(e.cantidad_disponible) > 0;
$$;

COMMENT ON FUNCTION fn_lotes_en_ventana_de_caducidad(DATE, INT[]) IS
  'Lotes con existencia total mayor que cero que vencen dentro de la antelacion mas larga, '
  'incluidos los ya vencidos, con sus dias restantes y su etapa de aviso. Uso interno de '
  'fn_generar_alertas_caducidad().';

REVOKE ALL ON FUNCTION fn_lotes_en_ventana_de_caducidad(DATE, INT[])
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fn_generar_alertas_caducidad()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoy DATE := public.fn_hoy_guatemala();
  v_umbrales INT[];
  v_creadas INT;
BEGIN
  -- La rutina programada y la sincronizacion del panel pueden coincidir; sin este candado las dos
  -- eligen el mismo lote y la segunda choca con uq_alertas_caducidad_lote_pendiente.
  PERFORM pg_advisory_xact_lock(hashtext('fn_generar_alertas_caducidad'));

  SELECT c.umbrales_dias INTO v_umbrales FROM public.configuracion_alertas_caducidad c;
  IF v_umbrales IS NULL THEN
    RAISE EXCEPTION 'No hay configuracion de antelaciones de aviso de vencimiento.';
  END IF;

  -- 1. Una alerta pendiente cuyo lote ya no tiene existencia no se puede atender: se cierra sola.
  UPDATE public.alertas_caducidad a
  SET estado = 'atendida', atendida_en = now(), cerrada_sin_existencia = TRUE
  WHERE a.estado = 'pendiente'
    AND COALESCE(
      (SELECT SUM(e.cantidad_disponible) FROM public.existencias e WHERE e.lote_id = a.lote_id),
      0
    ) <= 0;

  -- 2. Alertas nuevas. No se crea si ya hay una pendiente, ni si alguien atendio el lote en esta
  -- misma etapa o en una mas cercana (un lote reubicado a los 60 dias vuelve a alertar a los 30,
  -- no al dia siguiente). Un cierre automatico no cuenta: si el lote se repone, vuelve a alertar.
  WITH nuevas AS (
    INSERT INTO public.alertas_caducidad (lote_id, cantidad_afectada)
    SELECT c.lote_id, c.cantidad
    FROM public.fn_lotes_en_ventana_de_caducidad(v_hoy, v_umbrales) c
    JOIN public.lotes l ON l.id = c.lote_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alertas_caducidad a
        WHERE a.lote_id = c.lote_id AND a.estado = 'pendiente'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.alertas_caducidad atendida
        WHERE atendida.lote_id = c.lote_id
          AND atendida.estado = 'atendida'
          AND NOT atendida.cerrada_sin_existencia
          AND COALESCE(
            public.fn_etapa_caducidad(
              l.fecha_vencimiento - public.fn_hoy_guatemala(atendida.atendida_en),
              v_umbrales
            ),
            2147483647
          ) <= c.etapa
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_creadas FROM nuevas;

  -- 3. Cada alerta pendiente que llego a una etapa mas cercana que la ultima avisada recibe un
  -- aviso, y su INSERT genera la notificacion. Solo la etapa actual: una alerta nueva no recibe
  -- de golpe todas las antelaciones que ya dejo atras.
  WITH candidatos AS (
    SELECT * FROM public.fn_lotes_en_ventana_de_caducidad(v_hoy, v_umbrales)
  ),
  avanzadas AS (
    UPDATE public.alertas_caducidad a
    SET umbral_notificado_dias = c.etapa
    FROM candidatos c
    WHERE a.lote_id = c.lote_id
      AND a.estado = 'pendiente'
      AND c.etapa < COALESCE(a.umbral_notificado_dias, 2147483647)
    RETURNING a.id, c.etapa, c.dias, c.cantidad
  )
  INSERT INTO public.avisos_caducidad (alerta_id, umbral_dias, dias_restantes, cantidad_en_existencia)
  SELECT v.id, v.etapa, v.dias, v.cantidad FROM avanzadas v
  ON CONFLICT (alerta_id, umbral_dias) DO NOTHING;

  RETURN v_creadas;
END;
$$;

COMMENT ON FUNCTION fn_generar_alertas_caducidad() IS
  'Rutina de vencimientos (issue #899). Con la fecha de Guatemala y las antelaciones de '
  'configuracion_alertas_caducidad: cierra las alertas pendientes sin existencia, crea una alerta '
  'por lote con existencia dentro de la ventana (incluidos los vencidos) que no tenga una '
  'pendiente ni una atendida en la misma etapa, y registra un aviso -con su notificacion- cada '
  'vez que una alerta pendiente llega a una etapa mas cercana: cada antelacion y el dia del '
  'vencimiento. Idempotente. Devuelve cuantas alertas nuevas creo. SECURITY DEFINER; la invocan '
  'la Edge Function programada y fn_sincronizar_alertas_caducidad().';

REVOKE ALL ON FUNCTION fn_generar_alertas_caducidad() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 7. Quien configura los avisos tambien puede ponerlos al dia
-- ============================================================================
-- Al guardar las antelaciones, la pantalla sincroniza las alertas para que un lote que entra a la
-- ventana nueva avise en el momento. Quien tiene inventario.configurar_alertas sin ser
-- administracion recibia 42501 en ese paso. Sincronizar solo crea las alertas y avisos que la
-- rutina crearia igual; atenderlas sigue siendo solo de la administracion (00143).
CREATE OR REPLACE FUNCTION fn_sincronizar_alertas_caducidad()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creadas INT;
BEGIN
  IF NOT (public.es_administrador() OR public.tiene_permiso('inventario.configurar_alertas')) THEN
    RAISE EXCEPTION 'Solo administracion puede sincronizar las alertas de caducidad.'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.fn_generar_alertas_caducidad() INTO v_creadas;
  RETURN v_creadas;
END;
$$;

COMMENT ON FUNCTION fn_sincronizar_alertas_caducidad() IS
  'Ejecuta fn_generar_alertas_caducidad() a peticion de la administracion o de quien tenga '
  'inventario.configurar_alertas, para no depender de cuando corrio la rutina programada (issues '
  '#838 y #899). Devuelve cuantas alertas nuevas creo. Sin ese rol o permiso lanza 42501.';
