-- Deja una cuenta de administradora con el correo y la contrasena que recibe como variables de
-- psql (-v correo=... -v clave=...). Lo corre scripts/recargar-datos-demo.sh.
--
-- Las credenciales no viven en el repositorio: llegan por variables de entorno al correr el
-- script. Si la cuenta existe se le fija la contrasena y el rol; si no, se crea igual que las
-- cuentas de supabase/seed-demo.sql (auth.users + auth.identities, tokens en '').

SELECT set_config('ecopac.correo_admin', lower(btrim(:'correo')), false),
       set_config('ecopac.clave_admin', :'clave', false);

DO $$
DECLARE
  v_correo TEXT := current_setting('ecopac.correo_admin');
  v_clave TEXT := current_setting('ecopac.clave_admin');
  v_id UUID;
BEGIN
  IF v_correo = '' OR v_clave = '' THEN
    RAISE EXCEPTION 'Faltan el correo o la contrasena de la administradora.';
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_correo;

  IF v_id IS NULL THEN
    v_id := extensions.gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_correo, extensions.crypt(v_clave, extensions.gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}', '{"nombres":"Administradora","apellidos":""}',
      NOW(), NOW(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (extensions.gen_random_uuid(), v_id, v_id::TEXT,
            jsonb_build_object('sub', v_id::TEXT, 'email', v_correo), 'email', NOW(), NOW(), NOW());
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_clave, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_id;
  END IF;

  -- Mismo motivo que en seed-demo.sql: el trigger que impide cambiarse el rol lee auth.uid(), que
  -- en esta conexion directa es NULL.
  ALTER TABLE public.perfiles DISABLE TRIGGER USER;
  UPDATE public.perfiles SET rol = 'administrador', activo = TRUE WHERE id = v_id;
  ALTER TABLE public.perfiles ENABLE TRIGGER USER;

  RAISE NOTICE 'Administradora lista: %', v_correo;
END;
$$;

SELECT set_config('ecopac.clave_admin', '', false);
