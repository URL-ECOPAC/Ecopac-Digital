-- Ecopac Digital - Revocar de nuevo los privilegios de anon, y dejar quien lo vigile
-- Issue #435. La 00052 volvio a conceder SELECT sobre gastos al rol anon, que la 00049
-- (issue #408) habia retirado de todo el esquema publico.
--
-- POR QUE VOLVIO A PASAR, QUE ES LO QUE IMPORTA DE ESTA MIGRACION
--
-- La linea que lo reintrodujo viene con su propia explicacion:
--
--   -- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00034/00039)
--   GRANT SELECT ON gastos TO anon, authenticated;
--
-- Se copio el patron de 00034 y 00039, que son anteriores a la 00049. Esas migraciones estan
-- aplicadas y no se pueden editar, asi que el mal ejemplo es permanente y esta a la vista de
-- cualquiera que busque como se escribe un GRANT en este repositorio.
--
-- La 00049 dejo la regla escrita en su cabecera, pero una cabecera es un archivo que nadie
-- vuelve a abrir. En el momento de escribir una migracion nueva, lo unico visible es el mal
-- ejemplo. Por eso el arreglo de esta issue NO es otro comentario: es una guarda de CI.
--
-- LA GUARDA
--
-- El job "Validar migraciones y funciones" corre ahora
-- `supabase test db supabase/tests/database/privilegios_anon.sql` despues de aplicar todas las
-- migraciones desde cero. Comprueba el ESTADO REAL de la base, no el texto de los archivos: da
-- igual como se conceda el privilegio -- un GRANT, un DO block, un cambio de ACL por defecto --
-- si anon termina con algo sobre public, el PR falla.
--
-- Se descarto un event trigger que rechazara el GRANT dentro de la propia base, que seria mas
-- fuerte todavia: crearlo exige superusuario y el rol postgres no lo es (rolsuper = false,
-- comprobado; en Supabase solo supabase_admin lo tiene).
--
-- EL DAÑO DE ESTA REGRESION FUE ACOTADO
--
-- Conviene dejarlo escrito para que nadie lea esto como una brecha: anon obtuvo solo SELECT, la
-- politica de gastos es FOR SELECT TO authenticated -- asi que una peticion anonima veia cero
-- filas -- y el bloque ALTER DEFAULT PRIVILEGES de la 00049 aguanto: no habia un solo TRUNCATE
-- para anon en toda la base. Lo unico que se colo fue el GRANT escrito a mano. Era la segunda
-- capa de defensa caida, no un acceso real.

-- ============================================================================
-- 1. anon pierde todo sobre el esquema publico, otra vez
-- ============================================================================
-- En barrido y no solo sobre gastos: es idempotente y atrapa cualquier otra concesion que se
-- haya colado sin que la hayamos visto. Mismo criterio que la 00049.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ============================================================================
-- 2. Una vista para comprobar la regla en una linea
-- ============================================================================
-- Mismo patron que tablas_sin_rls (00030): una vista que debe devolver SIEMPRE cero filas, para
-- no tener que escribir la consulta a information_schema de memoria cada vez.
--
--   SELECT * FROM privilegios_de_anon;   -- cero filas = todo bien
CREATE OR REPLACE VIEW privilegios_de_anon AS
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public';

COMMENT ON VIEW privilegios_de_anon IS
  'Verificacion de la issue #435: debe devolver cero filas. Lista cualquier privilegio que el rol
   anon tenga sobre una tabla o vista del schema public. En este proyecto anon no necesita acceso
   a ninguna, porque el inicio de sesion no pasa por PostgREST. La prueba
   supabase/tests/database/privilegios_anon.sql lo automatiza y el CI la corre en cada PR.';

-- Es introspeccion del esquema, no datos de negocio: no tiene por que exponerse por la API.
-- Mismo trato que le da la 00030 a tablas_sin_rls.
REVOKE ALL ON privilegios_de_anon FROM PUBLIC, anon, authenticated;
