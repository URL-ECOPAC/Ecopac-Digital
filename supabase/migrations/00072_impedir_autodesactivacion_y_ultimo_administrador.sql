-- Ecopac Digital - Impedir autodesactivacion y perdida del ultimo administrador activo
-- (issue #107, criterios de aceptacion 4 y 5)
--
-- PLAN.md de la issue #107 (Paso 1, Pregunta 3) decidio que estos dos criterios necesitan una
-- migracion: un chequeo que viva solo en packages/shared es evadible con la
-- anon/authenticated key desde la consola del navegador -la misma key publica que usa
-- cualquier cliente legitimo-, y los criterios dicen "impide", no "advierte". La interfaz
-- (paso 2) sigue haciendo el mismo chequeo por adelantado, para no ofrecer un boton que el
-- servidor va a rechazar, pero la defensa real es esta migracion.
--
-- Sigue el patron exacto de impedir_cambio_de_rol_propio (00038): BEFORE UPDATE ON perfiles,
-- FOR EACH ROW, RAISE EXCEPTION con ERRCODE explicito.
--
-- ============================================================================
-- Codigo de error que ve el administrador
-- ============================================================================
-- packages/shared/api/errores-de-supabase.js no se toca en este PR (fuera del alcance
-- acordado), asi que el ERRCODE tiene que caer en un SQLSTATE que ese archivo ya clasifica.
-- Se usa 'check_violation' (23514), que clasificarPostgrest() traduce a
-- CODIGOS_DE_ERROR_DE_SUPABASE.CHECK: el administrador ve "Alguno de los datos no cumple las
-- reglas del sistema. Revisa el formulario y corrige lo que este marcado." No es un mensaje
-- especifico de este caso. Se descarta a proposito 'insufficient_privilege' (42501, el que usa
-- impedir_cambio_de_rol_propio): ese cae en PERMISO_DENEGADO, que le diria a un administrador
-- "pideselo a la administradora", sin sentido cuando quien esta bloqueada ya es la
-- administradora. La interfaz hace el mismo chequeo antes de llamar al servidor y muestra un
-- mensaje propio y especifico; este mensaje generico de CHECK solo se ve si algo evade ese
-- chequeo de cliente o si ocurre la carrera de la que habla el comentario de abajo.
--
-- ============================================================================
-- Condicion de carrera en el conteo de administradores activos
-- ============================================================================
-- "Cuantos administradores activos quedarian" es una pregunta sobre TODA la tabla, no sobre
-- una fila que un FOR UPDATE pueda bloquear. Con READ COMMITTED (el nivel por defecto), dos
-- UPDATE concurrentes que desactiven a dos administradores distintos -de un total de dos
-- activos- verian cada uno al otro como "todavia activo" en su propio snapshot, pasarian el
-- chequeo los dos, y el sistema se quedaria sin ningun administrador activo: el mismo
-- escenario de bloqueo total que esta migracion existe para evitar, por la puerta de la
-- concurrencia en vez de la de un chequeo faltante.
--
-- Se resuelve con un advisory lock transaccional (pg_advisory_xact_lock) tomado con una clave
-- fija antes de contar. Es un mutex de aplicacion: la segunda transaccion que llegue se
-- bloquea hasta que la primera confirme o revierta, y entonces cuenta sobre el estado ya
-- actualizado. Se libera solo al terminar la transaccion, nunca antes -la garantia que hace
-- falta-. No hay una fila natural que bloquear con FOR UPDATE porque la pregunta es sobre
-- ausencia de filas, no sobre una fila concreta. Se confirmo antes de escribir esta migracion
-- que ningun otro archivo de supabase/migrations/ usa pg_advisory_lock ni
-- pg_advisory_xact_lock todavia (grep del directorio completo, cero resultados), asi que la
-- clave hashtext('perfiles_ultimo_administrador_activo') no colisiona con ninguna existente.
--
-- ============================================================================
-- SECURITY DEFINER
-- ============================================================================
-- impedir_dejar_sin_administrador_activo() SI lo necesita: cuenta sobre TODA la tabla
-- perfiles, y esa lectura tiene que ver la tabla completa sin depender de que RLS le muestre
-- todo a quien dispara el trigger. En el camino normal quien llega hasta aca ya es
-- administrador (la RLS de UPDATE en 00038 solo deja tocar la fila de otro a un
-- administrador, y la unica forma de que OLD.rol ya sea 'administrador' en la fila propia es
-- que la sesion actual lo sea, porque rol_actual() lee la fila ya confirmada), pero se agrega
-- SECURITY DEFINER para no depender de esa coincidencia -misma razon que ya usa rol_actual()
-- en la 00004- y para que el conteo sea correcto incluso sin sesion (una migracion futura).
--
-- impedir_autodesactivacion() NO lo necesita: no consulta ninguna tabla, solo compara NEW.id
-- contra auth.uid(). No hay nada que RLS pueda restringirle.
--
-- ============================================================================
-- impedir_autodesactivacion() es mas amplio que el criterio 4 tal como esta escrito
-- ============================================================================
-- El criterio 4 del issue habla del Administrador ("el Administrador no puede desactivarse a
-- si mismo"), pero este trigger bloquea la autodesactivacion para CUALQUIERA de los cinco
-- roles, no solo para 'administrador': la condicion es NEW.id = auth.uid(), sin mirar el rol
-- de la fila (a diferencia de impedir_cambio_de_rol_propio, que si condiciona por
-- es_administrador()). Es una decision deliberada, no un descuido: hoy la politica RLS
-- "Administrador o el propio perfil editan perfiles" (00038) le permite a cualquier perfil
-- poner activo = false sobre su propia fila, y no hay ningun flujo legitimo del sistema donde
-- alguien tenga que desactivarse a si mismo -la desactivacion es siempre una accion de un
-- administrador sobre la fila de otra persona (packages/shared/usuarios/api.js,
-- desactivarUsuario()/cambiarActivo()). Generalizar la regla a los cinco roles cierra ese
-- hueco de RLS para todos en vez de dejarlo abierto para cuatro de los cinco. Es una regla
-- nueva de negocio y queda escrita aca a proposito, para que no haya que deducirla leyendo el
-- codigo.
--
-- ============================================================================
-- Orden de disparo de los triggers BEFORE UPDATE de perfiles
-- ============================================================================
-- Postgres corre los triggers BEFORE UPDATE FOR EACH ROW de una misma tabla en orden
-- alfabetico de nombre de trigger, no en el orden en que se crearon. Con esta migracion,
-- perfiles queda con estos tres BEFORE UPDATE FOR EACH ROW (mas trg_perfiles_updated_at, que
-- no valida nada y no importa aca), en el orden real en que corren:
--
--   1. trg_perfiles_impedir_autodesactivacion       (esta migracion, criterio 4)
--   2. trg_perfiles_impedir_cambio_de_rol_propio    (00038, existente)
--   3. trg_perfiles_impedir_ultimo_administrador    (esta migracion, criterio 5)
--
-- No cambia la correccion de ninguno de los tres -cada uno evalua su propia condicion sobre
-- NEW/OLD sin depender de que otro haya corrido antes-, pero si determina cual excepcion ve
-- el cliente cuando una sola operacion viola mas de una regla a la vez. Ejemplo: una
-- administradora que es la ultima activa intenta, en el mismo UPDATE, desactivarse a si misma
-- Y cambiarse el rol. Viola tanto la regla 1 (autodesactivacion) como la 3 (ultimo
-- administrador); como la 1 corre primero, esa es la excepcion que se dispara y la 3 nunca
-- llega a evaluarse. El resultado (la operacion se rechaza) es el mismo sin importar cual de
-- las dos gano, pero conviene que quede escrito antes de que alguien lo encuentre depurando.
--
-- ============================================================================
-- Limitacion conocida: ninguno de los dos triggers cubre el borrado (DELETE)
-- ============================================================================
-- perfiles.id es FK a auth.users(id) ON DELETE CASCADE (00002_perfiles_especialidades.sql).
-- Borrar al ultimo administrador desde el Dashboard de Supabase o con la Admin API de GoTrue
-- borra auth.users y, en cascada, la fila de perfiles -sin pasar por ningun BEFORE UPDATE de
-- esta migracion ni de la 00038-, dejando el sistema sin ningun administrador igual que si el
-- trigger de la regla 3 no existiera. No se resuelve aca a proposito: un BEFORE DELETE es
-- alcance distinto (haria falta decidir si bloquea el borrado de cualquier administrador o
-- solo el del ultimo activo, y si aplica tambien a un borrado en cascada disparado desde
-- auth.users en vez de un DELETE directo sobre perfiles), y esta migracion ya cubre los dos
-- caminos que el issue #107 pide (UPDATE de activo y de rol). Declarado en las notas de
-- deploy del PR: quien administre el proyecto en el Dashboard de Supabase tiene que saber que
-- borrar un usuario ahi no pasa por esta proteccion.

-- ============================================================================
-- Criterio 4: nadie puede desactivar su propia fila
-- ============================================================================
CREATE OR REPLACE FUNCTION impedir_autodesactivacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.activo = FALSE
     AND OLD.activo IS DISTINCT FROM NEW.activo
     AND NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION impedir_autodesactivacion() IS
  'Bloquea que un perfil se desactive a si mismo (issue #107, criterio 4). No distingue rol: aplica a cualquier fila que coincida con auth.uid(), no solo a administrador.';

CREATE TRIGGER trg_perfiles_impedir_autodesactivacion
BEFORE UPDATE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION impedir_autodesactivacion();

-- ============================================================================
-- Criterio 5: no dejar el sistema sin ningun administrador activo
-- ============================================================================
CREATE OR REPLACE FUNCTION impedir_dejar_sin_administrador_activo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quedarian_administradores_activos BOOLEAN;
BEGIN
  -- Puerta 1: desactivar al ultimo administrador activo.
  -- Puerta 2: cambiarle el rol al ultimo administrador activo.
  -- Es el mismo escenario de bloqueo total por dos caminos distintos; se evaluan las dos
  -- condiciones de disparo antes de gastar el lock y el conteo.
  IF OLD.rol = 'administrador' AND OLD.activo = TRUE
     AND (
       (NEW.activo = FALSE AND OLD.activo IS DISTINCT FROM NEW.activo)
       OR (NEW.rol IS DISTINCT FROM OLD.rol)
     ) THEN

    -- Mutex de aplicacion para el conteo (ver comentario de cabecera sobre la carrera).
    -- Clave arbitraria pero fija: cualquier valor sirve mientras sea el mismo en las dos
    -- llamadas que puedan competir.
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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION impedir_dejar_sin_administrador_activo() IS
  'Bloquea desactivar o cambiarle el rol al ultimo administrador activo (issue #107, criterio 5). Usa un advisory lock transaccional para que dos desactivaciones concurrentes no dejen el sistema sin ningun administrador activo.';

CREATE TRIGGER trg_perfiles_impedir_ultimo_administrador
BEFORE UPDATE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION impedir_dejar_sin_administrador_activo();
