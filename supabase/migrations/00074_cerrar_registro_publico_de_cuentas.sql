-- Cierra el registro publico de cuentas (issue #508).
--
-- EL AGUJERO
--
-- `POST /auth/v1/signup` con la llave anonima -que viaja en el bundle del navegador y es publica
-- por diseno- creaba una cuenta operativa. El trigger trg_auth_users_crear_perfil de la 00002
-- inserta el perfil sin `rol` ni `activo`, asi que caen a sus DEFAULT: 'voluntario general' y
-- TRUE. Ese rol no es de solo lectura: por las politicas de la 00032 y la 00033 lee y registra
-- pacientes, expedientes, atenciones y triajes. Comprobado contra el stack local antes de
-- escribir esta migracion: la cuenta recien creada leyo la tabla pacientes con DPI incluido y
-- registro un paciente nuevo.
--
-- POR QUE NO BASTA CON config.toml
--
-- El workflow de despliegue solo corre `supabase db push`; nunca `supabase config push`. Es
-- decir, `enable_signup = false` gobierna el stack local y el CI, pero en ecopac-dev y
-- ecopac-prod manda el Dashboard de cada proyecto (docs/SEGURIDAD.md, seccion 4). Al revisar
-- ecopac-dev el 28 de agosto, "Allow new users to sign up" estaba **activado**.
--
-- Lo unico del repositorio que alcanza a los proyectos remotos es una migracion. Por eso la
-- defensa vive aqui: protege aunque alguien vuelva a abrir el ajuste en el Dashboard, o aunque
-- se cree un proyecto nuevo con el default de Supabase, que es tenerlo abierto.
--
-- COMO SE DISTINGUE UN ALTA LEGITIMA DE UN REGISTRO PUBLICO
--
-- Dos senales, y la primera es mas sutil de lo que parece:
--
-- 1. **`session_user`, no `current_user`.** GoTrue conecta a la base como supabase_auth_admin;
--    las migraciones y los seeds, como postgres. Pero esta funcion es SECURITY DEFINER, y dentro
--    de una funcion asi `current_user` es el DUENO de la funcion -postgres-, no quien la invoca.
--    Comprobado con una sonda contra un signup real: `current_user=postgres` y
--    `session_user=supabase_auth_admin`. Mirar `current_user` dejaria la puerta abierta sin que
--    nada avisara, porque la condicion nunca se cumpliria.
--
-- 2. **`raw_app_meta_data`**, que el cliente no puede escribir. Un signup solo controla
--    `raw_user_meta_data` (el `options.data` de supabase-js); `raw_app_meta_data` la fija GoTrue,
--    y solo la Admin API -con la llave de servicio- puede ponerle claves propias.
--
-- De ahi la regla: si el INSERT viene de GoTrue y no trae la marca administrativa, se rechaza.
-- Las migraciones y los seeds entran como postgres, asi que siguen funcionando sin excepciones
-- -incluida la 00063, que aprovisiona al primer administrador, y los fixtures de las suites
-- pgTAP, que insertan en auth.users directamente-.
--
-- La decision vive en alta_de_cuenta_permitida(), que recibe el usuario de sesion como parametro
-- en vez de leerlo. Es a proposito: `postgres` no puede hacer SET SESSION AUTHORIZATION en el
-- stack local, asi que una prueba pgTAP no puede suplantar a GoTrue. Con la regla en una funcion
-- pura, la prueba la comprueba de verdad en vez de darla por buena.
--
-- La 00002 no se toca: esta aplicada. La funcion se reemplaza desde aqui con CREATE OR REPLACE.
--
-- Nota sobre la 00049: su cabecera justificaba retirarle privilegios a `anon` afirmando que "no
-- existe registro de cuentas desde el cliente". Era falso -signup es un endpoint de GoTrue, igual
-- que signInWithPassword, y por eso el REVOKE a `anon` no lo alcanzaba-. A partir de esta
-- migracion la afirmacion si es cierta.

-- ============================================================================
-- 1. La regla, en una funcion pura para poder probarla
-- ============================================================================
CREATE OR REPLACE FUNCTION alta_de_cuenta_permitida(
  p_usuario_de_sesion TEXT,
  p_app_meta          JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    -- No viene de GoTrue: es una migracion, un seed o una consulta directa a la base.
    p_usuario_de_sesion IS DISTINCT FROM 'supabase_auth_admin'
    -- O viene de GoTrue con la marca que solo la Admin API puede poner.
    OR COALESCE(p_app_meta ->> 'alta', '') = 'administrativa';
$$;

COMMENT ON FUNCTION alta_de_cuenta_permitida(TEXT, JSONB) IS
  'Decide si un alta en auth.users puede continuar. Recibe el usuario de sesion en vez de leerlo para que sea comprobable desde pgTAP: postgres no puede hacer SET SESSION AUTHORIZATION en el stack local.';

-- ============================================================================
-- 2. El trigger de la 00002, ahora con la puerta cerrada
-- ============================================================================
CREATE OR REPLACE FUNCTION crear_perfil_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- session_user y no current_user: dentro de una funcion SECURITY DEFINER, current_user es el
  -- dueno de la funcion (postgres) y nunca seria supabase_auth_admin. Ver la cabecera.
  IF NOT public.alta_de_cuenta_permitida(session_user, NEW.raw_app_meta_data) THEN
    RAISE EXCEPTION
      'El registro de cuentas esta cerrado. Las altas las hace la administradora.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.perfiles (id, nombres, apellidos, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombres', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellidos', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION crear_perfil_nuevo_usuario() IS
  'Crea el perfil correspondiente cada vez que se inserta un usuario en auth.users, y rechaza el alta si viene del registro publico de GoTrue sin la marca administrativa (issue #508).';

-- ============================================================================
-- 3. El camino de alta que queda funcionando
-- ============================================================================
-- Con el registro cerrado hace falta una via para dar de alta al personal. La prevista es la
-- Edge Function `invitar-usuario`, que packages/shared/usuarios/api.js ya invoca... y que **no
-- existe**: supabase/functions/ solo tiene un .gitkeep. Es decir, el alta administrativa ya
-- estaba rota antes de esta migracion, y el unico camino que funcionaba era justo el agujero.
--
-- Esta funcion es esa via mientras tanto: la ejecuta la administradora desde el SQL editor del
-- Dashboard, y es lo que llamara la Edge Function cuando se escriba.
--
-- No fija contrasena a proposito, por el mismo motivo que la 00063: una contrasena versionada o
-- tecleada por un tercero es una credencial compartida. La persona la establece con "olvide mi
-- contrasena".
CREATE OR REPLACE FUNCTION fn_crear_usuario_administrativo(
  p_correo    TEXT,
  p_nombres   TEXT,
  p_apellidos TEXT,
  p_rol       rol_usuario DEFAULT 'voluntario general'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_correo IS NULL OR btrim(p_correo) = '' THEN
    RAISE EXCEPTION 'Hace falta el correo para dar de alta a una persona.'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE email = lower(btrim(p_correo));
  IF v_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una cuenta con el correo %.', lower(btrim(p_correo))
      USING ERRCODE = 'unique_violation';
  END IF;

  v_id := extensions.gen_random_uuid();

  -- Las cuatro columnas de token van explicitas en '': GoTrue las escanea como texto no nulo y
  -- auth.users no les pone DEFAULT ''. Omitirlas deja la fila en NULL y rompe el login de TODO
  -- el mundo con un 500 "Database error querying schema" que no menciona la columna. Es
  -- exactamente el bug de la issue #496, que la 00069 tuvo que venir a reparar.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    lower(btrim(p_correo)),
    NULL,
    NOW(),
    -- La marca que el trigger de arriba exige. Un signup desde el cliente no la puede poner.
    '{"provider": "email", "providers": ["email"], "alta": "administrativa"}'::jsonb,
    jsonb_build_object('nombres', COALESCE(p_nombres, ''), 'apellidos', COALESCE(p_apellidos, '')),
    NOW(),
    NOW(),
    '', '', '', ''
  );

  -- GoTrue resuelve el proveedor por auth.identities, no por raw_app_meta_data. Sin esta fila el
  -- usuario existe pero no puede autenticarse por correo (mismo motivo que documenta la 00063).
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    v_id,
    v_id::text,
    jsonb_build_object(
      'sub', v_id::text,
      'email', lower(btrim(p_correo)),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW()
  );

  -- El trigger de la 00002 ya creo el perfil con el rol por defecto; aqui se fija el que toca.
  -- trg_perfiles_impedir_cambio_de_rol_propio (00038) bloquea el cambio de rol si
  -- es_administrador() es falso, y en una llamada sin sesion lo es, asi que se desactiva solo ese
  -- trigger, por nombre, igual que hace la 00063.
  ALTER TABLE public.perfiles
    DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

  UPDATE public.perfiles
  SET rol       = p_rol,
      activo    = TRUE,
      nombres   = COALESCE(NULLIF(btrim(COALESCE(p_nombres, '')), ''), nombres),
      apellidos = COALESCE(NULLIF(btrim(COALESCE(p_apellidos, '')), ''), apellidos)
  WHERE id = v_id;

  ALTER TABLE public.perfiles
    ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION fn_crear_usuario_administrativo(TEXT, TEXT, TEXT, rol_usuario) IS
  'Da de alta a una persona con el rol indicado, sin contrasena: la establece con "olvide mi contrasena". Es el camino administrativo mientras no exista la Edge Function invitar-usuario. No se concede a ningun rol de la aplicacion: se ejecuta desde el SQL editor del Dashboard.';

-- Nadie de la aplicacion la puede llamar. authenticated y anon no reciben EXECUTE: crear cuentas
-- no es una operacion que deba salir de una sesion del navegador, y la Edge Function que la
-- llamara en el futuro usa la llave de servicio.
REVOKE ALL ON FUNCTION fn_crear_usuario_administrativo(TEXT, TEXT, TEXT, rol_usuario) FROM PUBLIC;
