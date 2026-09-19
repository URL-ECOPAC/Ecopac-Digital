-- Ecopac Digital - Limitacion de peticiones para invitar-usuario y fn_buscar_pacientes
-- (issue #761, punto 3).
--
-- POR QUE UNA TABLA PROPIA Y NO config.toml NI KONG
--
-- [auth.rate_limit] de config.toml (docs/SEGURIDAD.md, seccion 4) solo cubre los endpoints
-- nativos de GoTrue (login, signup, refresh), y ademas solo aplica al stack local/CI: el
-- workflow de despliegue nunca corre `supabase config push`. Ni invitar-usuario (Edge Function
-- propia) ni fn_buscar_pacientes (RPC llamada directo por PostgREST) pasan por ahi. No hay
-- ninguna configuracion de Kong versionada en este repo (Supabase lo gestiona internamente), ni
-- Redis ni KV store accesible desde las Edge Functions (policy = "oneshot" en [edge_runtime] de
-- config.toml: sin estado en memoria garantizado entre invocaciones). Postgres es el unico lugar
-- que ven las dos rutas y que persiste entre llamadas, asi que el contador vive aqui.
--
-- DISENO: TABLA GENERICA + FUNCION NUCLEO + FUNCIONES COMPANERAS
--
-- Una sola tabla de contadores (recurso, actor_id) en vez de una tabla por recurso: un tercer
-- limite en el futuro solo necesita una funcion companera nueva de una linea, no otra migracion
-- de esquema. El nucleo (fn_verificar_y_contar_limite) hace el incremento atomico -un
-- INSERT ... ON CONFLICT DO UPDATE, no un SELECT-then-UPDATE: la fila queda bloqueada durante el
-- UPDATE, asi que dos llamadas concurrentes del mismo actor se serializan en vez de leer las dos
-- el mismo contador viejo- y el RAISE si excede. Las companeras solo fijan el recurso, el actor
-- y el umbral.
--
-- UMBRALES (confirmados con el equipo, documentados con su justificacion en docs/SEGURIDAD.md):
--   - invitar_usuario: 20 invitaciones por administrador cada hora. El onboarding real ocurre
--     en rafagas chicas; incluso dar de alta a un equipo nuevo de golpe cabe holgado.
--   - buscar_pacientes: 60 busquedas por usuario cada minuto. El buscador ya tiene debounce de
--     300 ms (RETARDO_DE_BUSQUEDA_MS, packages/shared/hooks/useBusquedaPacientes.js), asi que un
--     uso intenso real ronda 20-30 llamadas/minuto; 60 deja el doble de margen.
--
-- No se suma limite por IP en esta iteracion: fn_buscar_pacientes via PostgREST no ve la IP del
-- cliente sin configuracion adicional fuera de alcance de una migracion, e invitar-usuario ya
-- identifica al actor (un administrador autenticado), que es el vector relevante. Ver
-- docs/SEGURIDAD.md para el detalle completo.

CREATE TABLE limites_de_uso (
  recurso        TEXT NOT NULL,
  actor_id       UUID NOT NULL,
  contador       INT NOT NULL DEFAULT 1,
  ventana_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recurso, actor_id)
);

COMMENT ON TABLE limites_de_uso IS
  'Contador de limite de peticiones (rate limiting) por recurso y actor, con ventana de tiempo '
  'fija que se reinicia sola al expirar (issue #761). recurso identifica que se limita '
  '(''invitar_usuario'', ''buscar_pacientes''); actor_id es quien lo dispara. No expuesta a '
  'PostgREST ni a ningun rol de aplicacion: solo la tocan las funciones SECURITY DEFINER de '
  'esta migracion.';

ALTER TABLE limites_de_uso ENABLE ROW LEVEL SECURITY;
-- Sin ninguna politica: denegacion por defecto (patron 00030). Las funciones SECURITY DEFINER de
-- abajo la tocan igual, porque corren como su dueno, no como el rol que las invoca.
REVOKE ALL ON TABLE limites_de_uso FROM PUBLIC;

-- ============================================================================
-- 1. El nucleo: incrementa atomicamente y falla si se paso del umbral
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_verificar_y_contar_limite(
  p_recurso  TEXT,
  p_actor_id UUID,
  p_maximo   INT,
  p_ventana  INTERVAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contador INT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar quien hace la peticion.'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  -- `l` (alias del INSERT) en el SET se refiere a la fila que YA existia, no a la que se
  -- intento insertar (esa es EXCLUDED, que aqui no hace falta). Si la ventana anterior ya
  -- expiro, el contador arranca de nuevo en 1 y la ventana se reinicia a "ahora".
  INSERT INTO public.limites_de_uso AS l (recurso, actor_id, contador, ventana_inicio)
  VALUES (p_recurso, p_actor_id, 1, now())
  ON CONFLICT (recurso, actor_id) DO UPDATE SET
    contador = CASE
      WHEN l.ventana_inicio <= now() - p_ventana THEN 1
      ELSE l.contador + 1
    END,
    ventana_inicio = CASE
      WHEN l.ventana_inicio <= now() - p_ventana THEN now()
      ELSE l.ventana_inicio
    END
  RETURNING contador INTO v_contador;

  IF v_contador > p_maximo THEN
    RAISE EXCEPTION
      'Se alcanzo el limite de % peticiones cada %. Espera un momento e intenta de nuevo.',
      p_maximo, p_ventana
      USING ERRCODE = 'configuration_limit_exceeded';
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_verificar_y_contar_limite(TEXT, UUID, INT, INTERVAL) IS
  'Incrementa atomicamente el contador de (recurso, actor_id) y falla con SQLSTATE 53400 '
  '(configuration_limit_exceeded) si supera p_maximo dentro de la ventana p_ventana. Reinicia '
  'la ventana sola cuando expiro. Nucleo compartido; llamarla siempre a traves de una funcion '
  'companera con el recurso y el umbral ya fijos (issue #761).';

REVOKE ALL ON FUNCTION fn_verificar_y_contar_limite(TEXT, UUID, INT, INTERVAL) FROM PUBLIC;

-- ============================================================================
-- 2. Companera para invitar-usuario: la Edge Function la llama con la llave de
--    servicio, pasando el id de quien invita (no hay JWT del llamador disponible
--    dentro de Postgres en ese camino: supabaseAdmin usa la llave de servicio, asi
--    que auth.uid() daria NULL).
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_verificar_limite_invitaciones(p_administrador_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.fn_verificar_y_contar_limite(
    'invitar_usuario', p_administrador_id, 20, interval '1 hour'
  );
$$;

COMMENT ON FUNCTION fn_verificar_limite_invitaciones(UUID) IS
  'Limite de invitaciones por administrador (issue #761): 20 cada hora. La llama '
  'supabase/functions/invitar-usuario/index.ts antes de fn_crear_usuario_administrativo(), con '
  'la llave de servicio. No se concede a ningun rol de la aplicacion, solo a service_role.';

REVOKE ALL ON FUNCTION fn_verificar_limite_invitaciones(UUID) FROM PUBLIC;

-- service_role no es superusuario ni el dueno de la funcion: bypasea RLS (rolbypassrls), pero
-- eso es un privilegio distinto de poder ejecutarla. Sin este GRANT, la llamada de
-- invitar-usuario muere con 42501 (permission denied for function) -exactamente el mismo
-- defecto que la 00087 (issue #523) ya encontro y corrigio para fn_crear_usuario_administrativo,
-- solo que ahi se via probando a mano desde el SQL editor (conectado como postgres, el dueno,
-- que nunca pasa por este chequeo) y aqui se encontro probando la Edge Function real end-to-end
-- con curl: pgTAP no lo cazo porque esas pruebas llaman a la funcion como el rol que abre la
-- conexion (postgres, superusuario, bypasa todo GRANT), nunca como service_role.
GRANT EXECUTE ON FUNCTION fn_verificar_limite_invitaciones(UUID) TO service_role;

-- ============================================================================
-- 3. Companera para fn_buscar_pacientes: corre SECURITY INVOKER, con el JWT de
--    quien busca, asi que auth.uid() ya identifica al actor sin que haga falta
--    pasarlo como parametro.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_verificar_limite_busqueda_pacientes()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.fn_verificar_y_contar_limite(
    'buscar_pacientes', auth.uid(), 60, interval '1 minute'
  );
$$;

COMMENT ON FUNCTION fn_verificar_limite_busqueda_pacientes() IS
  'Limite de busquedas por usuario (issue #761): 60 cada minuto. La llama fn_buscar_pacientes() '
  'en una CTE al inicio, antes de la busqueda real. SECURITY DEFINER para poder escribir en '
  'limites_de_uso, que authenticated no puede tocar directamente; se concede EXECUTE a '
  'authenticated porque fn_buscar_pacientes corre SECURITY INVOKER y necesita poder llamarla.';

-- Una funcion nueva no hereda el REVOKE EXECUTE ... FROM anon/PUBLIC que la 00120 le aplico de
-- una sola vez a lo que existia entonces (issue #706): ni el ALTER DEFAULT PRIVILEGES de esa
-- misma migracion lo cierra solo -confirmado en su propio comentario-, asi que toda funcion
-- nueva tiene que revocar PUBLIC explicito antes de conceder lo que de verdad necesita.
REVOKE ALL ON FUNCTION fn_verificar_limite_busqueda_pacientes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_verificar_limite_busqueda_pacientes() TO authenticated;

-- ============================================================================
-- 4. fn_buscar_pacientes, con el limite conectado. Cuerpo vigente al momento de esta
--    migracion: el de la 00132 (issue #699, enum sexo_paciente), no el de la 00077
--    original -entre medio la 00111 tambien la toco (LEFT JOIN de comunidades, tras
--    volverse opcional) y la 00132 (el cast ::VARCHAR/::TEXT del enum). Misma firma y
--    misma logica de negocio que la 00132: solo se agrega la CTE _limite y se
--    referencia con CROSS JOIN dentro de "coincidencias".
--
--    Sin el CROSS JOIN, una CTE sin referenciar en el FROM se elimina del plan (dead
--    CTE elimination, PG12+) y el limite dejaria de comprobarse EN SILENCIO -el peor
--    tipo de bug posible para un control de seguridad-. Como _limite no depende de
--    pa (no esta correlacionada), el CROSS JOIN la evalua una sola vez por ejecucion
--    de la funcion, no una vez por fila de pacientes.
--
--    Deja de ser STABLE (pasa al default, VOLATILE): ahora escribe en limites_de_uso,
--    asi que "misma fila para los mismos argumentos dentro del mismo statement" ya no
--    es cierto en sentido estricto. Verificado que esto no rompe nada: el unico caller
--    (packages/shared/pacientes/api.js, supabase.rpc("fn_buscar_pacientes", ...)) ya
--    invoca por POST (sin { get: true }), que es como PostgREST expone siempre una
--    funcion VOLATILE.
--
--    Sin DROP FUNCTION: la firma no cambia, y un DROP+CREATE aqui perderia el REVOKE/GRANT que
--    ya trae acumulado desde 00102/00111/00120/00132 -haciendola caer de nuevo al default
--    implicito de Postgres (PUBLIC con EXECUTE), que es justo lo que 00120 cerro-. CREATE OR
--    REPLACE sobre una firma identica conserva los privilegios existentes tal cual estan.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_buscar_pacientes(
  p_termino TEXT DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 20,
  p_condicion_cronica_id UUID DEFAULT NULL,
  p_sexo TEXT DEFAULT NULL,
  p_edad_min INT DEFAULT NULL,
  p_edad_max INT DEFAULT NULL
)
RETURNS TABLE (
  paciente_id UUID,
  nombres VARCHAR,
  apellidos VARCHAR,
  fecha_nacimiento DATE,
  sexo VARCHAR,
  comunidad_id UUID,
  comunidad_nombre VARCHAR,
  numero_ficha VARCHAR,
  ultima_atencion DATE,
  condiciones TEXT[],
  relevancia REAL,
  pagina INT,
  por_pagina INT,
  total BIGINT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
SET pg_trgm.word_similarity_threshold = 0.4
AS $$
  WITH _limite AS (
    SELECT public.fn_verificar_limite_busqueda_pacientes() AS ok
  ),
  coincidencias AS (
    SELECT
      pa.id AS paciente_id,
      pa.nombres,
      pa.apellidos,
      pa.fecha_nacimiento,
      pa.sexo::VARCHAR AS sexo,
      pa.comunidad_id,
      co.nombre AS comunidad_nombre,
      ex.numero_ficha,
      (
        SELECT max(jo.fecha)
        FROM public.atenciones at
        JOIN public.jornadas jo ON jo.id = at.jornada_id
        WHERE at.paciente_id = pa.id
      ) AS ultima_atencion,
      (
        SELECT coalesce(array_agg(cc.nombre::TEXT ORDER BY cc.nombre), ARRAY[]::TEXT[])
        FROM public.padecimientos_cronicos pc
        JOIN public.condiciones_cronicas cc ON cc.id = pc.condicion_id
        WHERE pc.paciente_id = pa.id
          AND pc.estado <> 'resuelta'
      ) AS condiciones,
      CASE
        WHEN nullif(btrim(p_termino), '') IS NULL THEN 0::REAL
        ELSE extensions.word_similarity(
               lower(public.f_unaccent(btrim(p_termino))),
               lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
             )
      END AS relevancia
    FROM public.pacientes pa
    CROSS JOIN _limite
    LEFT JOIN public.comunidades co ON co.id = pa.comunidad_id
    LEFT JOIN public.expedientes ex ON ex.paciente_id = pa.id
    WHERE pa.fecha_baja IS NULL
      AND (p_comunidad_id IS NULL OR pa.comunidad_id = p_comunidad_id)
      AND (
        p_condicion_cronica_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.padecimientos_cronicos pc
             WHERE pc.paciente_id = pa.id
               AND pc.condicion_id = p_condicion_cronica_id
               AND pc.estado <> 'resuelta'
           )
      )
      AND (p_sexo IS NULL OR upper(pa.sexo::TEXT) = upper(p_sexo))
      AND (
        p_edad_min IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT >= p_edad_min
      )
      AND (
        p_edad_max IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT <= p_edad_max
      )
      AND (
        nullif(btrim(p_termino), '') IS NULL
        OR lower(public.f_unaccent(btrim(p_termino)))
           OPERATOR(extensions.<%)
           lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
      )
  ),
  paginacion AS (
    SELECT
      least(greatest(coalesce(p_por_pagina, 20), 1), 100) AS por_pagina,
      count(*) AS total
    FROM coincidencias
  ),
  paginacion_clampeada AS (
    SELECT
      por_pagina,
      total,
      greatest(
        least(coalesce(p_pagina, 1), greatest(ceil(total::NUMERIC / por_pagina)::INT, 1)),
        1
      ) AS pagina
    FROM paginacion
  )
  SELECT
    c.paciente_id,
    c.nombres,
    c.apellidos,
    c.fecha_nacimiento,
    c.sexo,
    c.comunidad_id,
    c.comunidad_nombre,
    c.numero_ficha,
    c.ultima_atencion,
    c.condiciones,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT) IS
  'Busca pacientes por nombre (tolerando acentos y errores de tipeo, via el indice de trigramas '
  'de 00011 y el operador <% de word_similarity), filtrando opcionalmente por comunidad y por '
  'condicion cronica vigente, con resultados paginados y ordenados por relevancia. Si la pagina '
  'pedida cae despues del final, devuelve la ultima pagina real (columna pagina) en vez de una '
  'lista vacia con el total perdido. Excluye pacientes con fecha_baja. La usa buscarPacientes() '
  'de packages/shared/pacientes/api.js. Existe como funcion porque PostgREST no puede reproducir '
  'la expresion indexada ni ordenar por similarity(). SECURITY INVOKER: respeta las politicas de '
  'SELECT de 00032/00008, incluida la de padecimientos_cronicos, que solo deja leer a medico y '
  'administrador; para el resto de roles la columna condiciones llega vacia, que es lo correcto. '
  'Issue #535: se agrego la columna condiciones, que la tabla del listado dibuja como chips desde '
  'el PR #311. El dato se resuelve aqui y no con una segunda consulta desde el cliente porque la '
  'funcion ya recorre padecimientos_cronicos para el filtro, asi que no cuesta ningun viaje de '
  'red adicional; esa era la objecion que dejo escrita el PR #482 al omitirlas. '
  'Vigente significa estado <> resuelta, o sea activa y controlada, misma definicion que '
  'soloVigentes en obtenerCondicionesDelPaciente() (#122): una condicion controlada se sigue '
  'padeciendo. La 00076 usaba estado = activa tanto aqui como en el filtro, asi que un diabetico '
  'controlado ni salia al filtrar por Diabetes ni mostraba su chip; las dos cosas se corrigen en '
  'esta migracion para que columna y filtro no se contradigan. '
  'Issue #761: ahora exige fn_verificar_limite_busqueda_pacientes() (60 busquedas por usuario '
  'cada minuto) via la CTE _limite, referenciada con CROSS JOIN para que el planner no la '
  'elimine por no estar correlacionada con pacientes.';
