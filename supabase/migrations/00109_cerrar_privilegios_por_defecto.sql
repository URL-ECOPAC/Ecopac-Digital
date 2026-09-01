-- Ecopac Digital - Cerrar los privilegios que reabren los defaults del esquema (issue #666)
--
-- La suite pgTAP lleva en rojo en develop siete aserciones repartidas en cuatro archivos, y como
-- el paso "supabase test db" no admite fallo, cualquier PR que toque supabase/ sale rojo aunque
-- su cambio sea correcto. Es exactamente el escenario que la cabecera del workflow describe como
-- la razon por la que la regresion de la issue #435 llego a mergearse.
--
-- POR QUE LA 00102 NO CERRO NADA
--
-- La 00102 (issue #511) revoco EXECUTE funcion por funcion con FROM PUBLIC, partiendo de que
-- "un REVOKE ... FROM anon habria sido un no-op, porque el privilegio no viene de una concesion
-- a anon". Esa premisa es falsa en esta base: el ACL de cada funcion dice anon=X/postgres, o sea
-- una concesion explicita, que Supabase otorga con ALTER DEFAULT PRIVILEGES al crear el
-- proyecto. Un REVOKE FROM PUBLIC no retira una concesion explicita, asi que las veinticinco
-- funciones invocables de public siguen abiertas a anon.
--
-- POR QUE SE BARRE Y NO SE LISTA
--
-- La 00102 listaba las funciones a mano y se dejo cuatro fuera (fn_crear_usuario_administrativo,
-- fn_generar_alertas_caducidad, fn_detectar_pacientes_duplicados y fn_fusionar_pacientes). Una
-- lista escrita a mano se queda corta en cuanto alguien agrega una funcion. Aqui se usa
-- ALL FUNCTIONS, por el mismo motivo por el que la 00049 uso ALL TABLES.

-- ============================================================================
-- 1. anon pierde EXECUTE sobre todo lo que hay hoy
-- ============================================================================
-- Se revoca de anon y tambien de PUBLIC: la concesion explicita y la implicita son dos caminos
-- distintos hacia el mismo privilegio, y cerrar solo uno deja el otro abierto. authenticated no
-- se toca: tiene su propia concesion explicita, que es de la que dependen las politicas RLS y
-- que la prueba 9 de privilegios_anon.sql comprueba que sigue ahi.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ============================================================================
-- 2. authenticated pierde DELETE donde ninguna politica lo gobierna
-- ============================================================================
-- Hoy lo tiene sobre cuarenta y cinco tablas y vistas, y solo seis tienen una politica de DELETE
-- que decida quien borra. En las otras treinta y nueve el GRANT esta muerto -- RLS deniega por
-- omision, asi que nadie borra nada -- pero es la segunda capa que las pruebas de las issues
-- #221 y #435 vigilan, y sin ella un descuido en una politica futura no encuentra nada debajo.
--
-- La 00049 dejo DELETE intacto a proposito, porque entonces las migraciones 00032 a 00048 lo
-- concedian donde hacia falta. El criterio de aqui es mas fino y no lo contradice: DELETE se
-- conserva donde hay una politica que lo use, y se retira donde no.
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Las seis que si borran, cada una con su politica de DELETE ya escrita.
GRANT DELETE ON jornada_personal TO authenticated;
GRANT DELETE ON padecimientos_cronicos TO authenticated;
GRANT DELETE ON perfil_especialidad TO authenticated;
GRANT DELETE ON principios_activos TO authenticated;
GRANT DELETE ON proyecto_hitos TO authenticated;
GRANT DELETE ON usuario_permiso TO authenticated;

-- ============================================================================
-- 3. Que no vuelva a entrar por la puerta de atras
-- ============================================================================
-- Los dos bloques anteriores arreglan la foto de hoy. Sin este, la proxima funcion o la proxima
-- tabla nacen otra vez con el privilegio, porque los defaults del esquema los conceden. Es el
-- mismo remate que la 00049 le puso a las tablas y secuencias de anon, que ahi si funciono: la
-- diferencia es que aquella no cubrio ON FUNCTIONS ni el DELETE de authenticated.
--
-- FOR ROLE postgres porque es el dueño de todo lo que crean las migraciones.
--
-- Consecuencia que conviene conocer: a partir de aqui, una tabla nueva que necesite borrado
-- tiene que conceder DELETE explicitamente en su propia migracion. Es deliberado -- el privilegio
-- se pide, no se hereda -- y es la misma postura que el equipo ya adopto para anon.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE DELETE ON TABLES FROM authenticated;
