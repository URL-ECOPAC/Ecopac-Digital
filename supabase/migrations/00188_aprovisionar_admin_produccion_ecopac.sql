-- Aprovisiona el correo de producción ecopac@gmail.com como administrador inicial (Issue #913)
DO $$
DECLARE
  v_correo CONSTANT text := 'ecopac@gmail.com';
  v_id     uuid;
BEGIN
  -- 1. Usuario de autenticación
  SELECT id INTO v_id FROM auth.users WHERE email = v_correo;

  IF v_id IS NULL THEN
    v_id := extensions.gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,      -- <- AÑADIR
      recovery_token,          -- <- AÑADIR
      email_change,            -- <- AÑADIR
      email_change_token_new,  -- <- AÑADIR
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
      '',                      -- <- AÑADIR
      '',                      -- <- AÑADIR
      '',                      -- <- AÑADIR
      '',                      -- <- AÑADIR
      '{"provider": "email", "providers": ["email"]}',
      '{"nombres": "Administrador", "apellidos": "Ecopac"}',
      NOW(),
      NOW()
    );

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

  -- 2. Asegurar el perfil con rol 'administrador'
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
    'Ecopac',
    'administrador',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    rol       = 'administrador',
    activo    = TRUE,
    nombres   = COALESCE(NULLIF(perfiles.nombres, ''), EXCLUDED.nombres),
    apellidos = COALESCE(NULLIF(perfiles.apellidos, ''), EXCLUDED.apellidos);

  ALTER TABLE public.perfiles
    ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
END $$;