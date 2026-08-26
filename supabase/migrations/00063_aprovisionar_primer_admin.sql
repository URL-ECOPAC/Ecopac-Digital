-- Desactivar triggers de usuario para la inserción inicial
ALTER TABLE public.perfiles DISABLE TRIGGER USER;

-- Crear usuario de autenticación
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
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'authenticated',
  'authenticated',
  'admin@ecopac.org',
  crypt('Admin123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"nombres": "Administrador", "apellidos": "Sistema"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Crear perfil de administrador
INSERT INTO public.perfiles (
  id,
  email,
  nombres,
  apellidos,
  rol,
  activo,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@ecopac.org',
  'Administrador',
  'Sistema',
  'administrador',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  rol = 'administrador';

-- Reactivar triggers
ALTER TABLE public.perfiles ENABLE TRIGGER USER;