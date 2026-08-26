-- Aprovisiona el primer administrador (issue #111).
--
-- POR QUE ESTA MIGRACION SE EDITO EN SU SITIO Y NO SE CORRIGIO CON UNA 00064
--
-- La version original de este archivo (PR #446) nunca llego a aplicarse en ninguna base.
-- Abortaba con:
--
--   ERROR: duplicate key value violates unique constraint "users_email_partial_key"
--   Key (email)=(admin@ecopac.org) already exists.
--
-- porque insertaba en auth.users con ON CONFLICT (id) DO NOTHING, que solo cubre el choque
-- por llave primaria. En ecopac-dev ya existia ese correo con OTRO id, asi que el conflicto
-- ocurria contra el indice unico de correo y la migracion se detenia. supabase db push para
-- en la primera migracion que falla, de modo que la base de develop quedo congelada en la
-- 00062 y ninguna migracion posterior podia llegar.
--
-- Al abortar, la migracion no quedo registrada en supabase_migrations.schema_migrations
-- (por eso se reintentaba en cada push y volvia a fallar). No es una migracion aplicada,
-- asi que la regla de inmutabilidad de AGENTS.md no la alcanza. Una 00064 tampoco habria
-- servido: db push se detiene en la 00063 antes de llegar a ella.
--
-- QUE CAMBIA RESPECTO A LA VERSION ORIGINAL
--
-- 1. Es idempotente. Resuelve por correo el usuario que ya exista en vez de insertar un id
--    fijo, y solo crea uno nuevo cuando de verdad no hay ninguno.
-- 2. No lleva contrasena. La original horneaba crypt('Admin123!', ...) en un repositorio
--    publico. Aqui el usuario se crea sin contrasena y se fija por el flujo de recuperacion,
--    que es lo que pide el criterio de #111 de no exponer credenciales.
-- 3. Crea la fila de auth.identities. Sin ella GoTrue no reconoce el proveedor de correo y
--    el usuario no puede iniciar sesion, asi que el objetivo de #111 no se cumplia ni
--    cuando la migracion pasaba.
-- 4. Desactiva un solo trigger, y por nombre, en lugar de DISABLE TRIGGER USER sobre toda
--    la tabla.

DO $$
DECLARE
  -- text y no citext: auth.users.email es varchar y GoTrue lo guarda ya en minusculas, asi que la
  -- comparacion directa basta y se evita depender de los operadores de citext en el esquema auth.
  v_correo  CONSTANT text := 'admin@ecopac.org';
  v_id      uuid;
BEGIN
  -- ------------------------------------------------------------------------------------
  -- 1. Usuario de autenticacion
  -- ------------------------------------------------------------------------------------
  -- Si el correo ya existe se reutiliza su id, venga de donde venga: de una corrida
  -- anterior, de un alta manual en el panel de Supabase o de una siembra local. Esto es lo
  -- que la version original no contemplaba.
  SELECT id INTO v_id FROM auth.users WHERE email = v_correo;

  IF v_id IS NULL THEN
    v_id := extensions.gen_random_uuid();

    -- encrypted_password va en NULL a proposito: la contrasena del primer administrador no
    -- se versiona. Se fija desde la aplicacion con "olvide mi contrasena", o con
    -- `supabase auth admin` desde el entorno seguro. Ver docs/QUICKSTART.md.
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_correo,
      NULL,
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"nombres": "Administrador", "apellidos": "Sistema"}',
      NOW(),
      NOW()
    );

    -- GoTrue resuelve el proveedor por auth.identities, no por raw_app_meta_data. Sin esta
    -- fila el usuario existe pero no puede autenticarse por correo.
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      created_at,
      updated_at
    ) VALUES (
      extensions.gen_random_uuid(),
      v_id,
      v_id::text,
      jsonb_build_object(
        'sub', v_id::text,
        'email', v_correo,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      NOW(),
      NOW()
    );
  END IF;

  -- ------------------------------------------------------------------------------------
  -- 2. Perfil con rol administrador
  -- ------------------------------------------------------------------------------------
  -- El trigger trg_auth_users_crear_perfil (00002) ya creo el perfil con el rol por
  -- defecto 'voluntario general' cuando se inserto en auth.users, asi que aqui casi siempre
  -- se entra por la rama del ON CONFLICT.
  --
  -- trg_perfiles_impedir_cambio_de_rol_propio (00038) bloquea cualquier UPDATE que cambie
  -- el rol si es_administrador() es falso, y durante una migracion no hay sesion, asi que
  -- lo es. Se desactiva solo ese trigger, por nombre: DISABLE TRIGGER USER apagaba tambien
  -- el de updated_at y el de auditoria de la 00026.
  ALTER TABLE public.perfiles
    DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

  INSERT INTO public.perfiles (
    id,
    email,
    nombres,
    apellidos,
    rol,
    activo
  ) VALUES (
    v_id,
    v_correo,
    'Administrador',
    'Sistema',
    'administrador',
    TRUE
  )
  -- nombres y apellidos solo se rellenan si estan vacios: el trigger de la 00002 los deja en ''
  -- cuando el alta no trae metadatos, pero si alguien ya puso el nombre real del administrador no
  -- se pisa con 'Administrador Sistema'.
  ON CONFLICT (id) DO UPDATE SET
    rol       = 'administrador',
    activo    = TRUE,
    nombres   = COALESCE(NULLIF(perfiles.nombres, ''), EXCLUDED.nombres),
    apellidos = COALESCE(NULLIF(perfiles.apellidos, ''), EXCLUDED.apellidos);

  ALTER TABLE public.perfiles
    ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
END $$;
