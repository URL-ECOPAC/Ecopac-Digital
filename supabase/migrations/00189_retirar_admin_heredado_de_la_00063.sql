-- Retira la cuenta admin@ecopac.org que aprovisiono la 00063 (issue #252).
--
-- POR QUE
--
-- La 00063 (issue #111) creo el primer administrador con el correo admin@ecopac.org, y la 00188
-- (issue #913) agrego el definitivo, ecopac.digital@gmail.com, pero no retiro el anterior. Un
-- proyecto nuevo quedaba con DOS administradores, y el primero esta atado a un buzon que la
-- organizacion no controla: la cuenta no tiene contrasena, pero en cuanto el proyecto tenga SMTP
-- propio, quien reciba el correo de admin@ecopac.org puede pedir "olvide mi contrasena" y entrar
-- como administrador. La organizacion pidio un solo usuario base.
--
-- La 00063 ya esta aplicada y no se edita (AGENTS.md); esta migracion corrige hacia adelante.
--
-- QUE HACE, Y QUE NO
--
-- Borra la cuenta de auth.users; su fila de perfiles cae por ON DELETE CASCADE (00002) y la de
-- auth.identities por la llave foranea de GoTrue. Solo la borra si se cumplen las dos:
--
--   1. Nunca se uso: sin contrasena y sin ningun inicio de sesion. Una cuenta usada pudo dejar
--      registros a su nombre (registrado_por, aprobado_por...) y borrarla romperia esa
--      trazabilidad; en ese caso se conserva y se avisa, y la decision es de una persona.
--   2. Queda otro administrador activo. impedir_borrar_ultimo_administrador() (00103) ya lo
--      exige y abortaria la migracion entera; se comprueba antes para avisar en vez de fallar.
--
-- En los proyectos de la organizacion (ecopac-prod, ecopac-dev) se cumplen las dos: nacieron
-- limpios y la 00188 deja a ecopac.digital@gmail.com como administrador. Es idempotente: si la
-- cuenta no existe, no hace nada.

DO $$
DECLARE
  v_correo CONSTANT text := 'admin@ecopac.org';
  v_id     uuid;
  v_usada  boolean;
BEGIN
  SELECT id,
         (last_sign_in_at IS NOT NULL OR coalesce(encrypted_password, '') <> '')
    INTO v_id, v_usada
    FROM auth.users
   WHERE email = v_correo;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  IF v_usada THEN
    RAISE NOTICE '% ya se uso (tiene contrasena o inicios de sesion); se conserva. Desactivarla a mano si corresponde.', v_correo;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perfiles
     WHERE rol = 'administrador' AND activo = TRUE AND id <> v_id
  ) THEN
    RAISE NOTICE '% es el unico administrador activo; se conserva.', v_correo;
    RETURN;
  END IF;

  DELETE FROM auth.users WHERE id = v_id;
END
$$;
