-- Ecopac Digital - Revocar EXECUTE de PUBLIC sobre las funciones de public (issue #511, caso 1)
--
-- La 00049 (issue #408) le retiro a anon todo privilegio sobre tablas y secuencias, pero dejo
-- un cabo suelto declarado en su propia cabecera: las funciones de public son ejecutables por
-- cualquiera porque el EXECUTE a PUBLIC es el comportamiento por defecto de Postgres. Un
-- REVOKE ... FROM anon habria sido un no-op, porque el privilegio no viene de una concesion a
-- anon.
--
-- DOS FORMAS DE QUEDAR ABIERTA, NO UNA: por eso el barrido es por has_function_privilege(),
-- no por "proacl IS NULL"
--
-- Buscar solo proacl IS NULL (el ACL nunca tocado) encuentra la mitad del problema. La otra
-- mitad es exactamente lo que la propia issue advierte: "un GRANT EXECUTE ... TO authenticated
-- no cierra nada. Al materializar el ACL, el =X/postgres de PUBLIC se conserva." Dos funciones
-- de este esquema (fn_medicamento_tiene_existencias, 00050; personal_registro_atenciones, 00044)
-- ya hacian ese GRANT explicito a authenticated desde su propia migracion original, y aun asi
-- seguian abiertas a PUBLIC porque nadie las revoco. Barrer con has_function_privilege('anon', ...)
-- encuentra las dos formas por igual: es la misma comprobacion que usa la prueba nueva de
-- supabase/tests/database/privilegios_anon.sql.
--
-- DE TODAS LAS FUNCIONES INVOCABLES POR RPC CON EXECUTE ABIERTO A PUBLIC HOY, DOS GRUPOS
--
-- (Se excluyen las RETURNS TRIGGER: Postgres no permite invocarlas fuera de un trigger sin
-- importar el GRANT -"trigger functions can only be called as triggers"-, y el disparo de un
-- trigger no pasa por la comprobacion de EXECUTE del rol que lo dispara. Revocarles PUBLIC no
-- cierra nada que estuviera abierto.)
--
-- Grupo 1: helpers internos del motor de permisos y del trigger de inventario. Ninguno lo invoca
-- el cliente via .rpc() (se reviso packages/shared completo).
-- - es_administrador(), es_consultivo(), rol_actual(), tiene_permiso(), participa_en_jornada()
--   y f_unaccent(): se evaluan dentro de practicamente todas las politicas RLS `TO authenticated`
--   del esquema. Ninguna politica del esquema vigente incluye a anon (00049/00056 lo dejaron sin
--   ninguna), asi que anon no necesita EXECUTE en ninguna.
-- - fn_aplicar_ajuste_existencias(): la llaman fn_actualizar_existencias() y
--   fn_autoaprobar_movimiento_inventario() con PERFORM. Ninguna de las dos es SECURITY DEFINER,
--   asi que corren -y por lo tanto tambien el PERFORM- con el rol de quien disparo el UPDATE
--   que las activa: authenticated en el flujo normal de aprobacion.
-- - alta_de_cuenta_permitida(): su unico llamador es crear_perfil_nuevo_usuario() (00074),
--   SECURITY DEFINER. Dentro de una funcion SECURITY DEFINER, las llamadas internas corren con
--   el rol dueño de la funcion (postgres), que ya tiene EXECUTE sobre todo por ser superusuario
--   del esquema. No hace falta ningun GRANT explicito para que este camino siga funcionando.
--
-- Grupo 2: funciones de negocio reales, todas invocadas por el cliente via .rpc() (tres de ellas
-- -presupuesto_de_jornada/proyecto/sistema- con el nombre armado en una variable en
-- presupuestos/api.js, por eso verificar-shared-vs-esquema.mjs las marca como
-- ".rpc() con nombre dinamico" y no las resuelve solo). Las 13 ya tenian EXECUTE concedido a
-- authenticated -algunas explicito desde su propia migracion, como las dos del parrafo de
-- arriba; el resto materializado en algun GRANT posterior que tampoco toco PUBLIC-, comprobado
-- contra el catalogo antes de escribir este archivo. Solo hace falta revocar de PUBLIC.
--
-- Ninguna funcion de ninguno de los dos grupos concede nada a anon: no hay ninguna politica RLS
-- ni flujo de la aplicacion que dependa de que anon las alcance (00049/00056).

-- ============================================================================
-- Grupo 1: helpers internos
-- ============================================================================
REVOKE EXECUTE ON FUNCTION es_administrador() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION es_consultivo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION rol_actual() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION tiene_permiso(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION participa_en_jornada(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION f_unaccent(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_aplicar_ajuste_existencias(UUID, UUID, tipo_movimiento, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION alta_de_cuenta_permitida(TEXT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION es_administrador() TO authenticated;
GRANT EXECUTE ON FUNCTION es_consultivo() TO authenticated;
GRANT EXECUTE ON FUNCTION rol_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION tiene_permiso(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION participa_en_jornada(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION f_unaccent(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aplicar_ajuste_existencias(UUID, UUID, tipo_movimiento, INT) TO authenticated;

-- alta_de_cuenta_permitida() no recibe GRANT: ver el razonamiento arriba. Si algun dia gana un
-- llamador que no sea una funcion SECURITY DEFINER propiedad del esquema, ese cambio es el que
-- tiene que traer el GRANT, no esta migracion adivinandolo antes de tiempo.

-- ============================================================================
-- Grupo 2: funciones de negocio, ya con EXECUTE en authenticated -solo falta revocar PUBLIC
-- ============================================================================
REVOKE EXECUTE ON FUNCTION fn_atenciones_de_persona_por_jornada(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_contar_atenciones_incompletas(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_existencias_disponibles(UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_generar_receta(UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_medicamento_tiene_existencias(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_registrar_medicamento(VARCHAR, VARCHAR, presentacion_medicamento, VARCHAR, UUID[], VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_registrar_paciente(VARCHAR, VARCHAR, DATE, VARCHAR, UUID, VARCHAR, idioma_preferido, VARCHAR, tipo_sanguineo, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION personal_registro_atenciones(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION presupuesto_de_jornada(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION presupuesto_de_proyecto(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION presupuesto_del_sistema() FROM PUBLIC;

-- No hay ALTER DEFAULT PRIVILEGES ... ON FUNCTIONS FROM PUBLIC aqui, a diferencia del REVOKE ALL
-- ON TABLES/SEQUENCES FROM anon de la 00049. Se probo (FOR ROLE postgres y sin el, dentro y
-- fuera de la misma transaccion, verificando proacl en el catalogo directamente) y no suprime
-- el EXECUTE a PUBLIC por defecto en este Postgres: una funcion nueva sigue naciendo abierta
-- pase lo que pase. La 00049 sí funciona para tablas porque ahi el default de Supabase (no el
-- de Postgres) ya viene de un default_acl explicito de supabase_admin, que REVOKE FROM anon si
-- alcanza a pisar; el EXECUTE a PUBLIC de las funciones es el default nativo de Postgres, y no
-- se logro suprimir por esta via en el tiempo que se le dedico a esta issue. Queda como
-- limitacion conocida: la proxima funcion que se escriba necesita su propio REVOKE/GRANT
-- explicito, igual que las de esta migracion, y nada obliga a que su autor se acuerde.
