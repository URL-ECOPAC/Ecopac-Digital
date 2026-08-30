-- Ecopac Digital - Defensa contra el borrado del ultimo administrador (issue #511, caso 2)
--
-- docs/PERMISOS.md, Divergencia 15: impedir_autodesactivacion() e
-- impedir_dejar_sin_administrador_activo() (00072) son BEFORE UPDATE. perfiles.id es
-- FK ON DELETE CASCADE a auth.users, y un DELETE -desde el Dashboard de Supabase o la Admin
-- API de GoTrue, no desde esta aplicacion- no dispara ningun BEFORE UPDATE. La 00072 ya
-- declaraba esto como limitacion conocida en su propia cabecera.
--
-- POR QUE BEFORE DELETE SOBRE perfiles Y NO SOBRE auth.users
--
-- Un ON DELETE CASCADE se ejecuta como un DELETE de verdad sobre la tabla referenciada: no
-- salta los triggers de esa tabla, solo evita que la aplicacion tenga que emitirlo a mano. Un
-- BEFORE DELETE FOR EACH ROW en perfiles se dispara igual quien inicie el borrado, un
-- DELETE FROM perfiles directo o la cascada desde auth.users, sin tener que tocar el esquema
-- auth (administrado por Supabase, se prefiere no modificarlo cuando hay una alternativa en un
-- esquema propio).
--
-- MISMA LOGICA, MISMO ADVISORY LOCK QUE LA 00072, FUNCION NUEVA PORQUE EL TRIGGER ES DISTINTO
--
-- No se reutiliza impedir_dejar_sin_administrador_activo(): un trigger BEFORE DELETE no recibe
-- NEW, solo OLD, asi que el cuerpo que compara NEW.activo/NEW.rol no aplica tal cual. La
-- condicion de disparo aqui es mas simple -no hay "cambia a" que evaluar, la fila entera
-- desaparece- pero el conteo y el candado son el mismo mutex de aplicacion
-- (hashtext('perfiles_ultimo_administrador_activo')), a proposito: una desactivacion (UPDATE)
-- y un borrado (DELETE) concurrentes sobre los dos ultimos administradores activos tienen que
-- competir por el mismo candado para que ninguno de los dos pase su chequeo viendo al otro
-- todavia activo.
CREATE OR REPLACE FUNCTION impedir_borrar_ultimo_administrador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quedarian_administradores_activos BOOLEAN;
BEGIN
  IF OLD.rol = 'administrador' AND OLD.activo = TRUE THEN
    PERFORM pg_advisory_xact_lock(hashtext('perfiles_ultimo_administrador_activo'));

    SELECT EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE rol = 'administrador' AND activo = TRUE AND id <> OLD.id
    ) INTO v_quedarian_administradores_activos;

    IF NOT v_quedarian_administradores_activos THEN
      RAISE EXCEPTION 'No puede quedar el sistema sin ningun administrador activo.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION impedir_borrar_ultimo_administrador() IS
  'Bloquea borrar al ultimo administrador activo (issue #511), incluido el borrado en cascada '
  'desde auth.users que el Dashboard de Supabase o la Admin API de GoTrue disparan sin pasar '
  'por ningun BEFORE UPDATE. Mismo advisory lock que impedir_dejar_sin_administrador_activo '
  '(00072): las dos protegen el mismo invariante por caminos distintos (UPDATE y DELETE) y '
  'tienen que competir por el mismo mutex para que una desactivacion y un borrado concurrentes '
  'no se dejen pasar el uno al otro.';

CREATE TRIGGER trg_perfiles_impedir_borrar_ultimo_administrador
BEFORE DELETE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION impedir_borrar_ultimo_administrador();
