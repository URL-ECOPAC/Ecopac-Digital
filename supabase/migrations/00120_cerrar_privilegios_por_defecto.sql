-- Ecopac Digital - Cerrar los privilegios que reabren los defaults del esquema (issue #706)

--
-- CONFIRMADO CONTRA ecopac-dev EL 9 DE SEPTIEMBRE DE 2026
--
-- Sin ninguna sesion iniciada, solo con la anon key:
--
--   POST /rest/v1/rpc/fn_generar_alertas_caducidad  -> 1  (SE EJECUTA Y ESCRIBE)
--
-- fn_generar_alertas_caducidad() es SECURITY DEFINER (00088) y trae su propio
-- "REVOKE ALL ... FROM PUBLIC" en la misma migracion. Ese REVOKE es exactamente el que ya usaba
-- la 00102 para las 25 funciones de este esquema, y en el proyecto real no cerro nada.
--
-- POR QUE "REVOKE ... FROM PUBLIC" NO CIERRA NADA EN EL PROYECTO REAL
--
-- La 00102 (issue #511) parte de que "un REVOKE ... FROM anon habria sido un no-op, porque el
-- privilegio no viene de una concesion a anon" -es decir, que anon ejecuta por la via implicita
-- de PUBLIC, y que revocar de PUBLIC basta-. Esa premisa es cierta en el stack local de la CLI
-- que fija el CI (2.115.0: proacl queda NULL en una funcion nueva, y NULL cae al default
-- implicito "PUBLIC tiene EXECUTE"). Es FALSA en el proyecto real: el ACL de cualquier funcion
-- de public en ecopac-dev trae una concesion EXPLICITA a anon --
--
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- -- que un REVOKE FROM PUBLIC no toca, porque no es la misma via. Comprobado tambien en el
-- stack local de esta rama, con una funcion creada dentro de una transaccion de prueba: incluso
-- con "ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ALL ON FUNCTIONS FROM anon" ya
-- aplicado, la funcion nueva le seguia concediendo EXECUTE a anon. El motivo exacto de esa
-- discrepancia no se pudo aislar mas alla de lo que ya deja escrito la cabecera de la 00102 --
-- se agotó el tiempo dedicado a esto en esa issue --, pero el sintoma es reproducible y
-- coincide con lo medido: una base creada por el script de arranque de la CLI 2.116.0 (que es
-- el que usan los proyectos reales, creados desde el Dashboard) concede a anon EXECUTE sobre
-- funciones de public por defecto; la 2.115.0 no.
--
-- POR QUE SE BARRE Y NO SE LISTA
--
-- La 00102 listaba las funciones a mano y ya se quedo corta: fn_crear_usuario_administrativo,
-- fn_generar_alertas_caducidad, fn_detectar_pacientes_duplicados y fn_fusionar_pacientes se
-- escribieron despues y ninguna entro a esa lista (dos de ellas, ademas, ya traian su propio
-- REVOKE FROM PUBLIC en su propia migracion -alta_de_cuenta_permitida via
-- fn_crear_usuario_administrativo, y fn_generar_alertas_caducidad-, y ese REVOKE tampoco cerro
-- nada en el proyecto real por la misma razon de arriba). Una lista escrita a mano se queda
-- corta en cuanto alguien agrega una funcion. Aqui se usa ALL FUNCTIONS, el mismo criterio con
-- el que la 00049 uso ALL TABLES para anon.
--
-- Contenido recuperado del PR #667 (rama fix/pgtap-privilegios-en-rojo, ya borrada; ver #707),
-- que en su momento se cerro sin mergear porque el diagnostico parecia limitado a una CLI local
-- desactualizada (ver el comentario de cierre del PR). La comprobacion del 9 de septiembre
-- contra el proyecto real confirma que el problema es el que el PR #667 ya habia diagnosticado.

-- ============================================================================
-- 1. anon pierde EXECUTE sobre todo lo que hay hoy
-- ============================================================================
-- Se revoca de anon y tambien de PUBLIC: la concesion explicita (la que importa en el proyecto
-- real) y la implicita (la que importa en local) son dos caminos distintos hacia el mismo
-- privilegio, y cerrar solo uno deja el otro abierto en alguno de los dos ambientes.
-- authenticated no se toca: tiene su propia concesion explicita en cada funcion, de la que
-- dependen las politicas RLS, y la prueba 9 de privilegios_anon.sql comprueba que sigue ahi.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ============================================================================
-- 2. authenticated pierde DELETE donde ninguna politica lo gobierna
-- ============================================================================
-- Mismo cabo suelto, la otra mitad de la comparacion que motivo esta issue: authenticated tiene
-- GRANT DELETE en 45 tablas y vistas de public, y solo seis tienen una politica de DELETE que
-- decida quien borra. En las otras treinta y nueve el GRANT esta muerto -RLS deniega por
-- omision, asi que nadie borra nada hoy- pero es la segunda capa que las pruebas de las issues
-- #221 y #435 vigilan, y sin ella un descuido en una politica futura no encuentra nada debajo.
--
-- La 00049 dejo DELETE intacto a proposito, porque entonces las migraciones 00032 a 00048 lo
-- concedian donde hacia falta. El criterio de aqui es mas fino y no la contradice: DELETE se
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
-- tabla nacen otra vez con el privilegio, porque el bootstrap del proyecto real las concede por
-- default. Es el mismo remate que la 00049 le puso a las tablas y secuencias de anon.
--
-- Advertencia honesta, no una promesa: comprobado en el stack local de esta rama que este
-- bloque, por si solo, NO suprime el EXECUTE que una funcion nueva concede a anon aqui -la
-- misma limitacion que ya dejo anotada la 00102-, asi que no hay una prueba pgTAP que lo
-- demuestre en verde (ver privilegios_anon.sql y docs/CI-CD.md, seccion "Lo que el CI no puede
-- predecir"). Se deja de todas formas porque es el remate correcto para el bootstrap real -el
-- de la CLI 2.116.0 y el de los proyectos creados desde el Dashboard, que es el que aplica a
-- ecopac-dev y a ecopac-prod- y porque es la misma postura que el equipo ya adopto para las
-- tablas de anon en la 00049. Sin este bloque, la proxima funcion que se escriba repite
-- exactamente el problema de esta issue.
--
-- FOR ROLE postgres porque es el dueño de todo lo que crean las migraciones.
--
-- Consecuencia que conviene conocer: a partir de aqui, una tabla nueva que necesite borrado
-- tiene que conceder DELETE explicitamente en su propia migracion. Es deliberado -- el
-- privilegio se pide, no se hereda -- y es la misma postura que el equipo ya adopto para anon.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE DELETE ON TABLES FROM authenticated;
