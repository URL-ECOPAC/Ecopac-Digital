-- Ecopac Digital - Retirar los privilegios de anon sobre el esquema publico
-- Issue #408. anon es el rol que PostgREST usa para toda peticion SIN sesion, es decir
-- cualquiera que tenga la llave anonima del proyecto, que viaja en el bundle del navegador
-- y es publica por diseno.
--
-- LA REGLA QUE ESTABLECE ESTA MIGRACION
--
-- En este proyecto anon no necesita acceso a NINGUNA tabla del esquema publico. El inicio
-- de sesion no pasa por PostgREST: iniciarSesion() de packages/shared/api/sesion.js llama a
-- auth.signInWithPassword, que es un endpoint de GoTrue, y la lectura del perfil ocurre
-- despues, ya con el JWT del usuario. No existe registro de cuentas desde el cliente.
--
-- Si alguna vez hace falta exponer algo a anon, se concede explicitamente en su propia
-- migracion y se justifica ahi por que. Lo que no se hace nunca mas es agregar anon a la
-- lista de un GRANT por costumbre, que es como llego el esquema al estado que corrige este
-- archivo.
--
-- POR QUE NO ALCANZA CON REVOCAR LOS GRANT ESCRITOS A MANO
--
-- Las migraciones 00032, 00033, 00034, 00038 y 00039 conceden a "anon, authenticated" sobre
-- 31 tablas. Pero el barrido del esquema completo (criterio de la issue) encontro que las 39
-- tablas de public, sin una sola excepcion, conceden privilegios a anon -- incluidas
-- donantes, donaciones, gastos, comunidades, municipios y departamentos, donde nadie escribio
-- un GRANT.
--
-- La causa es el ACL por defecto del esquema, que concede Dxt (TRUNCATE, REFERENCES, TRIGGER)
-- a anon en toda tabla nueva creada por postgres, que es el rol con el que corren las
-- migraciones:
--
--   public | postgres | r | {postgres=arwdDxt/postgres,anon=Dxt/postgres,...}
--
-- Por eso este archivo tambien toca ALTER DEFAULT PRIVILEGES: sin eso, la siguiente migracion
-- que cree una tabla vuelve a abrir el agujero y el arreglo caduca.
--
-- TRUNCATE NO PASA POR RLS, Y ESO SI ERA UNA BRECHA
--
-- Las politicas de fila gobiernan SELECT, INSERT, UPDATE y DELETE. TRUNCATE se controla solo
-- por el privilegio del mismo nombre. Comprobado sobre la base local antes de este cambio:
-- con el rol anon, "TRUNCATE pacientes CASCADE" se ejecuta y arrastra en cascada expedientes,
-- padecimientos_cronicos, atenciones, triajes, consultas, consulta_diagnostico, recetas y
-- receta_detalle. Una sola sentencia desde una peticion sin sesion vaciaba la cadena clinica
-- entera.
--
-- authenticated arrastra el mismo defecto por la misma causa: TRUNCATE, REFERENCES y TRIGGER
-- sobre 43 objetos. Un voluntario con sesion valida podia vaciar pacientes. Se cierra aqui
-- porque es el mismo defecto de origen, aunque la issue solo hable de anon.
--
-- QUE QUEDA FUERA, A PROPOSITO
--
-- anon puede ejecutar 22 funciones de public, 8 de ellas SECURITY DEFINER. Ese privilegio NO
-- viene de una concesion a anon: el proacl de esas funciones es NULL, o sea EXECUTE a PUBLIC,
-- que es el comportamiento por defecto de PostgreSQL. Un REVOKE ... FROM anon seria un no-op.
-- Cerrarlo exige revocar de PUBLIC y volver a conceder a authenticated y service_role una por
-- una, que es un cambio de otro tamano y otro riesgo. Va en issue aparte.

-- ============================================================================
-- 1. anon pierde todo sobre el esquema publico
-- ============================================================================
-- Se usa ALL TABLES en vez de listar las 39 a mano, por el mismo motivo por el que la 00030
-- recorre pg_tables: no depender de que alguien se acuerde de cada tabla. ALL TABLES incluye
-- las vistas, asi que reafirma lo que la 00041 ya habia hecho con las tres vistas agregadas.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ============================================================================
-- 2. authenticated pierde lo destructivo, conserva lo que las politicas usan
-- ============================================================================
-- Solo se le quitan los tres privilegios que ninguna politica necesita y que nunca se
-- concedieron a proposito. SELECT, INSERT, UPDATE y DELETE quedan intactos: son los que las
-- migraciones 00032 a 00048 conceden explicitamente y de los que dependen las politicas RLS.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ============================================================================
-- 3. Que no vuelva a pasar con las tablas que aun no existen
-- ============================================================================
-- Sin este bloque, los dos anteriores solo arreglan la foto de hoy. Toda tabla creada por una
-- migracion futura nacia con Dxt para anon y para authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

-- ============================================================================
-- 4. Verificacion a mano
-- ============================================================================
-- Ambas consultas deben devolver cero filas en cualquier momento. La prueba pgTAP que las
-- automatiza esta en supabase/tests/database/privilegios_anon.sql.
--
--   SELECT table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public';
--
--   SELECT table_name
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'authenticated' AND table_schema = 'public'
--     AND privilege_type = 'TRUNCATE';
