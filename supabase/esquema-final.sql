-- Ecopac Digital - Esquema consolidado de la base de datos
--
-- Esquema "public" de ecopac-prod (tablas, vistas, tipos, funciones, triggers, politicas RLS y
-- permisos), SIN DATOS. Tomado el 18 de octubre de 2026 con la migracion 00189 como ultima
-- (181 migraciones aplicadas): 60 tablas, 9 vistas, 23 tipos, 146 funciones, 154 triggers y
-- 157 politicas RLS.
--
-- ES UNA REFERENCIA DE LECTURA, NO LA FORMA DE INSTALAR. La base se crea aplicando
-- supabase/migrations/ en orden (docs/DESPLIEGUE_BASE_DE_DATOS.md y
-- docs/MANUAL-DE-INSTALACION.md, seccion 4). Este archivo no trae los catalogos sembrados ni lo
-- que las migraciones configuran fuera de "public", y no anota nada en
-- supabase_migrations.schema_migrations.
--
-- Una funcion no sale de las migraciones: "rls_auto_enable" y su event trigger, que Supabase
-- crea por su cuenta en los proyectos nuevos para activar RLS en cada tabla que se cree. Por eso
-- docs/DICCIONARIO-DE-DATOS.md, que se genera desde las migraciones, no la lista.
--
-- Se regenera cuando cambia el esquema:
--   pg_dump "<cadena de conexion de ecopac-prod>" --schema-only --schema=public --no-owner
-- actualizando la fecha, la ultima migracion y las cifras de esta cabecera.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: accion_alerta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."accion_alerta" AS ENUM (
    'donado',
    'reubicado',
    'descartado'
);


--
-- Name: TYPE "accion_alerta"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."accion_alerta" IS 'Que se hace con un lote vencido o por vencer: donarlo, reubicarlo en otra bodega o descartarlo.';


--
-- Name: categoria_notificacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."categoria_notificacion" AS ENUM (
    'caducidad',
    'stock',
    'validacion',
    'presupuestos'
);


--
-- Name: TYPE "categoria_notificacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."categoria_notificacion" IS 'De que trata una notificacion (issue #755). Es tambien el criterio por el que el buzon las agrupa. packages/shared/enums.js (CATEGORIAS_NOTIFICACION) replica estos valores.';


--
-- Name: estado_alerta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_alerta" AS ENUM (
    'pendiente',
    'atendida'
);


--
-- Name: TYPE "estado_alerta"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_alerta" IS 'Estado de una alerta de caducidad.';


--
-- Name: estado_cita; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_cita" AS ENUM (
    'creada',
    'en_atencion',
    'atendida',
    'cancelada'
);


--
-- Name: TYPE "estado_cita"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_cita" IS 'Estado de una cita (issue #927, 00184). En pantalla: Creado, En atencion, Atendido, Cancelado. Espejo de ESTADOS_CITA en packages/shared/citas/estados.js.';


--
-- Name: estado_condicion_cronica; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_condicion_cronica" AS ENUM (
    'activa',
    'controlada',
    'resuelta'
);


--
-- Name: TYPE "estado_condicion_cronica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_condicion_cronica" IS 'Si una condicion cronica de un paciente sigue activa.';


--
-- Name: estado_donacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_donacion" AS ENUM (
    'registrada',
    'anulada'
);


--
-- Name: TYPE "estado_donacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_donacion" IS 'Estado de una donacion: registrada o anulada.';


--
-- Name: estado_gasto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_gasto" AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);


--
-- Name: TYPE "estado_gasto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_gasto" IS 'Estados del flujo de aprobacion de un gasto. Vocabulario propio de gastos, separado de estado_movimiento (issue #412): antes del desacople, gastos.estado reutilizaba ese enum pensado para movimientos_inventario, y un cambio en el flujo de inventario podia alterar sin querer los valores permitidos aqui.';


--
-- Name: estado_jornada; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_jornada" AS ENUM (
    'planificada',
    'en curso',
    'finalizada',
    'cancelada'
);


--
-- Name: TYPE "estado_jornada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_jornada" IS 'Estado de una jornada. Las transiciones las valida un trigger.';


--
-- Name: estado_movimiento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_movimiento" AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);


--
-- Name: TYPE "estado_movimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_movimiento" IS 'Estado de un movimiento de inventario: pendiente, aprobado o rechazado.';


--
-- Name: estado_proyecto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_proyecto" AS ENUM (
    'planificado',
    'en curso',
    'finalizado',
    'cancelado'
);


--
-- Name: TYPE "estado_proyecto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_proyecto" IS 'Estado de un proyecto. Finalizado y cancelado son terminales.';


--
-- Name: estado_receta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."estado_receta" AS ENUM (
    'emitida',
    'anulada'
);


--
-- Name: TYPE "estado_receta"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."estado_receta" IS 'Estado de una receta: emitida o anulada.';


--
-- Name: moneda_lote; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."moneda_lote" AS ENUM (
    'GTQ'
);


--
-- Name: TYPE "moneda_lote"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."moneda_lote" IS 'Un solo valor a proposito: todo el sistema opera en quetzales (packages/shared/formato/moneda.js, MONEDA). Anadir una moneda nueva el dia que haga falta es ALTER TYPE ... ADD VALUE, no una migracion de esquema. Issue #752.';


--
-- Name: operacion_auditoria; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."operacion_auditoria" AS ENUM (
    'insercion',
    'actualizacion',
    'baja',
    'eliminacion'
);


--
-- Name: TYPE "operacion_auditoria"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."operacion_auditoria" IS 'Operacion registrada en la bitacora de auditoria.';


--
-- Name: origen_de_presupuesto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."origen_de_presupuesto" AS ENUM (
    'donacion',
    'fondos_propios',
    'aporte_externo',
    'sin_clasificar',
    'caja'
);


--
-- Name: TYPE "origen_de_presupuesto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."origen_de_presupuesto" IS 'De donde viene una parte del presupuesto de una jornada.';


--
-- Name: origen_lote; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."origen_lote" AS ENUM (
    'compra',
    'donacion'
);


--
-- Name: TYPE "origen_lote"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."origen_lote" IS 'Como se adquirio un lote: compra o donacion. Mismo eje del negocio que tipo_proveedor (comercial/donante, 00017), con vocabulario propio porque describe la transaccion (un lote) y no la entidad (un proveedor); se documenta la relacion en vez de unificar el vocabulario (issue #412). Sin CHECK que ate esto al tipo del proveedor referenciado.';


--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."rol_usuario" AS ENUM (
    'administrador',
    'junta directiva',
    'socio fundador',
    'medico',
    'voluntario general'
);


--
-- Name: TYPE "rol_usuario"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."rol_usuario" IS 'Roles del sistema. Lo replica packages/shared/usuarios/roles.js; ver docs/PERMISOS.md.';


--
-- Name: sexo_paciente; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."sexo_paciente" AS ENUM (
    'Femenino',
    'Masculino'
);


--
-- Name: TYPE "sexo_paciente"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."sexo_paciente" IS 'Sexo del paciente (issue #699). Los dos valores son los que la aplicacion ya escribia desde OPCIONES_SEXO y los unicos que hay en la base. Espejo de SEXOS en packages/shared/enums.js. Agregar un valor es ALTER TYPE ... ADD VALUE, y exige actualizar ese archivo en el mismo PR.';


--
-- Name: tipo_articulo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_articulo" AS ENUM (
    'medicamento',
    'insumo'
);


--
-- Name: TYPE "tipo_articulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_articulo" IS 'Si un articulo del inventario es medicamento o insumo.';


--
-- Name: tipo_donacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_donacion" AS ENUM (
    'medicamentos',
    'insumos',
    'dinero',
    'servicios'
);


--
-- Name: TYPE "tipo_donacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_donacion" IS 'Que se dono: dinero, medicamentos, insumos o servicios.';


--
-- Name: tipo_donante; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_donante" AS ENUM (
    'persona',
    'organizacion'
);


--
-- Name: TYPE "tipo_donante"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_donante" IS 'Tipo de donante: persona u organizacion.';


--
-- Name: tipo_movimiento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_movimiento" AS ENUM (
    'ingreso',
    'salida'
);


--
-- Name: TYPE "tipo_movimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_movimiento" IS 'Ingreso o salida de inventario.';


--
-- Name: tipo_proveedor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_proveedor" AS ENUM (
    'comercial',
    'donante'
);


--
-- Name: TYPE "tipo_proveedor"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_proveedor" IS 'Naturaleza de un proveedor: comercial (se le compra) o donante (dona). Mismo eje del negocio que origen_lote (compra/donacion, 00020), con vocabulario propio porque describe la entidad (un proveedor) y no la transaccion (un lote); se documenta la relacion en vez de unificar el vocabulario (issue #412). Sin CHECK que ate esto al origen de los lotes de ese proveedor.';


--
-- Name: tipo_sanguineo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."tipo_sanguineo" AS ENUM (
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-'
);


--
-- Name: TYPE "tipo_sanguineo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE "public"."tipo_sanguineo" IS 'Grupo sanguineo de un paciente.';


--
-- Name: accede_a_modulo_por_matriz("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."accede_a_modulo_por_matriz"("p_modulo" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rol_modulo rm
    WHERE rm.rol = public.rol_actual()
      AND rm.modulo = p_modulo
  );
$$;


--
-- Name: FUNCTION "accede_a_modulo_por_matriz"("p_modulo" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."accede_a_modulo_por_matriz"("p_modulo" "text") IS 'Si la matriz de acceso le abrio este modulo al rol de la sesion. Solo se usa en politicas de LECTURA: abrir un modulo no da escritura.';


--
-- Name: actualizar_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."actualizar_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "actualizar_timestamp_updated_at"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."actualizar_timestamp_updated_at"() IS 'Actualiza automaticamente updated_at antes de cada UPDATE; usada por los triggers BEFORE UPDATE de las tablas con esa columna.';


--
-- Name: alta_de_cuenta_permitida("text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    -- No viene de GoTrue: es una migracion, un seed o una consulta directa a la base.
    p_usuario_de_sesion IS DISTINCT FROM 'supabase_auth_admin'
    -- O viene de GoTrue con la marca que solo la Admin API puede poner.
    OR COALESCE(p_app_meta ->> 'alta', '') = 'administrativa';
$$;


--
-- Name: FUNCTION "alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb") IS 'Decide si un alta en auth.users puede continuar. Recibe el usuario de sesion en vez de leerlo para que sea comprobable desde pgTAP: postgres no puede hacer SET SESSION AUTHORIZATION en el stack local.';


--
-- Name: comprometido_de_jornada("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid" DEFAULT NULL::"uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(SUM(g.monto), 0)
  FROM public.gastos g
  WHERE g.jornada_id = p_jornada_id
    AND g.estado IN ('pendiente', 'aprobado')
    AND g.id IS DISTINCT FROM p_sin_gasto;
$$;


--
-- Name: FUNCTION "comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid") IS 'Suma de los gastos pendientes y aprobados de una jornada, sin contar p_sin_gasto (el que se esta revisando). SECURITY DEFINER para ver todos los gastos (00159).';


--
-- Name: crear_perfil_nuevo_usuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."crear_perfil_nuevo_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- session_user y no current_user: dentro de una funcion SECURITY DEFINER, current_user es el
  -- dueno de la funcion (postgres) y nunca seria supabase_auth_admin. Ver la cabecera.
  IF NOT public.alta_de_cuenta_permitida(session_user, NEW.raw_app_meta_data) THEN
    RAISE EXCEPTION
      'El registro de cuentas esta cerrado. Las altas las hace la administradora.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.perfiles (id, nombres, apellidos, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombres', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'apellidos', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "crear_perfil_nuevo_usuario"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."crear_perfil_nuevo_usuario"() IS 'Crea el perfil correspondiente cada vez que se inserta un usuario en auth.users, y rechaza el alta si viene del registro publico de GoTrue sin la marca administrativa (issue #508).';


--
-- Name: equipo_de_proyecto("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."equipo_de_proyecto"("p_proyecto_id" "uuid") RETURNS TABLE("id" "uuid", "proyecto_id" "uuid", "perfil_id" "uuid", "rol_en_proyecto" "text", "created_at" timestamp with time zone, "nombres" character varying, "apellidos" character varying, "en_equipo_del_proyecto" boolean, "jornadas" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH de_jornadas AS (
    -- El cuadro de turnos de cada jornada del proyecto y su responsable.
    SELECT d.perfil_id,
           array_agg(DISTINCT d.jornada ORDER BY d.jornada) AS jornadas,
           min(d.desde) AS desde
    FROM (
      SELECT jp.perfil_id, j.nombre::TEXT AS jornada, jp.created_at AS desde
      FROM public.jornada_personal jp
      JOIN public.jornadas j ON j.id = jp.jornada_id
      WHERE j.proyecto_id = p_proyecto_id
      UNION ALL
      SELECT j.responsable_id, j.nombre::TEXT, j.created_at
      FROM public.jornadas j
      WHERE j.proyecto_id = p_proyecto_id
    ) d
    GROUP BY d.perfil_id
  ),
  personas AS (
    SELECT pp.perfil_id FROM public.proyecto_personal pp WHERE pp.proyecto_id = p_proyecto_id
    UNION
    SELECT dj.perfil_id FROM de_jornadas dj
  )
  SELECT pp.id,
         p_proyecto_id,
         per.perfil_id,
         pp.rol_en_proyecto,
         coalesce(pp.created_at, dj.desde),
         pe.nombres,
         pe.apellidos,
         pp.id IS NOT NULL,
         coalesce(dj.jornadas, ARRAY[]::TEXT[])
  FROM personas per
  JOIN public.perfiles pe ON pe.id = per.perfil_id
  LEFT JOIN public.proyecto_personal pp
    ON pp.proyecto_id = p_proyecto_id AND pp.perfil_id = per.perfil_id
  LEFT JOIN de_jornadas dj ON dj.perfil_id = per.perfil_id
  WHERE public.es_administrador()
     OR public.tiene_permiso('proyectos.gestionar')
     OR public.pertenece_a_proyecto(p_proyecto_id)
     OR public.accede_a_modulo_por_matriz('proyectos')
  -- Primero el equipo asignado al proyecto, en el orden en que se armo; despues quien solo esta
  -- en sus jornadas.
  ORDER BY (pp.id IS NULL), coalesce(pp.created_at, dj.desde), pe.nombres;
$$;


--
-- Name: FUNCTION "equipo_de_proyecto"("p_proyecto_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."equipo_de_proyecto"("p_proyecto_id" "uuid") IS 'Equipo de un proyecto: la union de proyecto_personal, del cuadro de turnos de sus jornadas y de sus responsables, una fila por persona, con sus nombres (00150, 00157).';


--
-- Name: es_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."es_administrador"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(public.rol_actual() = 'administrador', FALSE);
$$;


--
-- Name: FUNCTION "es_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."es_administrador"() IS 'TRUE si quien esta conectado tiene rol administrador y su cuenta esta activa. La usan las politicas RLS.';


--
-- Name: es_consultivo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."es_consultivo"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(public.rol_actual() IN ('junta directiva', 'socio fundador'), FALSE);
$$;


--
-- Name: FUNCTION "es_consultivo"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."es_consultivo"() IS 'TRUE si el usuario autenticado es junta directiva o socio fundador: los dos roles de gobernanza de solo lectura, con permisos identicos (issue #404). Reemplaza las comparaciones a mano contra ''junta directiva'' que dejaban fuera a socio fundador.';


--
-- Name: es_personal_de_campo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."es_personal_de_campo"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT public.rol_actual() IN ('medico', 'voluntario general');
$$;


--
-- Name: FUNCTION "es_personal_de_campo"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."es_personal_de_campo"() IS 'Si la sesion es medico o voluntario general (y esta activa: rol_actual() es NULL para un perfil desactivado).';


--
-- Name: existencias_totales_por_bodega("uuid"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."existencias_totales_por_bodega"("p_bodega_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("bodega_id" "uuid", "total_disponible" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    e.bodega_id,
    SUM(e.cantidad_disponible)
  FROM public.existencias e
  WHERE p_bodega_ids IS NULL OR e.bodega_id = ANY(p_bodega_ids)
  GROUP BY e.bodega_id;
$$;


--
-- Name: FUNCTION "existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]) IS 'Suma cantidad_disponible por bodega (issue #773). Una bodega sin existencias, o cuyas existencias RLS no deja ver, no genera fila -- quien llama trata "bodega ausente en el resultado" como total cero. SECURITY INVOKER: respeta la politica de SELECT de existencias (00034), abierta a cualquier sesion autenticada.';


--
-- Name: f_unaccent("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."f_unaccent"("texto" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, texto);
$$;


--
-- Name: FUNCTION "f_unaccent"("texto" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."f_unaccent"("texto" "text") IS 'Wrapper IMMUTABLE de extensions.unaccent, necesario para usar unaccent dentro de un indice.';


--
-- Name: fn_actualizar_existencias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_actualizar_existencias"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Solo actua cuando el estado cambia a 'aprobado'.
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN

    IF NEW.aprobado_en IS NULL THEN
      NEW.aprobado_en := NOW();
    END IF;

    PERFORM public.fn_aplicar_ajuste_existencias(
      NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_actualizar_existencias"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_actualizar_existencias"() IS 'Aplica el ajuste de existencias cuando un movimiento pasa a aprobado (00023, sobre existencias desde la 00047). Desde la 00112 lleva SET search_path = '''' y llama calificado, por el mismo motivo que fn_autoaprobar_movimiento_inventario.';


--
-- Name: fn_ajustar_entrega_receta("uuid", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_detalle RECORD;
  v_cantidad_previa INT;
  v_diferencia INT;
  v_vence DATE;
  v_disponible INT;
BEGIN
  IF NOT (public.es_administrador() OR public.rol_actual() = 'medico') THEN
    RAISE EXCEPTION 'Solo medico o administracion puede ajustar la entrega de una receta.';
  END IF;

  IF p_cantidad_real IS NULL OR p_cantidad_real <= 0 THEN
    RAISE EXCEPTION 'La cantidad realmente entregada debe ser mayor que cero.';
  END IF;

  SELECT rd.*, r.estado AS receta_estado
  INTO v_detalle
  FROM public.receta_detalle rd
  JOIN public.recetas r ON r.id = rd.receta_id
  WHERE rd.id = p_receta_detalle_id
  FOR UPDATE OF rd;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El renglon de receta indicado no existe.';
  END IF;

  IF v_detalle.receta_estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede ajustar la entrega de una receta anulada.';
  END IF;

  v_cantidad_previa := COALESCE(v_detalle.cantidad_ajustada, v_detalle.cantidad_entregada);
  v_diferencia := p_cantidad_real - v_cantidad_previa;

  IF v_diferencia <> 0 THEN
    IF v_detalle.lote_id IS NULL OR v_detalle.bodega_id IS NULL THEN
      RAISE EXCEPTION
        'Este renglon no tiene lote y bodega asociados: no genero movimiento de inventario que ajustar.';
    END IF;

    IF v_diferencia > 0 THEN
      SELECT fecha_vencimiento INTO v_vence FROM public.lotes WHERE id = v_detalle.lote_id;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se puede ajustar hacia un lote vencido: % vencio el %.',
          v_detalle.lote_id, v_vence;
      END IF;

      v_disponible := public.fn_disponible_neto(v_detalle.lote_id, v_detalle.bodega_id);

      IF v_disponible < v_diferencia THEN
        RAISE EXCEPTION
          'Existencia insuficiente para ajustar la entrega. Disponible: %, diferencia solicitada: %.',
          GREATEST(v_disponible, 0), v_diferencia
          USING ERRCODE = 'check_violation';
      END IF;

      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'salida', v_detalle.lote_id, v_detalle.bodega_id, v_diferencia,
        'Ajuste de entrega: se entrego ' || v_diferencia ||
          ' unidad(es) mas de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid(),
        v_detalle.receta_id
      );
    ELSE
      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'ingreso', v_detalle.lote_id, v_detalle.bodega_id, ABS(v_diferencia),
        'Ajuste de entrega: se devuelve a existencia por entregar ' || ABS(v_diferencia) ||
          ' unidad(es) menos de lo ya registrado (receta_detalle ' || p_receta_detalle_id || ')',
        auth.uid(),
        v_detalle.receta_id
      );
    END IF;
  END IF;

  UPDATE public.receta_detalle
  SET cantidad_ajustada = p_cantidad_real,
      ajustada_por = auth.uid(),
      ajustada_en = NOW()
  WHERE id = p_receta_detalle_id;
END;
$$;


--
-- Name: FUNCTION "fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer) IS 'Corrige la cantidad realmente entregada de un renglon de receta (issue #764) sin reescribir cantidad_entregada ni descontar el inventario dos veces: calcula la diferencia contra el ultimo valor confirmado (cantidad_ajustada si ya existia, si no cantidad_entregada) y registra un movimiento nuevo solo por esa diferencia -salida si se entrego mas, ingreso si se entrego menos-, con el mismo flujo de aprobacion que cualquier otro movimiento (administrador autoaprueba, medico y voluntario dejan pendiente). SECURITY DEFINER porque cantidad_ajustada, ajustada_por y ajustada_en no tienen policy ni GRANT de UPDATE para ningun rol -mismo candado que ya protegia cantidad_entregada (00033)-, asi que la funcion valida el rol a mano (solo medico o administrador, igual que las politicas de receta_detalle) en vez de depender de RLS, que aqui no se evalua.';


--
-- Name: fn_anular_receta_al_rechazar_su_entrega(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_anular_receta_al_rechazar_su_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.recetas r
  SET estado = 'anulada',
      motivo_anulacion = 'Anulada por la administracion al rechazar su salida de inventario: '
        || COALESCE(NULLIF(btrim(NEW.motivo_rechazo), ''), 'sin motivo'),
      anulada_por = COALESCE(auth.uid(), NEW.aprobado_por, r.medico_id),
      anulada_en = NOW()
  WHERE r.id = NEW.receta_id
    AND r.estado = 'emitida';

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_anular_receta_al_rechazar_su_entrega"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_anular_receta_al_rechazar_su_entrega"() IS 'Rechazar la salida que entrega una receta la anula entera, con un motivo que dice que fue la administracion (00186, issue #925).';


--
-- Name: fn_aplicar_ajuste_existencias("uuid", "uuid", "public"."tipo_movimiento", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  SELECT fecha_vencimiento INTO v_fecha_vencimiento
  FROM public.lotes
  WHERE id = p_lote_id;

  SELECT cantidad_disponible INTO v_stock_actual
  FROM public.existencias
  WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id
  FOR UPDATE;

  v_stock_actual := COALESCE(v_stock_actual, 0);

  IF p_tipo = 'salida' THEN
    -- La unica excepcion es la baja de fn_atender_alerta_caducidad (issue #755): sacar del
    -- inventario un vencido no es entregarlo.
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE
       AND COALESCE(current_setting('ecopac.baja_por_caducidad', TRUE), '') <> 'on' THEN
      RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
    END IF;

    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
    END IF;

    UPDATE public.existencias
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        updated_at = NOW()
    WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id;

  ELSIF p_tipo = 'ingreso' THEN
    INSERT INTO public.existencias (lote_id, bodega_id, cantidad_disponible)
    VALUES (p_lote_id, p_bodega_id, p_cantidad)
    ON CONFLICT (lote_id, bodega_id) DO UPDATE
    SET cantidad_disponible = existencias.cantidad_disponible + EXCLUDED.cantidad_disponible,
        updated_at = NOW();

    -- Aprobar el ingreso vuelve firme al lote que lo acompania (issue #625). Idempotente: un
    -- segundo ingreso aprobado sobre el mismo lote no cambia nada.
    --
    -- Va aqui dentro, y no en la politica RLS, porque quien aprueba no necesita GRANT de UPDATE
    -- sobre lotes para que esto ocurra: la confirmacion es una consecuencia de aprobar el
    -- movimiento, no una edicion del catalogo. SECURITY DEFINER es lo que lo hace posible.
    UPDATE public.lotes
    SET confirmado = TRUE,
        updated_at = NOW()
    WHERE id = p_lote_id AND confirmado = FALSE;
  END IF;
END;
$$;


--
-- Name: FUNCTION "fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer) IS 'Ajusta existencias.cantidad_disponible para la fila (lote_id, bodega_id). En salida exige stock suficiente y lote vigente (fecha_vencimiento contra lotes); en ingreso hace upsert porque puede no existir aun fila de existencias para esa combinacion, y ademas confirma el lote si venia provisional (issue #625). Issue #369: reemplaza el ajuste sobre lotes_existencias (00028).';


--
-- Name: fn_aportar_donacion_a_su_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_aportar_donacion_a_su_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_donacion RECORD;
  v_estado_de_la_jornada public.estado_jornada;
  v_aporte_id UUID;
BEGIN
  IF NEW.monto IS NULL OR NEW.monto <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT d.tipo, d.estado, d.jornada_id, d.registrado_por INTO v_donacion
  FROM public.donaciones d
  WHERE d.id = NEW.donacion_id;

  IF v_donacion.jornada_id IS NULL
     OR v_donacion.tipo IS DISTINCT FROM 'dinero'::public.tipo_donacion
     OR v_donacion.estado IS DISTINCT FROM 'registrada'::public.estado_donacion
  THEN
    RETURN NULL;
  END IF;

  SELECT j.estado INTO v_estado_de_la_jornada
  FROM public.jornadas j
  WHERE j.id = v_donacion.jornada_id;

  IF v_estado_de_la_jornada IS NULL
     OR v_estado_de_la_jornada NOT IN ('planificada', 'en curso')
  THEN
    RETURN NULL;
  END IF;

  -- El aporte que esta donacion ya tiene en su jornada, si un renglon anterior lo creo. Uno ya
  -- liquidado o que llego por traspaso (00160) es historia y no se toca.
  SELECT o.id INTO v_aporte_id
  FROM public.jornada_presupuesto_origen o
  WHERE o.donacion_id = NEW.donacion_id
    AND o.jornada_id = v_donacion.jornada_id
    AND o.traspasado_desde IS NULL
    AND o.devuelto = 0
  ORDER BY o.created_at, o.id
  LIMIT 1
  FOR UPDATE;

  IF v_aporte_id IS NULL THEN
    INSERT INTO public.jornada_presupuesto_origen
      (jornada_id, origen, donacion_id, monto, descripcion, registrado_por)
    VALUES
      (v_donacion.jornada_id, 'donacion', NEW.donacion_id, NEW.monto,
       'Recibida para esta jornada', v_donacion.registrado_por);
  ELSE
    UPDATE public.jornada_presupuesto_origen
    SET monto = monto + NEW.monto
    WHERE id = v_aporte_id;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_aportar_donacion_a_su_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_aportar_donacion_a_su_jornada"() IS 'Trigger de donacion_detalle (00187): el monto de una donacion de dinero registrada para una jornada planificada o en curso entra a su presupuesto como aporte de origen donacion. DEFINER: quien registra donaciones puede no gestionar jornadas.';


--
-- Name: fn_aprobar_entrega_completa_de_receta(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_aprobar_entrega_completa_de_receta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.movimientos_inventario m
  SET estado = 'aprobado',
      aprobado_por = NEW.aprobado_por,
      aprobado_en = NOW()
  WHERE m.receta_id = NEW.receta_id
    AND m.id <> NEW.id
    AND m.estado = 'pendiente'
    AND m.tipo = 'salida'
    AND m.motivo LIKE 'Entrega por receta medica%';

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_aprobar_entrega_completa_de_receta"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_aprobar_entrega_completa_de_receta"() IS 'Aprobar una salida de la entrega de una receta aprueba las demas: la receta se valida completa o nada (00186, issue #925).';


--
-- Name: fn_atenciones_de_persona_por_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid") RETURNS TABLE("jornada_id" "uuid", "consultas" integer, "triajes" integer, "pacientes" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH eventos AS (
    SELECT
      con.jornada_id AS jid,
      a.paciente_id AS paciente_id,
      'consulta' AS tipo
    FROM public.consultas con
    JOIN public.atenciones a ON a.id = con.atencion_id
    WHERE con.medico_id = p_perfil_id

    UNION ALL

    SELECT
      a.jornada_id AS jid,
      a.paciente_id AS paciente_id,
      'triaje' AS tipo
    FROM public.triajes t
    JOIN public.atenciones a ON a.id = t.atencion_id
    WHERE t.tomado_por = p_perfil_id
  )
  SELECT
    eventos.jid AS jornada_id,
    COUNT(*) FILTER (WHERE eventos.tipo = 'consulta')::INT AS consultas,
    COUNT(*) FILTER (WHERE eventos.tipo = 'triaje')::INT AS triajes,
    COUNT(DISTINCT eventos.paciente_id)::INT AS pacientes
  FROM eventos
  GROUP BY eventos.jid;
$$;


--
-- Name: FUNCTION "fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid") IS 'Cuenta, por jornada, las consultas (consultas.medico_id), los triajes (triajes.tomado_por) y los pacientes distintos alcanzados por cualquiera de las dos vias, para un perfil dado. Solo devuelve una fila por jornada donde hubo al menos un evento visible para quien llama; una jornada sin actividad clinica de esa persona, o cuya actividad RLS no deja ver, simplemente no aparece en el resultado -- son el mismo caso para esta funcion. Quien la consume (obtenerJornadasDePersona() de packages/shared/jornadas/api.js) le asigna { consultas: 0, triajes: 0, pacientes: 0 } a toda jornada ausente. Issue #175, criterio 4. No es SECURITY DEFINER: respeta las politicas de SELECT de consultas, triajes y atenciones (00033), igual que personal_registro_atenciones (00044) y fn_contar_atenciones_incompletas (00051). Junta directiva y socio fundador no tienen SELECT sobre ninguna de las tres tablas: para ellos esta funcion no devuelve ninguna fila, para ninguna jornada, sin importar la actividad real. Voluntario general lee triajes y atenciones pero no consultas: para ese rol el conteo de pacientes tambien queda incompleto (solo cuenta los alcanzados por triaje), sin que nada lo distinga de un conteo completo -- limite conocido de RLS, no de esta funcion.';


--
-- Name: fn_atender_alerta_caducidad("uuid", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_alerta public.alertas_caducidad;
  v_vence DATE;
  v_existencia RECORD;
  v_accion_item JSONB;
  v_accion public.accion_alerta;
  v_cantidad INT;
  v_bodega_destino UUID;
  v_pendiente INT;
  v_a_mover INT;
  v_total_disponible INT;
  v_suma_acciones INT := 0;
  v_num_acciones INT;
  v_disponible_fuera_destino INT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo administracion puede atender una alerta de vencimiento.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta FROM public.alertas_caducidad WHERE id = p_alerta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La alerta no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_alerta.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La alerta ya fue atendida.' USING ERRCODE = '23514';
  END IF;

  v_num_acciones := COALESCE(jsonb_array_length(p_acciones), 0);
  IF v_num_acciones = 0 THEN
    RAISE EXCEPTION 'Hay que indicar al menos una accion.' USING ERRCODE = '23502';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = v_alerta.lote_id;

  -- Bloquea las filas de existencias del lote para toda la transaccion: nadie mas puede
  -- registrar un movimiento de este lote mientras se reparte entre las acciones, y lo que se
  -- lea aqui sigue siendo verdad cuando se aplique mas abajo.
  --
  -- El FOR UPDATE va sobre la subconsulta, no sobre el SELECT con SUM(): Postgres rechaza
  -- "FOR UPDATE is not allowed with aggregate functions" (SQLSTATE 42601) apenas se intenta
  -- planificar la sentencia, así que esto no era un caso raro -- CUALQUIER llamada a esta
  -- funcion caia aqui antes de mover nada. Y 42601 no es un codigo que
  -- errores-de-supabase.js sepa clasificar, asi que en pantalla se veia el generico "Ocurrio
  -- un error inesperado" para cualquier alerta que se intentara atender.
  SELECT COALESCE(SUM(bloqueadas.cantidad_disponible), 0) INTO v_total_disponible
  FROM (
    SELECT e.cantidad_disponible
    FROM public.existencias e
    WHERE e.lote_id = v_alerta.lote_id AND e.cantidad_disponible > 0
    FOR UPDATE
  ) bloqueadas;

  IF v_total_disponible = 0 THEN
    RAISE EXCEPTION 'El lote ya no tiene existencia disponible que atender.' USING ERRCODE = '23514';
  END IF;

  -- Validar cada accion y sumar cantidades ANTES de mover nada: una accion invalida a mitad de
  -- la lista no debe dejar las anteriores ya aplicadas.
  FOR v_accion_item IN SELECT * FROM jsonb_array_elements(p_acciones)
  LOOP
    v_accion := (v_accion_item ->> 'accion')::public.accion_alerta;
    v_cantidad := (v_accion_item ->> 'cantidad')::INT;
    v_bodega_destino := NULLIF(v_accion_item ->> 'bodegaDestinoId', '')::UUID;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada accion debe ser mayor a cero.' USING ERRCODE = '23514';
    END IF;

    IF v_accion = 'reubicado' THEN
      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION 'Un lote vencido no se reubica: se descarta o se dona.' USING ERRCODE = '23514';
      END IF;
      IF v_bodega_destino IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = v_bodega_destino) THEN
        RAISE EXCEPTION 'Reubicar exige una bodega destino que exista.' USING ERRCODE = '23502';
      END IF;

      -- Reubicar saca existencia de las demas bodegas para meterla en la destino: si el lote
      -- vive entero (o en su mayoria) ya en esa misma bodega, no hay de donde tomar la cantidad
      -- pedida. Sin este chequeo, el caso mas comun para provocarlo -un lote que solo esta en UNA
      -- bodega, y quien atiende elige esa misma bodega como destino, algo que la pantalla no le
      -- impide porque la alerta no muestra en que bodega esta el lote hoy- caia en el chequeo
      -- defensivo de mas abajo (pensado para que "nunca" pase) y esa RAISE usa ERRCODE 55000, que
      -- el cliente no sabe traducir: la persona veia "Ocurrio un error inesperado" en vez de un
      -- mensaje que explique que le falta stock fuera de la bodega destino.
      SELECT COALESCE(SUM(e.cantidad_disponible), 0) INTO v_disponible_fuera_destino
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id
        AND e.cantidad_disponible > 0
        AND e.bodega_id <> v_bodega_destino;

      IF v_cantidad > v_disponible_fuera_destino THEN
        RAISE EXCEPTION
          'No hay % unidades del lote fuera de la bodega destino para reubicar (disponible: %).',
          v_cantidad, v_disponible_fuera_destino USING ERRCODE = '23514';
      END IF;
    END IF;

    v_suma_acciones := v_suma_acciones + v_cantidad;
  END LOOP;

  IF v_suma_acciones <> v_total_disponible THEN
    RAISE EXCEPTION 'Las acciones tienen que sumar exactamente el disponible del lote (%), no %.',
      v_total_disponible, v_suma_acciones USING ERRCODE = '23514';
  END IF;

  -- Ahora si, aplicar: una accion a la vez, consumiendo bodegas hasta completar su cantidad, y
  -- dejando un registro en alerta_caducidad_detalle de cada una.
  FOR v_accion_item IN SELECT * FROM jsonb_array_elements(p_acciones)
  LOOP
    v_accion := (v_accion_item ->> 'accion')::public.accion_alerta;
    v_pendiente := (v_accion_item ->> 'cantidad')::INT;
    v_bodega_destino := NULLIF(v_accion_item ->> 'bodegaDestinoId', '')::UUID;

    IF v_accion <> 'reubicado' THEN
      PERFORM set_config('ecopac.baja_por_caducidad', 'on', TRUE);
    END IF;

    FOR v_existencia IN
      SELECT e.bodega_id, e.cantidad_disponible
      FROM public.existencias e
      WHERE e.lote_id = v_alerta.lote_id
        AND e.cantidad_disponible > 0
        AND (v_accion <> 'reubicado' OR e.bodega_id <> v_bodega_destino)
      ORDER BY e.bodega_id
      FOR UPDATE
    LOOP
      EXIT WHEN v_pendiente <= 0;
      v_a_mover := LEAST(v_pendiente, v_existencia.cantidad_disponible);
      IF v_a_mover <= 0 THEN
        CONTINUE;
      END IF;

      IF v_accion = 'reubicado' THEN
        -- Primero el ingreso en la destino y despues la salida del origen: al reves, el total
        -- del medicamento pasaria por cero entre las dos sentencias y
        -- trg_existencias_notificar_sin_stock avisaria de un "sin stock" que nunca ocurrio.
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('ingreso', v_alerta.lote_id, v_bodega_destino, v_a_mover,
                'Reubicacion por alerta de vencimiento', auth.uid());
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_a_mover,
                'Reubicacion por alerta de vencimiento', auth.uid());
      ELSE
        INSERT INTO public.movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
        VALUES ('salida', v_alerta.lote_id, v_existencia.bodega_id, v_a_mover,
                'Baja por caducidad: ' || v_accion::TEXT, auth.uid());
      END IF;

      v_pendiente := v_pendiente - v_a_mover;
    END LOOP;

    IF v_accion <> 'reubicado' THEN
      PERFORM set_config('ecopac.baja_por_caducidad', 'off', TRUE);
    END IF;

    IF v_pendiente > 0 THEN
      -- No deberia pasar: la suma de todas las acciones ya se valido == disponible total, y el
      -- lote esta bloqueado (FOR UPDATE) desde antes de validar. Defensa, no camino esperado.
      RAISE EXCEPTION 'No se pudo completar la accion "%": faltaron % unidades por repartir.',
        v_accion, v_pendiente USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.alerta_caducidad_detalle (alerta_id, accion, cantidad, bodega_destino_id)
    VALUES (p_alerta_id, v_accion, (v_accion_item ->> 'cantidad')::INT, v_bodega_destino);
  END LOOP;

  -- accion en alertas_caducidad solo se llena cuando fue una unica accion (compatibilidad con
  -- las pantallas que ya la leen tal cual, sin desglose); con varias, queda NULL y el detalle
  -- completo vive en alerta_caducidad_detalle.
  UPDATE public.alertas_caducidad
  SET estado = 'atendida',
      accion = CASE
        WHEN v_num_acciones = 1 THEN (p_acciones -> 0 ->> 'accion')::public.accion_alerta
        ELSE NULL
      END,
      atendida_por = auth.uid(),
      atendida_en = NOW()
  WHERE id = p_alerta_id;

  RETURN p_alerta_id;
END;
$$;


--
-- Name: FUNCTION "fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb") IS 'Cierra una alerta de caducidad y ejecuta una o mas acciones sobre el stock, en una transaccion (issue de division de alertas, PLAN.md punto 5): p_acciones es un arreglo de { accion, cantidad, bodegaDestinoId? } cuyas cantidades tienen que sumar exactamente el disponible vivo del lote (todas las bodegas) al momento de atender, no cantidad_afectada (el numero congelado al generar la alerta). descartado/donado dan de baja esa cantidad con salidas aprobadas; reubicado la traslada a bodegaDestinoId (exige que el lote no haya vencido). Cada accion aplicada queda en alerta_caducidad_detalle; alertas_caducidad.accion solo se llena cuando hubo una unica accion. Solo administracion; lanza 42501 a cualquier otro rol.';


--
-- Name: fn_autoaprobar_gasto_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_autoaprobar_gasto_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF public.es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_autoaprobar_gasto_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_autoaprobar_gasto_administrador"() IS 'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via auth.uid(), nunca de un campo del cliente), hace nacer el gasto en estado aprobado, con aprobado_por y aprobado_en fijados automaticamente. Espejo de fn_autoaprobar_movimiento_inventario (00094), sin ajuste de existencias: un gasto no mueve inventario (00089). Cualquier otro rol conserva el DEFAULT ''pendiente'' de la columna estado (00025), sin cambios.';


--
-- Name: fn_autoaprobar_movimiento_inventario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_autoaprobar_movimiento_inventario"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF public.es_administrador() OR public.fn_es_aprobacion_de_sistema() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.aprobado_en := NOW();
    NEW.aprobacion_automatica := TRUE;

    PERFORM public.fn_aplicar_ajuste_existencias(
      NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_autoaprobar_movimiento_inventario"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_autoaprobar_movimiento_inventario"() IS 'Hace nacer aprobado el movimiento que inserta la administradora, o el que registra el sistema (fn_es_aprobacion_de_sistema, 00186), con aprobado_por, aprobado_en y aprobacion_automatica, y aplica el ajuste de existencias. Cualquier otro caso conserva el DEFAULT ''pendiente'' (00023). SET search_path = '''' desde la 00112.';


--
-- Name: fn_bloquear_gasto_finalizado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_bloquear_gasto_finalizado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.estado IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un gasto en estado %', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_bloquear_gasto_finalizado"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_bloquear_gasto_finalizado"() IS 'Trigger: un gasto aprobado o rechazado ya no se modifica ni se borra.';


--
-- Name: fn_bloquear_movimiento_finalizado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_bloquear_movimiento_finalizado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.estado NOT IN ('aprobado', 'rechazado') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'No se puede eliminar un movimiento de inventario en estado %: es el respaldo de la existencia que genero.',
      OLD.estado;
  END IF;

  IF NOT (public.es_administrador() OR public.tiene_permiso('inventario.aprobar')) THEN
    RAISE EXCEPTION
      'Un movimiento en estado % ya no es de quien lo registro: solo la administradora puede tocarlo.',
      OLD.estado;
  END IF;

  -- Lo que define el movimiento queda congelado incluso para ella: ya se aplico sobre
  -- existencias y cambiarlo aqui no lo desaplica. La correccion es un movimiento compensatorio.
  IF NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
     OR NEW.bodega_id IS DISTINCT FROM OLD.bodega_id
     OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por THEN
    RAISE EXCEPTION
      'Un movimiento en estado % ya ajusto las existencias: para corregirlo se registra el movimiento que lo compensa, no se reescribe.',
      OLD.estado;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_bloquear_movimiento_finalizado"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_bloquear_movimiento_finalizado"() IS 'Un movimiento aprobado o rechazado no lo edita quien lo registro, y ni siquiera la administradora puede cambiar lo que movio stock (tipo, lote, bodega, cantidad, estado, registrado_por): eso se corrige con un movimiento compensatorio. Ella si puede corregir el texto -motivo, motivo_rechazo-, que antes tambien quedaba congelado sin que eso protegiera ninguna integridad (issue #625). El DELETE sigue prohibido para todos.';


--
-- Name: fn_bodega_de_entrega_de_consulta("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (
      SELECT j.botiquin_bodega_id
      FROM public.consultas c
      JOIN public.atenciones a ON a.id = c.atencion_id
      JOIN public.jornadas j ON j.id = a.jornada_id
      WHERE c.id = p_consulta_id
    ),
    (SELECT b.id FROM public.bodegas b WHERE b.es_principal)
  );
$$;


--
-- Name: FUNCTION "fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid") IS 'Bodega de la que sale lo que se receta en una consulta: la de botiquin de su jornada o, si no tiene, la principal (00176).';


--
-- Name: fn_buscar_pacientes("text", "uuid", integer, integer, "uuid", "text", integer, integer, "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_buscar_pacientes"("p_termino" "text" DEFAULT NULL::"text", "p_comunidad_id" "uuid" DEFAULT NULL::"uuid", "p_pagina" integer DEFAULT 1, "p_por_pagina" integer DEFAULT 20, "p_condicion_cronica_id" "uuid" DEFAULT NULL::"uuid", "p_sexo" "text" DEFAULT NULL::"text", "p_edad_min" integer DEFAULT NULL::integer, "p_edad_max" integer DEFAULT NULL::integer, "p_area_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("paciente_id" "uuid", "nombres" character varying, "apellidos" character varying, "fecha_nacimiento" "date", "sexo" character varying, "comunidad_id" "uuid", "comunidad_nombre" character varying, "numero_ficha" character varying, "ultima_atencion" "date", "condiciones" "text"[], "relevancia" real, "pagina" integer, "por_pagina" integer, "total" bigint)
    LANGUAGE "sql"
    SET "search_path" TO ''
    SET "pg_trgm.word_similarity_threshold" TO '0.4'
    AS $$
  WITH _limite AS (
    SELECT public.fn_verificar_limite_busqueda_pacientes() AS ok
  ),
  coincidencias AS (
    SELECT
      pa.id AS paciente_id,
      pa.nombres,
      pa.apellidos,
      pa.fecha_nacimiento,
      pa.sexo::VARCHAR AS sexo,
      pa.comunidad_id,
      co.nombre AS comunidad_nombre,
      ex.numero_ficha,
      (
        SELECT max(jo.fecha)
        FROM public.atenciones at
        JOIN public.jornadas jo ON jo.id = at.jornada_id
        WHERE at.paciente_id = pa.id
      ) AS ultima_atencion,
      (
        SELECT coalesce(array_agg(cc.nombre::TEXT ORDER BY cc.nombre), ARRAY[]::TEXT[])
        FROM public.padecimientos_cronicos pc
        JOIN public.condiciones_cronicas cc ON cc.id = pc.condicion_id
        WHERE pc.paciente_id = pa.id
          AND pc.estado <> 'resuelta'
      ) AS condiciones,
      CASE
        WHEN nullif(btrim(p_termino), '') IS NULL THEN 0::REAL
        ELSE extensions.word_similarity(
               lower(public.f_unaccent(btrim(p_termino))),
               lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
             )
      END AS relevancia
    FROM public.pacientes pa
    CROSS JOIN _limite
    LEFT JOIN public.comunidades co ON co.id = pa.comunidad_id
    LEFT JOIN public.expedientes ex ON ex.paciente_id = pa.id
    WHERE pa.fecha_baja IS NULL
      AND (p_comunidad_id IS NULL OR pa.comunidad_id = p_comunidad_id)
      AND (
        p_condicion_cronica_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.padecimientos_cronicos pc
             WHERE pc.paciente_id = pa.id
               AND pc.condicion_id = p_condicion_cronica_id
               AND pc.estado <> 'resuelta'
           )
      )
      -- 00182: el area, vigente o retirada. Sin filtro, un paciente sin area sigue saliendo.
      AND (
        p_area_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.paciente_area pr
             WHERE pr.paciente_id = pa.id
               AND pr.area_id = p_area_id
           )
      )
      AND (p_sexo IS NULL OR upper(pa.sexo::TEXT) = upper(p_sexo))
      AND (
        p_edad_min IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT >= p_edad_min
      )
      AND (
        p_edad_max IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT <= p_edad_max
      )
      AND (
        nullif(btrim(p_termino), '') IS NULL
        OR lower(public.f_unaccent(btrim(p_termino)))
           OPERATOR(extensions.<%)
           lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
      )
  ),
  paginacion AS (
    SELECT
      least(greatest(coalesce(p_por_pagina, 20), 1), 100) AS por_pagina,
      count(*) AS total
    FROM coincidencias
  ),
  paginacion_clampeada AS (
    SELECT
      por_pagina,
      total,
      greatest(
        least(coalesce(p_pagina, 1), greatest(ceil(total::NUMERIC / por_pagina)::INT, 1)),
        1
      ) AS pagina
    FROM paginacion
  )
  SELECT
    c.paciente_id,
    c.nombres,
    c.apellidos,
    c.fecha_nacimiento,
    c.sexo,
    c.comunidad_id,
    c.comunidad_nombre,
    c.numero_ficha,
    c.ultima_atencion,
    c.condiciones,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;


--
-- Name: FUNCTION "fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid") IS 'Busca pacientes por nombre (tolerando acentos y errores de tipeo, via el indice de trigramas de 00011 y el operador <% de word_similarity), filtrando opcionalmente por comunidad, condicion cronica vigente, sexo, edad y area de atencion (p_area_id, 00182), con resultados paginados y ordenados por relevancia. Si la pagina pedida cae despues del final devuelve la ultima pagina real. Excluye pacientes con fecha_baja. Cuenta contra el limite de busquedas (00134). SECURITY INVOKER: respeta las politicas de SELECT de pacientes, padecimientos_cronicos y paciente_area.';


--
-- Name: fn_cambiar_principio_de_medicamento("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_tipo public.tipo_articulo;
BEGIN
  SELECT tipo_articulo INTO v_tipo FROM public.medicamentos WHERE id = p_medicamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El medicamento no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_tipo = 'medicamento' AND p_principio_id IS NULL THEN
    RAISE EXCEPTION 'Un medicamento debe tener un principio activo.' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.medicamento_principio
  WHERE medicamento_id = p_medicamento_id
    AND (v_tipo <> 'medicamento' OR principio_id <> p_principio_id);

  IF v_tipo = 'medicamento' THEN
    INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
    VALUES (p_medicamento_id, p_principio_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


--
-- Name: FUNCTION "fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid") IS 'Deja al medicamento con este principio activo y ningun otro, en una transaccion (00166). A un insumo le quita los que tenga. No es SECURITY DEFINER: la deciden las politicas de medicamento_principio.';


--
-- Name: fn_cantidad_comprometida("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(SUM(m.cantidad), 0)::INT
  FROM public.movimientos_inventario m
  WHERE m.lote_id = p_lote_id
    AND m.bodega_id = p_bodega_id
    AND m.tipo = 'salida'
    AND m.estado = 'pendiente';
$$;


--
-- Name: FUNCTION "fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid") IS 'Unidades de un lote en una bodega con una salida pendiente de aprobar: ya estan en la existencia pero ya no se pueden entregar (00186, issue #925).';


--
-- Name: fn_cargar_insumo_a_bodega_de_jornada("uuid", "uuid", "uuid", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
  v_otra TEXT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora carga la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.nombre, j.estado, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         COALESCE(b.es_principal, FALSE) AS es_principal, p.estado AS estado_proyecto
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  LEFT JOIN public.proyectos p ON p.id = j.proyecto_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.estado = 'finalizada' THEN
    RAISE EXCEPTION 'La jornada ya finalizo: su bodega ya no se carga.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.estado_proyecto IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', v_jornada.estado_proyecto
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: asignale una antes de cargarla.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: entrega directo de ella y no hay nada que cargar.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF p_bodega_origen_id = v_jornada.botiquin_bodega_id THEN
    RAISE EXCEPTION 'La bodega de origen es la misma de la jornada: elige otra bodega para cargarla.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT j.nombre INTO v_otra
  FROM public.jornadas j
  WHERE j.id = public.fn_jornada_en_curso_de_bodega(v_jornada.botiquin_bodega_id)
    AND j.id <> p_jornada_id;

  IF v_otra IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega % esta ahora en la jornada %, que sigue en curso: cargala cuando esa jornada termine.',
      v_jornada.bodega_nombre, v_otra
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    p_bodega_origen_id,
    v_jornada.botiquin_bodega_id,
    p_cantidad,
    'Carga de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' para la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;


--
-- Name: FUNCTION "fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer) IS 'Traslada p_cantidad de un lote desde p_bodega_origen_id a la bodega movil de la jornada: un ingreso y una salida aprobados, con jornada_id (00178). Solo la administradora. Devuelve el id del ingreso.';


--
-- Name: fn_cita_exige_permiso_de_agenda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_cita_exige_permiso_de_agenda"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Sin sesion (auth.uid() nulo) no es una persona: es el seed, una migracion o el service_role.
  -- anon no llega aqui, porque la politica de UPDATE de citas no lo admite.
  IF auth.uid() IS NULL
     OR current_setting('ecopac.cita_atendida_por_consulta', TRUE) = 'on'
     OR current_setting('ecopac.fusionando_pacientes', TRUE) = 'on'
     OR public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.tiene_permiso('citas.agendar') THEN
    RETURN NEW;
  END IF;

  -- Solo el estado, y solo entre creada y en atencion.
  IF (to_jsonb(NEW) - 'estado' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'estado' - 'updated_at')
     AND OLD.estado IN ('creada', 'en_atencion')
     AND NEW.estado IN ('creada', 'en_atencion') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sin el permiso de agendar citas solo se abre la cita (Atender) o se regresa a creada.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;


--
-- Name: FUNCTION "fn_cita_exige_permiso_de_agenda"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_cita_exige_permiso_de_agenda"() IS 'Sin citas.agendar (ni administracion ni jornadas.gestionar), una cita solo cambia de estado entre creada y en atencion: Atender y Regresar a creada (00185). Los cambios del sistema (consulta, fusion, sin sesion) no pasan por la regla.';


--
-- Name: fn_clinica_salas_cubren_lo_agendado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_clinica_salas_cubren_lo_agendado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_peor RECORD;
BEGIN
  IF NEW.salas_disponibles >= OLD.salas_disponibles THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cita_clinica:' || NEW.id::TEXT, 0));

  -- Lo agendado a futuro: en cada inicio de una cita que no termino, cuantas coinciden.
  SELECT x.cantidad, x.momento INTO v_peor
  FROM public.citas c
  CROSS JOIN LATERAL public.fn_maximo_de_citas_simultaneas(NEW.id, c.inicia_en, c.termina_en, c.id) x
  WHERE c.clinica_id = NEW.id
    AND c.estado <> 'cancelada'
    AND c.termina_en > now()
  ORDER BY x.cantidad DESC, x.momento
  LIMIT 1;

  IF FOUND AND v_peor.cantidad + 1 > NEW.salas_disponibles THEN
    RAISE EXCEPTION 'No se puede bajar a % salas: el % hay % citas a la vez.',
      NEW.salas_disponibles, public.fn_texto_de_hora_guatemala(v_peor.momento), v_peor.cantidad + 1
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_clinica_salas_cubren_lo_agendado"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_clinica_salas_cubren_lo_agendado"() IS 'Rechaza bajar salas_disponibles por debajo de las citas que ya coinciden en algun horario futuro, diciendo en que fecha y hora (00184).';


--
-- Name: fn_consulta_de_cita_antes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_consulta_de_cita_antes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_cita RECORD;
BEGIN
  IF NEW.cita_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.*, e.id AS expediente_id INTO v_cita
  FROM public.citas c
  LEFT JOIN public.expedientes e ON e.paciente_id = c.paciente_id
  WHERE c.id = NEW.cita_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cita indicada no existe.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.cita_id IS NOT DISTINCT FROM NEW.cita_id THEN
    NEW.area_id := v_cita.area_id;
    RETURN NEW;
  END IF;

  IF v_cita.estado <> 'en_atencion' THEN
    RAISE EXCEPTION 'Abre la cita con Atender antes de registrar su consulta.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_cita.jornada_id <> NEW.jornada_id OR v_cita.expediente_id IS DISTINCT FROM NEW.expediente_id THEN
    RAISE EXCEPTION 'La consulta no es del paciente y la jornada de la cita.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_cita.profesional_id IS NOT NULL
     AND v_cita.profesional_id <> NEW.medico_id
     AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Esta cita la atiende otro profesional.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.area_id := v_cita.area_id;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_consulta_de_cita_antes"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_consulta_de_cita_antes"() IS 'Antes de guardar una consulta con cita (00184): la cita esta en atencion, es del mismo paciente y jornada, la atiende su profesional o la administradora, y la consulta toma el area de la cita.';


--
-- Name: fn_consulta_de_cita_despues(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_consulta_de_cita_despues"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.cita_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.cita_id IS NOT DISTINCT FROM NEW.cita_id) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('ecopac.cita_atendida_por_consulta', 'on', TRUE);
  UPDATE public.citas c
  SET estado = 'atendida',
      profesional_id = COALESCE(c.profesional_id, NEW.medico_id)
  WHERE c.id = NEW.cita_id;
  PERFORM set_config('ecopac.cita_atendida_por_consulta', 'off', TRUE);

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_consulta_de_cita_despues"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_consulta_de_cita_despues"() IS 'Despues de guardar una consulta con cita (00184): la cita pasa a atendida y, si no tenia profesional, queda quien registro la consulta.';


--
-- Name: fn_consumo_de_insumos_de_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid") RETURNS TABLE("lote_id" "uuid", "medicamento_id" "uuid", "articulo" "text", "concentracion" "text", "numero_lote" "text", "fecha_vencimiento" "date", "costo_unitario" numeric, "cargado" bigint, "entregado" bigint, "devuelto" bigint, "en_bodega" bigint, "pendiente" bigint, "queda" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_bodega_id UUID;
BEGIN
  IF NOT (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los insumos de esta jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- La bodega solo cuenta para cargado, devuelto y en bodega cuando no es la principal.
  SELECT j.botiquin_bodega_id INTO v_bodega_id
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id
    AND NOT COALESCE(b.es_principal, FALSE);

  RETURN QUERY
  WITH traslados AS (
    SELECT
      m.lote_id,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'ingreso')::BIGINT AS cargado,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'salida')::BIGINT AS devuelto
    FROM public.movimientos_inventario m
    WHERE v_bodega_id IS NOT NULL
      AND m.jornada_id = p_jornada_id
      AND m.bodega_id = v_bodega_id
      AND m.estado = 'aprobado'
    GROUP BY m.lote_id
  ),
  recetas_de_la_jornada AS (
    SELECT r.id, r.estado
    FROM public.recetas r
    JOIN public.consultas c ON c.id = r.consulta_id
    JOIN public.atenciones a ON a.id = c.atencion_id
    WHERE a.jornada_id = p_jornada_id
  ),
  entregas AS (
    SELECT rd.lote_id, SUM(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada))::BIGINT AS cantidad
    FROM public.receta_detalle rd
    JOIN recetas_de_la_jornada r ON r.id = rd.receta_id
    WHERE r.estado = 'emitida'
      AND rd.lote_id IS NOT NULL
    GROUP BY rd.lote_id
  ),
  pendientes AS (
    SELECT m.lote_id,
           SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE -m.cantidad END)::BIGINT AS cantidad
    FROM public.movimientos_inventario m
    JOIN recetas_de_la_jornada r ON r.id = m.receta_id
    WHERE m.estado = 'pendiente'
    GROUP BY m.lote_id
  ),
  en_bodega AS (
    SELECT e.lote_id, SUM(e.cantidad_disponible)::BIGINT AS cantidad
    FROM public.existencias e
    WHERE v_bodega_id IS NOT NULL
      AND e.bodega_id = v_bodega_id
      AND e.cantidad_disponible > 0
    GROUP BY e.lote_id
  ),
  lotes_de_la_jornada AS (
    SELECT traslados.lote_id FROM traslados
    UNION
    SELECT entregas.lote_id FROM entregas
    UNION
    SELECT en_bodega.lote_id FROM en_bodega
  )
  SELECT
    l.id,
    m.id,
    m.nombre::TEXT,
    m.concentracion::TEXT,
    l.numero_lote::TEXT,
    l.fecha_vencimiento,
    l.costo_unitario,
    COALESCE(t.cargado, 0),
    COALESCE(en.cantidad, 0),
    COALESCE(t.devuelto, 0),
    COALESCE(eb.cantidad, 0),
    GREATEST(COALESCE(p.cantidad, 0), 0),
    CASE WHEN v_bodega_id IS NULL THEN 0
         ELSE COALESCE(t.cargado, 0) - COALESCE(en.cantidad, 0) - COALESCE(t.devuelto, 0)
    END
  FROM lotes_de_la_jornada lj
  JOIN public.lotes l ON l.id = lj.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  LEFT JOIN traslados t ON t.lote_id = l.id
  LEFT JOIN entregas en ON en.lote_id = l.id
  LEFT JOIN pendientes p ON p.lote_id = l.id
  LEFT JOIN en_bodega eb ON eb.lote_id = l.id
  ORDER BY m.nombre, l.fecha_vencimiento NULLS LAST, l.numero_lote;
END;
$$;


--
-- Name: FUNCTION "fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid") IS 'Por lote: lo cargado a la bodega movil de la jornada, lo entregado en sus recetas emitidas (con el ajuste si lo hay), lo devuelto, lo que hay hoy en toda la bodega (en_bodega), lo que espera aprobacion (pendiente) y lo que le queda a la jornada (queda = cargado - entregado - devuelto). 00178, 00181; pendiente y queda desde la 00186 (issue #925).';


--
-- Name: fn_contar_atenciones_incompletas("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_contar_atenciones_incompletas"("p_jornada_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT count(*)::INT
  FROM public.atenciones a
  WHERE a.jornada_id = p_jornada_id
    AND NOT EXISTS (SELECT 1 FROM public.consultas c WHERE c.atencion_id = a.id);
$$;


--
-- Name: FUNCTION "fn_contar_atenciones_incompletas"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_contar_atenciones_incompletas"("p_jornada_id" "uuid") IS 'Cuenta las atenciones de una jornada que todavia no tienen consulta asociada. jornadas/api.js la consulta antes de finalizar una jornada para advertir -sin bloquear- si hay atenciones incompletas (issue #171, criterio de aceptacion 4). No es SECURITY DEFINER: respeta las politicas de SELECT de atenciones/consultas (00033).';


--
-- Name: fn_crear_usuario_administrativo("text", "text", "text", "public"."rol_usuario"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario" DEFAULT 'voluntario general'::"public"."rol_usuario") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_correo IS NULL OR btrim(p_correo) = '' THEN
    RAISE EXCEPTION 'Hace falta el correo para dar de alta a una persona.'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE email = lower(btrim(p_correo));
  IF v_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una cuenta con el correo %.', lower(btrim(p_correo))
      USING ERRCODE = 'unique_violation';
  END IF;

  v_id := extensions.gen_random_uuid();

  -- Las cuatro columnas de token van explicitas en '': GoTrue las escanea como texto no nulo y
  -- auth.users no les pone DEFAULT ''. Omitirlas deja la fila en NULL y rompe el login de TODO
  -- el mundo con un 500 "Database error querying schema" que no menciona la columna. Es
  -- exactamente el bug de la issue #496, que la 00069 tuvo que venir a reparar.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    lower(btrim(p_correo)),
    NULL,
    NOW(),
    -- La marca que el trigger de arriba exige. Un signup desde el cliente no la puede poner.
    '{"provider": "email", "providers": ["email"], "alta": "administrativa"}'::jsonb,
    jsonb_build_object('nombres', COALESCE(p_nombres, ''), 'apellidos', COALESCE(p_apellidos, '')),
    NOW(),
    NOW(),
    '', '', '', ''
  );

  -- GoTrue resuelve el proveedor por auth.identities, no por raw_app_meta_data. Sin esta fila el
  -- usuario existe pero no puede autenticarse por correo (mismo motivo que documenta la 00063).
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    v_id,
    v_id::text,
    jsonb_build_object(
      'sub', v_id::text,
      'email', lower(btrim(p_correo)),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW()
  );

  -- El trigger de la 00002 ya creo el perfil con el rol por defecto; aqui se fija el que toca.
  -- trg_perfiles_impedir_cambio_de_rol_propio (00038) bloquea el cambio de rol si
  -- es_administrador() es falso, y en una llamada sin sesion lo es, asi que se desactiva solo ese
  -- trigger, por nombre, igual que hace la 00063.
  ALTER TABLE public.perfiles
    DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

  UPDATE public.perfiles
  SET rol       = p_rol,
      activo    = TRUE,
      nombres   = COALESCE(NULLIF(btrim(COALESCE(p_nombres, '')), ''), nombres),
      apellidos = COALESCE(NULLIF(btrim(COALESCE(p_apellidos, '')), ''), apellidos)
  WHERE id = v_id;

  ALTER TABLE public.perfiles
    ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

  RETURN v_id;
END;
$$;


--
-- Name: FUNCTION "fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario") IS 'Da de alta a una persona con el rol indicado, sin contrasena: la establece con "olvide mi contrasena". Es el camino administrativo mientras no exista la Edge Function invitar-usuario. No se concede a ningun rol de la aplicacion: se ejecuta desde el SQL editor del Dashboard.';


--
-- Name: fn_detectar_pacientes_duplicados(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_detectar_pacientes_duplicados"() RETURNS TABLE("paciente_a_id" "uuid", "nombres_a" character varying, "apellidos_a" character varying, "numero_ficha_a" character varying, "paciente_b_id" "uuid", "nombres_b" character varying, "apellidos_b" character varying, "numero_ficha_b" character varying, "fecha_nacimiento" "date", "similitud" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    SET "pg_trgm.similarity_threshold" TO '0.4'
    AS $$
  SELECT
    a.id,
    a.nombres,
    a.apellidos,
    ea.numero_ficha,
    b.id,
    b.nombres,
    b.apellidos,
    eb.numero_ficha,
    a.fecha_nacimiento,
    extensions.similarity(
      lower(public.f_unaccent(a.nombres || ' ' || a.apellidos)),
      lower(public.f_unaccent(b.nombres || ' ' || b.apellidos))
    ) AS similitud
  FROM public.pacientes a
  JOIN public.pacientes b
    ON a.id < b.id
    AND a.fecha_nacimiento = b.fecha_nacimiento
    AND lower(public.f_unaccent(a.nombres || ' ' || a.apellidos))
        OPERATOR(extensions.%) lower(public.f_unaccent(b.nombres || ' ' || b.apellidos))
  LEFT JOIN public.expedientes ea ON ea.paciente_id = a.id
  LEFT JOIN public.expedientes eb ON eb.paciente_id = b.id
  WHERE a.fecha_baja IS NULL
    AND b.fecha_baja IS NULL
  ORDER BY similitud DESC
  LIMIT 100;
$$;


--
-- Name: FUNCTION "fn_detectar_pacientes_duplicados"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_detectar_pacientes_duplicados"() IS 'Posibles pacientes duplicados: misma fecha de nacimiento y nombre similar (pg_trgm), ordenados por similitud. SECURITY INVOKER: la ve quien ya puede leer pacientes (00032).';


--
-- Name: fn_devolver_de_bodega_de_jornada("uuid", "uuid", "uuid", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
  v_queda INT;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora devuelve lo que queda en la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.nombre, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         COALESCE(b.es_principal, FALSE) AS es_principal
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: no hay nada que devolver.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: no hay nada que devolver.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = p_bodega_destino_id AND b.es_movil) THEN
    RAISE EXCEPTION 'Lo que sobra se devuelve a una bodega fija.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_queda := GREATEST(0, public.fn_queda_de_jornada_en_lote(p_jornada_id, p_lote_id));

  IF p_cantidad > v_queda THEN
    RAISE EXCEPTION 'De ese lote, a esta jornada le quedan % unidad(es): no se puede devolver mas.', v_queda
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    v_jornada.botiquin_bodega_id,
    p_bodega_destino_id,
    p_cantidad,
    'Devolucion de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' de la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;


--
-- Name: FUNCTION "fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer) IS 'Devuelve p_cantidad de un lote de la bodega movil de la jornada a una bodega fija (fn_trasladar_entre_bodegas, marcado con la jornada) (00179). Solo la administradora; tambien con la jornada finalizada.';


--
-- Name: fn_devolver_inventario_de_receta_anulada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_devolver_inventario_de_receta_anulada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_neto RECORD;
  v_registrado_por UUID := COALESCE(auth.uid(), NEW.anulada_por, NEW.medico_id);
BEGIN
  PERFORM set_config('ecopac.aprobacion_de_sistema', 'on', TRUE);

  UPDATE public.movimientos_inventario m
  SET estado = 'rechazado',
      motivo_rechazo = 'La receta ' || COALESCE(NEW.folio, '') || ' se anulo.',
      aprobado_por = v_registrado_por,
      aprobado_en = NOW()
  WHERE m.receta_id = NEW.id
    AND m.estado = 'pendiente';

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'off', TRUE);

  FOR v_neto IN
    SELECT m.lote_id, m.bodega_id,
           SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE -m.cantidad END)::INT AS cantidad
    FROM public.movimientos_inventario m
    WHERE m.receta_id = NEW.id
      AND m.estado = 'aprobado'
    GROUP BY m.lote_id, m.bodega_id
  LOOP
    IF v_neto.cantidad > 0 THEN
      INSERT INTO public.movimientos_inventario (
        tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
      )
      VALUES (
        'ingreso', v_neto.lote_id, v_neto.bodega_id, v_neto.cantidad,
        'Devolucion por receta anulada ' || COALESCE(NEW.folio, ''),
        v_registrado_por,
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_devolver_inventario_de_receta_anulada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_devolver_inventario_de_receta_anulada"() IS 'Al anular una receta (4A, issue #925): rechaza sus movimientos pendientes y devuelve a la bodega lo que ya se habia descontado, con un ingreso enlazado a la receta (00186).';


--
-- Name: fn_disparar_correo_de_notificaciones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_disparar_correo_de_notificaciones"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_url TEXT;
  v_llave TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'notificaciones_url';

  SELECT decrypted_secret INTO v_llave
  FROM vault.decrypted_secrets WHERE name = 'notificaciones_llave';

  IF v_url IS NULL OR v_llave IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_llave
    ),
    body := '{}'::jsonb
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_disparar_correo_de_notificaciones: no se pudo encolar el correo: %', SQLERRM;
  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_disparar_correo_de_notificaciones"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_disparar_correo_de_notificaciones"() IS 'Trigger: pide a la Edge Function de correo (pg_net) que envie por correo la notificacion recien creada (00138).';


--
-- Name: fn_disponible_neto("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT e.cantidad_disponible
    FROM public.existencias e
    WHERE e.lote_id = p_lote_id AND e.bodega_id = p_bodega_id
  ), 0) - public.fn_cantidad_comprometida(p_lote_id, p_bodega_id);
$$;


--
-- Name: FUNCTION "fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid") IS 'Existencia de un lote en una bodega menos lo comprometido en salidas pendientes (00186). Es lo que se puede recetar, cargar, devolver o trasladar.';


--
-- Name: fn_eliminar_clinica("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_eliminar_clinica"("p_clinica_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora elimina una clinica.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = p_clinica_id) THEN
    RAISE EXCEPTION 'La clinica indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Con citas, cualquiera, no se borra: se retira y las conserva.
  IF EXISTS (SELECT 1 FROM public.citas c WHERE c.clinica_id = p_clinica_id) THEN
    UPDATE public.clinicas c SET es_vigente = FALSE WHERE c.id = p_clinica_id;
    RETURN 'retirada';
  END IF;

  DELETE FROM public.clinicas c WHERE c.id = p_clinica_id;
  RETURN 'eliminada';
END;
$$;


--
-- Name: FUNCTION "fn_eliminar_clinica"("p_clinica_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_eliminar_clinica"("p_clinica_id" "uuid") IS 'Borra una clinica que nunca tuvo citas; si las tuvo, la retira (es_vigente = false). Devuelve eliminada o retirada. Solo la administradora (00183, 00184).';


--
-- Name: fn_es_aprobacion_de_sistema(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_es_aprobacion_de_sistema"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(current_setting('ecopac.aprobacion_de_sistema', TRUE), '') = 'on';
$$;


--
-- Name: FUNCTION "fn_es_aprobacion_de_sistema"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_es_aprobacion_de_sistema"() IS 'TRUE mientras una funcion del sistema (traspaso al iniciar una jornada, anulacion de una receta) registra movimientos que impone una regla y no una persona (00186). Los aprueba solos y les deja cambiar de estado.';


--
-- Name: fn_etapa_caducidad(integer, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_dias IS NULL THEN NULL
    WHEN p_dias <= 0 THEN 0
    ELSE (SELECT min(u) FROM unnest(p_umbrales) u WHERE p_dias <= u)
  END;
$$;


--
-- Name: FUNCTION "fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]) IS 'Etapa de aviso de un lote a p_dias de vencer: 0 si vence hoy o ya vencio (aviso obligatorio), si no la antelacion mas corta que ya alcanzo, o NULL si todavia esta fuera de la ventana. packages/shared/inventario/configuracionAlertas.validaciones.js (etapaDeVencimiento) la replica.';


--
-- Name: fn_existencias_disponibles("uuid", "text", integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_existencias_disponibles"("p_bodega_id" "uuid" DEFAULT NULL::"uuid", "p_busqueda" "text" DEFAULT NULL::"text", "p_limite" integer DEFAULT 50, "p_desplazamiento" integer DEFAULT 0) RETURNS TABLE("medicamento_id" "uuid", "medicamento" "text", "concentracion" "text", "presentacion" "text", "marca" "text", "componentes" "text"[], "cantidad_disponible" integer, "fecha_vencimiento_proxima" "date", "lotes_disponibles" integer, "total_medicamentos" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH disponibles AS (
    SELECT
      v.medicamento_id,
      v.lote_id,
      v.cantidad_disponible,
      v.fecha_vencimiento
    FROM public.vista_lotes_disponibles v
    WHERE p_bodega_id IS NULL OR v.bodega_id = p_bodega_id
  ),
  agregado AS (
    SELECT
      d.medicamento_id AS med_id,
      SUM(d.cantidad_disponible)::INT AS cantidad,
      MIN(d.fecha_vencimiento) AS vence,
      COUNT(DISTINCT d.lote_id)::INT AS lotes
    FROM disponibles d
    GROUP BY d.medicamento_id
  ),
  con_catalogo AS (
    SELECT
      a.med_id,
      a.cantidad,
      a.vence,
      a.lotes,
      m.nombre::TEXT AS nombre,
      m.concentracion::TEXT AS concentracion,
      p.nombre::TEXT AS presentacion,
      m.marca::TEXT AS marca,
      ARRAY(
        SELECT pa.nombre::TEXT
        FROM public.medicamento_principio mp
        JOIN public.principios_activos pa ON pa.id = mp.principio_id
        WHERE mp.medicamento_id = a.med_id
        ORDER BY pa.nombre
      ) AS componentes
    FROM agregado a
    JOIN public.medicamentos m ON m.id = a.med_id
    JOIN public.presentaciones p ON p.id = m.presentacion_id
  ),
  filtrado AS (
    SELECT c.*
    FROM con_catalogo c
    WHERE p_busqueda IS NULL
       OR btrim(p_busqueda) = ''
       OR lower(public.f_unaccent(c.nombre))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.marca))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.concentracion))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR EXISTS (
            SELECT 1
            FROM unnest(c.componentes) AS componente
            WHERE lower(public.f_unaccent(componente))
                    LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
          )
  )
  SELECT
    f.med_id,
    f.nombre,
    f.concentracion,
    f.presentacion,
    f.marca,
    f.componentes,
    f.cantidad,
    f.vence,
    f.lotes,
    COUNT(*) OVER ()::BIGINT
  FROM filtrado f
  ORDER BY f.nombre, f.concentracion, f.marca
  LIMIT p_limite
  OFFSET p_desplazamiento;
$$;


--
-- Name: FUNCTION "fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer) IS 'Inventario disponible agregado por medicamento: cantidad total, fecha de vencimiento mas proxima y numero de lotes con existencia. Se apoya en vista_lotes_disponibles (00047), que ya excluye lo vencido y lo que tiene cantidad cero, asi que la exclusion de vencidos no se repite aqui. p_bodega_id nulo suma todas las bodegas; con valor, agrupa despues de filtrar, que es el motivo por el que esto es una funcion y no una vista de granularidad fija. p_busqueda compara sin acentos contra nombre, marca, concentracion y los principios activos del medicamento. total_medicamentos repite en cada fila el total sin paginar, para que quien consume sepa cuantas paginas hay sin una segunda consulta. SECURITY INVOKER: respeta las politicas RLS de existencias, lotes, medicamentos y bodegas (00034), igual que la vista. Issue #145 (RF-18).';


--
-- Name: fn_fechas_reales_de_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_fechas_reales_de_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_estado_anterior TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado::TEXT END;
BEGIN
  IF v_estado_anterior IS DISTINCT FROM NEW.estado::TEXT THEN
    IF NEW.estado = 'en curso' THEN
      NEW.fecha_inicio_real := COALESCE(NEW.fecha_inicio_real, NOW());
      NEW.fecha_fin_real := NULL;
    ELSIF NEW.estado = 'finalizada' THEN
      NEW.fecha_inicio_real := COALESCE(NEW.fecha_inicio_real, NOW());
      NEW.fecha_fin_real := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_fechas_reales_de_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_fechas_reales_de_jornada"() IS 'Fija fecha_inicio_real al pasar una jornada a en curso y fecha_fin_real al finalizarla; reabrirla borra el cierre (00174).';


--
-- Name: fn_fijar_registrado_por_origen_de_presupuesto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Fuera de una peticion (migraciones, seed) auth.uid() es NULL y se respeta lo que venga.
  IF auth.uid() IS NOT NULL THEN
    NEW.registrado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_fijar_registrado_por_origen_de_presupuesto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"() IS 'Trigger: pone registrado_por con auth.uid() en un origen de presupuesto; el cliente no lo manda ni lo puede falsear.';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: fusiones_pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."fusiones_pacientes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "paciente_absorbido_id" "uuid" NOT NULL,
    "paciente_sobreviviente_id" "uuid" NOT NULL,
    "realizada_por" "uuid",
    "realizada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "citas_traslapadas" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_fusiones_pacientes_no_autofusion" CHECK (("paciente_absorbido_id" <> "paciente_sobreviviente_id"))
);


--
-- Name: TABLE "fusiones_pacientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."fusiones_pacientes" IS 'Registra que expediente absorbio a cual (issue #140). Se escribe solo por fn_fusionar_pacientes; sin politicas de escritura.';


--
-- Name: COLUMN "fusiones_pacientes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "fusiones_pacientes"."paciente_absorbido_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."paciente_absorbido_id" IS 'Paciente duplicado que se dio de baja al fusionar.';


--
-- Name: COLUMN "fusiones_pacientes"."paciente_sobreviviente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."paciente_sobreviviente_id" IS 'Paciente que conserva el historial de los dos.';


--
-- Name: COLUMN "fusiones_pacientes"."realizada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."realizada_por" IS 'Quien hizo la fusion.';


--
-- Name: COLUMN "fusiones_pacientes"."realizada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."realizada_en" IS 'Cuando se hizo.';


--
-- Name: COLUMN "fusiones_pacientes"."citas_traslapadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fusiones_pacientes"."citas_traslapadas" IS 'Cuantas citas no canceladas del sobreviviente quedaron traslapadas con otra suya tras la fusion (00184). Se conservan; la pantalla lo avisa.';


--
-- Name: fn_fusionar_pacientes("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid") RETURNS "public"."fusiones_pacientes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_expediente_sobreviviente UUID;
  v_expediente_absorbido UUID;
  v_fusion public.fusiones_pacientes;
  v_traslapadas INTEGER;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora puede fusionar expedientes.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_sobreviviente_id = p_absorbido_id THEN
    RAISE EXCEPTION 'Un paciente no se puede fusionar consigo mismo.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.pacientes
    WHERE id IN (p_sobreviviente_id, p_absorbido_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El paciente sobreviviente o el absorbido no existen.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pacientes WHERE id = p_absorbido_id AND fecha_baja IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'El expediente que se quiere absorber ya esta dado de baja o ya fue fusionado.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_expediente_sobreviviente FROM public.expedientes WHERE paciente_id = p_sobreviviente_id;
  SELECT id INTO v_expediente_absorbido FROM public.expedientes WHERE paciente_id = p_absorbido_id;

  UPDATE public.atenciones a
  SET paciente_id = p_sobreviviente_id
  WHERE a.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.atenciones s
      WHERE s.paciente_id = p_sobreviviente_id AND s.jornada_id = a.jornada_id
    );

  UPDATE public.padecimientos_cronicos p
  SET paciente_id = p_sobreviviente_id
  WHERE p.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.padecimientos_cronicos s
      WHERE s.paciente_id = p_sobreviviente_id AND s.condicion_id = p.condicion_id
    );

  -- 00184: las areas, sin duplicar. Las que el sobreviviente ya tiene se quedan con el absorbido.
  UPDATE public.paciente_area pa
  SET paciente_id = p_sobreviviente_id
  WHERE pa.paciente_id = p_absorbido_id
    AND NOT EXISTS (
      SELECT 1 FROM public.paciente_area s
      WHERE s.paciente_id = p_sobreviviente_id AND s.area_id = pa.area_id
    );

  -- 00184: todas las citas. fn_validar_cita no revisa traslapes durante la fusion: si quedan
  -- traslapadas se conservan y se cuentan.
  PERFORM set_config('ecopac.fusionando_pacientes', 'on', TRUE);
  UPDATE public.citas c SET paciente_id = p_sobreviviente_id WHERE c.paciente_id = p_absorbido_id;
  PERFORM set_config('ecopac.fusionando_pacientes', 'off', TRUE);

  SELECT count(*)::INT INTO v_traslapadas
  FROM public.citas c
  WHERE c.paciente_id = p_sobreviviente_id
    AND c.estado <> 'cancelada'
    AND EXISTS (
      SELECT 1 FROM public.citas o
      WHERE o.paciente_id = p_sobreviviente_id
        AND o.id <> c.id
        AND o.estado <> 'cancelada'
        AND o.inicia_en < c.termina_en
        AND o.termina_en > c.inicia_en
    );

  IF v_expediente_absorbido IS NOT NULL AND v_expediente_sobreviviente IS NOT NULL THEN
    UPDATE public.consultas
    SET expediente_id = v_expediente_sobreviviente
    WHERE expediente_id = v_expediente_absorbido;
  ELSE
    RAISE EXCEPTION 'No se puede fusionar con seguridad: uno de los dos pacientes no tiene expediente.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE public.pacientes
  SET fecha_baja = CURRENT_DATE
  WHERE id = p_absorbido_id;

  INSERT INTO public.fusiones_pacientes (
    paciente_absorbido_id, paciente_sobreviviente_id, realizada_por, citas_traslapadas
  )
  VALUES (p_absorbido_id, p_sobreviviente_id, auth.uid(), v_traslapadas)
  RETURNING * INTO v_fusion;

  RETURN v_fusion;
END;
$$;


--
-- Name: FUNCTION "fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid") IS 'Fusiona dos expedientes: reasigna atenciones/condiciones/consultas sin violar sus UNIQUE, da de baja al absorbido y registra la fusion. Solo administrador (issue #140). Aborta si a alguno de los dos les falta el expediente, en vez de fusionar a medias (issue #637).';


--
-- Name: fn_generar_alertas_caducidad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_generar_alertas_caducidad"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_hoy DATE := public.fn_hoy_guatemala();
  v_umbrales INT[];
  v_creadas INT;
BEGIN
  -- La rutina programada y la sincronizacion del panel pueden coincidir; sin este candado las dos
  -- eligen el mismo lote y la segunda choca con uq_alertas_caducidad_lote_pendiente.
  PERFORM pg_advisory_xact_lock(hashtext('fn_generar_alertas_caducidad'));

  SELECT c.umbrales_dias INTO v_umbrales FROM public.configuracion_alertas_caducidad c;
  IF v_umbrales IS NULL THEN
    RAISE EXCEPTION 'No hay configuracion de antelaciones de aviso de vencimiento.';
  END IF;

  -- 1. Una alerta pendiente cuyo lote ya no tiene existencia no se puede atender: se cierra sola.
  UPDATE public.alertas_caducidad a
  SET estado = 'atendida', atendida_en = now(), cerrada_sin_existencia = TRUE
  WHERE a.estado = 'pendiente'
    AND COALESCE(
      (SELECT SUM(e.cantidad_disponible) FROM public.existencias e WHERE e.lote_id = a.lote_id),
      0
    ) <= 0;

  -- 2. Alertas nuevas. No se crea si ya hay una pendiente, ni si alguien atendio el lote en esta
  -- misma etapa o en una mas cercana (un lote reubicado a los 60 dias vuelve a alertar a los 30,
  -- no al dia siguiente). Un cierre automatico no cuenta: si el lote se repone, vuelve a alertar.
  WITH nuevas AS (
    INSERT INTO public.alertas_caducidad (lote_id, cantidad_afectada)
    SELECT c.lote_id, c.cantidad
    FROM public.fn_lotes_en_ventana_de_caducidad(v_hoy, v_umbrales) c
    JOIN public.lotes l ON l.id = c.lote_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.alertas_caducidad a
        WHERE a.lote_id = c.lote_id AND a.estado = 'pendiente'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.alertas_caducidad atendida
        WHERE atendida.lote_id = c.lote_id
          AND atendida.estado = 'atendida'
          AND NOT atendida.cerrada_sin_existencia
          AND COALESCE(
            public.fn_etapa_caducidad(
              l.fecha_vencimiento - public.fn_hoy_guatemala(atendida.atendida_en),
              v_umbrales
            ),
            2147483647
          ) <= c.etapa
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_creadas FROM nuevas;

  -- 3. Cada alerta pendiente que llego a una etapa mas cercana que la ultima avisada recibe un
  -- aviso, y su INSERT genera la notificacion. Solo la etapa actual: una alerta nueva no recibe
  -- de golpe todas las antelaciones que ya dejo atras.
  WITH candidatos AS (
    SELECT * FROM public.fn_lotes_en_ventana_de_caducidad(v_hoy, v_umbrales)
  ),
  avanzadas AS (
    UPDATE public.alertas_caducidad a
    SET umbral_notificado_dias = c.etapa
    FROM candidatos c
    WHERE a.lote_id = c.lote_id
      AND a.estado = 'pendiente'
      AND c.etapa < COALESCE(a.umbral_notificado_dias, 2147483647)
    RETURNING a.id, c.etapa, c.dias, c.cantidad
  )
  INSERT INTO public.avisos_caducidad (alerta_id, umbral_dias, dias_restantes, cantidad_en_existencia)
  SELECT v.id, v.etapa, v.dias, v.cantidad FROM avanzadas v
  ON CONFLICT (alerta_id, umbral_dias) DO NOTHING;

  RETURN v_creadas;
END;
$$;


--
-- Name: FUNCTION "fn_generar_alertas_caducidad"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_generar_alertas_caducidad"() IS 'Rutina de vencimientos (issue #899). Con la fecha de Guatemala y las antelaciones de configuracion_alertas_caducidad: cierra las alertas pendientes sin existencia, crea una alerta por lote con existencia dentro de la ventana (incluidos los vencidos) que no tenga una pendiente ni una atendida en la misma etapa, y registra un aviso -con su notificacion- cada vez que una alerta pendiente llega a una etapa mas cercana: cada antelacion y el dia del vencimiento. Idempotente. Devuelve cuantas alertas nuevas creo. SECURITY DEFINER; la invocan la Edge Function programada y fn_sincronizar_alertas_caducidad().';


--
-- Name: fn_generar_receta("uuid", "uuid", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_receta_id UUID;
  v_renglon JSONB;
  v_lote_id UUID;
  v_bodega_id UUID;
  v_bodega_de_entrega UUID;
  v_cantidad INT;
  v_vence DATE;
  v_disponible INT;
  v_folio TEXT;
  v_salida RECORD;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una receta necesita al menos un medicamento.';
  END IF;

  v_bodega_de_entrega := public.fn_bodega_de_entrega_de_consulta(p_consulta_id);

  INSERT INTO public.recetas (consulta_id, medico_id, indicaciones_generales)
  VALUES (p_consulta_id, p_medico_id, p_indicaciones_generales)
  RETURNING id, folio INTO v_receta_id, v_folio;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_lote_id := NULLIF(v_renglon ->> 'lote_id', '')::UUID;
    v_bodega_id := NULLIF(v_renglon ->> 'bodega_id', '')::UUID;
    v_cantidad := (v_renglon ->> 'cantidad_entregada')::INT;

    IF v_lote_id IS NOT NULL THEN
      SELECT fecha_vencimiento INTO v_vence
      FROM public.lotes
      WHERE id = v_lote_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El lote indicado no existe.';
      END IF;

      IF v_vence < CURRENT_DATE THEN
        RAISE EXCEPTION
          'No se puede recetar del lote %: vencio el %.',
          v_renglon ->> 'lote_id', v_vence;
      END IF;

      IF v_bodega_id IS NULL THEN
        RAISE EXCEPTION
          'El renglon del lote % no indica de que bodega sale. Sin bodega no se puede descontar.',
          v_renglon ->> 'lote_id';
      END IF;

      IF v_bodega_de_entrega IS NOT NULL AND v_bodega_id <> v_bodega_de_entrega THEN
        RAISE EXCEPTION
          'En esta jornada los medicamentos salen de la bodega %, no de otra.',
          (SELECT nombre FROM public.bodegas WHERE id = v_bodega_de_entrega)
          USING ERRCODE = 'object_not_in_prerequisite_state';
      END IF;
    END IF;

    INSERT INTO public.receta_detalle (
      receta_id, medicamento_id, lote_id, bodega_id, dosis, frecuencia, duracion,
      cantidad_entregada
    )
    VALUES (
      v_receta_id,
      (v_renglon ->> 'medicamento_id')::UUID,
      v_lote_id,
      v_bodega_id,
      v_renglon ->> 'dosis',
      v_renglon ->> 'frecuencia',
      v_renglon ->> 'duracion',
      v_cantidad
    );
  END LOOP;

  -- Un movimiento por combinacion (lote, bodega) y no uno por renglon (00112).
  FOR v_salida IN
    SELECT
      (renglon ->> 'lote_id')::UUID AS lote_id,
      (renglon ->> 'bodega_id')::UUID AS bodega_id,
      SUM((renglon ->> 'cantidad_entregada')::INT) AS cantidad
    FROM jsonb_array_elements(p_detalle) AS renglon
    WHERE NULLIF(renglon ->> 'lote_id', '') IS NOT NULL
    GROUP BY 1, 2
  LOOP
    PERFORM 1 FROM public.existencias e
    WHERE e.lote_id = v_salida.lote_id AND e.bodega_id = v_salida.bodega_id
    FOR UPDATE;

    v_disponible := public.fn_disponible_neto(v_salida.lote_id, v_salida.bodega_id);

    -- Mismo mensaje que la 00176 (lo comparan las pruebas y el cliente).
    IF v_disponible < v_salida.cantidad THEN
      RAISE EXCEPTION
        'Existencia insuficiente en el lote %. Disponible: %, solicitado: %.',
        v_salida.lote_id, GREATEST(v_disponible, 0), v_salida.cantidad;
    END IF;

    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, receta_id
    )
    VALUES (
      'salida',
      v_salida.lote_id,
      v_salida.bodega_id,
      v_salida.cantidad,
      'Entrega por receta medica ' || COALESCE(v_folio, ''),
      auth.uid(),
      v_receta_id
    );
  END LOOP;

  RETURN v_receta_id;
END;
$$;


--
-- Name: FUNCTION "fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb") IS 'Crea una receta con todos sus renglones Y registra la salida de inventario correspondiente, todo en una sola transaccion (issues #120 y #711): si un renglon o una salida falla, no queda ni la receta ni el movimiento. Antes de insertar cada renglon con lote comprueba que el lote no este vencido, que la existencia alcance y que venga la bodega de la que sale. Los renglones sin lote no se comprueban ni generan movimiento: recetar sin especificar lote es valido (receta_detalle.lote_id es nullable en la 00019) y ahi el control ocurre al despachar. Los movimientos se agrupan por (lote, bodega), asi que dos renglones del mismo lote dan una sola salida. Desde la issue #764 tambien persiste bodega_id en receta_detalle, que fn_ajustar_entrega_receta() necesita para corregir la cantidad entregada mas adelante sin descontar el inventario dos veces. SECURITY INVOKER: quien puede crear la receta y quien puede registrar el movimiento lo deciden las politicas de la 00033 y la 00034, no esta funcion; el flujo de aprobacion no cambia (administrador autoaprueba por la 00028, medico y voluntario dejan el movimiento pendiente).';


--
-- Name: fn_hoy_guatemala(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_hoy_guatemala"("p_instante" timestamp with time zone DEFAULT "now"()) RETURNS "date"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT (p_instante AT TIME ZONE 'America/Guatemala')::DATE;
$$;


--
-- Name: FUNCTION "fn_hoy_guatemala"("p_instante" timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_hoy_guatemala"("p_instante" timestamp with time zone) IS 'Fecha calendario de Guatemala en el instante dado (por defecto, ahora). La base corre en UTC, asi que CURRENT_DATE se adelanta un dia entre las 18:00 y las 23:59 de Guatemala (issue #899).';


--
-- Name: fn_impedir_devuelto_a_mano(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_impedir_devuelto_a_mano"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF current_setting('ecopac.liquidando_sobrante', true) IS DISTINCT FROM 'on' THEN
    IF (TG_OP = 'INSERT' AND (NEW.devuelto <> 0 OR NEW.traspasado_desde IS NOT NULL))
       OR (TG_OP = 'UPDATE' AND (NEW.devuelto IS DISTINCT FROM OLD.devuelto
                                 OR NEW.traspasado_desde IS DISTINCT FROM OLD.traspasado_desde))
    THEN
      RAISE EXCEPTION 'Lo devuelto de un aporte se registra al liquidar el sobrante de la jornada.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Un aporte ya liquidado es historia: no se corrige ni se quita.
    IF TG_OP = 'UPDATE' AND OLD.devuelto > 0 THEN
      RAISE EXCEPTION 'Un aporte cuyo sobrante ya se liquido no se modifica.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_impedir_devuelto_a_mano"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_impedir_devuelto_a_mano"() IS 'Trigger de jornada_presupuesto_origen (00160): devuelto y traspasado_desde solo los escribe fn_liquidar_sobrante_de_jornada().';


--
-- Name: fn_impedir_presupuesto_a_mano(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_impedir_presupuesto_a_mano"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.presupuesto_asignado IS DISTINCT FROM OLD.presupuesto_asignado
     AND current_setting('ecopac.sincronizando_presupuesto', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'El presupuesto de una jornada es la suma de sus origenes: se registra un origen, no el total.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_impedir_presupuesto_a_mano"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_impedir_presupuesto_a_mano"() IS 'Trigger: rechaza un UPDATE que cambie jornadas.presupuesto_asignado fuera de la sincronizacion con jornada_presupuesto_origen (00135).';


--
-- Name: fn_impedir_quitar_aporte_liquidado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_impedir_quitar_aporte_liquidado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.devuelto > 0 THEN
    RAISE EXCEPTION 'Un aporte cuyo sobrante ya se liquido no se quita.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION "fn_impedir_quitar_aporte_liquidado"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_impedir_quitar_aporte_liquidado"() IS 'Trigger de jornada_presupuesto_origen (00160): un aporte con sobrante liquidado no se borra.';


--
-- Name: fn_insumos_de_proyecto("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_insumos_de_proyecto"("p_proyecto_id" "uuid") RETURNS TABLE("jornada_id" "uuid", "jornada" "text", "bodega" "text", "lote_id" "uuid", "articulo" "text", "concentracion" "text", "numero_lote" "text", "fecha_vencimiento" "date", "costo_unitario" numeric, "queda" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
BEGIN
  IF NOT (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los insumos de este proyecto.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_jornada IN
    SELECT j.id, j.nombre, b.nombre AS bodega
    FROM public.jornadas j
    JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
    WHERE j.proyecto_id = p_proyecto_id
      AND b.es_movil
      AND NOT b.es_principal
  LOOP
    RETURN QUERY
    SELECT v_jornada.id, v_jornada.nombre::TEXT, v_jornada.bodega::TEXT,
           c.lote_id, c.articulo, c.concentracion, c.numero_lote, c.fecha_vencimiento,
           c.costo_unitario, c.queda
    FROM public.fn_consumo_de_insumos_de_jornada(v_jornada.id) c
    WHERE c.queda > 0;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION "fn_insumos_de_proyecto"("p_proyecto_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_insumos_de_proyecto"("p_proyecto_id" "uuid") IS 'Lo que les queda a las jornadas del proyecto en sus bodegas moviles, por jornada y lote (queda de fn_consumo_de_insumos_de_jornada). Cada unidad cuenta en una sola jornada, asi que una bodega compartida no se suma en dos proyectos (00186, issue #925).';


--
-- Name: fn_jornada_bodega_movil_libre(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_bodega_movil_libre"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_otra TEXT;
BEGIN
  IF NEW.estado <> 'en curso' OR NEW.botiquin_bodega_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- La principal no viaja: puede atender a varias jornadas en curso a la vez.
  IF EXISTS (
    SELECT 1 FROM public.bodegas b WHERE b.id = NEW.botiquin_bodega_id AND b.es_principal
  ) THEN
    RETURN NEW;
  END IF;

  SELECT j.nombre INTO v_otra
  FROM public.jornadas j
  WHERE j.botiquin_bodega_id = NEW.botiquin_bodega_id
    AND j.estado = 'en curso'
    AND j.id <> NEW.id
  LIMIT 1;

  IF v_otra IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega movil ya esta en la jornada %, que sigue en curso.', v_otra
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_jornada_bodega_movil_libre"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_bodega_movil_libre"() IS 'Rechaza que una jornada quede en curso con una bodega movil que ya esta en otra jornada en curso (00179). La bodega principal no tiene esa restriccion (00181).';


--
-- Name: fn_jornada_cancela_citas_pendientes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_cancela_citas_pendientes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado OR NEW.estado NOT IN ('cancelada', 'finalizada') THEN
    RETURN NEW;
  END IF;

  UPDATE public.citas c
  SET estado = 'cancelada',
      cancelada_en = now(),
      motivo_cancelacion = CASE NEW.estado
        WHEN 'cancelada' THEN 'Jornada cancelada'
        ELSE 'No atendida al cerrar la jornada'
      END
  WHERE c.jornada_id = NEW.id
    AND c.estado IN ('creada', 'en_atencion');

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_jornada_cancela_citas_pendientes"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_cancela_citas_pendientes"() IS 'Al cancelar o finalizar una jornada, cancela sus citas creadas o en atencion con el motivo que corresponde (00184).';


--
-- Name: fn_jornada_duena_de_bodega("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (
      SELECT j.id
      FROM public.jornadas j
      WHERE j.id = public.fn_jornada_en_curso_de_bodega(p_bodega_id)
        AND j.id IS DISTINCT FROM p_excluir
    ),
    (
      SELECT m.jornada_id
      FROM public.movimientos_inventario m
      WHERE m.bodega_id = p_bodega_id
        AND m.tipo = 'ingreso'
        AND m.estado = 'aprobado'
        AND m.jornada_id IS NOT NULL
        AND m.jornada_id IS DISTINCT FROM p_excluir
      ORDER BY m.created_at DESC
      LIMIT 1
    )
  );
$$;


--
-- Name: FUNCTION "fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid") IS 'De que jornada es hoy el inventario de una bodega movil: la que la tiene en curso o, si no hay, la ultima que recibio inventario en ella (00186). p_excluir deja fuera una jornada.';


--
-- Name: fn_jornada_en_curso_de_bodega("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT j.id
  FROM public.jornadas j
  JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.botiquin_bodega_id = p_bodega_id
    AND j.estado = 'en curso'
    AND b.es_movil
    AND NOT b.es_principal
  LIMIT 1;
$$;


--
-- Name: FUNCTION "fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid") IS 'La jornada en curso que tiene esta bodega movil, o NULL (00186).';


--
-- Name: fn_jornada_exige_bodega_movil(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_exige_bodega_movil"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'Toda jornada lleva una bodega: elige una bodega movil o la bodega principal.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bodegas b
    WHERE b.id = NEW.botiquin_bodega_id AND (b.es_movil OR b.es_principal)
  ) THEN
    RAISE EXCEPTION 'La bodega de una jornada tiene que ser una bodega movil o la bodega principal.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_jornada_exige_bodega_movil"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_exige_bodega_movil"() IS 'Rechaza crear una jornada sin bodega, quitarsela, o darle una que no es movil ni la principal (00178; la principal se acepta desde la 00181).';


--
-- Name: fn_jornada_exige_proyecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_exige_proyecto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.proyecto_id IS NULL THEN
    RAISE EXCEPTION 'Toda jornada pertenece a un proyecto: elige uno.'
      USING ERRCODE = 'not_null_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_jornada_exige_proyecto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_exige_proyecto"() IS 'Rechaza crear una jornada sin proyecto o quitarle el que tiene (00169).';


--
-- Name: fn_jornada_sin_inventario_cargado_al_cambiar_bodega(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_jornada_sin_inventario_cargado_al_cambiar_bodega"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_bodega TEXT;
BEGIN
  IF OLD.botiquin_bodega_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.nombre INTO v_bodega
  FROM public.bodegas b
  WHERE b.id = OLD.botiquin_bodega_id
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT DISTINCT m.lote_id
        FROM public.movimientos_inventario m
        WHERE m.jornada_id = OLD.id
          AND m.bodega_id = OLD.botiquin_bodega_id
          AND m.estado = 'aprobado'
      ) lotes
      WHERE public.fn_queda_de_jornada_en_lote(OLD.id, lotes.lote_id) > 0
    );

  IF v_bodega IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega % todavia tiene inventario cargado para esta jornada: devuelvelo antes de cambiar de bodega.', v_bodega
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_jornada_sin_inventario_cargado_al_cambiar_bodega"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_jornada_sin_inventario_cargado_al_cambiar_bodega"() IS 'Rechaza cambiar la bodega de una jornada mientras le quede inventario en su bodega movil (cargado - entregado - devuelto > 0); primero se devuelve (00181, por jornada desde la 00186).';


--
-- Name: fn_liquidar_sobrante_de_jornada("uuid", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
  v_destino RECORD;
  v_decision JSONB;
  v_origen_id UUID;
  v_tipo TEXT;
  v_destino_id UUID;
  v_sobrante NUMERIC;
  v_aporte RECORD;
  v_liquidados INTEGER := 0;
BEGIN
  IF NOT (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar')) THEN
    RAISE EXCEPTION 'Solo quien gestiona jornadas liquida el sobrante de una.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.id, j.nombre, j.estado, j.proyecto_id INTO v_jornada
  FROM public.jornadas j
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.estado <> 'finalizada' THEN
    RAISE EXCEPTION 'El sobrante se liquida cuando la jornada esta finalizada.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gastos g WHERE g.jornada_id = p_jornada_id AND g.estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'La jornada tiene gastos pendientes de aprobar: el sobrante todavia puede cambiar.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_decisiones IS NULL OR jsonb_typeof(p_decisiones) <> 'array' OR jsonb_array_length(p_decisiones) = 0 THEN
    RAISE EXCEPTION 'Indica que hacer con el sobrante de al menos un aporte.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('ecopac.liquidando_sobrante', 'on', true);

  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisiones) LOOP
    v_origen_id := (v_decision->>'origen_id')::UUID;
    v_tipo := v_decision->>'destino';

    -- El sobrante se calcula de nuevo en cada vuelta: la anterior pudo cambiarlo.
    SELECT s.sobrante INTO v_sobrante
    FROM public.sobrante_de_jornada(p_jornada_id) s
    WHERE s.origen_id = v_origen_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese aporte no es de esta jornada.' USING ERRCODE = 'check_violation';
    END IF;

    IF v_sobrante <= 0 THEN
      RAISE EXCEPTION 'A ese aporte no le sobra nada.' USING ERRCODE = 'check_violation';
    END IF;

    SELECT o.* INTO v_aporte
    FROM public.jornada_presupuesto_origen o
    WHERE o.id = v_origen_id
    FOR UPDATE;

    IF v_tipo = 'traspasar' THEN
      v_destino_id := (v_decision->>'jornada_destino_id')::UUID;

      SELECT j.id, j.estado, j.proyecto_id INTO v_destino
      FROM public.jornadas j
      WHERE j.id = v_destino_id;

      IF NOT FOUND
         OR v_destino_id = p_jornada_id
         OR v_jornada.proyecto_id IS NULL
         OR v_destino.proyecto_id IS DISTINCT FROM v_jornada.proyecto_id
      THEN
        RAISE EXCEPTION 'El sobrante se traspasa a otra jornada del mismo proyecto.'
          USING ERRCODE = 'check_violation';
      END IF;

      IF v_destino.estado NOT IN ('planificada', 'en curso') THEN
        RAISE EXCEPTION 'La jornada que recibe el sobrante tiene que estar planificada o en curso.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF v_tipo IS DISTINCT FROM 'devolver' THEN
      RAISE EXCEPTION 'El destino del sobrante es devolver o traspasar.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Primero sale de esta jornada; despues entra en la otra. En ese orden, el saldo de la
    -- donacion (fn_validar_origen_de_presupuesto) nunca cuenta el mismo dinero dos veces.
    UPDATE public.jornada_presupuesto_origen
    SET devuelto = devuelto + v_sobrante
    WHERE id = v_origen_id;

    IF v_tipo = 'traspasar' THEN
      INSERT INTO public.jornada_presupuesto_origen
        (jornada_id, origen, donacion_id, fuente_id, monto, descripcion, traspasado_desde)
      VALUES
        (v_destino_id, v_aporte.origen, v_aporte.donacion_id, v_aporte.fuente_id, v_sobrante,
         'Sobrante de la jornada ' || v_jornada.nombre, v_origen_id);
    ELSIF v_aporte.origen <> 'donacion' THEN
      -- 00168: lo que no vuelve a una donacion entra a la caja.
      INSERT INTO public.movimientos_de_caja
        (tipo, monto, aporte_id, jornada_id, descripcion)
      VALUES
        ('entrada', v_sobrante, v_origen_id, p_jornada_id,
         'Sobrante de la jornada ' || v_jornada.nombre);
    END IF;

    v_liquidados := v_liquidados + 1;
  END LOOP;

  PERFORM set_config('ecopac.liquidando_sobrante', 'off', true);

  RETURN v_liquidados;
END;
$$;


--
-- Name: FUNCTION "fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb") IS 'Liquida el sobrante de una jornada finalizada sin gastos pendientes: por cada aporte elegido, lo devuelve a su origen o lo traspasa a otra jornada planificada o en curso del mismo proyecto (00160). Lo devuelto que no es de una donacion entra a la caja (00168). Administradora o jornadas.gestionar.';


--
-- Name: fn_lote_de_medicamento_tiene_vencimiento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_lote_de_medicamento_tiene_vencimiento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.fecha_vencimiento IS NULL AND EXISTS (
    SELECT 1
    FROM public.medicamentos m
    WHERE m.id = NEW.medicamento_id
      AND m.tipo_articulo = 'medicamento'
  ) THEN
    RAISE EXCEPTION 'Un lote de medicamento necesita fecha de vencimiento.'
      USING ERRCODE = 'not_null_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_lote_de_medicamento_tiene_vencimiento"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_lote_de_medicamento_tiene_vencimiento"() IS 'Rechaza un lote de medicamento sin fecha de vencimiento; un lote de insumo puede no tenerla (00171).';


--
-- Name: fn_lotes_en_ventana_de_caducidad("date", integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]) RETURNS TABLE("lote_id" "uuid", "dias" integer, "etapa" integer, "cantidad" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    l.id,
    (l.fecha_vencimiento - p_hoy)::INT,
    public.fn_etapa_caducidad(l.fecha_vencimiento - p_hoy, p_umbrales),
    SUM(e.cantidad_disponible)::INT
  FROM public.lotes l
  JOIN public.existencias e ON e.lote_id = l.id
  -- Sin antelaciones la ventana es 0: solo entra lo que vence hoy o ya vencio.
  WHERE l.fecha_vencimiento - p_hoy <= COALESCE((SELECT max(u) FROM unnest(p_umbrales) u), 0)
  GROUP BY l.id, l.fecha_vencimiento
  HAVING SUM(e.cantidad_disponible) > 0;
$$;


--
-- Name: FUNCTION "fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]) IS 'Lotes con existencia total mayor que cero que vencen dentro de la antelacion mas larga, incluidos los ya vencidos, con sus dias restantes y su etapa de aviso. Uso interno de fn_generar_alertas_caducidad().';


--
-- Name: fn_maximo_de_citas_simultaneas("uuid", timestamp with time zone, timestamp with time zone, "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid" DEFAULT NULL::"uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone) RETURNS "record"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH puntos AS (
    SELECT p_desde AS punto
    UNION
    SELECT o.inicia_en
    FROM public.citas o
    WHERE o.clinica_id = p_clinica_id
      AND o.estado <> 'cancelada'
      AND o.id IS DISTINCT FROM p_excluir_id
      AND o.inicia_en > p_desde
      AND o.inicia_en < p_hasta
  )
  SELECT
    (SELECT count(*)::INT FROM public.citas o
      WHERE o.clinica_id = p_clinica_id
        AND o.estado <> 'cancelada'
        AND o.id IS DISTINCT FROM p_excluir_id
        AND o.inicia_en <= pu.punto
        AND o.termina_en > pu.punto) AS cantidad,
    pu.punto AS momento
  FROM puntos pu
  ORDER BY 1 DESC, 2
  LIMIT 1;
$$;


--
-- Name: FUNCTION "fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone) IS 'Cuantas citas no canceladas de la clinica coinciden a la vez como maximo dentro del intervalo, y en que momento (00184). La usan fn_validar_cita y la regla de salas de clinicas.';


--
-- Name: fn_medicamento_tiene_existencias("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.existencias e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE l.medicamento_id = p_medicamento_id
      AND e.cantidad_disponible > 0
      AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
  );
$$;


--
-- Name: FUNCTION "fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid") IS 'TRUE si el medicamento tiene stock positivo no vencido (existencias.cantidad_disponible > 0 y lote con fecha_vencimiento >= hoy, o sin fecha, 00171) en algun lote. medicamentos.api.js la consulta antes de desactivar un medicamento (issue #142); un medicamento con lotes historicos ya agotados o vencidos si se puede desactivar.';


--
-- Name: fn_normalizar_configuracion_alertas_caducidad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.umbrales_dias := ARRAY(
    SELECT u FROM unnest(NEW.umbrales_dias) u ORDER BY u DESC NULLS LAST
  );
  NEW.actualizado_por := auth.uid();
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_normalizar_configuracion_alertas_caducidad"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"() IS 'Trigger: ordena las antelaciones de mayor a menor y registra quien guardo el cambio.';


--
-- Name: fn_notificar_administradores("public"."categoria_notificacion", "text", "text", "text", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH nuevas AS (
    INSERT INTO public.notificaciones
      (perfil_id, categoria, titulo, cuerpo, enlace, origen_tabla, origen_id)
    SELECT p.id, p_categoria, p_titulo, p_cuerpo, p_enlace, p_origen_tabla, p_origen_id
    FROM public.perfiles p
    WHERE p.rol = 'administrador' AND p.activo
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM nuevas;
$$;


--
-- Name: FUNCTION "fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid") IS 'Crea la misma notificacion para cada administrador activo (un perfil desactivado no recibe nada, mismo criterio que la 00079). Devuelve cuantas creo. Solo la llaman los triggers de la 00138: sin EXECUTE para ningun rol de aplicacion.';


--
-- Name: fn_notificar_aviso_caducidad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_notificar_aviso_caducidad"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_vence DATE;
  v_titulo TEXT;
BEGIN
  SELECT m.nombre, l.numero_lote, l.fecha_vencimiento
  INTO v_medicamento, v_numero_lote, v_vence
  FROM public.alertas_caducidad a
  JOIN public.lotes l ON l.id = a.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE a.id = NEW.alerta_id;

  v_titulo := CASE
    WHEN NEW.dias_restantes < 0 THEN 'Lote vencido: ' || v_medicamento
    WHEN NEW.dias_restantes = 0 THEN 'Lote vence hoy: ' || v_medicamento
    ELSE format(
      'Lote por vencer en %s %s: %s',
      NEW.dias_restantes,
      CASE WHEN NEW.dias_restantes = 1 THEN 'día' ELSE 'días' END,
      v_medicamento
    )
  END;

  PERFORM public.fn_notificar_administradores(
    'caducidad',
    v_titulo,
    format(
      'El lote %s %s el %s y tiene %s unidades en existencia. Registra la acción tomada en '
      'Inventario > Alertas.',
      v_numero_lote,
      CASE WHEN NEW.dias_restantes < 0 THEN 'venció' ELSE 'vence' END,
      to_char(v_vence, 'DD/MM/YYYY'),
      NEW.cantidad_en_existencia
    ),
    '/inventario?tab=alertas',
    'avisos_caducidad',
    NEW.id
  );

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_notificar_aviso_caducidad"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_notificar_aviso_caducidad"() IS 'Trigger: avisa en el buzon (y por correo) de la administracion cada vez que se registra un aviso de vencimiento: "Lote por vencer en N dias", "Lote vence hoy" o "Lote vencido" (issue #899). Reemplaza a fn_notificar_alerta_caducidad (00138), que avisaba una sola vez por alerta.';


--
-- Name: fn_notificar_gasto_por_aprobar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_notificar_gasto_por_aprobar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada TEXT;
  v_registrado_por TEXT;
BEGIN
  SELECT j.nombre INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  SELECT p.nombres || ' ' || p.apellidos INTO v_registrado_por
  FROM public.perfiles p WHERE p.id = NEW.registrado_por;

  -- El monto se formatea con separadores fijos (',' y '.') y no con los de lc_numeric: el mismo
  -- numero no puede salir distinto segun la configuracion regional del servidor.
  PERFORM public.fn_notificar_administradores(
    'presupuestos',
    'Gasto por aprobar: ' || NEW.concepto,
    format(
      '%s registró un gasto de Q%s. Jornada: %s.',
      COALESCE(v_registrado_por, 'Alguien'),
      trim(to_char(NEW.monto, '999,999,990.00')),
      v_jornada
    ),
    '/presupuestos?tab=aprobaciones',
    'gastos',
    NEW.id
  );

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_notificar_gasto_por_aprobar"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_notificar_gasto_por_aprobar"() IS 'Trigger: avisa a quien aprueba gastos cuando se registra uno pendiente (00138).';


--
-- Name: fn_notificar_medicamento_sin_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_notificar_medicamento_sin_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_fila RECORD;
BEGIN
  FOR v_fila IN
    WITH delta AS (
      SELECT l.medicamento_id, SUM(n.cantidad_disponible - o.cantidad_disponible) AS cambio
      FROM nuevas n
      JOIN viejas o ON o.id = n.id
      JOIN public.lotes l ON l.id = n.lote_id
      GROUP BY l.medicamento_id
      HAVING SUM(n.cantidad_disponible - o.cantidad_disponible) < 0
    ),
    totales AS (
      SELECT
        d.medicamento_id,
        d.cambio,
        (
          SELECT COALESCE(SUM(e.cantidad_disponible), 0)
          FROM public.existencias e
          JOIN public.lotes l ON l.id = e.lote_id
          WHERE l.medicamento_id = d.medicamento_id
        ) AS total_actual
      FROM delta d
    )
    SELECT t.medicamento_id, m.nombre, m.concentracion
    FROM totales t
    JOIN public.medicamentos m ON m.id = t.medicamento_id
    WHERE t.total_actual = 0 AND t.total_actual - t.cambio > 0
  LOOP
    PERFORM public.fn_notificar_administradores(
      'stock',
      'Sin stock: ' || trim(v_fila.nombre || ' ' || COALESCE(v_fila.concentracion, '')),
      format(
        'La existencia total de %s llegó a 0 en todas las bodegas.',
        trim(v_fila.nombre || ' ' || COALESCE(v_fila.concentracion, ''))
      ),
      '/inventario?tab=catalogo',
      'medicamentos',
      v_fila.medicamento_id
    );
  END LOOP;

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_notificar_medicamento_sin_stock"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_notificar_medicamento_sin_stock"() IS 'Trigger: avisa cuando un medicamento se queda sin existencias en todas las bodegas (00138).';


--
-- Name: fn_notificar_movimiento_por_validar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_notificar_movimiento_por_validar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_medicamento TEXT;
  v_numero_lote TEXT;
  v_bodega TEXT;
  v_registrado_por TEXT;
  v_folio TEXT;
BEGIN
  SELECT b.nombre INTO v_bodega FROM public.bodegas b WHERE b.id = NEW.bodega_id;

  SELECT p.nombres || ' ' || p.apellidos INTO v_registrado_por
  FROM public.perfiles p WHERE p.id = NEW.registrado_por;

  IF NEW.receta_id IS NOT NULL AND NEW.tipo = 'salida'
     AND NEW.motivo LIKE 'Entrega por receta medica%' THEN
    SELECT r.folio INTO v_folio FROM public.recetas r WHERE r.id = NEW.receta_id;

    PERFORM public.fn_notificar_administradores(
      'validacion',
      format('Receta por validar: %s', COALESCE(v_folio, 'sin folio')),
      format(
        '%s emitio la receta %s en %s. La salida de sus medicamentos espera aprobacion y se aprueba o rechaza completa.',
        COALESCE(v_registrado_por, 'Alguien'),
        COALESCE(v_folio, 'sin folio'),
        v_bodega
      ),
      '/inventario?tab=validacion',
      'recetas',
      NEW.receta_id
    );
    RETURN NULL;
  END IF;

  SELECT m.nombre, l.numero_lote INTO v_medicamento, v_numero_lote
  FROM public.lotes l
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  WHERE l.id = NEW.lote_id;

  PERFORM public.fn_notificar_administradores(
    'validacion',
    format(
      'Movimiento por validar: %s de %s',
      CASE WHEN NEW.tipo = 'ingreso' THEN 'ingreso' ELSE 'salida' END,
      v_medicamento
    ),
    format(
      '%s registró %s de %s unidades del lote %s en %s. Motivo: %s',
      COALESCE(v_registrado_por, 'Alguien'),
      CASE WHEN NEW.tipo = 'ingreso' THEN 'un ingreso' ELSE 'una salida' END,
      NEW.cantidad,
      v_numero_lote,
      v_bodega,
      NEW.motivo
    ),
    '/inventario?tab=validacion',
    'movimientos_inventario',
    NEW.id
  );

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_notificar_movimiento_por_validar"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_notificar_movimiento_por_validar"() IS 'Trigger: avisa a quien valida movimientos cuando se registra uno pendiente (00138). Desde la 00186 la entrega de una receta avisa una sola vez, por receta, y no una por medicamento.';


--
-- Name: fn_opciones_reporte_enfermedades(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_opciones_reporte_enfermedades"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de enfermedades.'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'jornadas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', x.id, 'nombre', x.nombre, 'fecha', x.fecha, 'comunidad', x.comunidad)
        ORDER BY x.fecha DESC, x.nombre
      )
      FROM (
        SELECT j.id, j.nombre, j.fecha, c.nombre AS comunidad
        FROM public.jornadas j
        JOIN public.comunidades c ON c.id = j.comunidad_id
        WHERE EXISTS (
          SELECT 1
          FROM public.consultas co
          JOIN public.consulta_diagnostico cd ON cd.consulta_id = co.id
          WHERE co.jornada_id = j.id
        )
      ) x
    ), '[]'::jsonb),
    'proyectos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'nombre', pr.nombre) ORDER BY pr.nombre)
      FROM public.proyectos pr
      WHERE EXISTS (SELECT 1 FROM public.jornadas j WHERE j.proyecto_id = pr.id)
    ), '[]'::jsonb),
    'diagnosticos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', d.id, 'codigo', d.codigo, 'nombre', d.nombre)
        ORDER BY d.nombre
      )
      FROM public.diagnosticos d
      WHERE EXISTS (SELECT 1 FROM public.consulta_diagnostico cd WHERE cd.diagnostico_id = d.id)
    ), '[]'::jsonb)
  );
END;
$$;


--
-- Name: FUNCTION "fn_opciones_reporte_enfermedades"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_opciones_reporte_enfermedades"() IS 'Jornadas y diagnosticos con casos, y proyectos con jornadas, para los selectores del reporte de enfermedades. Existe porque los roles consultivos no leen esas tablas por RLS (issue #916, 00177).';


--
-- Name: fn_origen_del_presupuesto_inicial(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_origen_del_presupuesto_inicial"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.presupuesto_asignado > 0 THEN
    INSERT INTO public.jornada_presupuesto_origen (jornada_id, origen, monto, descripcion)
    VALUES (NEW.id, 'sin_clasificar', NEW.presupuesto_asignado,
            'Presupuesto indicado al crear la jornada');
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_origen_del_presupuesto_inicial"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_origen_del_presupuesto_inicial"() IS 'Trigger: una jornada que se crea con presupuesto_asignado mayor que cero registra ese monto como un origen sin_clasificar, para que el asignado siga siendo la suma de sus origenes (00135).';


--
-- Name: fn_paciente_area_area_vigente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_paciente_area_area_vigente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.areas_atencion a WHERE a.id = NEW.area_id AND a.es_vigente
  ) THEN
    RAISE EXCEPTION 'El area esta retirada: ya no se asigna a pacientes.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_paciente_area_area_vigente"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_paciente_area_area_vigente"() IS 'Rechaza asignar a un paciente un area de atencion retirada (00182).';


--
-- Name: fn_pasar_insumo_de_proyecto_a_jornada("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_insumo public.proyecto_insumos%ROWTYPE;
  v_nuevo_id UUID;
BEGIN
  SELECT * INTO v_insumo FROM public.proyecto_insumos WHERE id = p_insumo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El insumo no existe o no tienes permiso para verlo.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jornadas
    WHERE id = p_jornada_id AND proyecto_id = v_insumo.proyecto_id
  ) THEN
    RAISE EXCEPTION 'La jornada no pertenece al proyecto del insumo.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.jornada_insumos
    (jornada_id, medicamento_id, cantidad, unidad, costo_unitario_estimado, nota)
  VALUES
    (p_jornada_id, v_insumo.medicamento_id, v_insumo.cantidad, v_insumo.unidad,
     v_insumo.costo_unitario_estimado, v_insumo.nota)
  RETURNING id INTO v_nuevo_id;

  DELETE FROM public.proyecto_insumos WHERE id = p_insumo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para quitar el insumo del proyecto.'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_nuevo_id;
END;
$$;


--
-- Name: FUNCTION "fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid") IS 'Pasa un insumo previsto a nivel proyecto (proyecto_insumos) a una jornada de ese proyecto (jornada_insumos), en una sola transaccion (00151).';


--
-- Name: fn_proteger_decision_de_movimiento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proteger_decision_de_movimiento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Sin sesion no hay a quien atribuirle nada (seed, migraciones, service_role).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.es_administrador() OR public.tiene_permiso('inventario.aprobar')
     OR public.fn_es_aprobacion_de_sistema() THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION
      'Solo quien aprueba puede cambiar el estado de un movimiento de inventario.';
  END IF;

  IF NEW.aprobado_por IS DISTINCT FROM OLD.aprobado_por
     OR NEW.aprobado_en IS DISTINCT FROM OLD.aprobado_en
     OR NEW.motivo_rechazo IS DISTINCT FROM OLD.motivo_rechazo
     OR NEW.aprobacion_automatica IS DISTINCT FROM OLD.aprobacion_automatica THEN
    RAISE EXCEPTION
      'Solo quien aprueba puede escribir aprobado_por, aprobado_en, motivo_rechazo o aprobacion_automatica.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_proteger_decision_de_movimiento"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proteger_decision_de_movimiento"() IS 'Impide que quien registro un movimiento escriba las columnas que documentan la decision de quien lo aprueba o lo rechaza (issue #625). Desde la 00186 tampoco frena al sistema (fn_es_aprobacion_de_sistema): la anulacion de una receta rechaza sus salidas pendientes.';


--
-- Name: fn_proteger_presupuesto_comprometido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proteger_presupuesto_comprometido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_asignado NUMERIC;
  v_quedaria NUMERIC;
  v_comprometido NUMERIC;
BEGIN
  IF current_setting('ecopac.liquidando_sobrante', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Solo importa si la jornada de OLD pierde dinero.
  IF TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id
     AND (NEW.monto - NEW.devuelto) >= (OLD.monto - OLD.devuelto)
  THEN
    RETURN NEW;
  END IF;

  SELECT j.presupuesto_asignado INTO v_asignado
  FROM public.jornadas j
  WHERE j.id = OLD.jornada_id;

  -- La jornada se esta borrando (ON DELETE CASCADE): no hay presupuesto que proteger.
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_quedaria := v_asignado - (OLD.monto - OLD.devuelto)
    + CASE WHEN TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id
           THEN NEW.monto - NEW.devuelto ELSE 0 END;
  v_comprometido := public.comprometido_de_jornada(OLD.jornada_id);

  IF v_quedaria < v_comprometido THEN
    RAISE EXCEPTION 'La jornada ya tiene Q% comprometidos en gastos: sin este aporte le quedarian Q%.',
      to_char(v_comprometido, 'FM999999990.00'),
      to_char(v_quedaria, 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: FUNCTION "fn_proteger_presupuesto_comprometido"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proteger_presupuesto_comprometido"() IS 'Trigger de jornada_presupuesto_origen (00159): quitar o rebajar un aporte no puede dejar la jornada con menos presupuesto que lo comprometido en gastos.';


--
-- Name: fn_proveedor_sigue_al_donante(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proveedor_sigue_al_donante"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.fn_sincronizar_proveedor_de_donante(NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_proveedor_sigue_al_donante"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proveedor_sigue_al_donante"() IS 'Al registrar un donante o cambiar su nombre o contacto, crea o actualiza su proveedor (00175).';


--
-- Name: fn_proyecto_cancelado_no_se_modifica(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proyecto_cancelado_no_se_modifica"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.estado IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', OLD.estado
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_proyecto_cancelado_no_se_modifica"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proyecto_cancelado_no_se_modifica"() IS 'Rechaza cualquier UPDATE de un proyecto cuyo estado ya es cancelado (00154) o finalizado (00172).';


--
-- Name: fn_proyecto_de_la_fila_no_esta_cancelado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_proyectos UUID[] := ARRAY[]::UUID[];
  v_estado TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_proyectos := array_append(v_proyectos, OLD.proyecto_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_proyectos := array_append(v_proyectos, NEW.proyecto_id);
  END IF;

  SELECT p.estado::TEXT INTO v_estado
  FROM public.proyectos p
  WHERE p.id = ANY (v_proyectos)
    AND p.estado IN ('cancelado', 'finalizado')
  LIMIT 1;

  IF v_estado IS NOT NULL THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', v_estado
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_proyecto_de_la_fila_no_esta_cancelado"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"() IS 'Rechaza escribir una fila que cuelga de un proyecto cancelado (00154) o finalizado (00172): hitos, seguimiento, equipo, insumos previstos y la asociacion de una jornada.';


--
-- Name: fn_proyecto_de_la_jornada_de_la_donacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_proyecto_de_la_jornada_de_la_donacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.jornada_id IS NOT NULL THEN
    SELECT j.proyecto_id INTO NEW.proyecto_id
    FROM public.jornadas j
    WHERE j.id = NEW.jornada_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_proyecto_de_la_jornada_de_la_donacion"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_proyecto_de_la_jornada_de_la_donacion"() IS 'Trigger: si una donacion es para una jornada, su proyecto es el de esa jornada (00153).';


--
-- Name: fn_queda_de_jornada_en_lote("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH bodega AS (
    SELECT j.botiquin_bodega_id AS id
    FROM public.jornadas j
    WHERE j.id = p_jornada_id
  )
  SELECT (
    COALESCE((
      SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE -m.cantidad END)
      FROM public.movimientos_inventario m, bodega
      WHERE m.jornada_id = p_jornada_id
        AND m.lote_id = p_lote_id
        AND m.bodega_id = bodega.id
        AND m.estado = 'aprobado'
    ), 0)
    - COALESCE((
      SELECT SUM(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada))
      FROM public.receta_detalle rd
      JOIN public.recetas r ON r.id = rd.receta_id
      JOIN public.consultas c ON c.id = r.consulta_id
      JOIN public.atenciones a ON a.id = c.atencion_id
      WHERE a.jornada_id = p_jornada_id
        AND r.estado = 'emitida'
        AND rd.lote_id = p_lote_id
    ), 0)
  )::INT;
$$;


--
-- Name: FUNCTION "fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid") IS 'Lo que le queda a una jornada de un lote en su bodega: cargado - entregado - devuelto (00186, issue #925). Entregado cuenta las recetas emitidas aunque su salida siga pendiente.';


--
-- Name: fn_reclamar_correos_de_notificaciones(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_reclamar_correos_de_notificaciones"("p_limite" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "email" "text", "nombres" "text", "categoria" "public"."categoria_notificacion", "titulo" "text", "cuerpo" "text", "enlace" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH reclamadas AS (
    UPDATE public.notificaciones n
    SET correo_intentado_en = NOW()
    WHERE n.id IN (
      SELECT c.id
      FROM public.notificaciones c
      WHERE c.correo_enviado_en IS NULL
        AND (c.correo_intentado_en IS NULL OR c.correo_intentado_en < NOW() - INTERVAL '15 minutes')
      ORDER BY c.created_at
      LIMIT p_limite
      FOR UPDATE SKIP LOCKED
    )
    RETURNING n.id, n.perfil_id, n.categoria, n.titulo, n.cuerpo, n.enlace, n.created_at
  )
  SELECT r.id, p.email::TEXT, p.nombres::TEXT, r.categoria, r.titulo, r.cuerpo, r.enlace,
    r.created_at
  FROM reclamadas r
  JOIN public.perfiles p ON p.id = r.perfil_id
  ORDER BY r.created_at;
$$;


--
-- Name: FUNCTION "fn_reclamar_correos_de_notificaciones"("p_limite" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_reclamar_correos_de_notificaciones"("p_limite" integer) IS 'Marca como en curso hasta p_limite notificaciones sin correo enviado, en orden de llegada, y las devuelve con el correo de su destinatario (issue #755). Solo service_role.';


--
-- Name: fn_registrar_donacion("uuid", "public"."tipo_donacion", "date", "jsonb", "uuid", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid" DEFAULT NULL::"uuid", "p_observaciones" "text" DEFAULT NULL::"text", "p_jornada_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_donacion public.donaciones;
  v_renglon JSONB;
  v_detalle_id UUID;
  v_ids_detalle JSONB := '[]'::JSONB;
  v_medicamento_id UUID;
  v_medicamento public.medicamentos;
  v_descripcion TEXT;
  v_unidad TEXT;
  -- Que tipo de articulo del catalogo lleva cada renglon, o NULL si el tipo de donacion no usa
  -- catalogo (dinero, servicios).
  v_tipo_articulo public.tipo_articulo := CASE p_tipo
    WHEN 'medicamentos' THEN 'medicamento'::public.tipo_articulo
    WHEN 'insumos' THEN 'insumo'::public.tipo_articulo
  END;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una donacion necesita al menos un renglon de detalle.';
  END IF;

  INSERT INTO public.donaciones (
    donante_id, proyecto_id, jornada_id, tipo, fecha, observaciones, registrado_por
  )
  VALUES (
    p_donante_id, p_proyecto_id, p_jornada_id, p_tipo, p_fecha, p_observaciones, auth.uid()
  )
  RETURNING * INTO v_donacion;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_medicamento_id := NULLIF(v_renglon ->> 'medicamentoId', '')::UUID;
    v_descripcion := v_renglon ->> 'descripcion';
    v_unidad := v_renglon ->> 'unidad';

    IF v_tipo_articulo IS NOT NULL THEN
      IF v_medicamento_id IS NULL THEN
        RAISE EXCEPTION 'Cada renglon de una donacion de % tiene que elegir un articulo del catalogo.', p_tipo
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT * INTO v_medicamento FROM public.medicamentos WHERE id = v_medicamento_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El articulo elegido no existe en el catalogo.'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF v_medicamento.tipo_articulo <> v_tipo_articulo THEN
        RAISE EXCEPTION 'Una donacion de % solo lleva articulos de tipo %.', p_tipo, v_tipo_articulo
          USING ERRCODE = 'check_violation';
      END IF;

      -- El catalogo manda: lo que el cliente haya mandado como texto se ignora. Un insumo no
      -- tiene concentracion (00164): concat_ws la salta.
      v_descripcion := concat_ws(' ', v_medicamento.nombre, v_medicamento.concentracion);
      SELECT nombre INTO v_unidad FROM public.presentaciones WHERE id = v_medicamento.presentacion_id;
    ELSIF v_medicamento_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo una donacion de medicamentos o de insumos lleva un articulo del catalogo.'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.donacion_detalle (
      donacion_id, descripcion, cantidad, unidad, monto, medicamento_id
    )
    VALUES (
      v_donacion.id,
      v_descripcion,
      NULLIF(v_renglon ->> 'cantidad', '')::NUMERIC,
      v_unidad,
      NULLIF(v_renglon ->> 'monto', '')::NUMERIC,
      v_medicamento_id
    )
    RETURNING id INTO v_detalle_id;

    v_ids_detalle := v_ids_detalle || to_jsonb(v_detalle_id);
  END LOOP;

  RETURN jsonb_build_object('donacion', to_jsonb(v_donacion), 'detalleIds', v_ids_detalle);
END;
$$;


--
-- Name: FUNCTION "fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid") IS 'Registra una donacion con sus renglones en una transaccion. En medicamentos e insumos cada renglon elige un articulo del catalogo de su mismo tipo, y la descripcion y la unidad salen de el (00135, 00170).';


--
-- Name: medicamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."medicamentos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "concentracion" character varying(100),
    "marca" character varying(100) NOT NULL,
    "forma_farmaceutica" character varying(100),
    "es_pediatrico" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "tipo_articulo" "public"."tipo_articulo" DEFAULT 'medicamento'::"public"."tipo_articulo" NOT NULL,
    "presentacion_id" "uuid" NOT NULL
);


--
-- Name: TABLE "medicamentos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."medicamentos" IS 'Catalogo de articulos del inventario: medicamentos e insumos. Un articulo se desactiva, no se borra.';


--
-- Name: COLUMN "medicamentos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "medicamentos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."nombre" IS 'Nombre del articulo.';


--
-- Name: COLUMN "medicamentos"."concentracion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."concentracion" IS 'Concentracion del medicamento (500 mg). Obligatoria para un medicamento; un insumo no la tiene y queda en NULL (00164).';


--
-- Name: COLUMN "medicamentos"."marca"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."marca" IS 'Marca o laboratorio.';


--
-- Name: COLUMN "medicamentos"."forma_farmaceutica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."forma_farmaceutica" IS 'Forma farmaceutica (tableta, jarabe, ...). Se captura pero la presentacion la da presentacion_id.';


--
-- Name: COLUMN "medicamentos"."es_pediatrico"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."es_pediatrico" IS 'TRUE si es de uso pediatrico.';


--
-- Name: COLUMN "medicamentos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "medicamentos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "medicamentos"."activo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."activo" IS 'FALSE = desactivado: ya no se ofrece al registrar, pero conserva su historial.';


--
-- Name: COLUMN "medicamentos"."tipo_articulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."tipo_articulo" IS 'Medicamento o insumo.';


--
-- Name: COLUMN "medicamentos"."presentacion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamentos"."presentacion_id" IS 'Presentacion (caja, frasco, sobre, ...), del catalogo presentaciones.';


--
-- Name: fn_registrar_medicamento(character varying, character varying, "uuid", character varying, "uuid"[], character varying, boolean, "public"."tipo_articulo"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying DEFAULT NULL::character varying, "p_es_pediatrico" boolean DEFAULT false, "p_tipo_articulo" "public"."tipo_articulo" DEFAULT 'medicamento'::"public"."tipo_articulo") RETURNS "public"."medicamentos"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_medicamento public.medicamentos;
  v_principio_id UUID;
  v_es_medicamento BOOLEAN := p_tipo_articulo = 'medicamento';
BEGIN
  IF v_es_medicamento AND (p_principios_ids IS NULL OR array_length(p_principios_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'Un medicamento debe registrarse con al menos un principio activo.'
      USING ERRCODE = '23514';
  END IF;

  -- Un insumo no guarda datos farmacologicos aunque lleguen.
  INSERT INTO public.medicamentos (
    nombre, concentracion, presentacion_id, marca, forma_farmaceutica, es_pediatrico,
    tipo_articulo
  )
  VALUES (
    p_nombre,
    CASE WHEN v_es_medicamento THEN p_concentracion END,
    p_presentacion_id,
    p_marca,
    CASE WHEN v_es_medicamento THEN p_forma_farmaceutica END,
    v_es_medicamento AND coalesce(p_es_pediatrico, false),
    p_tipo_articulo
  )
  RETURNING * INTO v_medicamento;

  IF v_es_medicamento THEN
    FOREACH v_principio_id IN ARRAY p_principios_ids LOOP
      INSERT INTO public.medicamento_principio (medicamento_id, principio_id)
      VALUES (v_medicamento.id, v_principio_id);
    END LOOP;
  END IF;

  RETURN v_medicamento;
END;
$$;


--
-- Name: FUNCTION "fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo") IS 'Registra un articulo del catalogo en una transaccion. Un medicamento exige al menos un principio activo y su concentracion; un insumo no guarda principio, concentracion, forma farmaceutica ni uso pediatrico (00164).';


--
-- Name: fn_registrar_paciente(character varying, character varying, "date", character varying, "uuid", character varying, character varying, character varying, "public"."tipo_sanguineo", character varying, character varying, "uuid"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying DEFAULT NULL::character varying, "p_tipo_sangre" "public"."tipo_sanguineo" DEFAULT NULL::"public"."tipo_sanguineo", "p_nombre_responsable" character varying DEFAULT NULL::character varying, "p_parentesco_responsable" character varying DEFAULT NULL::character varying, "p_area_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "nombres" character varying, "apellidos" character varying, "fecha_nacimiento" "date", "sexo" character varying, "comunidad_id" "uuid", "telefono_contacto" character varying, "idioma" character varying, "dpi" character varying, "tipo_sangre" "public"."tipo_sanguineo", "nombre_responsable" character varying, "parentesco_responsable" character varying, "fecha_baja" "date", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "numero_ficha" character varying)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_paciente public.pacientes;
  v_expediente public.expedientes;
BEGIN
  INSERT INTO public.pacientes (
    nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma,
    dpi, tipo_sangre, nombre_responsable, parentesco_responsable
  )
  VALUES (
    p_nombres, p_apellidos, p_fecha_nacimiento, p_sexo::public.sexo_paciente, p_comunidad_id,
    p_telefono_contacto, p_idioma, p_dpi, p_tipo_sangre, p_nombre_responsable,
    p_parentesco_responsable
  )
  RETURNING * INTO v_paciente;

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval de la 00081) lo genera aqui.
  INSERT INTO public.expedientes (paciente_id)
  VALUES (v_paciente.id)
  RETURNING * INTO v_expediente;

  -- 00182: las areas, en la misma transaccion. DISTINCT porque un id repetido chocaria con la PK.
  IF p_area_ids IS NOT NULL AND cardinality(p_area_ids) > 0 THEN
    INSERT INTO public.paciente_area (paciente_id, area_id)
    SELECT DISTINCT v_paciente.id, area FROM unnest(p_area_ids) AS area;
  END IF;

  RETURN QUERY SELECT
    v_paciente.id, v_paciente.nombres, v_paciente.apellidos, v_paciente.fecha_nacimiento,
    v_paciente.sexo::VARCHAR, v_paciente.comunidad_id, v_paciente.telefono_contacto,
    v_paciente.idioma, v_paciente.dpi, v_paciente.tipo_sangre, v_paciente.nombre_responsable,
    v_paciente.parentesco_responsable, v_paciente.fecha_baja, v_paciente.created_at,
    v_paciente.updated_at, v_expediente.numero_ficha;
END;
$$;


--
-- Name: FUNCTION "fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]) IS 'Inserta un paciente, su expediente y sus areas de atencion (p_area_ids, 00182) en una sola transaccion. numero_ficha lo genera el DEFAULT de expedientes (nextval, 00081), asi que dos dispositivos registrando a la vez no colisionan. No es SECURITY DEFINER: las politicas de INSERT de pacientes, expedientes (00032) y paciente_area (00182) deciden quien puede llamarla. p_idioma es un codigo del catalogo idiomas (issue #663).';


--
-- Name: fn_registrar_salida_a_cuenta_de_jornada("uuid", "uuid", integer, "text", "uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_de_la_jornada INT := 0;
  v_registrado_por UUID := COALESCE(p_registrado_por, auth.uid());
BEGIN
  IF p_jornada_id IS NOT NULL THEN
    v_de_la_jornada := LEAST(
      p_cantidad,
      GREATEST(0, public.fn_queda_de_jornada_en_lote(p_jornada_id, p_lote_id))
    );
  END IF;

  IF v_de_la_jornada > 0 THEN
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_id, v_de_la_jornada, p_motivo, v_registrado_por, p_jornada_id);
  END IF;

  IF p_cantidad - v_de_la_jornada > 0 THEN
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_id, p_cantidad - v_de_la_jornada, p_motivo, v_registrado_por, NULL);
  END IF;
END;
$$;


--
-- Name: FUNCTION "fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid") IS 'Saca p_cantidad de una bodega movil: a cuenta de p_jornada_id hasta lo que le queda de ese lote, y el resto sin jornada (00186). p_registrado_por, si viene, reemplaza a auth.uid() (el traspaso iniciado sin sesion).';


--
-- Name: fn_registrar_salida_de_caja(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_registrar_salida_de_caja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.origen = 'caja' AND OLD.traspasado_desde IS NULL
     AND (NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL) THEN
    DELETE FROM public.movimientos_de_caja WHERE aporte_id = NEW.id AND tipo = 'salida';
    RETURN NEW;
  END IF;

  IF NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT j.nombre INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  INSERT INTO public.movimientos_de_caja
    (tipo, monto, aporte_id, jornada_id, descripcion, registrado_por)
  VALUES
    ('salida', NEW.monto, NEW.id, NEW.jornada_id, 'Aporte a la jornada ' || v_jornada,
     NEW.registrado_por)
  ON CONFLICT (aporte_id) WHERE tipo = 'salida'
  DO UPDATE SET monto = EXCLUDED.monto, jornada_id = EXCLUDED.jornada_id,
                descripcion = EXCLUDED.descripcion;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_registrar_salida_de_caja"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_registrar_salida_de_caja"() IS 'Trigger de jornada_presupuesto_origen (00168): un aporte con origen caja deja su salida en movimientos_de_caja.';


--
-- Name: fn_reporte_enfermedades("text", "date", "date", "uuid"[], "uuid"[], integer, integer, "uuid", "uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_reporte_enfermedades"("p_agrupar_por" "text" DEFAULT 'ninguno'::"text", "p_desde" "date" DEFAULT NULL::"date", "p_hasta" "date" DEFAULT NULL::"date", "p_jornada_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_comunidad_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_municipio_id" integer DEFAULT NULL::integer, "p_departamento_id" integer DEFAULT NULL::integer, "p_proyecto_id" "uuid" DEFAULT NULL::"uuid", "p_diagnostico_id" "uuid" DEFAULT NULL::"uuid", "p_solo_principales" boolean DEFAULT true, "p_comunidad_de" "text" DEFAULT 'jornada'::"text") RETURNS TABLE("grupo_id" "text", "grupo" "text", "grupo_fecha" "date", "diagnostico_id" "uuid", "codigo" "text", "diagnostico" "text", "orden_diagnostico" integer, "casos" integer, "hombres" integer, "mujeres" integer, "menores" integer, "adultos" integer, "adultos_mayores" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de enfermedades.'
      USING ERRCODE = '42501';
  END IF;

  IF p_agrupar_por IS NULL OR p_agrupar_por NOT IN ('ninguno', 'jornada', 'comunidad', 'mes') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use ninguno, jornada, comunidad o mes.', p_agrupar_por
      USING ERRCODE = '22023';
  END IF;

  IF p_comunidad_de IS NULL OR p_comunidad_de NOT IN ('jornada', 'paciente') THEN
    RAISE EXCEPTION 'Comunidad no valida: %. Use jornada o paciente.', p_comunidad_de
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH casos_base AS (
    -- Una fila por diagnostico registrado en una consulta. La UNIQUE (consulta_id,
    -- diagnostico_id) garantiza que una consulta no cuenta dos veces la misma enfermedad.
    SELECT
      d.id AS d_id,
      d.codigo::TEXT AS d_codigo,
      d.nombre::TEXT AS d_nombre,
      j.id AS j_id,
      j.nombre::TEXT AS j_nombre,
      j.fecha AS j_fecha,
      com.id AS c_id,
      com.nombre::TEXT AS c_nombre,
      p.sexo::TEXT AS sexo,
      -- La edad a la fecha de la jornada, como en fn_reporte_pacientes_atendidos.
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad
    FROM public.consulta_diagnostico cd
    JOIN public.consultas co ON co.id = cd.consulta_id
    JOIN public.expedientes e ON e.id = co.expediente_id
    JOIN public.pacientes p ON p.id = e.paciente_id
    JOIN public.jornadas j ON j.id = co.jornada_id
    JOIN public.diagnosticos d ON d.id = cd.diagnostico_id
    -- La comunidad que se eligio: donde se atendio, o de donde viene el paciente (la de la
    -- jornada si el paciente no tiene, igual que vista_reporte_impacto_por_comunidad).
    JOIN public.comunidades com ON com.id = CASE
      WHEN p_comunidad_de = 'paciente' THEN COALESCE(p.comunidad_id, j.comunidad_id)
      ELSE j.comunidad_id
    END
    JOIN public.municipios m ON m.id = com.municipio_id
    WHERE (NOT p_solo_principales OR cd.es_principal)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
      AND (p_jornada_ids IS NULL OR cardinality(p_jornada_ids) = 0 OR j.id = ANY (p_jornada_ids))
      AND (p_comunidad_ids IS NULL OR cardinality(p_comunidad_ids) = 0 OR com.id = ANY (p_comunidad_ids))
      AND (p_municipio_id IS NULL OR m.id = p_municipio_id)
      AND (p_departamento_id IS NULL OR m.departamento_id = p_departamento_id)
      AND (p_proyecto_id IS NULL OR j.proyecto_id = p_proyecto_id)
      AND (p_diagnostico_id IS NULL OR d.id = p_diagnostico_id)
  ),
  agrupados AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_id::TEXT
        WHEN 'comunidad' THEN cb.c_id::TEXT
        WHEN 'mes' THEN to_char(cb.j_fecha, 'YYYY-MM')
        ELSE 'todo'
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_nombre
        WHEN 'comunidad' THEN cb.c_nombre
        WHEN 'mes' THEN to_char(cb.j_fecha, 'YYYY-MM')
        ELSE 'Todo el período'
      END AS g_nombre,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_fecha
        WHEN 'mes' THEN date_trunc('month', cb.j_fecha)::DATE
        ELSE NULL
      END AS g_fecha,
      cb.d_id,
      cb.d_codigo,
      cb.d_nombre,
      count(*)::INT AS n,
      count(*) FILTER (WHERE cb.sexo = 'Masculino')::INT AS n_hombres,
      count(*) FILTER (WHERE cb.sexo = 'Femenino')::INT AS n_mujeres,
      count(*) FILTER (WHERE cb.edad < 18)::INT AS n_menores,
      count(*) FILTER (WHERE cb.edad BETWEEN 18 AND 59)::INT AS n_adultos,
      count(*) FILTER (WHERE cb.edad >= 60)::INT AS n_mayores
    FROM casos_base cb
    GROUP BY 1, 2, 3, cb.d_id, cb.d_codigo, cb.d_nombre
  ),
  ranking AS (
    -- El puesto de cada enfermedad en todo el recorte: las vistas comparativas eligen con el las
    -- mas frecuentes para el eje de la grafica.
    SELECT
      cb.d_id,
      row_number() OVER (ORDER BY count(*) DESC, cb.d_nombre, cb.d_id)::INT AS puesto
    FROM casos_base cb
    GROUP BY cb.d_id, cb.d_nombre
  )
  SELECT
    a.g_id,
    a.g_nombre,
    a.g_fecha,
    a.d_id,
    a.d_codigo,
    a.d_nombre,
    r.puesto,
    a.n,
    a.n_hombres,
    a.n_mujeres,
    a.n_menores,
    a.n_adultos,
    a.n_mayores
  FROM agrupados a
  JOIN ranking r ON r.d_id = a.d_id
  -- Dentro de un grupo, de la enfermedad con mas casos a la de menos; el nombre desempata.
  ORDER BY a.g_fecha NULLS LAST, a.g_nombre, a.n DESC, a.d_nombre;
END;
$$;


--
-- Name: FUNCTION "fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text") IS 'Casos por diagnostico del catalogo, agrupados por nada, jornada, comunidad (de la jornada o del paciente) o mes, con desglose por sexo y edad. Solo conteos agregados, siempre con su numero real; ninguna fila por paciente (issue #916, 00177; sin supresion desde la issue #926, 00180).';


--
-- Name: fn_reporte_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_reporte_jornada"("p_jornada_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_reporte JSONB;
BEGIN
  IF NOT (public.puede_consultar_reportes() OR public.rol_actual() = 'medico') THEN
    RAISE EXCEPTION 'Solo administracion, el medico y quien consulta reportes ve el reporte de una jornada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'jornada', jsonb_build_object(
      'id', j.id,
      'nombre', j.nombre,
      'fecha', j.fecha,
      'estado', j.estado,
      'comunidad', jsonb_build_object('id', c.id, 'nombre', c.nombre)
    ),
    'resumen', jsonb_build_object(
      'total_consultas',
      (SELECT count(*) FROM public.consultas co WHERE co.jornada_id = j.id),
      'pacientes_atendidos',
      (SELECT count(DISTINCT e.paciente_id)
         FROM public.consultas co
         JOIN public.expedientes e ON e.id = co.expediente_id
        WHERE co.jornada_id = j.id)
    ),
    'diagnosticos_mas_frecuentes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('diagnostico', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT d.nombre, count(*) AS cantidad
        FROM public.consultas co
        JOIN public.consulta_diagnostico cd ON cd.consulta_id = co.id
        JOIN public.diagnosticos d ON d.id = cd.diagnostico_id
        WHERE co.jornada_id = j.id
        GROUP BY d.nombre
      ) x
    ), '[]'::jsonb),
    'medicamentos_mas_entregados', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('medicamento', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT COALESCE(m.nombre, 'Sin nombre') AS nombre,
               sum(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada, 0)) AS cantidad
        FROM public.consultas co
        JOIN public.recetas r ON r.consulta_id = co.id AND r.estado = 'emitida'
        JOIN public.receta_detalle rd ON rd.receta_id = r.id
        LEFT JOIN public.medicamentos m ON m.id = rd.medicamento_id
        WHERE co.jornada_id = j.id
        GROUP BY COALESCE(m.nombre, 'Sin nombre')
      ) x
    ), '[]'::jsonb),
    'personal_participante', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'usuario_id', x.medico_id,
          'nombre', x.nombre,
          'total_atenciones', x.cantidad
        )
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT co.medico_id,
               NULLIF(trim(concat_ws(' ', pe.nombres, pe.apellidos)), '') AS nombre,
               count(*) AS cantidad
        FROM public.consultas co
        LEFT JOIN public.perfiles pe ON pe.id = co.medico_id
        WHERE co.jornada_id = j.id
        GROUP BY co.medico_id, pe.nombres, pe.apellidos
      ) x
    ), '[]'::jsonb)
  )
  INTO v_reporte
  FROM public.jornadas j
  JOIN public.comunidades c ON c.id = j.comunidad_id
  WHERE j.id = p_jornada_id;

  RETURN v_reporte;
END;
$$;


--
-- Name: FUNCTION "fn_reporte_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_reporte_jornada"("p_jornada_id" "uuid") IS 'Reporte de una jornada: resumen, diagnosticos, medicamentos mas entregados y personal (00148). Desde la 00186 lo entregado es de las recetas emitidas, con la cantidad ajustada si la hay.';


--
-- Name: fn_reporte_pacientes_atendidos("text", "uuid", "uuid", "date", "date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_reporte_pacientes_atendidos"("p_agrupar_por" "text" DEFAULT 'jornada'::"text", "p_jornada_id" "uuid" DEFAULT NULL::"uuid", "p_comunidad_id" "uuid" DEFAULT NULL::"uuid", "p_desde" "date" DEFAULT NULL::"date", "p_hasta" "date" DEFAULT NULL::"date") RETURNS TABLE("grupo_id" "text", "grupo" "text", "pacientes" integer, "nuevos" integer, "recurrentes" integer, "hombres" integer, "mujeres" integer, "menores" integer, "adultos" integer, "adultos_mayores" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de pacientes atendidos.';
  END IF;

  IF p_agrupar_por NOT IN ('jornada', 'comunidad', 'periodo') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use jornada, comunidad o periodo.', p_agrupar_por;
  END IF;

  RETURN QUERY
  WITH atendidos AS (
    SELECT
      a.paciente_id,
      j.id AS jornada_id,
      j.nombre AS jornada_nombre,
      j.fecha AS jornada_fecha,
      c.id AS comunidad_id,
      c.nombre AS comunidad_nombre,
      p.sexo::TEXT AS sexo,
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad
    FROM public.atenciones a
    JOIN public.jornadas j ON j.id = a.jornada_id
    JOIN public.pacientes p ON p.id = a.paciente_id
    -- 00155: la comunidad del paciente; la de la jornada solo si el paciente no tiene.
    JOIN public.comunidades c ON c.id = COALESCE(p.comunidad_id, j.comunidad_id)
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Sin cambios desde la 00132: nuevo es "primera jornada en la que se le atendio".
  clasificados AS (
    SELECT DISTINCT ON (t.paciente_id, t.jornada_id)
      t.*,
      NOT EXISTS (
        SELECT 1
        FROM public.atenciones previa
        JOIN public.jornadas jp ON jp.id = previa.jornada_id
        WHERE previa.paciente_id = t.paciente_id
          AND jp.fecha < t.jornada_fecha
      ) AS es_nuevo
    FROM atendidos t
  ),
  por_grupo AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_id::TEXT
        WHEN 'comunidad' THEN cl.comunidad_id::TEXT
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_nombre
        WHEN 'comunidad' THEN cl.comunidad_nombre
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_nombre,
      cl.paciente_id,
      bool_or(cl.es_nuevo) AS es_nuevo,
      min(cl.sexo) AS sexo,
      min(cl.edad) AS edad
    FROM clasificados cl
    GROUP BY 1, 2, cl.paciente_id
  )
  SELECT
    pg.g_id,
    pg.g_nombre,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE NOT pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE pg.sexo = 'Masculino')::INT,
    COUNT(*) FILTER (WHERE pg.sexo = 'Femenino')::INT,
    COUNT(*) FILTER (WHERE pg.edad < 18)::INT,
    COUNT(*) FILTER (WHERE pg.edad BETWEEN 18 AND 59)::INT,
    COUNT(*) FILTER (WHERE pg.edad >= 60)::INT
  FROM por_grupo pg
  GROUP BY pg.g_id, pg.g_nombre
  ORDER BY pg.g_nombre;
END;
$$;


--
-- Name: FUNCTION "fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date") IS 'Pacientes atendidos agregados por jornada, comunidad o mes, con el desglose por sexo y por rango de edad y la distincion entre pacientes nuevos y recurrentes (issue #202, RF-31). Cuenta pacientes distintos, no atenciones: dos atenciones del mismo paciente en la misma jornada son un solo paciente atendido. La edad se calcula a la fecha de la jornada, no a la de hoy, para que un reporte de hace tres anios no envejezca con el tiempo. SECURITY DEFINER con guarda de rol explicita: los roles consultivos no tienen politica de SELECT sobre pacientes (00032) y esta funcion necesita sexo y fecha_nacimiento para los desgloses. Devuelve UNICAMENTE agregados: ninguna fila del resultado identifica a un paciente, que es la regla que fija la 00054 (issue #407). La 00095 corrigio dos errores de calculo (issue #596): el sexo se comparaba contra la inicial cuando la columna guardaba la palabra completa, asi que hombres y mujeres salian en cero; y un paciente recurrente contaba como nuevo en todos sus grupos. La 00132 (issue #699) retira el parche que dejo la 00095: con sexo convertido en el enum sexo_paciente, el desglose vuelve a compararse por igualdad y no por la inicial con LIKE.';


--
-- Name: fn_saldo_de_caja_sin_filtro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_saldo_de_caja_sin_filtro"() RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.monto ELSE -m.monto END), 0)
  FROM public.movimientos_de_caja m;
$$;


--
-- Name: FUNCTION "fn_saldo_de_caja_sin_filtro"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_saldo_de_caja_sin_filtro"() IS 'Saldo de la caja sin pasar por RLS (00168). Solo la usan los triggers; la pantalla lee saldo_de_caja().';


--
-- Name: fn_sincronizar_alertas_caducidad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_sincronizar_alertas_caducidad"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_creadas INT;
BEGIN
  IF NOT (public.es_administrador() OR public.tiene_permiso('inventario.configurar_alertas')) THEN
    RAISE EXCEPTION 'Solo administracion puede sincronizar las alertas de caducidad.'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.fn_generar_alertas_caducidad() INTO v_creadas;
  RETURN v_creadas;
END;
$$;


--
-- Name: FUNCTION "fn_sincronizar_alertas_caducidad"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_sincronizar_alertas_caducidad"() IS 'Ejecuta fn_generar_alertas_caducidad() a peticion de la administracion o de quien tenga inventario.configurar_alertas, para no depender de cuando corrio la rutina programada (issues #838 y #899). Devuelve cuantas alertas nuevas creo. Sin ese rol o permiso lanza 42501.';


--
-- Name: fn_sincronizar_presupuesto_de_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada_id UUID;
BEGIN
  -- Un UPDATE que mueve el origen de una jornada a otra tiene que recalcular las dos.
  FOR v_jornada_id IN
    SELECT DISTINCT unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.jornada_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.jornada_id END
    ])
  LOOP
    CONTINUE WHEN v_jornada_id IS NULL;

    PERFORM set_config('ecopac.sincronizando_presupuesto', 'on', true);
    UPDATE public.jornadas j
    SET presupuesto_asignado = (
      SELECT COALESCE(SUM(o.monto - o.devuelto), 0)
      FROM public.jornada_presupuesto_origen o
      WHERE o.jornada_id = v_jornada_id
    )
    WHERE j.id = v_jornada_id;
    PERFORM set_config('ecopac.sincronizando_presupuesto', 'off', true);
  END LOOP;

  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_sincronizar_presupuesto_de_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"() IS 'Mantiene jornadas.presupuesto_asignado igual a la suma de sus filas de jornada_presupuesto_origen (issue #840). Es la unica via que escribe esa columna.';


--
-- Name: fn_sincronizar_proveedor_de_donante("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_donante public.donantes;
  v_proveedor_id UUID;
  v_nombre TEXT;
  v_contacto TEXT;
BEGIN
  SELECT * INTO v_donante FROM public.donantes WHERE id = p_donante_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_contacto := LEFT(
    NULLIF(concat_ws(' · ', v_donante.contacto, v_donante.telefono, v_donante.email::TEXT), ''),
    150
  );

  SELECT id INTO v_proveedor_id FROM public.proveedores WHERE donante_id = p_donante_id;

  -- Sin proveedor enlazado, adopta el proveedor donante suelto del mismo nombre, si lo hay.
  IF v_proveedor_id IS NULL THEN
    SELECT id INTO v_proveedor_id
    FROM public.proveedores
    WHERE tipo = 'donante'
      AND donante_id IS NULL
      AND lower(public.f_unaccent(trim(nombre))) = lower(public.f_unaccent(trim(v_donante.nombre)))
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- proveedores.nombre es UNIQUE: si un proveedor comercial ya tiene ese nombre, el del donante
  -- se distingue con un sufijo en vez de fallar.
  v_nombre := v_donante.nombre;
  IF EXISTS (
    SELECT 1 FROM public.proveedores
    WHERE nombre = v_nombre AND id IS DISTINCT FROM v_proveedor_id
  ) THEN
    v_nombre := LEFT(v_donante.nombre, 139) || ' (donante)';
  END IF;

  IF v_proveedor_id IS NULL THEN
    INSERT INTO public.proveedores (nombre, contacto, tipo, donante_id)
    VALUES (v_nombre, v_contacto, 'donante', p_donante_id)
    RETURNING id INTO v_proveedor_id;
  ELSE
    UPDATE public.proveedores
    SET nombre = v_nombre,
        contacto = v_contacto,
        tipo = 'donante',
        donante_id = p_donante_id
    WHERE id = v_proveedor_id;
  END IF;

  RETURN v_proveedor_id;
END;
$$;


--
-- Name: FUNCTION "fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid") IS 'Crea o actualiza el proveedor de tipo donante de un donante, con su mismo nombre y su contacto (00175).';


--
-- Name: fn_texto_de_hora_guatemala(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT to_char(p_momento AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI');
$$;


--
-- Name: FUNCTION "fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone) IS 'Fecha y hora en America/Guatemala (DD/MM/YYYY HH24:MI) para los mensajes de la agenda (00184).';


--
-- Name: fn_trasladar_entre_bodegas("uuid", "uuid", "uuid", integer, "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text" DEFAULT NULL::"text", "p_jornada_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_vence DATE;
  v_disponible INT;
  v_motivo TEXT;
  v_ingreso_id UUID;
  v_origen RECORD;
  v_destino RECORD;
  v_bodega_de_la_jornada UUID;
  v_jornada_ingreso UUID;
  v_jornada_salida UUID;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora traslada inventario entre bodegas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a trasladar tiene que ser mayor que cero.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_bodega_origen_id IS NULL OR p_bodega_destino_id IS NULL
     OR p_bodega_origen_id = p_bodega_destino_id THEN
    RAISE EXCEPTION 'Un traslado sale de una bodega y entra a otra distinta.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT b.nombre, (b.es_movil AND NOT b.es_principal) AS es_movil INTO v_destino
  FROM public.bodegas b WHERE b.id = p_bodega_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bodega destino no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT b.nombre, (b.es_movil AND NOT b.es_principal) AS es_movil INTO v_origen
  FROM public.bodegas b WHERE b.id = p_bodega_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La bodega de origen no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote indicado no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_vence IS NOT NULL AND v_vence < CURRENT_DATE THEN
    RAISE EXCEPTION 'El lote vencio el %: se da de baja desde su alerta, no se traslada.', v_vence
      USING ERRCODE = 'check_violation';
  END IF;

  -- El bloqueo es el de la 00179; lo disponible ahora descuenta lo comprometido.
  PERFORM 1 FROM public.existencias e
  WHERE e.lote_id = p_lote_id AND e.bodega_id = p_bodega_origen_id
  FOR UPDATE;

  v_disponible := public.fn_disponible_neto(p_lote_id, p_bodega_origen_id);

  IF v_disponible < p_cantidad THEN
    RAISE EXCEPTION 'Existencia insuficiente en %. Disponible: %, solicitado: %.',
      v_origen.nombre, GREATEST(v_disponible, 0), p_cantidad
      USING ERRCODE = 'check_violation';
  END IF;

  v_motivo := COALESCE(
    NULLIF(btrim(p_motivo), ''),
    'Traslado de ' || v_origen.nombre || ' a ' || v_destino.nombre
  );

  IF p_jornada_id IS NOT NULL THEN
    SELECT j.botiquin_bodega_id INTO v_bodega_de_la_jornada
    FROM public.jornadas j WHERE j.id = p_jornada_id;
  END IF;

  v_jornada_ingreso := CASE
    WHEN NOT v_destino.es_movil THEN p_jornada_id
    WHEN v_bodega_de_la_jornada = p_bodega_destino_id THEN p_jornada_id
    ELSE public.fn_jornada_en_curso_de_bodega(p_bodega_destino_id)
  END;

  v_jornada_salida := CASE
    WHEN NOT v_origen.es_movil THEN p_jornada_id
    WHEN v_bodega_de_la_jornada = p_bodega_origen_id THEN p_jornada_id
    ELSE public.fn_jornada_duena_de_bodega(p_bodega_origen_id)
  END;

  -- Primero el ingreso y despues la salida (00143): al reves, el total del articulo pasaria por
  -- cero y trg_existencias_notificar_sin_stock avisaria de un "sin stock" falso.
  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES ('ingreso', p_lote_id, p_bodega_destino_id, p_cantidad, v_motivo, auth.uid(), v_jornada_ingreso)
  RETURNING id INTO v_ingreso_id;

  IF v_origen.es_movil THEN
    PERFORM public.fn_registrar_salida_a_cuenta_de_jornada(
      p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, v_jornada_salida
    );
  ELSE
    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('salida', p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, auth.uid(), v_jornada_salida);
  END IF;

  RETURN v_ingreso_id;
END;
$$;


--
-- Name: FUNCTION "fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid") IS 'Traslada p_cantidad de un lote de una bodega a otra: un ingreso en la destino y la salida del origen, aprobados y en una transaccion (00179). Solo la administradora. Desde la 00186 compara con lo disponible neto y registra cada lado movil en su jornada: el ingreso en la jornada indicada o en la que tiene la bodega en curso; la salida en la indicada o en la duena, hasta lo que le queda. Devuelve el id del ingreso.';


--
-- Name: fn_traspasar_sobrante_a_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
  v_lote RECORD;
  v_a_traspasar INT;
  v_anterior UUID;
  v_anterior_nombre TEXT;
  v_motivo TEXT;
  v_registrado_por UUID;
BEGIN
  SELECT j.id, j.nombre, j.botiquin_bodega_id, j.responsable_id INTO v_jornada
  FROM public.jornadas j
  JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id AND b.es_movil AND NOT b.es_principal;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Sin sesion (la migracion, SQL directo, pruebas) el traspaso queda a nombre del responsable de
  -- la jornada: registrado_por no admite NULL.
  v_registrado_por := COALESCE(auth.uid(), v_jornada.responsable_id);

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'on', TRUE);

  FOR v_lote IN
    SELECT e.lote_id
    FROM public.existencias e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE e.bodega_id = v_jornada.botiquin_bodega_id
      AND e.cantidad_disponible > 0
      AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
    FOR UPDATE OF e
  LOOP
    v_a_traspasar := public.fn_disponible_neto(v_lote.lote_id, v_jornada.botiquin_bodega_id)
      - public.fn_queda_de_jornada_en_lote(v_jornada.id, v_lote.lote_id);

    CONTINUE WHEN v_a_traspasar <= 0;

    v_anterior := public.fn_jornada_duena_de_bodega(v_jornada.botiquin_bodega_id, v_jornada.id);
    v_anterior_nombre := NULL;
    SELECT j.nombre INTO v_anterior_nombre FROM public.jornadas j WHERE j.id = v_anterior;

    v_motivo := 'Traspaso a la jornada ' || v_jornada.nombre || ' de lo que habia en la bodega'
      || CASE WHEN v_anterior_nombre IS NOT NULL
              THEN ' (sobrante de la jornada ' || v_anterior_nombre || ')' ELSE '' END;

    INSERT INTO public.movimientos_inventario (
      tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
    )
    VALUES ('ingreso', v_lote.lote_id, v_jornada.botiquin_bodega_id, v_a_traspasar, v_motivo,
            v_registrado_por, v_jornada.id);

    PERFORM public.fn_registrar_salida_a_cuenta_de_jornada(
      v_lote.lote_id, v_jornada.botiquin_bodega_id, v_a_traspasar, v_motivo, v_anterior,
      v_registrado_por
    );
  END LOOP;

  PERFORM set_config('ecopac.aprobacion_de_sistema', 'off', TRUE);
END;
$$;


--
-- Name: FUNCTION "fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid") IS 'Pasa a la cuenta de una jornada con bodega movil lo que hay en su bodega y no es suyo: cargado en ella, devuelto en la anterior. El inventario fisico no cambia (00186, issue #925).';


--
-- Name: fn_traspasar_sobrante_al_iniciar_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_traspasar_sobrante_al_iniciar_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.fn_traspasar_sobrante_a_jornada(NEW.id);
  RETURN NULL;
END;
$$;


--
-- Name: FUNCTION "fn_traspasar_sobrante_al_iniciar_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_traspasar_sobrante_al_iniciar_jornada"() IS 'Al iniciar una jornada (planificada a en curso), fn_traspasar_sobrante_a_jornada() (00186).';


--
-- Name: fn_umbrales_caducidad_validos(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_umbrales_caducidad_validos"("p_umbrales" integer[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_umbrales IS NOT NULL
    AND cardinality(p_umbrales) BETWEEN 0 AND 4
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_umbrales) u WHERE u IS NULL OR u < 1 OR u > 365
    )
    AND (SELECT count(DISTINCT u) FROM unnest(p_umbrales) u) = cardinality(p_umbrales);
$$;


--
-- Name: FUNCTION "fn_umbrales_caducidad_validos"("p_umbrales" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_umbrales_caducidad_validos"("p_umbrales" integer[]) IS 'Regla de las antelaciones de aviso de vencimiento: de 0 a 4 valores, distintos, entre 1 y 365 dias. La usa el CHECK de configuracion_alertas_caducidad; packages/shared/inventario/configuracionAlertas.validaciones.js replica la misma regla.';


--
-- Name: fn_validar_aporte_de_caja(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_aporte_de_caja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_saldo NUMERIC;
  v_ya_sacado NUMERIC := 0;
BEGIN
  -- Un traspaso de sobrante (00160) mueve dinero entre jornadas, no de la caja.
  IF NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.monto = OLD.monto AND OLD.origen = 'caja' THEN
      RETURN NEW;
    END IF;
    IF OLD.origen = 'caja' THEN
      v_ya_sacado := OLD.monto;
    END IF;
  END IF;

  v_saldo := public.fn_saldo_de_caja_sin_filtro() + v_ya_sacado;
  IF NEW.monto > v_saldo THEN
    RAISE EXCEPTION 'La caja tiene Q%: no alcanza para Q%.',
      to_char(v_saldo, 'FM999999990.00'),
      to_char(NEW.monto, 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_aporte_de_caja"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_aporte_de_caja"() IS 'Trigger de jornada_presupuesto_origen (00168): un aporte con origen caja no saca mas de lo que hay en ella.';


--
-- Name: fn_validar_cita(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_cita"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_jornada RECORD;
  v_salas INTEGER;
  v_maximo RECORD;
  v_fusionando BOOLEAN := current_setting('ecopac.fusionando_pacientes', TRUE) = 'on';
  v_por_consulta BOOLEAN := current_setting('ecopac.cita_atendida_por_consulta', TRUE) = 'on';
  v_cambia_agenda BOOLEAN;
BEGIN
  IF NEW.termina_en IS NULL AND NEW.inicia_en IS NOT NULL THEN
    NEW.termina_en := NEW.inicia_en + INTERVAL '30 minutes';
  END IF;

  -- La fusion solo cambia el paciente: lo demas de la cita se queda como estaba.
  IF TG_OP = 'UPDATE' AND v_fusionando THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'creada' THEN
      RAISE EXCEPTION 'Una cita nueva nace creada.' USING ERRCODE = 'check_violation';
    END IF;
    v_cambia_agenda := TRUE;
  ELSE
    -- Una cita atendida o cancelada ya no se edita, salvo las notas.
    IF OLD.estado IN ('atendida', 'cancelada') THEN
      IF (to_jsonb(NEW) - 'notas' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'notas' - 'updated_at') THEN
        RAISE EXCEPTION 'Una cita % ya no se edita; solo sus notas.', OLD.estado
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;

    -- Transiciones.
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      IF NOT (
        (OLD.estado = 'creada' AND NEW.estado IN ('en_atencion', 'cancelada'))
        OR (OLD.estado = 'en_atencion' AND NEW.estado IN ('creada', 'atendida', 'cancelada'))
      ) THEN
        RAISE EXCEPTION 'Una cita no pasa de % a %.', OLD.estado, NEW.estado
          USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.estado = 'atendida' AND NOT v_por_consulta THEN
        RAISE EXCEPTION 'Una cita queda atendida al guardar su consulta, no a mano.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    -- La consulta la marca atendida y pone su profesional si faltaba (fn_consulta_de_cita_despues):
    -- ese cambio no es reagendar, y quien la atiende puede ser la administradora.
    IF v_por_consulta THEN
      RETURN NEW;
    END IF;

    v_cambia_agenda := (NEW.paciente_id, NEW.jornada_id, NEW.clinica_id, NEW.area_id,
                        NEW.profesional_id, NEW.inicia_en, NEW.termina_en)
      IS DISTINCT FROM (OLD.paciente_id, OLD.jornada_id, OLD.clinica_id, OLD.area_id,
                        OLD.profesional_id, OLD.inicia_en, OLD.termina_en);

    IF v_cambia_agenda AND OLD.estado <> 'creada' THEN
      RAISE EXCEPTION 'Solo se cambia la agenda de una cita creada.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Cancelar: quien y cuando. Al salir de cancelada no se vuelve (no hay esa transicion).
  IF NEW.estado = 'cancelada' THEN
    NEW.cancelada_en := COALESCE(NEW.cancelada_en, now());
    NEW.cancelada_por := COALESCE(NEW.cancelada_por, auth.uid());
    RETURN NEW;
  END IF;

  SELECT j.estado, j.fecha INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  -- Atender: con la jornada en curso.
  IF TG_OP = 'UPDATE' AND NEW.estado = 'en_atencion' AND OLD.estado = 'creada'
     AND v_jornada.estado <> 'en curso' THEN
    RAISE EXCEPTION 'Una cita se atiende con la jornada en curso.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF NOT v_cambia_agenda THEN
    RETURN NEW;
  END IF;

  IF v_jornada.estado NOT IN ('planificada', 'en curso') THEN
    RAISE EXCEPTION 'Solo se agenda en una jornada planificada o en curso.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF (NEW.inicia_en AT TIME ZONE 'America/Guatemala')::DATE < v_jornada.fecha THEN
    RAISE EXCEPTION 'La cita no puede ser antes de la fecha de la jornada (%).',
      to_char(v_jornada.fecha, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = NEW.paciente_id AND p.fecha_baja IS NOT NULL) THEN
    RAISE EXCEPTION 'El paciente esta dado de baja: no se le agendan citas.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id)
     AND NOT EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = NEW.clinica_id AND c.es_vigente) THEN
    RAISE EXCEPTION 'La clinica esta retirada: no se agenda en ella.' USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.area_id IS DISTINCT FROM OLD.area_id)
     AND NOT EXISTS (SELECT 1 FROM public.areas_atencion a WHERE a.id = NEW.area_id AND a.es_vigente) THEN
    RAISE EXCEPTION 'El area esta retirada: no se agenda en ella.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.profesional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.jornada_personal jp
    JOIN public.perfiles pe ON pe.id = jp.perfil_id
    WHERE jp.jornada_id = NEW.jornada_id
      AND jp.perfil_id = NEW.profesional_id
      AND jp.rol_en_jornada = 'medico'
      AND pe.activo
  ) THEN
    RAISE EXCEPTION 'El profesional tiene que estar como medico en el cuadro de turnos de la jornada.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloqueos, siempre en el mismo orden (clinica, paciente, profesional) para no trabarse con otra
  -- transaccion que agenda a la vez. Duran hasta el fin de la transaccion.
  PERFORM pg_advisory_xact_lock(hashtextextended('cita_clinica:' || NEW.clinica_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('cita_paciente:' || NEW.paciente_id::TEXT, 0));
  IF NEW.profesional_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('cita_profesional:' || NEW.profesional_id::TEXT, 0));
  END IF;

  -- Primero lo del paciente y el profesional, que es lo mas especifico; despues el cupo.
  IF EXISTS (
    SELECT 1 FROM public.citas o
    WHERE o.paciente_id = NEW.paciente_id
      AND o.id IS DISTINCT FROM NEW.id
      AND o.estado <> 'cancelada'
      AND o.inicia_en < NEW.termina_en
      AND o.termina_en > NEW.inicia_en
  ) THEN
    RAISE EXCEPTION 'El paciente ya tiene otra cita a esa hora.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.profesional_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.citas o
    WHERE o.profesional_id = NEW.profesional_id
      AND o.id IS DISTINCT FROM NEW.id
      AND o.estado <> 'cancelada'
      AND o.inicia_en < NEW.termina_en
      AND o.termina_en > NEW.inicia_en
  ) THEN
    RAISE EXCEPTION 'El profesional ya tiene otra cita a esa hora.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT c.salas_disponibles INTO v_salas FROM public.clinicas c WHERE c.id = NEW.clinica_id;
  SELECT * INTO v_maximo
  FROM public.fn_maximo_de_citas_simultaneas(NEW.clinica_id, NEW.inicia_en, NEW.termina_en, NEW.id);

  IF COALESCE(v_maximo.cantidad, 0) + 1 > v_salas THEN
    RAISE EXCEPTION 'La clinica ya tiene sus % salas ocupadas el %.', v_salas,
      public.fn_texto_de_hora_guatemala(v_maximo.momento)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_cita"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_cita"() IS 'Reglas de la cita (00184): cupo de la clinica con bloqueo, traslapes de paciente y profesional, profesional del cuadro de turnos, estado de la jornada, fecha, paciente sin baja, clinica y area vigentes, transiciones e inmutabilidad de la atendida o cancelada.';


--
-- Name: fn_validar_gasto_contra_presupuesto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_gasto_contra_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_asignado NUMERIC;
  v_fecha_jornada DATE;
  v_estado public.estado_jornada;
  v_comprometido NUMERIC;
  -- El dia mas tardio entre el del servidor (UTC, el de gastos.fecha DEFAULT CURRENT_DATE) y el
  -- de Guatemala: desde las 18:00 de Guatemala el servidor ya esta en el dia siguiente, y un gasto
  -- registrado sin fecha se rechazaba como futuro.
  v_hoy DATE := GREATEST(CURRENT_DATE, (now() AT TIME ZONE 'America/Guatemala')::DATE);
  v_compromete_mas BOOLEAN;
BEGIN
  SELECT j.presupuesto_asignado, j.fecha, j.estado INTO v_asignado, v_fecha_jornada, v_estado
  FROM public.jornadas j
  WHERE j.id = NEW.jornada_id;

  -- Sin jornada, la llave foranea es la que responde.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Una jornada que ya cerro no admite gastos nuevos. Aprobar o rechazar los pendientes si: es lo
  -- que hace falta para liquidar su sobrante (00160).
  IF v_estado = 'finalizada'
     AND (TG_OP = 'INSERT'
          OR NEW.jornada_id IS DISTINCT FROM OLD.jornada_id
          OR NEW.monto > OLD.monto)
  THEN
    RAISE EXCEPTION 'La jornada ya cerro: no admite gastos nuevos.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.fecha IS DISTINCT FROM OLD.fecha)
     AND NEW.fecha > GREATEST(v_hoy, v_fecha_jornada)
  THEN
    RAISE EXCEPTION 'La fecha de un gasto llega hasta el dia de su jornada (%) o hasta hoy si ya paso.',
      to_char(v_fecha_jornada, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado NOT IN ('pendiente', 'aprobado') THEN
    RETURN NEW;
  END IF;

  v_compromete_mas :=
    TG_OP = 'INSERT'
    OR NEW.monto > OLD.monto
    OR NEW.jornada_id IS DISTINCT FROM OLD.jornada_id
    OR OLD.estado NOT IN ('pendiente', 'aprobado');

  IF NOT v_compromete_mas THEN
    RETURN NEW;
  END IF;

  v_comprometido := public.comprometido_de_jornada(NEW.jornada_id, NEW.id);

  IF v_comprometido + NEW.monto > v_asignado THEN
    RAISE EXCEPTION 'Este gasto pasa el presupuesto de la jornada: tiene Q% y ya hay Q% comprometidos, quedan Q%.',
      to_char(v_asignado, 'FM999999990.00'),
      to_char(v_comprometido, 'FM999999990.00'),
      to_char(GREATEST(v_asignado - v_comprometido, 0), 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_gasto_contra_presupuesto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_gasto_contra_presupuesto"() IS 'Trigger de gastos (00159): una jornada finalizada no admite gastos nuevos, la fecha llega hasta el dia de la jornada o hasta hoy, y un gasto que compromete mas dinero no deja lo comprometido (pendiente + aprobado) por encima del presupuesto asignado.';


--
-- Name: fn_validar_lote_de_renglon_de_donacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_lote_de_renglon_de_donacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_medicamento_del_lote UUID;
BEGIN
  IF NEW.lote_id IS NULL OR NEW.medicamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT medicamento_id INTO v_medicamento_del_lote FROM public.lotes WHERE id = NEW.lote_id;

  IF v_medicamento_del_lote IS DISTINCT FROM NEW.medicamento_id THEN
    RAISE EXCEPTION 'El lote no es del medicamento que se dono en este renglon.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_lote_de_renglon_de_donacion"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_lote_de_renglon_de_donacion"() IS 'Trigger: el lote que se enlaza a un renglon de donacion tiene que ser del mismo medicamento que se dono (00135).';


--
-- Name: fn_validar_origen_de_presupuesto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_origen_de_presupuesto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_tipo public.tipo_donacion;
  v_estado public.estado_donacion;
  v_total NUMERIC;
  v_ya_asignado NUMERIC;
BEGIN
  -- Sin donacion_id la fila la rechaza chk_presupuesto_origen_donacion_coherente, con su propio
  -- mensaje: este trigger corre antes que el CHECK y no tiene que adelantarse a decir otra cosa.
  IF NEW.origen <> 'donacion' OR NEW.donacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.tipo, d.estado INTO v_tipo, v_estado
  FROM public.donaciones d
  WHERE d.id = NEW.donacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La donacion elegida no existe.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_tipo <> 'dinero' THEN
    RAISE EXCEPTION 'Solo una donacion de dinero puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_estado <> 'registrada' THEN
    RAISE EXCEPTION 'Una donacion anulada no puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(dd.monto), 0) INTO v_total
  FROM public.donacion_detalle dd
  WHERE dd.donacion_id = NEW.donacion_id;

  SELECT COALESCE(SUM(o.monto - o.devuelto), 0) INTO v_ya_asignado
  FROM public.jornada_presupuesto_origen o
  WHERE o.donacion_id = NEW.donacion_id
    AND o.id IS DISTINCT FROM NEW.id;

  IF v_ya_asignado + (NEW.monto - NEW.devuelto) > v_total THEN
    RAISE EXCEPTION 'La donacion es de Q% y ya se asignaron Q%: quedan Q% para asignar.',
      v_total, v_ya_asignado, v_total - v_ya_asignado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_origen_de_presupuesto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_origen_de_presupuesto"() IS 'Un origen de tipo donacion tiene que apuntar a una donacion de dinero registrada, y lo asignado desde ella en todas las jornadas no puede pasar de su monto (issue #840).';


--
-- Name: fn_validar_transicion_estado_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_transicion_estado_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.estado = 'planificada' AND NEW.estado = 'en curso' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'en curso' AND NEW.estado = 'finalizada' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'finalizada' AND NEW.estado = 'en curso' THEN
    IF NOT public.es_administrador() THEN
      RAISE EXCEPTION 'Solo un administrador puede reabrir una jornada finalizada.';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Transicion de estado invalida para jornadas: % -> %', OLD.estado, NEW.estado;
  END IF;
END;
$$;


--
-- Name: FUNCTION "fn_validar_transicion_estado_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_transicion_estado_jornada"() IS 'Bloquea cambios de estado de jornadas que no esten en la lista de transiciones permitidas (planificada->en curso, en curso->finalizada, finalizada->en curso). La reapertura (finalizada->en curso) exige ademas es_administrador(). No es SECURITY DEFINER: evalua con los privilegios de quien hace el UPDATE. Issue #171.';


--
-- Name: fn_validar_transicion_estado_proyecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_validar_transicion_estado_proyecto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT (
    (OLD.estado = 'planificado' AND NEW.estado = 'en curso')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'finalizado')
    OR (OLD.estado = 'planificado' AND NEW.estado = 'cancelado')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'cancelado')
  ) THEN
    RAISE EXCEPTION 'Transicion de estado invalida para proyectos: % -> %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "fn_validar_transicion_estado_proyecto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_validar_transicion_estado_proyecto"() IS 'Bloquea cambios de estado de proyectos que no esten en la lista de transiciones permitidas.';


--
-- Name: fn_valor_de_inventario_disponible("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_valor_de_inventario_disponible"("p_bodega_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("bodega_id" "uuid", "bodega" "text", "medicamento_id" "uuid", "medicamento" "text", "origen" "public"."origen_lote", "cantidad_disponible" bigint, "valor_disponible" numeric, "unidades_sin_costo" bigint, "lotes_sin_costo" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion y quien consulta reportes ve la valorizacion de inventario.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.bodega_id,
    b.nombre::TEXT AS bodega,
    l.medicamento_id,
    m.nombre::TEXT AS medicamento,
    l.origen,
    SUM(e.cantidad_disponible)::BIGINT AS cantidad_disponible,
    SUM(e.cantidad_disponible * l.costo_unitario) FILTER (WHERE l.costo_unitario IS NOT NULL) AS valor_disponible,
    COALESCE(SUM(e.cantidad_disponible) FILTER (WHERE l.costo_unitario IS NULL), 0)::BIGINT AS unidades_sin_costo,
    COUNT(DISTINCT l.id) FILTER (WHERE l.costo_unitario IS NULL)::BIGINT AS lotes_sin_costo
  FROM public.existencias e
  JOIN public.lotes l ON l.id = e.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  JOIN public.bodegas b ON b.id = e.bodega_id
  WHERE e.cantidad_disponible > 0
    AND (p_bodega_id IS NULL OR e.bodega_id = p_bodega_id)
  GROUP BY e.bodega_id, b.nombre, l.medicamento_id, m.nombre, l.origen
  ORDER BY b.nombre, m.nombre, l.origen;
END;
$$;


--
-- Name: FUNCTION "fn_valor_de_inventario_disponible"("p_bodega_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_valor_de_inventario_disponible"("p_bodega_id" "uuid") IS 'Valor monetario del inventario disponible (existencias.cantidad_disponible, no lotes.cantidad_ingresada), agregado por bodega, medicamento y origen. p_bodega_id nulo suma todas las bodegas. valor_disponible solo suma lotes con costo_unitario conocido; unidades_sin_costo y lotes_sin_costo cuentan aparte lo que no tiene costo capturado, para que el reporte declare cuanto del inventario queda sin valorizar en vez de contarlo como cero. SECURITY DEFINER: solo administrador y los roles consultivos (junta directiva, socio fundador) reciben resultado, por la misma razon que protege presupuesto_de_jornada/proyecto/sistema (00080) y obtenerIndicadoresImpacto (reportes/api.js) -- costo_unitario es informacion financiera que la 00121 no pudo restringir a nivel de columna. Issue #752.';


--
-- Name: fn_verificar_limite_busqueda_pacientes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_verificar_limite_busqueda_pacientes"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.fn_verificar_y_contar_limite(
    'buscar_pacientes', auth.uid(), 60, interval '1 minute'
  );
$$;


--
-- Name: FUNCTION "fn_verificar_limite_busqueda_pacientes"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_verificar_limite_busqueda_pacientes"() IS 'Limite de busquedas por usuario (issue #761): 60 cada minuto. La llama fn_buscar_pacientes() en una CTE al inicio, antes de la busqueda real. SECURITY DEFINER para poder escribir en limites_de_uso, que authenticated no puede tocar directamente; se concede EXECUTE a authenticated porque fn_buscar_pacientes corre SECURITY INVOKER y necesita poder llamarla.';


--
-- Name: fn_verificar_limite_invitaciones("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_verificar_limite_invitaciones"("p_administrador_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.fn_verificar_y_contar_limite(
    'invitar_usuario', p_administrador_id, 20, interval '1 hour'
  );
$$;


--
-- Name: FUNCTION "fn_verificar_limite_invitaciones"("p_administrador_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_verificar_limite_invitaciones"("p_administrador_id" "uuid") IS 'Limite de invitaciones por administrador (issue #761): 20 cada hora. La llama supabase/functions/invitar-usuario/index.ts antes de fn_crear_usuario_administrativo(), con la llave de servicio. No se concede a ningun rol de la aplicacion, solo a service_role.';


--
-- Name: fn_verificar_y_contar_limite("text", "uuid", integer, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_contador INT;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar quien hace la peticion.'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  -- `l` (alias del INSERT) en el SET se refiere a la fila que YA existia, no a la que se
  -- intento insertar (esa es EXCLUDED, que aqui no hace falta). Si la ventana anterior ya
  -- expiro, el contador arranca de nuevo en 1 y la ventana se reinicia a "ahora".
  INSERT INTO public.limites_de_uso AS l (recurso, actor_id, contador, ventana_inicio)
  VALUES (p_recurso, p_actor_id, 1, now())
  ON CONFLICT (recurso, actor_id) DO UPDATE SET
    contador = CASE
      WHEN l.ventana_inicio <= now() - p_ventana THEN 1
      ELSE l.contador + 1
    END,
    ventana_inicio = CASE
      WHEN l.ventana_inicio <= now() - p_ventana THEN now()
      ELSE l.ventana_inicio
    END
  RETURNING contador INTO v_contador;

  IF v_contador > p_maximo THEN
    RAISE EXCEPTION
      'Se alcanzo el limite de % peticiones cada %. Espera un momento e intenta de nuevo.',
      p_maximo, p_ventana
      USING ERRCODE = 'configuration_limit_exceeded';
  END IF;
END;
$$;


--
-- Name: FUNCTION "fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval) IS 'Incrementa atomicamente el contador de (recurso, actor_id) y falla con SQLSTATE 53400 (configuration_limit_exceeded) si supera p_maximo dentro de la ventana p_ventana. Reinicia la ventana sola cuando expiro. Nucleo compartido; llamarla siempre a traves de una funcion companera con el recurso y el umbral ya fijos (issue #761).';


--
-- Name: impedir_autodesactivacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_autodesactivacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


--
-- Name: FUNCTION "impedir_autodesactivacion"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_autodesactivacion"() IS 'Bloquea que un perfil se desactive a si mismo (issue #107, criterio 4). No distingue rol: aplica a cualquier fila que coincida con auth.uid(), no solo a administrador.';


--
-- Name: impedir_baja_de_paciente_sin_ser_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_baja_de_paciente_sin_ser_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.fecha_baja IS DISTINCT FROM OLD.fecha_baja AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora da de baja o reactiva a un paciente.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "impedir_baja_de_paciente_sin_ser_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_baja_de_paciente_sin_ser_administrador"() IS 'Trigger: dar de baja a un paciente (fecha_baja) es solo de la administracion.';


--
-- Name: impedir_borrado_fisico_paciente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_borrado_fisico_paciente"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION
    'Los pacientes no se borran fisicamente. Registra la baja asignando fecha_baja.'
    USING ERRCODE = 'restrict_violation';
END;
$$;


--
-- Name: FUNCTION "impedir_borrado_fisico_paciente"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_borrado_fisico_paciente"() IS 'Bloquea el borrado fisico de pacientes: la baja se registra con fecha_baja y queda auditada. Falla en voz alta en lugar de convertir el DELETE en una baja silenciosa.';


--
-- Name: impedir_borrar_ultimo_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_borrar_ultimo_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


--
-- Name: FUNCTION "impedir_borrar_ultimo_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_borrar_ultimo_administrador"() IS 'Bloquea borrar al ultimo administrador activo (issue #511), incluido el borrado en cascada desde auth.users que el Dashboard de Supabase o la Admin API de GoTrue disparan sin pasar por ningun BEFORE UPDATE. Mismo advisory lock que impedir_dejar_sin_administrador_activo (00072): las dos protegen el mismo invariante por caminos distintos (UPDATE y DELETE) y tienen que competir por el mismo mutex para que una desactivacion y un borrado concurrentes no se dejen pasar el uno al otro.';


--
-- Name: impedir_cambio_de_rol_propio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_cambio_de_rol_propio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el rol de un perfil.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "impedir_cambio_de_rol_propio"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_cambio_de_rol_propio"() IS 'Bloquea que un perfil se auto-asigne o auto-revoque un rol distinto al que tiene. Solo administrador puede cambiar rol.';


--
-- Name: impedir_dejar_sin_administrador_activo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_dejar_sin_administrador_activo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


--
-- Name: FUNCTION "impedir_dejar_sin_administrador_activo"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_dejar_sin_administrador_activo"() IS 'Bloquea desactivar o cambiarle el rol al ultimo administrador activo (issue #107, criterio 5). Usa un advisory lock transaccional para que dos desactivaciones concurrentes no dejen el sistema sin ningun administrador activo.';


--
-- Name: impedir_desactivar_sin_ser_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_desactivar_sin_ser_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora desactiva un registro del catalogo.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "impedir_desactivar_sin_ser_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_desactivar_sin_ser_administrador"() IS 'Trigger: desactivar un articulo o un diagnostico del catalogo es solo de la administracion.';


--
-- Name: impedir_permiso_escritura_a_consultivo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_permiso_escritura_a_consultivo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.concedido
     AND EXISTS (
       SELECT 1 FROM public.perfiles pe
       WHERE pe.id = NEW.perfil_id AND pe.rol IN ('junta directiva', 'socio fundador')
     )
     AND EXISTS (
       SELECT 1 FROM public.permisos p
       WHERE p.id = NEW.permiso_id AND p.clave <> 'reportes.exportar'
     )
  THEN
    RAISE EXCEPTION 'Un rol consultivo no puede recibir un permiso de escritura.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "impedir_permiso_escritura_a_consultivo"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_permiso_escritura_a_consultivo"() IS 'Bloquea conceder (usuario_permiso.concedido = true) cualquier permiso fino distinto de reportes.exportar a un perfil junta directiva o socio fundador: son consultivos por definicion (00037, 00080) y ningun permiso fino los debe convertir en escritores (issue #409).';


--
-- Name: impedir_retirar_sin_ser_administrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."impedir_retirar_sin_ser_administrador"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.es_vigente AND NOT NEW.es_vigente AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora retira un registro del catalogo.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "impedir_retirar_sin_ser_administrador"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."impedir_retirar_sin_ser_administrador"() IS 'Trigger: retirar (es_vigente) una condicion cronica o una comunidad es solo de la administracion (00148).';


--
-- Name: mis_accesos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."mis_accesos"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'modulos',
    COALESCE(
      (SELECT jsonb_agg(rm.modulo ORDER BY rm.modulo)
         FROM public.rol_modulo rm
        WHERE rm.rol = public.rol_actual()),
      '[]'::jsonb
    ),
    'permisos',
    COALESCE(
      (SELECT jsonb_agg(p.clave ORDER BY p.clave)
         FROM public.permisos p
        WHERE public.rol_actual() IS NOT NULL
          AND public.tiene_permiso(p.clave)),
      '[]'::jsonb
    )
  );
$$;


--
-- Name: FUNCTION "mis_accesos"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."mis_accesos"() IS 'Modulos abiertos por la matriz al rol de la sesion y sus permisos finos efectivos. Solo describe a quien llama.';


--
-- Name: modulo_por_defecto("public"."rol_usuario", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT CASE
    WHEN p_rol = 'administrador' THEN TRUE
    WHEN p_rol IN ('medico', 'voluntario general') THEN
      p_modulo IN ('pacientes', 'inventario', 'jornadas', 'proyectos', 'presupuestos')
    WHEN p_rol IN ('junta directiva', 'socio fundador') THEN p_modulo = 'reportes'
    ELSE FALSE
  END;
$$;


--
-- Name: FUNCTION "modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text") IS 'Modulos que un rol ve por defecto, espejo de MODULOS[].roles (packages/shared/navegacion.js). La matriz de acceso (rol_modulo) solo concede modulos fuera de esta lista.';


--
-- Name: participa_en_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."participa_en_jornada"("p_jornada_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jornada_personal jp
    JOIN public.perfiles pe ON pe.id = jp.perfil_id
    WHERE jp.jornada_id = p_jornada_id AND jp.perfil_id = auth.uid() AND pe.activo
  );
$$;


--
-- Name: FUNCTION "participa_en_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."participa_en_jornada"("p_jornada_id" "uuid") IS 'TRUE si quien esta conectado, con la cuenta activa, esta en el equipo de la jornada (jornada_personal). La usan las politicas RLS.';


--
-- Name: personal_registro_atenciones("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.consultas c
      WHERE c.jornada_id = p_jornada_id AND c.medico_id = p_perfil_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.triajes t
      JOIN public.atenciones a ON a.id = t.atencion_id
      WHERE a.jornada_id = p_jornada_id AND t.tomado_por = p_perfil_id
    );
$$;


--
-- Name: FUNCTION "personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid") IS 'Indica si un perfil ya registro trabajo clinico (una consulta o un triaje) en una jornada. La usa desasignarPersonal() de packages/shared/jornadas/api.js antes de borrar una fila de jornada_personal, para cumplir el criterio de aceptacion de la issue #174 que RLS no puede expresar por si solo. SECURITY INVOKER porque el unico llamador real es la administradora (la politica de DELETE de jornada_personal ya lo exige), que tiene SELECT sobre consultas y triajes.';


--
-- Name: pertenece_a_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."pertenece_a_jornada"("p_jornada_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.participa_en_jornada(p_jornada_id)
      OR EXISTS (
        SELECT 1
        FROM public.jornadas j
        JOIN public.perfiles pe ON pe.id = j.responsable_id
        WHERE j.id = p_jornada_id AND j.responsable_id = auth.uid() AND pe.activo
      );
$$;


--
-- Name: FUNCTION "pertenece_a_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."pertenece_a_jornada"("p_jornada_id" "uuid") IS 'La jornada es de esta persona: o esta en su cuadro de turnos (participa_en_jornada, 00079) o figura como su responsable_id. SECURITY DEFINER y search_path fijo por el mismo motivo que su companera. Exige perfiles.activo tambien en la rama del responsable, para no reabrir por aqui lo que cerro la 00079.';


--
-- Name: pertenece_a_proyecto("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."pertenece_a_proyecto"("p_proyecto_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.rol_actual() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.proyecto_personal pp
        WHERE pp.proyecto_id = p_proyecto_id
          AND pp.perfil_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.jornadas j
        WHERE j.proyecto_id = p_proyecto_id
          AND public.pertenece_a_jornada(j.id)
      )
    );
$$;


--
-- Name: FUNCTION "pertenece_a_proyecto"("p_proyecto_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."pertenece_a_proyecto"("p_proyecto_id" "uuid") IS 'Si la sesion esta en el equipo del proyecto o participa en alguna de sus jornadas.';


--
-- Name: presupuesto_de_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."presupuesto_de_jornada"("p_jornada_id" "uuid") RETURNS TABLE("asignado" numeric, "gastado" numeric, "disponible" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    j.presupuesto_asignado,
    COALESCE(g.aprobado, 0),
    j.presupuesto_asignado - COALESCE(g.aprobado, 0),
    COALESCE(g.pendiente, 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.id = p_jornada_id;
$$;


--
-- Name: FUNCTION "presupuesto_de_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."presupuesto_de_jornada"("p_jornada_id" "uuid") IS 'Presupuesto de una jornada con el disponible ya restado. gastado suma solo los gastos aprobados; los que esperan aprobacion van en pendiente para que la pantalla pueda avisar de lo comprometido sin mezclarlo con el gasto real. SECURITY INVOKER para que las politicas RLS de jornadas y gastos se apliquen con la identidad de quien consulta. Devuelve cero filas si la jornada no existe o si RLS no la deja ver.';


--
-- Name: presupuesto_de_proyecto("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."presupuesto_de_proyecto"("p_proyecto_id" "uuid") RETURNS TABLE("asignado" numeric, "gastado" numeric, "disponible" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    COALESCE(SUM(j.presupuesto_asignado), 0),
    COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(j.presupuesto_asignado), 0) - COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(g.pendiente), 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.proyecto_id = p_proyecto_id;
$$;


--
-- Name: FUNCTION "presupuesto_de_proyecto"("p_proyecto_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."presupuesto_de_proyecto"("p_proyecto_id" "uuid") IS 'Presupuesto de un proyecto como sumatoria del de sus jornadas. La suma ocurre en la base de datos: el cliente nunca recibe la lista de jornadas. Un proyecto sin jornadas devuelve una fila en ceros, no cero filas.';


--
-- Name: presupuesto_del_sistema(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."presupuesto_del_sistema"() RETURNS TABLE("asignado" numeric, "gastado" numeric, "disponible" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    COALESCE(SUM(j.presupuesto_asignado), 0),
    COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(j.presupuesto_asignado), 0) - COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(g.pendiente), 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE;
$$;


--
-- Name: FUNCTION "presupuesto_del_sistema"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."presupuesto_del_sistema"() IS 'Presupuesto total del sistema, sumatoria de todas las jornadas visibles para quien consulta. Al ser SECURITY INVOKER, dos roles distintos pueden obtener totales distintos: cada uno ve lo que sus politicas RLS le permiten.';


--
-- Name: presupuestos_de_jornadas("uuid"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]) RETURNS TABLE("jornada_id" "uuid", "asignado" numeric, "gastado" numeric, "disponible" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    j.id,
    j.presupuesto_asignado,
    COALESCE(g.aprobado, 0),
    j.presupuesto_asignado - COALESCE(g.aprobado, 0),
    COALESCE(g.pendiente, 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.id = ANY(p_jornada_ids);
$$;


--
-- Name: FUNCTION "presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]) IS 'Version en lote de presupuesto_de_jornada(): un id por fila en vez de una RPC por jornada (issue #771). Una jornada que no existe o que RLS no deja ver no genera fila.';


--
-- Name: presupuestos_de_proyectos("uuid"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]) RETURNS TABLE("proyecto_id" "uuid", "asignado" numeric, "gastado" numeric, "disponible" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    j.proyecto_id,
    COALESCE(SUM(j.presupuesto_asignado), 0),
    COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(j.presupuesto_asignado), 0) - COALESCE(SUM(g.aprobado), 0),
    COALESCE(SUM(g.pendiente), 0)
  FROM public.jornadas j
  LEFT JOIN LATERAL (
    SELECT
      SUM(monto) FILTER (WHERE estado = 'aprobado') AS aprobado,
      SUM(monto) FILTER (WHERE estado = 'pendiente') AS pendiente
    FROM public.gastos
    WHERE jornada_id = j.id
  ) g ON TRUE
  WHERE j.proyecto_id = ANY(p_proyecto_ids)
  GROUP BY j.proyecto_id;
$$;


--
-- Name: FUNCTION "presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]) IS 'Version en lote de presupuesto_de_proyecto(): un id por fila en vez de una RPC por proyecto (issue #771). Un proyecto sin jornadas visibles no genera fila -- a diferencia de presupuesto_de_proyecto(), que siempre devuelve una fila en ceros -- porque agrupa por proyecto_id y no hay nada que agrupar. Quien llama trata "id ausente en el resultado" igual que un presupuesto en ceros.';


--
-- Name: puede_consultar_reportes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."puede_consultar_reportes"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT public.es_administrador()
    OR public.es_consultivo()
    OR public.tiene_permiso('reportes.exportar')
    OR public.accede_a_modulo_por_matriz('reportes');
$$;


--
-- Name: FUNCTION "puede_consultar_reportes"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."puede_consultar_reportes"() IS 'Administradora, roles consultivos, quien tiene reportes.exportar o el rol al que la matriz le abrio Reportes.';


--
-- Name: registrar_avance_de_proyecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_avance_de_proyecto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.porcentaje_avance IS DISTINCT FROM NEW.porcentaje_avance THEN
    INSERT INTO public.proyecto_seguimiento (
      proyecto_id,
      porcentaje_anterior,
      porcentaje_nuevo,
      registrado_por
    )
    VALUES (NEW.id, OLD.porcentaje_avance, NEW.porcentaje_avance, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_avance_de_proyecto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_avance_de_proyecto"() IS 'Anota en proyecto_seguimiento cada cambio del porcentaje de avance, con quien lo hizo y cuando. Mismo criterio que registrar_cambio_estado_proyecto() de la 00029: el rastro lo deja la base de datos, no la aplicacion, para que no dependa de que el cliente se acuerde.';


--
-- Name: registrar_cambio_estado_jornada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_cambio_estado_jornada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.jornada_estado_historial (jornada_id, estado_anterior, estado_nuevo, cambiado_por)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
      NEW.estado,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_cambio_estado_jornada"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_cambio_estado_jornada"() IS 'Registra en jornada_estado_historial la creacion y cada cambio de estado de una jornada.';


--
-- Name: registrar_cambio_estado_proyecto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_cambio_estado_proyecto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.proyecto_estado_historial (proyecto_id, estado_anterior, estado_nuevo, cambiado_por)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
      NEW.estado,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_cambio_estado_proyecto"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_cambio_estado_proyecto"() IS 'Registra en proyecto_estado_historial la creacion y cada cambio de estado de un proyecto.';


--
-- Name: registrar_evento_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_evento_auditoria"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
  v_columna_id TEXT := coalesce(TG_ARGV[0], 'id');
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> v_columna_id)::UUID;

  ELSIF TG_OP = 'UPDATE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := to_jsonb(NEW);
    v_fila_id := (v_nuevos ->> v_columna_id)::UUID;

    IF (v_anteriores ->> 'fecha_baja') IS NULL AND (v_nuevos ->> 'fecha_baja') IS NOT NULL THEN
      v_operacion := 'baja';
    ELSE
      v_operacion := 'actualizacion';
    END IF;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> v_columna_id)::UUID;
  END IF;

  INSERT INTO public.eventos_auditoria (
    tabla_afectada,
    fila_id,
    operacion,
    realizado_por,
    valores_anteriores,
    valores_nuevos
  )
  VALUES (
    TG_TABLE_NAME,
    v_fila_id,
    v_operacion,
    auth.uid(),
    v_anteriores,
    v_nuevos
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_evento_auditoria"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_evento_auditoria"() IS 'Escribe una fila en eventos_auditoria por cada INSERT, UPDATE o DELETE de las tablas sensibles. Opera sobre to_jsonb(OLD) y to_jsonb(NEW) en lugar de sobre los campos, lo que le permite servir a tablas con columnas distintas sin conocerlas.';


--
-- Name: registrar_evento_auditoria_rol_permiso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_evento_auditoria_rol_permiso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> 'permiso_id')::UUID;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> 'permiso_id')::UUID;
  END IF;

  INSERT INTO public.eventos_auditoria (
    tabla_afectada,
    fila_id,
    operacion,
    realizado_por,
    valores_anteriores,
    valores_nuevos
  )
  VALUES (
    TG_TABLE_NAME,
    v_fila_id,
    v_operacion,
    auth.uid(),
    v_anteriores,
    v_nuevos
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_evento_auditoria_rol_permiso"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_evento_auditoria_rol_permiso"() IS 'Como registrar_evento_auditoria_usuario_permiso() (00045), pero para rol_permiso: usa permiso_id como fila_id -no rol, que es un enum, no un UUID- porque esta tabla no identifica una persona sino que permiso cambio de disponibilidad para un rol. rol y permiso_id quedan en valores_anteriores/valores_nuevos. Solo INSERT/DELETE: rol_permiso nunca recibe UPDATE.';


--
-- Name: registrar_evento_auditoria_usuario_permiso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> 'perfil_id')::UUID;

  ELSIF TG_OP = 'UPDATE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'actualizacion';
    v_fila_id := (v_nuevos ->> 'perfil_id')::UUID;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> 'perfil_id')::UUID;
  END IF;

  INSERT INTO public.eventos_auditoria (
    tabla_afectada,
    fila_id,
    operacion,
    realizado_por,
    valores_anteriores,
    valores_nuevos
  )
  VALUES (
    TG_TABLE_NAME,
    v_fila_id,
    v_operacion,
    auth.uid(),
    v_anteriores,
    v_nuevos
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "registrar_evento_auditoria_usuario_permiso"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"() IS 'Como registrar_evento_auditoria() (00026), pero para usuario_permiso: usa perfil_id como fila_id porque esta tabla no tiene columna id (su PK es compuesta perfil_id+permiso_id). permiso_id, concedido, otorgado_por y motivo quedan en valores_anteriores/valores_nuevos igual que en los triggers genericos.';


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: rol_actual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rol_actual"() RETURNS "public"."rol_usuario"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid() AND activo;
$$;


--
-- Name: FUNCTION "rol_actual"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."rol_actual"() IS 'Rol del perfil de la sesion, o NULL si no hay sesion o el perfil esta desactivado (issue #529). De esta funcion cuelga casi toda la matriz RLS.';


--
-- Name: saldo_de_caja(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."saldo_de_caja"() RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.fn_saldo_de_caja_sin_filtro()
  WHERE public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.accede_a_modulo_por_matriz('jornadas')
     OR public.accede_a_modulo_por_matriz('presupuestos');
$$;


--
-- Name: FUNCTION "saldo_de_caja"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."saldo_de_caja"() IS 'Lo que hay en la caja: entradas menos salidas (00168). NULL para quien no ve los aportes.';


--
-- Name: sobrante_de_jornada("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."sobrante_de_jornada"("p_jornada_id" "uuid") RETURNS TABLE("origen_id" "uuid", "origen" "public"."origen_de_presupuesto", "monto" numeric, "devuelto" numeric, "usado" numeric, "sobrante" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH aportes AS (
    SELECT o.id,
           o.origen,
           o.monto,
           o.devuelto,
           o.monto - o.devuelto AS cuenta,
           -- Lo que cuentan los aportes que se gastan antes que este.
           COALESCE(SUM(o.monto - o.devuelto) OVER (
             ORDER BY CASE o.origen
                        WHEN 'donacion' THEN 1
                        WHEN 'aporte_externo' THEN 2
                        WHEN 'sin_clasificar' THEN 3
                        ELSE 4
                      END,
                      o.created_at, o.id
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), 0) AS antes
    FROM public.jornada_presupuesto_origen o
    WHERE o.jornada_id = p_jornada_id
  ),
  gastado AS (
    SELECT public.comprometido_de_jornada(p_jornada_id) AS total
  )
  SELECT a.id,
         a.origen,
         a.monto,
         a.devuelto,
         LEAST(a.cuenta, GREATEST(g.total - a.antes, 0)),
         a.cuenta - LEAST(a.cuenta, GREATEST(g.total - a.antes, 0))
  FROM aportes a CROSS JOIN gastado g
  WHERE public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.accede_a_modulo_por_matriz('jornadas')
     OR public.accede_a_modulo_por_matriz('presupuestos')
  ORDER BY CASE a.origen
             WHEN 'donacion' THEN 1
             WHEN 'aporte_externo' THEN 2
             WHEN 'sin_clasificar' THEN 3
             ELSE 4
           END;
$$;


--
-- Name: FUNCTION "sobrante_de_jornada"("p_jornada_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."sobrante_de_jornada"("p_jornada_id" "uuid") IS 'Por cada aporte de una jornada: lo que cuenta, lo usado por los gastos pendientes y aprobados (primero donaciones y aportes externos, al final fondos propios) y lo que sobra (00160). La ve quien ve los aportes.';


--
-- Name: tiene_permiso("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."tiene_permiso"("p_codigo" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    (
      -- La concesion individual tampoco sobrevive a la baja: sin este EXISTS, un perfil
      -- desactivado con un permiso puntual conservaba la escritura de jornadas y gastos.
      SELECT up.concedido
      FROM public.usuario_permiso up
      JOIN public.permisos p ON p.id = up.permiso_id
      WHERE up.perfil_id = auth.uid()
        AND p.clave = p_codigo
        AND EXISTS (
          SELECT 1 FROM public.perfiles pe WHERE pe.id = auth.uid() AND pe.activo
        )
    ),
    (
      SELECT TRUE
      FROM public.rol_permiso rp
      JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE rp.rol = public.rol_actual() AND p.clave = p_codigo
    ),
    FALSE
  );
$$;


--
-- Name: FUNCTION "tiene_permiso"("p_codigo" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."tiene_permiso"("p_codigo" "text") IS 'TRUE si quien esta conectado tiene el permiso fino p_codigo: por su rol (rol_permiso) salvo que se le revoque, o concedido a el (usuario_permiso). La usan las politicas RLS.';


--
-- Name: validar_jornada_en_curso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validar_jornada_en_curso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_estado public.estado_jornada;
BEGIN
  SELECT estado INTO v_estado
  FROM public.jornadas
  WHERE id = NEW.jornada_id;

  IF v_estado IS NULL OR v_estado != 'en curso' THEN
    RAISE EXCEPTION 'No se puede registrar la consulta: La jornada asociada no esta en curso (Estado actual: %).', 
      COALESCE(v_estado::text, 'NO ENCONTRADA');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "validar_jornada_en_curso"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."validar_jornada_en_curso"() IS 'Valida que la jornada asociada a la consulta se encuentre en estado en curso antes de guardar.';


--
-- Name: validar_jornada_en_curso_atenciones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validar_jornada_en_curso_atenciones"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_estado public.estado_jornada;
BEGIN
  SELECT estado INTO v_estado
  FROM public.jornadas
  WHERE id = NEW.jornada_id;

  IF v_estado IS NULL OR v_estado != 'en curso' THEN
    RAISE EXCEPTION
      'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: %).',
      COALESCE(v_estado::text, 'NO ENCONTRADA');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "validar_jornada_en_curso_atenciones"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."validar_jornada_en_curso_atenciones"() IS 'Valida que la jornada de la atencion este en curso antes de guardar (issue #172, RF-24). Es el
   equivalente para atenciones de validar_jornada_en_curso(), que la 00018 aplica a consultas.';


--
-- Name: alerta_caducidad_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."alerta_caducidad_detalle" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "alerta_id" "uuid" NOT NULL,
    "accion" "public"."accion_alerta" NOT NULL,
    "cantidad" integer NOT NULL,
    "bodega_destino_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_alerta_caducidad_detalle_cantidad_positiva" CHECK (("cantidad" > 0))
);


--
-- Name: TABLE "alerta_caducidad_detalle"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."alerta_caducidad_detalle" IS 'Como se reparte la atencion de una alerta entre varias acciones (por ejemplo, parte donada y parte descartada).';


--
-- Name: COLUMN "alerta_caducidad_detalle"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "alerta_caducidad_detalle"."alerta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."alerta_id" IS 'Alerta atendida.';


--
-- Name: COLUMN "alerta_caducidad_detalle"."accion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."accion" IS 'Que se hizo con esta parte.';


--
-- Name: COLUMN "alerta_caducidad_detalle"."cantidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."cantidad" IS 'Unidades de esta parte.';


--
-- Name: COLUMN "alerta_caducidad_detalle"."bodega_destino_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."bodega_destino_id" IS 'Bodega a la que se reubico, si la accion es reubicado.';


--
-- Name: COLUMN "alerta_caducidad_detalle"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alerta_caducidad_detalle"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: alertas_caducidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."alertas_caducidad" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "estado" "public"."estado_alerta" DEFAULT 'pendiente'::"public"."estado_alerta" NOT NULL,
    "cantidad_afectada" integer NOT NULL,
    "accion" "public"."accion_alerta",
    "atendida_por" "uuid",
    "atendida_en" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "umbral_notificado_dias" integer,
    "cerrada_sin_existencia" boolean DEFAULT false NOT NULL,
    CONSTRAINT "chk_alertas_caducidad_cantidad_positiva" CHECK (("cantidad_afectada" > 0)),
    CONSTRAINT "chk_alertas_caducidad_cierre_coherente" CHECK (((("estado" = 'pendiente'::"public"."estado_alerta") AND ("accion" IS NULL) AND ("atendida_por" IS NULL) AND ("atendida_en" IS NULL) AND (NOT "cerrada_sin_existencia")) OR (("estado" = 'atendida'::"public"."estado_alerta") AND ("atendida_en" IS NOT NULL) AND (((NOT "cerrada_sin_existencia") AND ("atendida_por" IS NOT NULL)) OR ("cerrada_sin_existencia" AND ("atendida_por" IS NULL) AND ("accion" IS NULL)))))),
    CONSTRAINT "chk_alertas_caducidad_umbral_no_negativo" CHECK (("umbral_notificado_dias" >= 0))
);


--
-- Name: TABLE "alertas_caducidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."alertas_caducidad" IS 'Alerta de un lote vencido o por vencer. La genera la rutina diaria y se atiende donando, reubicando o descartando.';


--
-- Name: COLUMN "alertas_caducidad"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "alertas_caducidad"."lote_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."lote_id" IS 'Lote de la alerta.';


--
-- Name: COLUMN "alertas_caducidad"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."estado" IS 'Pendiente o atendida.';


--
-- Name: COLUMN "alertas_caducidad"."cantidad_afectada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."cantidad_afectada" IS 'Unidades del lote en riesgo cuando se genero la alerta.';


--
-- Name: COLUMN "alertas_caducidad"."accion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."accion" IS 'Accion principal con la que se atendio.';


--
-- Name: COLUMN "alertas_caducidad"."atendida_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."atendida_por" IS 'Quien la atendio.';


--
-- Name: COLUMN "alertas_caducidad"."atendida_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."atendida_en" IS 'Cuando se atendio.';


--
-- Name: COLUMN "alertas_caducidad"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "alertas_caducidad"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "alertas_caducidad"."umbral_notificado_dias"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."umbral_notificado_dias" IS 'Etapa mas cercana ya avisada: la antelacion en dias, o 0 para el aviso del dia del vencimiento. NULL mientras no se ha avisado nada. Evita repetir un aviso y permite enviar el siguiente (issue #899).';


--
-- Name: COLUMN "alertas_caducidad"."cerrada_sin_existencia"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."alertas_caducidad"."cerrada_sin_existencia" IS 'TRUE si la rutina cerro la alerta porque el lote se quedo sin existencia por otra via. No tiene accion ni atendida_por: nadie la atendio (issue #899).';


--
-- Name: areas_atencion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."areas_atencion" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "descripcion" "text",
    "es_vigente" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_areas_atencion_nombre_no_vacio" CHECK (("btrim"(("nombre")::"text") <> ''::"text"))
);


--
-- Name: TABLE "areas_atencion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."areas_atencion" IS 'Catalogo de areas de atencion (Odontologia, Psicologia, Medicina General, ...) que se asignan al paciente y en las que se agendan las citas (issue #927, 00182). No se borran: se retiran con es_vigente.';


--
-- Name: COLUMN "areas_atencion"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."id" IS 'Identificador del area.';


--
-- Name: COLUMN "areas_atencion"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."nombre" IS 'Nombre del area. Unico sin distinguir mayusculas ni acentos (idx_areas_atencion_nombre_normalizado).';


--
-- Name: COLUMN "areas_atencion"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."descripcion" IS 'Que se atiende en el area. Opcional.';


--
-- Name: COLUMN "areas_atencion"."es_vigente"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."es_vigente" IS 'FALSE = retirada (borrado logico): no se ofrece al elegir, pero la conservan los pacientes, citas y consultas que ya la tienen, y se puede usar en los filtros. Solo la administradora la retira (00148).';


--
-- Name: COLUMN "areas_atencion"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."created_at" IS 'Cuando se creo el area.';


--
-- Name: COLUMN "areas_atencion"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."areas_atencion"."updated_at" IS 'Ultima modificacion del area.';


--
-- Name: atenciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."atenciones" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cerrada_en" timestamp with time zone,
    "motivo_cierre" "text"
);


--
-- Name: TABLE "atenciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."atenciones" IS 'La visita de un paciente a una jornada: se abre al recibirlo y se cierra al terminar. Los signos vitales, la consulta y la receta cuelgan de ella.';


--
-- Name: COLUMN "atenciones"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "atenciones"."paciente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."paciente_id" IS 'Paciente atendido.';


--
-- Name: COLUMN "atenciones"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."jornada_id" IS 'Jornada en la que se le atendio; tiene que estar en curso.';


--
-- Name: COLUMN "atenciones"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "atenciones"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "atenciones"."cerrada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."cerrada_en" IS 'Cuando se retiro la atencion de la cola de la jornada. NULL = sigue abierta. La escribe
   cerrarAtencion() de packages/shared/atenciones/api.js (issue #173).';


--
-- Name: COLUMN "atenciones"."motivo_cierre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atenciones"."motivo_cierre" IS 'Por que se cerro: entrega completada, el paciente se retiro, se refirio a otro nivel. Texto
   libre y opcional; sirve para entender una cola que se vacio sin consultas.';


--
-- Name: avisos_caducidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."avisos_caducidad" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "alerta_id" "uuid" NOT NULL,
    "umbral_dias" integer NOT NULL,
    "dias_restantes" integer NOT NULL,
    "cantidad_en_existencia" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_avisos_caducidad_cantidad_positiva" CHECK (("cantidad_en_existencia" > 0)),
    CONSTRAINT "chk_avisos_caducidad_umbral_no_negativo" CHECK (("umbral_dias" >= 0))
);


--
-- Name: TABLE "avisos_caducidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."avisos_caducidad" IS 'Cada aviso de vencimiento enviado: uno por alerta y por etapa (antelacion configurada o dia del vencimiento). Su INSERT genera la notificacion a la administracion (issue #899).';


--
-- Name: COLUMN "avisos_caducidad"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."id" IS 'Identificador del aviso; es el origen_id de su notificacion.';


--
-- Name: COLUMN "avisos_caducidad"."alerta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."alerta_id" IS 'Alerta de caducidad a la que pertenece.';


--
-- Name: COLUMN "avisos_caducidad"."umbral_dias"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."umbral_dias" IS 'Etapa avisada: la antelacion en dias, o 0 para el dia del vencimiento.';


--
-- Name: COLUMN "avisos_caducidad"."dias_restantes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."dias_restantes" IS 'Dias que faltaban para el vencimiento al avisar (negativo si ya habia vencido).';


--
-- Name: COLUMN "avisos_caducidad"."cantidad_en_existencia"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."cantidad_en_existencia" IS 'Unidades del lote en existencia al avisar.';


--
-- Name: COLUMN "avisos_caducidad"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."avisos_caducidad"."created_at" IS 'Momento del aviso.';


--
-- Name: bodegas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bodegas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "ubicacion" character varying(200),
    "es_movil" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "es_principal" boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE "bodegas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."bodegas" IS 'Lugares donde se guarda inventario: la bodega central y los botiquines moviles que viajan a las jornadas.';


--
-- Name: COLUMN "bodegas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "bodegas"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."nombre" IS 'Nombre de la bodega; unico.';


--
-- Name: COLUMN "bodegas"."ubicacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."ubicacion" IS 'Donde esta, en texto libre.';


--
-- Name: COLUMN "bodegas"."es_movil"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."es_movil" IS 'TRUE si es un botiquin que viaja a las jornadas.';


--
-- Name: COLUMN "bodegas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "bodegas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "bodegas"."es_principal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."bodegas"."es_principal" IS 'TRUE en la bodega principal: de ella sale lo que se receta en una jornada sin bodega de botiquin (00176). Hay una sola.';


--
-- Name: categorias_de_gasto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."categorias_de_gasto" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_categorias_de_gasto_nombre" CHECK (((("length"("btrim"("nombre")) >= 1) AND ("length"("btrim"("nombre")) <= 80)) AND ("nombre" = "btrim"("nombre"))))
);


--
-- Name: TABLE "categorias_de_gasto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."categorias_de_gasto" IS 'Categorias de gasto (00158). Catalogo que crece desde el formulario de gasto ("Crear categoria nueva"); reemplaza al enum categoria_gasto.';


--
-- Name: COLUMN "categorias_de_gasto"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."categorias_de_gasto"."id" IS 'Identificador de la categoria.';


--
-- Name: COLUMN "categorias_de_gasto"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."categorias_de_gasto"."nombre" IS 'Nombre de la categoria, tal como se muestra y como lo guarda gastos.categoria. Unico sin importar mayusculas.';


--
-- Name: COLUMN "categorias_de_gasto"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."categorias_de_gasto"."registrado_por" IS 'Quien creo la categoria (auth.uid()).';


--
-- Name: COLUMN "categorias_de_gasto"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."categorias_de_gasto"."created_at" IS 'Cuando se creo la categoria.';


--
-- Name: citas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."citas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "clinica_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL,
    "profesional_id" "uuid",
    "inicia_en" timestamp with time zone NOT NULL,
    "termina_en" timestamp with time zone NOT NULL,
    "estado" "public"."estado_cita" DEFAULT 'creada'::"public"."estado_cita" NOT NULL,
    "notas" "text",
    "registrada_por" "uuid" DEFAULT "auth"."uid"(),
    "cancelada_por" "uuid",
    "cancelada_en" timestamp with time zone,
    "motivo_cancelacion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_citas_cancelacion" CHECK ((("estado" = 'cancelada'::"public"."estado_cita") = ("cancelada_en" IS NOT NULL))),
    CONSTRAINT "chk_citas_termina_despues" CHECK (("termina_en" > "inicia_en"))
);


--
-- Name: TABLE "citas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."citas" IS 'Agenda de citas: un paciente, en una jornada, una clinica y un area, a una hora (issue #927, 00184). No se borran: se cancelan. La consulta que sale de una cita la referencia con consultas.cita_id.';


--
-- Name: COLUMN "citas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."id" IS 'Identificador de la cita.';


--
-- Name: COLUMN "citas"."paciente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."paciente_id" IS 'Paciente de la cita. No se agenda a uno dado de baja.';


--
-- Name: COLUMN "citas"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."jornada_id" IS 'Jornada en que se atiende. Planificada o en curso para agendar; en curso para atender.';


--
-- Name: COLUMN "citas"."clinica_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."clinica_id" IS 'Clinica donde se atiende; su cupo es salas_disponibles.';


--
-- Name: COLUMN "citas"."area_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."area_id" IS 'Area de atencion de la cita; pasa a la consulta (consultas.area_id).';


--
-- Name: COLUMN "citas"."profesional_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."profesional_id" IS 'Quien va a registrar la consulta: un medico del cuadro de turnos de la jornada, sin dos citas traslapadas. Opcional al agendar; si falta, queda quien registra la consulta.';


--
-- Name: COLUMN "citas"."inicia_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."inicia_en" IS 'Inicio de la cita. No antes de la fecha de la jornada (America/Guatemala).';


--
-- Name: COLUMN "citas"."termina_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."termina_en" IS 'Fin de la cita; por defecto inicia_en + 30 minutos, siempre despues de inicia_en.';


--
-- Name: COLUMN "citas"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."estado" IS 'creada, en_atencion, atendida o cancelada; transiciones en fn_validar_cita.';


--
-- Name: COLUMN "citas"."notas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."notas" IS 'Notas libres. Es lo unico que se edita en una cita atendida o cancelada.';


--
-- Name: COLUMN "citas"."registrada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."registrada_por" IS 'Quien agendo la cita (DEFAULT auth.uid()).';


--
-- Name: COLUMN "citas"."cancelada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."cancelada_por" IS 'Quien la cancelo, o quien cerro o cancelo la jornada cuando la cancelo ese cambio (motivo_cancelacion lo dice).';


--
-- Name: COLUMN "citas"."cancelada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."cancelada_en" IS 'Cuando se cancelo. Presente si y solo si estado = cancelada.';


--
-- Name: COLUMN "citas"."motivo_cancelacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."motivo_cancelacion" IS 'Por que se cancelo (opcional).';


--
-- Name: COLUMN "citas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."created_at" IS 'Cuando se agendo.';


--
-- Name: COLUMN "citas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."citas"."updated_at" IS 'Ultima modificacion.';


--
-- Name: clinicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."clinicas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "salas_disponibles" integer NOT NULL,
    "es_vigente" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_clinicas_nombre_no_vacio" CHECK (("btrim"(("nombre")::"text") <> ''::"text")),
    CONSTRAINT "chk_clinicas_salas_positivas" CHECK (("salas_disponibles" > 0))
);


--
-- Name: TABLE "clinicas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."clinicas" IS 'Catalogo de clinicas donde se atienden las citas, con su numero de salas (issue #927, 00183). No se borra una clinica con citas: se retira con es_vigente (fn_eliminar_clinica).';


--
-- Name: COLUMN "clinicas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."id" IS 'Identificador de la clinica.';


--
-- Name: COLUMN "clinicas"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."nombre" IS 'Nombre de la clinica. Unico sin distinguir mayusculas ni acentos (idx_clinicas_nombre_normalizado).';


--
-- Name: COLUMN "clinicas"."salas_disponibles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."salas_disponibles" IS 'Cuantas citas se pueden atender a la vez en la clinica. Mayor que cero. No baja de lo que ya hay agendado en algun horario futuro.';


--
-- Name: COLUMN "clinicas"."es_vigente"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."es_vigente" IS 'FALSE = retirada: no se ofrece al agendar, pero la conservan las citas que ya la tienen. Solo la administradora la retira (00148).';


--
-- Name: COLUMN "clinicas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."created_at" IS 'Cuando se creo la clinica.';


--
-- Name: COLUMN "clinicas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."clinicas"."updated_at" IS 'Ultima modificacion de la clinica.';


--
-- Name: comunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."comunidades" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "municipio_id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "latitud" numeric(9,6),
    "longitud" numeric(9,6),
    "referencia_acceso" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "es_vigente" boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE "comunidades"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."comunidades" IS 'Aldeas, caserios y colonias donde se hacen jornadas y de donde vienen los pacientes. La organizacion las agrega; no es un catalogo oficial.';


--
-- Name: COLUMN "comunidades"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "comunidades"."municipio_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."municipio_id" IS 'Municipio en el que esta la comunidad.';


--
-- Name: COLUMN "comunidades"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."nombre" IS 'Nombre de la comunidad.';


--
-- Name: COLUMN "comunidades"."latitud"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."latitud" IS 'Latitud para ubicarla en el mapa, opcional.';


--
-- Name: COLUMN "comunidades"."longitud"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."longitud" IS 'Longitud para ubicarla en el mapa, opcional.';


--
-- Name: COLUMN "comunidades"."referencia_acceso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."referencia_acceso" IS 'Como llegar, en texto libre: una comunidad rural no siempre tiene direccion.';


--
-- Name: COLUMN "comunidades"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "comunidades"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "comunidades"."es_vigente"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."comunidades"."es_vigente" IS 'FALSE = retirada (borrado logico): ya no se ofrece al elegir, pero conserva su historial.';


--
-- Name: condiciones_cronicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."condiciones_cronicas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "es_vigente" boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE "condiciones_cronicas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."condiciones_cronicas" IS 'Catalogo de condiciones cronicas que se registran en los pacientes (diabetes, hipertension, ...).';


--
-- Name: COLUMN "condiciones_cronicas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."condiciones_cronicas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "condiciones_cronicas"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."condiciones_cronicas"."nombre" IS 'Nombre de la condicion; unico.';


--
-- Name: COLUMN "condiciones_cronicas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."condiciones_cronicas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "condiciones_cronicas"."es_vigente"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."condiciones_cronicas"."es_vigente" IS 'Retiro logico del catalogo (00115): FALSE deja de ofrecerla al asignar una condicion nueva, sin romper las fichas que ya la citan. Solo el administrador la cambia (00140).';


--
-- Name: configuracion_alertas_caducidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."configuracion_alertas_caducidad" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "unica" boolean DEFAULT true NOT NULL,
    "umbrales_dias" integer[] DEFAULT '{90}'::integer[] NOT NULL,
    "actualizado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_configuracion_alertas_caducidad_umbrales_validos" CHECK ("public"."fn_umbrales_caducidad_validos"("umbrales_dias")),
    CONSTRAINT "chk_configuracion_alertas_caducidad_unica" CHECK ("unica")
);


--
-- Name: TABLE "configuracion_alertas_caducidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."configuracion_alertas_caducidad" IS 'Antelaciones con las que se avisa que un lote va a vencer (issue #899). Una sola fila. El aviso del dia del vencimiento no se configura: siempre se envia. La cambia la administracion, o quien tenga el permiso inventario.configurar_alertas, desde la web.';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."id" IS 'Identificador de la fila.';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."unica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."unica" IS 'Siempre TRUE; con su UNIQUE garantiza que la tabla tenga una sola fila.';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."umbrales_dias"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."umbrales_dias" IS 'Dias antes del vencimiento en que se avisa, de mayor a menor. De 0 a 4 valores distintos entre 1 y 365. Por defecto {90}. La mayor es la ventana: un lote mas lejos no genera alerta. Vacio: solo se avisa el dia del vencimiento (la ventana es 0).';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."actualizado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."actualizado_por" IS 'Perfil que guardo el ultimo cambio. Lo fija el trigger con auth.uid().';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."created_at" IS 'Fecha de creacion de la fila.';


--
-- Name: COLUMN "configuracion_alertas_caducidad"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."configuracion_alertas_caducidad"."updated_at" IS 'Fecha del ultimo cambio.';


--
-- Name: consulta_diagnostico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."consulta_diagnostico" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "consulta_id" "uuid" NOT NULL,
    "diagnostico_id" "uuid" NOT NULL,
    "es_principal" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "consulta_diagnostico"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."consulta_diagnostico" IS 'Diagnosticos de una consulta; uno puede marcarse como principal.';


--
-- Name: COLUMN "consulta_diagnostico"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consulta_diagnostico"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "consulta_diagnostico"."consulta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consulta_diagnostico"."consulta_id" IS 'Consulta diagnosticada.';


--
-- Name: COLUMN "consulta_diagnostico"."diagnostico_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consulta_diagnostico"."diagnostico_id" IS 'Diagnostico del catalogo.';


--
-- Name: COLUMN "consulta_diagnostico"."es_principal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consulta_diagnostico"."es_principal" IS 'TRUE en el diagnostico principal de la consulta.';


--
-- Name: COLUMN "consulta_diagnostico"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consulta_diagnostico"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: consultas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."consultas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "expediente_id" "uuid" NOT NULL,
    "atencion_id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "motivo_consulta" "text" NOT NULL,
    "antecedentes" "text",
    "sintomas" "text",
    "exploracion" "text",
    "tratamiento" "text",
    "observaciones" "text",
    "plan_seguimiento" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cita_id" "uuid",
    "area_id" "uuid"
);


--
-- Name: TABLE "consultas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."consultas" IS 'Consulta medica de una atencion: motivo, sintomas, exploracion, diagnosticos y tratamiento.';


--
-- Name: COLUMN "consultas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "consultas"."expediente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."expediente_id" IS 'Expediente del paciente.';


--
-- Name: COLUMN "consultas"."atencion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."atencion_id" IS 'Atencion a la que pertenece la consulta.';


--
-- Name: COLUMN "consultas"."medico_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."medico_id" IS 'Medico que atendio.';


--
-- Name: COLUMN "consultas"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."jornada_id" IS 'Jornada en la que se hizo; la misma de la atencion.';


--
-- Name: COLUMN "consultas"."motivo_consulta"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."motivo_consulta" IS 'Por que viene el paciente, en sus palabras.';


--
-- Name: COLUMN "consultas"."antecedentes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."antecedentes" IS 'Antecedentes relevantes.';


--
-- Name: COLUMN "consultas"."sintomas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."sintomas" IS 'Sintomas que refiere.';


--
-- Name: COLUMN "consultas"."exploracion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."exploracion" IS 'Hallazgos de la exploracion fisica.';


--
-- Name: COLUMN "consultas"."tratamiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."tratamiento" IS 'Tratamiento indicado.';


--
-- Name: COLUMN "consultas"."observaciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."observaciones" IS 'Otras observaciones del medico.';


--
-- Name: COLUMN "consultas"."plan_seguimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."plan_seguimiento" IS 'Que sigue: control, referencia, examenes.';


--
-- Name: COLUMN "consultas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "consultas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "consultas"."cita_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."cita_id" IS 'La cita de la que salio la consulta (00184): es lo que la marca como agendada. UNIQUE: una consulta por cita. NULL en una consulta sin cita.';


--
-- Name: COLUMN "consultas"."area_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."consultas"."area_id" IS 'Area de atencion de la consulta (00184). Con cita, la de la cita; sin cita, opcional. Las consultas anteriores quedan en NULL.';


--
-- Name: departamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."departamentos" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "departamentos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."departamentos" IS 'Los 22 departamentos de Guatemala. Catalogo fijo, cargado por migracion.';


--
-- Name: COLUMN "departamentos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."departamentos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "departamentos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."departamentos"."nombre" IS 'Nombre del departamento.';


--
-- Name: COLUMN "departamentos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."departamentos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "departamentos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."departamentos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: diagnosticos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."diagnosticos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "codigo" character varying(20),
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE "diagnosticos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."diagnosticos" IS 'Catalogo de diagnosticos que se eligen en la consulta. La organizacion lo amplia; un diagnostico se desactiva, no se borra.';


--
-- Name: COLUMN "diagnosticos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "diagnosticos"."codigo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."codigo" IS 'Codigo CIE-10. Unico entre las filas que lo tienen (idx_diagnosticos_codigo_unico, 00105). Nullable a proposito: un diagnostico local sin equivalente CIE-10 es valido.';


--
-- Name: COLUMN "diagnosticos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."nombre" IS 'Nombre del diagnostico.';


--
-- Name: COLUMN "diagnosticos"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."descripcion" IS 'Descripcion o criterios, opcional.';


--
-- Name: COLUMN "diagnosticos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "diagnosticos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "diagnosticos"."activo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."diagnosticos"."activo" IS 'FALSE retira el diagnostico del selector de la consulta medica (issue #639) sin borrarlo: consulta_diagnostico lo referencia ON DELETE RESTRICT (00018) y las consultas que ya lo citan no cambian. Mismo patron que medicamentos.activo (00050).';


--
-- Name: donacion_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."donacion_detalle" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "donacion_id" "uuid" NOT NULL,
    "descripcion" character varying(200) NOT NULL,
    "cantidad" numeric(12,2),
    "unidad" character varying(50),
    "monto" numeric(12,2),
    "lote_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "medicamento_id" "uuid",
    CONSTRAINT "chk_donacion_detalle_cantidad_positiva" CHECK ((("cantidad" IS NULL) OR ("cantidad" > (0)::numeric))),
    CONSTRAINT "chk_donacion_detalle_monto_no_negativo" CHECK ((("monto" IS NULL) OR ("monto" >= (0)::numeric)))
);


--
-- Name: TABLE "donacion_detalle"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."donacion_detalle" IS 'Renglones de una donacion: que se dono y cuanto. Un renglon de medicamentos puede enlazarse al lote que se creo al ingresarlo a inventario.';


--
-- Name: COLUMN "donacion_detalle"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "donacion_detalle"."donacion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."donacion_id" IS 'Donacion a la que pertenece.';


--
-- Name: COLUMN "donacion_detalle"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."descripcion" IS 'Que se dono.';


--
-- Name: COLUMN "donacion_detalle"."cantidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."cantidad" IS 'Cantidad, en articulos donados.';


--
-- Name: COLUMN "donacion_detalle"."unidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."unidad" IS 'Unidad de la cantidad.';


--
-- Name: COLUMN "donacion_detalle"."monto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."monto" IS 'Monto en quetzales, en una donacion de dinero o de servicios.';


--
-- Name: COLUMN "donacion_detalle"."lote_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."lote_id" IS 'Lote que se creo al ingresar este renglon a inventario; unico.';


--
-- Name: COLUMN "donacion_detalle"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "donacion_detalle"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "donacion_detalle"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donacion_detalle"."medicamento_id" IS 'Articulo del catalogo del renglon: un medicamento en una donacion de medicamentos, un insumo en una de insumos (00135, 00170). NULL en dinero y servicios, y en los insumos registrados antes de la 00170.';


--
-- Name: donaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."donaciones" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "donante_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tipo" "public"."tipo_donacion" NOT NULL,
    "observaciones" "text",
    "estado" "public"."estado_donacion" DEFAULT 'registrada'::"public"."estado_donacion" NOT NULL,
    "motivo_anulacion" "text",
    "anulada_por" "uuid",
    "anulada_en" timestamp with time zone,
    "registrado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proyecto_id" "uuid",
    "jornada_id" "uuid",
    CONSTRAINT "chk_donaciones_anulacion_coherente" CHECK (((("estado" = 'registrada'::"public"."estado_donacion") AND ("motivo_anulacion" IS NULL) AND ("anulada_por" IS NULL) AND ("anulada_en" IS NULL)) OR (("estado" = 'anulada'::"public"."estado_donacion") AND ("motivo_anulacion" IS NOT NULL) AND ("anulada_por" IS NOT NULL) AND ("anulada_en" IS NOT NULL))))
);


--
-- Name: TABLE "donaciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."donaciones" IS 'Donacion recibida: de quien, cuando, de que tipo y, opcionalmente, para que proyecto o jornada. Se anula, no se borra.';


--
-- Name: COLUMN "donaciones"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "donaciones"."donante_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."donante_id" IS 'Quien dono.';


--
-- Name: COLUMN "donaciones"."fecha"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."fecha" IS 'Cuando se recibio.';


--
-- Name: COLUMN "donaciones"."tipo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."tipo" IS 'Dinero, medicamentos, insumos o servicios.';


--
-- Name: COLUMN "donaciones"."observaciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."observaciones" IS 'Observaciones.';


--
-- Name: COLUMN "donaciones"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."estado" IS 'Registrada o anulada. Desde la 00173 una donacion ya no se anula: solo las anuladas antes conservan ese estado.';


--
-- Name: COLUMN "donaciones"."motivo_anulacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."motivo_anulacion" IS 'Por que se anulo; obligatorio al anular.';


--
-- Name: COLUMN "donaciones"."anulada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."anulada_por" IS 'Quien la anulo.';


--
-- Name: COLUMN "donaciones"."anulada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."anulada_en" IS 'Cuando se anulo.';


--
-- Name: COLUMN "donaciones"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."registrado_por" IS 'Quien la registro.';


--
-- Name: COLUMN "donaciones"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "donaciones"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "donaciones"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."proyecto_id" IS 'Proyecto al que se destina, si alguno. Si hay jornada, es el de la jornada (00153).';


--
-- Name: COLUMN "donaciones"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donaciones"."jornada_id" IS 'Jornada para la que se recibio la donacion (00153). Si esta puesta, proyecto_id es el de la jornada.';


--
-- Name: donantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."donantes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "tipo" "public"."tipo_donante" NOT NULL,
    "contacto" character varying(150),
    "telefono" character varying(20),
    "email" "extensions"."citext",
    "direccion" character varying(200),
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "donantes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."donantes" IS 'Personas u organizaciones que donan. Se dan de baja, no se borran.';


--
-- Name: COLUMN "donantes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "donantes"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."nombre" IS 'Nombre del donante.';


--
-- Name: COLUMN "donantes"."tipo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."tipo" IS 'Persona u organizacion.';


--
-- Name: COLUMN "donantes"."contacto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."contacto" IS 'Persona de contacto.';


--
-- Name: COLUMN "donantes"."telefono"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."telefono" IS 'Telefono de contacto.';


--
-- Name: COLUMN "donantes"."email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."email" IS 'Correo de contacto.';


--
-- Name: COLUMN "donantes"."direccion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."direccion" IS 'Direccion.';


--
-- Name: COLUMN "donantes"."activo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."activo" IS 'FALSE = dado de baja.';


--
-- Name: COLUMN "donantes"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "donantes"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."donantes"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: eventos_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."eventos_auditoria" (
    "id" bigint NOT NULL,
    "tabla_afectada" "text" NOT NULL,
    "fila_id" "uuid" NOT NULL,
    "operacion" "public"."operacion_auditoria" NOT NULL,
    "realizado_por" "uuid",
    "realizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valores_anteriores" "jsonb",
    "valores_nuevos" "jsonb"
);


--
-- Name: TABLE "eventos_auditoria"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."eventos_auditoria" IS 'Bitacora de cambios sobre informacion sensible. Se escribe solo por trigger y solo la lee la administradora. Sin politicas de INSERT, UPDATE ni DELETE: con RLS habilitado, lo que no tiene politica esta prohibido. No se usa FORCE ROW LEVEL SECURITY porque el dueno debe seguir eximido para que los triggers SECURITY DEFINER puedan insertar.';


--
-- Name: COLUMN "eventos_auditoria"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "eventos_auditoria"."tabla_afectada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."tabla_afectada" IS 'Tabla en la que ocurrio el cambio.';


--
-- Name: COLUMN "eventos_auditoria"."fila_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."fila_id" IS 'Llave primaria de la fila auditada. UUID porque las seis tablas auditadas la usan.';


--
-- Name: COLUMN "eventos_auditoria"."operacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."operacion" IS 'La baja se distingue de una actualizacion cualquiera: es el UPDATE que estrena fecha_baja.';


--
-- Name: COLUMN "eventos_auditoria"."realizado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."realizado_por" IS 'Perfil que origino el cambio. Sin llave foranea para que el registro sobreviva al borrado del perfil. NULL si la operacion no viene de una sesion.';


--
-- Name: COLUMN "eventos_auditoria"."realizado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."realizado_en" IS 'Cuando ocurrio.';


--
-- Name: COLUMN "eventos_auditoria"."valores_anteriores"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."valores_anteriores" IS 'Fila completa antes del cambio. Incluye datos de pacientes, y por eso la tabla es de lectura exclusiva de la administradora.';


--
-- Name: COLUMN "eventos_auditoria"."valores_nuevos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."eventos_auditoria"."valores_nuevos" IS 'La fila despues del cambio (to_jsonb(NEW)); NULL en un borrado.';


--
-- Name: eventos_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."eventos_auditoria" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."eventos_auditoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: existencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."existencias" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "bodega_id" "uuid" NOT NULL,
    "cantidad_disponible" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_existencias_cantidad_no_negativa" CHECK (("cantidad_disponible" >= 0))
);


--
-- Name: TABLE "existencias"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."existencias" IS 'Cuanto hay de cada lote en cada bodega. La mantienen los movimientos aprobados; nadie la escribe a mano.';


--
-- Name: COLUMN "existencias"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "existencias"."lote_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."lote_id" IS 'Lote.';


--
-- Name: COLUMN "existencias"."bodega_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."bodega_id" IS 'Bodega.';


--
-- Name: COLUMN "existencias"."cantidad_disponible"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."cantidad_disponible" IS 'Unidades disponibles ahora; nunca negativa.';


--
-- Name: COLUMN "existencias"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "existencias"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."existencias"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: expedientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."expedientes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "numero_ficha" character varying(30) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "expedientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."expedientes" IS 'Expediente clinico de un paciente: uno por paciente, con su numero de ficha. Las consultas cuelgan de el.';


--
-- Name: COLUMN "expedientes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."expedientes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "expedientes"."paciente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."expedientes"."paciente_id" IS 'Paciente dueno del expediente (unico).';


--
-- Name: COLUMN "expedientes"."numero_ficha"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."expedientes"."numero_ficha" IS 'Numero de ficha que ve el personal. Lo genera la base con una secuencia (00081).';


--
-- Name: COLUMN "expedientes"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."expedientes"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "expedientes"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."expedientes"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: expedientes_numero_ficha_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."expedientes_numero_ficha_seq"
    START WITH 0
    INCREMENT BY 1
    MINVALUE 0
    NO MAXVALUE
    CACHE 1;


--
-- Name: expedientes_numero_ficha_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."expedientes_numero_ficha_seq" OWNED BY "public"."expedientes"."numero_ficha";


--
-- Name: fuentes_de_presupuesto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."fuentes_de_presupuesto" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(120) NOT NULL,
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_fuentes_de_presupuesto_nombre" CHECK (("length"("btrim"(("nombre")::"text")) > 0))
);


--
-- Name: TABLE "fuentes_de_presupuesto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."fuentes_de_presupuesto" IS 'Quien aporta de fuera al presupuesto de una jornada (origen aporte_externo). Catalogo que crece desde "Registrar un aporte".';


--
-- Name: COLUMN "fuentes_de_presupuesto"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fuentes_de_presupuesto"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "fuentes_de_presupuesto"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fuentes_de_presupuesto"."nombre" IS 'Nombre de quien aporta.';


--
-- Name: COLUMN "fuentes_de_presupuesto"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fuentes_de_presupuesto"."registrado_por" IS 'Quien la registro.';


--
-- Name: COLUMN "fuentes_de_presupuesto"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."fuentes_de_presupuesto"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gastos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "concepto" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "responsable_id" "uuid",
    "estado" "public"."estado_gasto" DEFAULT 'pendiente'::"public"."estado_gasto" NOT NULL,
    "registrado_por" "uuid" NOT NULL,
    "aprobado_por" "uuid",
    "aprobado_en" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "motivo_rechazo" "text",
    CONSTRAINT "chk_gastos_motivo_rechazo_coherente" CHECK (((("estado" = 'rechazado'::"public"."estado_gasto") AND ("motivo_rechazo" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "motivo_rechazo")) > 0)) OR (("estado" <> 'rechazado'::"public"."estado_gasto") AND ("motivo_rechazo" IS NULL)))),
    CONSTRAINT "gastos_monto_check" CHECK (("monto" > (0)::numeric))
);


--
-- Name: TABLE "gastos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."gastos" IS 'Gasto de una jornada. Se registra pendiente y lo aprueba o rechaza quien administra presupuestos.';


--
-- Name: COLUMN "gastos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "gastos"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."jornada_id" IS 'Jornada a la que se carga el gasto.';


--
-- Name: COLUMN "gastos"."concepto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."concepto" IS 'En que se gasto.';


--
-- Name: COLUMN "gastos"."categoria"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."categoria" IS 'Categoria del gasto: el nombre de una fila de categorias_de_gasto (00158; antes el enum categoria_gasto).';


--
-- Name: COLUMN "gastos"."monto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."monto" IS 'Monto en quetzales; mayor que cero.';


--
-- Name: COLUMN "gastos"."fecha"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."fecha" IS 'Fecha del gasto.';


--
-- Name: COLUMN "gastos"."responsable_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."responsable_id" IS 'Quien hizo el gasto.';


--
-- Name: COLUMN "gastos"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."estado" IS 'Pendiente, aprobado o rechazado.';


--
-- Name: COLUMN "gastos"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."registrado_por" IS 'Quien lo registro.';


--
-- Name: COLUMN "gastos"."aprobado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."aprobado_por" IS 'Quien lo aprobo o rechazo.';


--
-- Name: COLUMN "gastos"."aprobado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."aprobado_en" IS 'Cuando se aprobo o rechazo.';


--
-- Name: COLUMN "gastos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "gastos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "gastos"."motivo_rechazo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."gastos"."motivo_rechazo" IS 'Motivo obligatorio al rechazar un gasto (issue #490). El CHECK chk_gastos_motivo_rechazo_coherente obliga a que viaje junto con estado = rechazado y a que este en NULL en cualquier otro estado.';


--
-- Name: idiomas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."idiomas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "codigo" character varying(30) NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "idiomas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."idiomas" IS 'Catalogo de idiomas del paciente (issue #663). Sustituye al enum idioma_preferido de la 00001, que obligaba a una migracion por cada idioma nuevo. pacientes.idioma referencia codigo, no id, para que las pruebas y las semillas que ya escriben el valor por su nombre sigan siendo validas. Agregar un idioma es un INSERT.';


--
-- Name: COLUMN "idiomas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."idiomas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "idiomas"."codigo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."idiomas"."codigo" IS 'Clave del idioma; la guarda pacientes.idioma.';


--
-- Name: COLUMN "idiomas"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."idiomas"."nombre" IS 'Nombre del idioma para mostrar.';


--
-- Name: COLUMN "idiomas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."idiomas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: jornada_estado_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."jornada_estado_historial" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "estado_anterior" "public"."estado_jornada",
    "estado_nuevo" "public"."estado_jornada" NOT NULL,
    "cambiado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "jornada_estado_historial"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."jornada_estado_historial" IS 'Cada cambio de estado de una jornada, con quien lo hizo. Lo escribe un trigger.';


--
-- Name: COLUMN "jornada_estado_historial"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "jornada_estado_historial"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."jornada_id" IS 'Jornada.';


--
-- Name: COLUMN "jornada_estado_historial"."estado_anterior"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."estado_anterior" IS 'Estado del que salio; NULL al crearse.';


--
-- Name: COLUMN "jornada_estado_historial"."estado_nuevo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."estado_nuevo" IS 'Estado al que paso.';


--
-- Name: COLUMN "jornada_estado_historial"."cambiado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."cambiado_por" IS 'Quien hizo el cambio.';


--
-- Name: COLUMN "jornada_estado_historial"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_estado_historial"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: jornada_insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."jornada_insumos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "medicamento_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "unidad" character varying(30) NOT NULL,
    "costo_unitario_estimado" numeric(12,2),
    "nota" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_jornada_insumos_cantidad" CHECK (("cantidad" > 0)),
    CONSTRAINT "chk_jornada_insumos_costo" CHECK ((("costo_unitario_estimado" IS NULL) OR ("costo_unitario_estimado" >= (0)::numeric))),
    CONSTRAINT "chk_jornada_insumos_nota" CHECK ((("nota" IS NULL) OR (("length"("btrim"("nota")) > 0) AND ("length"("nota") <= 500)))),
    CONSTRAINT "chk_jornada_insumos_unidad" CHECK (("length"("btrim"(("unidad")::"text")) > 0))
);


--
-- Name: TABLE "jornada_insumos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."jornada_insumos" IS 'Articulos del catalogo de inventario PREVISTOS para una jornada: cantidad, unidad y costo unitario estimado. Lista de planificacion: no descuenta ni reserva existencias (mismo criterio que proyecto_insumos, 00147).';


--
-- Name: COLUMN "jornada_insumos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "jornada_insumos"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."jornada_id" IS 'Jornada para la que se preve el articulo.';


--
-- Name: COLUMN "jornada_insumos"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."medicamento_id" IS 'Articulo del catalogo de inventario.';


--
-- Name: COLUMN "jornada_insumos"."cantidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."cantidad" IS 'Cantidad prevista; mayor que cero.';


--
-- Name: COLUMN "jornada_insumos"."unidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."unidad" IS 'Unidad de la cantidad (cajas, unidades, ...).';


--
-- Name: COLUMN "jornada_insumos"."costo_unitario_estimado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."costo_unitario_estimado" IS 'Costo estimado de UNA unidad, en quetzales. NULL cuando no se estimo. El total es cantidad x este valor y no se guarda.';


--
-- Name: COLUMN "jornada_insumos"."nota"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."nota" IS 'Observacion opcional.';


--
-- Name: COLUMN "jornada_insumos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "jornada_insumos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_insumos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: jornada_personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."jornada_personal" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "rol_en_jornada" "public"."rol_usuario" NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fin" time without time zone NOT NULL,
    "responsabilidad" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asistio" boolean DEFAULT false NOT NULL,
    CONSTRAINT "chk_jornada_personal_horario" CHECK (("hora_fin" > "hora_inicio"))
);


--
-- Name: TABLE "jornada_personal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."jornada_personal" IS 'Equipo de una jornada: quien va, con que rol, en que horario y si asistio.';


--
-- Name: COLUMN "jornada_personal"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "jornada_personal"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."jornada_id" IS 'Jornada.';


--
-- Name: COLUMN "jornada_personal"."perfil_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."perfil_id" IS 'Persona asignada.';


--
-- Name: COLUMN "jornada_personal"."rol_en_jornada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."rol_en_jornada" IS 'Rol con el que participa.';


--
-- Name: COLUMN "jornada_personal"."hora_inicio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."hora_inicio" IS 'Hora en que empieza su turno.';


--
-- Name: COLUMN "jornada_personal"."hora_fin"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."hora_fin" IS 'Hora en que termina su turno.';


--
-- Name: COLUMN "jornada_personal"."responsabilidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."responsabilidad" IS 'Que le toca hacer, en texto libre.';


--
-- Name: COLUMN "jornada_personal"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "jornada_personal"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "jornada_personal"."asistio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_personal"."asistio" IS 'Si llego a la jornada; se marca al cerrarla.';


--
-- Name: jornada_presupuesto_origen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."jornada_presupuesto_origen" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "origen" "public"."origen_de_presupuesto" NOT NULL,
    "donacion_id" "uuid",
    "monto" numeric(12,2) NOT NULL,
    "descripcion" character varying(200),
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fuente_id" "uuid",
    "devuelto" numeric(12,2) DEFAULT 0 NOT NULL,
    "traspasado_desde" "uuid",
    CONSTRAINT "chk_presupuesto_origen_devuelto" CHECK ((("devuelto" >= (0)::numeric) AND ("devuelto" <= "monto"))),
    CONSTRAINT "chk_presupuesto_origen_donacion_coherente" CHECK ((("origen" = 'donacion'::"public"."origen_de_presupuesto") = ("donacion_id" IS NOT NULL))),
    CONSTRAINT "chk_presupuesto_origen_fuente_solo_externo" CHECK ((("fuente_id" IS NULL) OR ("origen" = 'aporte_externo'::"public"."origen_de_presupuesto"))),
    CONSTRAINT "chk_presupuesto_origen_monto_positivo" CHECK (("monto" > (0)::numeric))
);


--
-- Name: TABLE "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."jornada_presupuesto_origen" IS 'De donde viene cada parte del presupuesto de una jornada (issue #840). jornadas.presupuesto_asignado es la suma de estas filas y la mantiene fn_sincronizar_presupuesto_de_jornada; nadie la escribe a mano.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."jornada_id" IS 'Jornada cuyo presupuesto se explica.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."origen" IS 'donacion: sale de una donacion de dinero (donacion_id). fondos_propios: dinero de la organizacion. aporte_externo: otra fuente que no pasa por el registro de donaciones. sin_clasificar: el presupuesto que existia antes de la 00135, o el de un INSERT de jornada que traia el monto ya puesto. caja: sale de la caja, donde queda el sobrante que no vuelve a una donacion (00168).';


--
-- Name: COLUMN "jornada_presupuesto_origen"."donacion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."donacion_id" IS 'La donacion de dinero de la que sale el monto. Obligatoria si y solo si origen = donacion.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."monto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."monto" IS 'Parte del presupuesto que viene de este origen.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."descripcion" IS 'Detalle del aporte.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."registrado_por" IS 'Quien lo registro.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."fuente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."fuente_id" IS 'Quien hizo el aporte externo (fuentes_de_presupuesto). Opcional: el detalle libre sigue existiendo.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."devuelto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."devuelto" IS 'Lo que salio de la jornada al liquidar su sobrante: devuelto a su origen o traspasado a otra jornada (00160). Lo que cuenta del aporte es monto - devuelto.';


--
-- Name: COLUMN "jornada_presupuesto_origen"."traspasado_desde"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornada_presupuesto_origen"."traspasado_desde" IS 'Si este aporte es el sobrante de otra jornada, el aporte del que salio (00160).';


--
-- Name: jornadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."jornadas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "fecha" "date" NOT NULL,
    "comunidad_id" "uuid" NOT NULL,
    "responsable_id" "uuid" NOT NULL,
    "proyecto_id" "uuid",
    "estado" "public"."estado_jornada" DEFAULT 'planificada'::"public"."estado_jornada" NOT NULL,
    "presupuesto_asignado" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "codigo" character varying(30) NOT NULL,
    "fecha_inicio_real" timestamp with time zone,
    "fecha_fin_real" timestamp with time zone,
    "cupo_estimado" integer,
    "botiquin_bodega_id" "uuid",
    CONSTRAINT "chk_jornadas_cupo_estimado_no_negativo" CHECK ((("cupo_estimado" IS NULL) OR ("cupo_estimado" >= 0))),
    CONSTRAINT "chk_jornadas_fecha_no_anterior_a_creacion" CHECK (("fecha" >= (("created_at" AT TIME ZONE 'America/Guatemala'::"text"))::"date")),
    CONSTRAINT "chk_jornadas_presupuesto_no_negativo" CHECK (("presupuesto_asignado" >= (0)::numeric))
);


--
-- Name: TABLE "jornadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."jornadas" IS 'Jornada medica o dental en una comunidad: su fecha, responsable, estado, presupuesto y, si lo tiene, el proyecto al que pertenece.';


--
-- Name: COLUMN "jornadas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "jornadas"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."nombre" IS 'Nombre de la jornada.';


--
-- Name: COLUMN "jornadas"."fecha"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."fecha" IS 'Fecha programada; no puede ser anterior a la creacion.';


--
-- Name: COLUMN "jornadas"."comunidad_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."comunidad_id" IS 'Comunidad donde se hace.';


--
-- Name: COLUMN "jornadas"."responsable_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."responsable_id" IS 'Persona a cargo.';


--
-- Name: COLUMN "jornadas"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."proyecto_id" IS 'Proyecto social al que pertenece. Obligatorio al crear la jornada y no se puede quitar (00169); solo las jornadas anteriores a la 00169 pueden no tenerlo.';


--
-- Name: COLUMN "jornadas"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."estado" IS 'Planificada, en curso, finalizada o cancelada. Las transiciones las valida un trigger.';


--
-- Name: COLUMN "jornadas"."presupuesto_asignado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."presupuesto_asignado" IS 'Presupuesto de la jornada: la suma de sus origenes en jornada_presupuesto_origen, que mantiene un trigger. No se escribe a mano (00135).';


--
-- Name: COLUMN "jornadas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "jornadas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "jornadas"."codigo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."codigo" IS 'Identificador legible generado por el servidor (issue #756), nunca por quien registra: el DEFAULT toma el siguiente valor de jornadas_codigo_seq, formateado "JOR-" + 6 digitos con ceros a la izquierda. No es un campo de formulario: packages/shared/jornadas/campos.js ya no lo declara en CAMPOS_JORNADA (antes lo hacia, pero CAMPOS_FORMULARIO_JORNADA -issue #179- lo excluia del formulario real de todos modos).';


--
-- Name: COLUMN "jornadas"."fecha_inicio_real"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."fecha_inicio_real" IS 'Cuando empezo de verdad: la fija un trigger al pasarla a en curso (00174).';


--
-- Name: COLUMN "jornadas"."fecha_fin_real"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."fecha_fin_real" IS 'Cuando termino de verdad: la fija un trigger al finalizarla, y reabrirla la borra (00174).';


--
-- Name: COLUMN "jornadas"."cupo_estimado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."cupo_estimado" IS 'Cuantos pacientes se espera atender.';


--
-- Name: COLUMN "jornadas"."botiquin_bodega_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."jornadas"."botiquin_bodega_id" IS 'Bodega de la que salen las entregas de la jornada: una bodega movil, que viaja a la jornada y se carga desde la pestana Insumos, o la bodega principal, que entrega directo y no se carga ni se devuelve (00181). Obligatoria al crear la jornada y no se puede quitar (00178); solo las jornadas anteriores a la 00178 pueden no tenerla.';


--
-- Name: jornadas_codigo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."jornadas_codigo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jornadas_codigo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."jornadas_codigo_seq" OWNED BY "public"."jornadas"."codigo";


--
-- Name: limites_de_uso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."limites_de_uso" (
    "recurso" "text" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "contador" integer DEFAULT 1 NOT NULL,
    "ventana_inicio" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "limites_de_uso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."limites_de_uso" IS 'Contador de limite de peticiones (rate limiting) por recurso y actor, con ventana de tiempo fija que se reinicia sola al expirar (issue #761). recurso identifica que se limita (''invitar_usuario'', ''buscar_pacientes''); actor_id es quien lo dispara. No expuesta a PostgREST ni a ningun rol de aplicacion: solo la tocan las funciones SECURITY DEFINER de esta migracion.';


--
-- Name: COLUMN "limites_de_uso"."recurso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."limites_de_uso"."recurso" IS 'Que se limita (por ejemplo invitaciones o busqueda de pacientes).';


--
-- Name: COLUMN "limites_de_uso"."actor_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."limites_de_uso"."actor_id" IS 'Perfil al que se le cuentan las peticiones.';


--
-- Name: COLUMN "limites_de_uso"."contador"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."limites_de_uso"."contador" IS 'Peticiones hechas dentro de la ventana actual.';


--
-- Name: COLUMN "limites_de_uso"."ventana_inicio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."limites_de_uso"."ventana_inicio" IS 'Cuando empezo la ventana de tiempo que se esta contando.';


--
-- Name: lotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lotes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "medicamento_id" "uuid" NOT NULL,
    "numero_lote" character varying(50) NOT NULL,
    "fecha_vencimiento" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proveedor_id" "uuid" NOT NULL,
    "origen" "public"."origen_lote" NOT NULL,
    "cantidad_ingresada" integer NOT NULL,
    "fecha_ingreso" "date" DEFAULT CURRENT_DATE NOT NULL,
    "registrado_por" "uuid",
    "confirmado" boolean DEFAULT false NOT NULL,
    "costo_unitario" numeric(12,2),
    "moneda" "public"."moneda_lote" DEFAULT 'GTQ'::"public"."moneda_lote" NOT NULL,
    CONSTRAINT "chk_lotes_cantidad_positiva" CHECK (("cantidad_ingresada" > 0)),
    CONSTRAINT "chk_lotes_vencimiento_posterior" CHECK (("fecha_vencimiento" >= "fecha_ingreso"))
);


--
-- Name: TABLE "lotes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."lotes" IS 'Lote de un articulo: numero, vencimiento, de donde vino y cuanto entro. Lo disponible por bodega esta en existencias.';


--
-- Name: COLUMN "lotes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "lotes"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."medicamento_id" IS 'Articulo del lote.';


--
-- Name: COLUMN "lotes"."numero_lote"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."numero_lote" IS 'Numero de lote del fabricante.';


--
-- Name: COLUMN "lotes"."fecha_vencimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."fecha_vencimiento" IS 'Fecha de vencimiento; un lote vencido no se entrega. Obligatoria en un lote de medicamento; un lote de insumo puede no tenerla y entonces no vence (00171).';


--
-- Name: COLUMN "lotes"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "lotes"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "lotes"."proveedor_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."proveedor_id" IS 'Proveedor o donante del que entro.';


--
-- Name: COLUMN "lotes"."origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."origen" IS 'Si entro por compra o por donacion.';


--
-- Name: COLUMN "lotes"."cantidad_ingresada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."cantidad_ingresada" IS 'Unidades que entraron con el lote; no cambia al entregar.';


--
-- Name: COLUMN "lotes"."fecha_ingreso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."fecha_ingreso" IS 'Cuando entro a bodega.';


--
-- Name: COLUMN "lotes"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."registrado_por" IS 'Quien dio de alta el lote. NULL en los lotes anteriores a la 00107 y en los que siembra el seed. Es lo que permite que su autor lo corrija mientras siga provisional.';


--
-- Name: COLUMN "lotes"."confirmado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."confirmado" IS 'FALSE mientras el lote sea la propuesta que acompania a un ingreso pendiente; TRUE cuando la administradora aprueba ese ingreso (fn_aplicar_ajuste_existencias, 00107). Un lote sin confirmar no tiene existencias, asi que no se puede dispensar ni recetar.';


--
-- Name: COLUMN "lotes"."costo_unitario"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."costo_unitario" IS 'Costo por unidad al momento del ingreso. NULL significa "no se conoce el costo" -- un lote donado, o uno de compra cuyo precio no se capturo-, NUNCA "cero": forzar un cero mentiria en los reportes financieros tanto como forzar un precio inventado. La funcion de valorizacion (fn_valor_de_inventario_disponible) tiene que declarar cuanto del inventario queda sin valorizar, no sumarlo como cero en silencio. Issue #752.';


--
-- Name: COLUMN "lotes"."moneda"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."lotes"."moneda" IS 'GTQ por defecto porque hoy es la unica moneda del sistema (moneda_lote). No tiene sentido como NULL aunque costo_unitario lo sea: la moneda de un lote es un hecho del sistema, no un dato que se capture por lote. Issue #752.';


--
-- Name: CONSTRAINT "chk_lotes_vencimiento_posterior" ON "lotes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "chk_lotes_vencimiento_posterior" ON "public"."lotes" IS 'Un lote no puede vencer antes de haber ingresado. El limite es inclusivo desde la 00096 (issue #597): que venza el mismo dia en que ingresa es valido, porque un lote que vence hoy se sigue considerando entregable en vista_lotes_disponibles, en fn_aplicar_ajuste_existencias y en esLoteEntregable(). Antes era estricto y la base se negaba a registrar un lote que el resto del sistema si sabia despachar. No compara contra CURRENT_DATE: un lote historico ya vencido se registra con su fecha_ingreso real.';


--
-- Name: medicamento_principio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."medicamento_principio" (
    "medicamento_id" "uuid" NOT NULL,
    "principio_id" "uuid" NOT NULL
);


--
-- Name: TABLE "medicamento_principio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."medicamento_principio" IS 'Principios activos de cada medicamento (un medicamento puede tener varios).';


--
-- Name: COLUMN "medicamento_principio"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamento_principio"."medicamento_id" IS 'Medicamento.';


--
-- Name: COLUMN "medicamento_principio"."principio_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."medicamento_principio"."principio_id" IS 'Principio activo que contiene.';


--
-- Name: movimientos_de_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."movimientos_de_caja" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "tipo" character varying(10) NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "aporte_id" "uuid" NOT NULL,
    "jornada_id" "uuid" NOT NULL,
    "descripcion" character varying(200),
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_movimientos_de_caja_monto_positivo" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "chk_movimientos_de_caja_tipo" CHECK ((("tipo")::"text" = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying])::"text"[])))
);


--
-- Name: TABLE "movimientos_de_caja"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."movimientos_de_caja" IS 'Libro de la caja (00168): entra el sobrante devuelto de los aportes que no son de una donacion y sale lo que se asigna a una jornada con origen caja. Lo escriben fn_liquidar_sobrante_de_jornada y un trigger de jornada_presupuesto_origen; nadie a mano.';


--
-- Name: COLUMN "movimientos_de_caja"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."id" IS 'Identificador del movimiento.';


--
-- Name: COLUMN "movimientos_de_caja"."tipo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."tipo" IS 'entrada: sobrante devuelto a la caja. salida: aporte a una jornada que sale de la caja.';


--
-- Name: COLUMN "movimientos_de_caja"."monto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."monto" IS 'Cuanto entra o sale, en quetzales.';


--
-- Name: COLUMN "movimientos_de_caja"."aporte_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."aporte_id" IS 'En una entrada, el aporte cuyo sobrante se devolvio; en una salida, el aporte con origen caja.';


--
-- Name: COLUMN "movimientos_de_caja"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."jornada_id" IS 'La jornada de ese aporte: de la que viene el sobrante o la que recibe el dinero.';


--
-- Name: COLUMN "movimientos_de_caja"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."descripcion" IS 'Que fue, en palabras.';


--
-- Name: COLUMN "movimientos_de_caja"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."registrado_por" IS 'Quien hizo la operacion.';


--
-- Name: COLUMN "movimientos_de_caja"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_de_caja"."created_at" IS 'Cuando entro o salio el dinero.';


--
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."movimientos_inventario" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "tipo" "public"."tipo_movimiento" NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "bodega_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "motivo" "text" NOT NULL,
    "estado" "public"."estado_movimiento" DEFAULT 'pendiente'::"public"."estado_movimiento" NOT NULL,
    "registrado_por" "uuid" NOT NULL,
    "aprobado_por" "uuid",
    "aprobado_en" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aprobacion_automatica" boolean DEFAULT false NOT NULL,
    "motivo_rechazo" "text",
    "jornada_id" "uuid",
    "receta_id" "uuid",
    CONSTRAINT "chk_movimientos_motivo_rechazo_coherente" CHECK (((("estado" = 'rechazado'::"public"."estado_movimiento") AND ("motivo_rechazo" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "motivo_rechazo")) > 0)) OR (("estado" <> 'rechazado'::"public"."estado_movimiento") AND ("motivo_rechazo" IS NULL)))),
    CONSTRAINT "movimientos_inventario_cantidad_check" CHECK (("cantidad" > 0))
);


--
-- Name: TABLE "movimientos_inventario"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."movimientos_inventario" IS 'Ingresos y salidas de inventario. Un movimiento pendiente no cambia existencias; al aprobarse, si.';


--
-- Name: COLUMN "movimientos_inventario"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "movimientos_inventario"."tipo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."tipo" IS 'Ingreso o salida.';


--
-- Name: COLUMN "movimientos_inventario"."lote_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."lote_id" IS 'Lote que se mueve.';


--
-- Name: COLUMN "movimientos_inventario"."bodega_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."bodega_id" IS 'Bodega en la que entra o de la que sale.';


--
-- Name: COLUMN "movimientos_inventario"."cantidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."cantidad" IS 'Unidades que se mueven; mayor que cero.';


--
-- Name: COLUMN "movimientos_inventario"."motivo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."motivo" IS 'Por que: numero de comprobante en un ingreso, o entrega, traslado, baja o donacion en una salida.';


--
-- Name: COLUMN "movimientos_inventario"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."estado" IS 'Pendiente, aprobado o rechazado.';


--
-- Name: COLUMN "movimientos_inventario"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."registrado_por" IS 'Quien lo registro.';


--
-- Name: COLUMN "movimientos_inventario"."aprobado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."aprobado_por" IS 'Quien lo aprobo; la misma persona si se aprobo solo por su rol.';


--
-- Name: COLUMN "movimientos_inventario"."aprobado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."aprobado_en" IS 'Cuando se aprobo.';


--
-- Name: COLUMN "movimientos_inventario"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "movimientos_inventario"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "movimientos_inventario"."aprobacion_automatica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."aprobacion_automatica" IS 'TRUE cuando el estado aprobado lo fijo el trigger tr_autoaprobar_movimiento_inventario al insertar (administrador). FALSE en el flujo manual de aprobacion de #80, incluido el caso en el que un administrador aprueba manualmente un movimiento pendiente ya existente.';


--
-- Name: COLUMN "movimientos_inventario"."motivo_rechazo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."motivo_rechazo" IS 'Motivo obligatorio al rechazar un movimiento (issue #491, mismo patron que gastos.motivo_rechazo de la 00071). El CHECK chk_movimientos_motivo_rechazo_coherente obliga a que viaje junto con estado = rechazado y a que este en NULL en cualquier otro estado.';


--
-- Name: COLUMN "movimientos_inventario"."jornada_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."jornada_id" IS 'Jornada para la que se movio el inventario: la carga de su bodega movil (fn_cargar_insumo_a_bodega_de_jornada, 00178). NULL en cualquier otro movimiento.';


--
-- Name: COLUMN "movimientos_inventario"."receta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."movimientos_inventario"."receta_id" IS 'Receta de la que sale el movimiento: la salida que registra fn_generar_receta, el ajuste de fn_ajustar_entrega_receta y la devolucion al anularla (00186). NULL en cualquier otro movimiento.';


--
-- Name: municipios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."municipios" (
    "id" integer NOT NULL,
    "departamento_id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "municipios"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."municipios" IS 'Municipios de Guatemala, cada uno en su departamento. Catalogo fijo, cargado por migracion.';


--
-- Name: COLUMN "municipios"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."municipios"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "municipios"."departamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."municipios"."departamento_id" IS 'Departamento al que pertenece.';


--
-- Name: COLUMN "municipios"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."municipios"."nombre" IS 'Nombre del municipio.';


--
-- Name: COLUMN "municipios"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."municipios"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "municipios"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."municipios"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "email" "extensions"."citext" NOT NULL,
    "telefono" character varying(20),
    "rol" "public"."rol_usuario" DEFAULT 'voluntario general'::"public"."rol_usuario" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "fecha_ingreso" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "direccion" "text",
    "notas" "text"
);


--
-- Name: TABLE "perfiles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."perfiles" IS 'Persona que usa el sistema. Una fila por cuenta de auth.users (mismo id), creada por trigger al invitarla. Su rol decide que modulos ve y que puede hacer.';


--
-- Name: COLUMN "perfiles"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "perfiles"."nombres"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."nombres" IS 'Nombres de la persona.';


--
-- Name: COLUMN "perfiles"."apellidos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."apellidos" IS 'Apellidos de la persona.';


--
-- Name: COLUMN "perfiles"."email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."email" IS 'Correo con el que inicia sesion; unico, sin distinguir mayusculas (citext).';


--
-- Name: COLUMN "perfiles"."telefono"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."telefono" IS 'Telefono de contacto. Solo lo ven la administradora y la propia persona (perfiles_directorio lo enmascara).';


--
-- Name: COLUMN "perfiles"."rol"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."rol" IS 'Rol en el sistema (rol_usuario). Decide modulos y permisos por defecto.';


--
-- Name: COLUMN "perfiles"."activo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."activo" IS 'FALSE = cuenta desactivada: no inicia sesion ni tiene privilegios. Se desactiva, no se borra.';


--
-- Name: COLUMN "perfiles"."fecha_ingreso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."fecha_ingreso" IS 'Desde cuando colabora con la organizacion.';


--
-- Name: COLUMN "perfiles"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "perfiles"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "perfiles"."direccion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."direccion" IS 'Direccion de contacto en texto libre (ej. "Zona 10, Guatemala"). Nulable: dato opcional, sin formulario que lo escriba todavia.';


--
-- Name: COLUMN "perfiles"."notas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfiles"."notas" IS 'Notas internas sobre la persona (ej. disponibilidad, rol dentro del equipo). Nulable: dato opcional, sin formulario que lo escriba todavia.';


--
-- Name: nombres_de_perfiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."nombres_de_perfiles" WITH ("security_barrier"='true') AS
 SELECT "id",
    "nombres",
    "apellidos",
    "activo"
   FROM "public"."perfiles" "p"
  WHERE ("public"."rol_actual"() IS NOT NULL);


--
-- Name: VIEW "nombres_de_perfiles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."nombres_de_perfiles" IS 'Nombre de cada persona (id, nombres, apellidos, activo), sin datos de contacto, para toda persona activa (00161). Pone nombre a los ids que el RLS de cada tabla ya deja ver.';


--
-- Name: COLUMN "nombres_de_perfiles"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."nombres_de_perfiles"."id" IS 'Id del perfil (perfiles.id).';


--
-- Name: COLUMN "nombres_de_perfiles"."nombres"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."nombres_de_perfiles"."nombres" IS 'Nombres de la persona.';


--
-- Name: COLUMN "nombres_de_perfiles"."apellidos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."nombres_de_perfiles"."apellidos" IS 'Apellidos de la persona.';


--
-- Name: COLUMN "nombres_de_perfiles"."activo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."nombres_de_perfiles"."activo" IS 'Si la persona esta activa; una inactiva conserva su nombre en lo que ya hizo.';


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notificaciones" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "categoria" "public"."categoria_notificacion" NOT NULL,
    "titulo" "text" NOT NULL,
    "cuerpo" "text" NOT NULL,
    "enlace" "text" NOT NULL,
    "origen_tabla" "text" NOT NULL,
    "origen_id" "uuid" NOT NULL,
    "leida_en" timestamp with time zone,
    "correo_enviado_en" timestamp with time zone,
    "correo_intentado_en" timestamp with time zone,
    "correo_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_notificaciones_enlace_es_ruta" CHECK (("enlace" ~~ '/%'::"text")),
    CONSTRAINT "chk_notificaciones_titulo_no_vacio" CHECK (("length"(TRIM(BOTH FROM "titulo")) > 0))
);


--
-- Name: TABLE "notificaciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."notificaciones" IS 'Buzon interno de cada perfil y bandeja de salida del correo (issue #755). Una fila por incidencia y por destinatario. Solo la escriben los triggers de esta migracion; cada perfil lee las suyas y solo puede cambiar leida_en.';


--
-- Name: COLUMN "notificaciones"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "notificaciones"."perfil_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."perfil_id" IS 'Persona que recibe la notificacion.';


--
-- Name: COLUMN "notificaciones"."categoria"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."categoria" IS 'De que trata: caducidad, stock, validacion o presupuestos.';


--
-- Name: COLUMN "notificaciones"."titulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."titulo" IS 'Titulo corto.';


--
-- Name: COLUMN "notificaciones"."cuerpo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."cuerpo" IS 'Texto de la notificacion.';


--
-- Name: COLUMN "notificaciones"."enlace"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."enlace" IS 'Ruta de la web donde se resuelve la incidencia (p. ej. /inventario?tab=alertas). La app movil no la usa tal cual: traduce la categoria a su propia pantalla (packages/shared/notificaciones/categorias.js).';


--
-- Name: COLUMN "notificaciones"."origen_tabla"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."origen_tabla" IS 'Tabla de la incidencia que produjo la notificacion: avisos_caducidad (desde la 00162; antes alertas_caducidad), movimientos_inventario, gastos o medicamentos. Con origen_id identifica la incidencia sin FK, porque apunta a tablas distintas segun la categoria.';


--
-- Name: COLUMN "notificaciones"."origen_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."origen_id" IS 'Fila que la origino, en la tabla que dice origen_tabla. Sin llave foranea: apunta a tablas distintas.';


--
-- Name: COLUMN "notificaciones"."leida_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."leida_en" IS 'Cuando la leyo. NULL = sin leer.';


--
-- Name: COLUMN "notificaciones"."correo_enviado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."correo_enviado_en" IS 'NULL mientras el correo no salio. La Edge Function enviar-notificaciones lo fija solo cuando el servidor SMTP acepto el mensaje, asi que un envio fallido se reintenta y uno exitoso no se repite.';


--
-- Name: COLUMN "notificaciones"."correo_intentado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."correo_intentado_en" IS 'Cuando una corrida de enviar-notificaciones reclamo esta fila. Evita que dos corridas simultaneas (el webhook y la rutina diaria) manden el mismo correo dos veces; si la corrida murio sin terminar, la fila se vuelve a reclamar pasados 15 minutos.';


--
-- Name: COLUMN "notificaciones"."correo_error"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."correo_error" IS 'Error del ultimo intento de enviarla por correo, si fallo.';


--
-- Name: COLUMN "notificaciones"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notificaciones"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: paciente_area; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."paciente_area" (
    "paciente_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "paciente_area"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."paciente_area" IS 'Areas de atencion en las que esta cada paciente; un paciente puede estar en varias (issue #927, 00182).';


--
-- Name: COLUMN "paciente_area"."paciente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."paciente_area"."paciente_id" IS 'Paciente.';


--
-- Name: COLUMN "paciente_area"."area_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."paciente_area"."area_id" IS 'Area de atencion. Una retirada no se puede asignar de nuevo (trg_paciente_area_area_vigente), pero la conserva quien ya la tenia.';


--
-- Name: COLUMN "paciente_area"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."paciente_area"."created_at" IS 'Cuando se le asigno el area.';


--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pacientes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "fecha_nacimiento" "date" NOT NULL,
    "sexo" "public"."sexo_paciente" NOT NULL,
    "comunidad_id" "uuid",
    "telefono_contacto" character varying(20),
    "idioma" character varying(30) NOT NULL,
    "dpi" character varying(20),
    "fecha_baja" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_sangre" "public"."tipo_sanguineo",
    "nombre_responsable" character varying(150),
    "parentesco_responsable" character varying(50),
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "chk_pacientes_dpi_13_digitos" CHECK ((("dpi" IS NULL) OR (("dpi")::"text" ~ '^[0-9]{13}$'::"text")))
);


--
-- Name: TABLE "pacientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."pacientes" IS 'Personas atendidas en las jornadas. Datos personales sensibles: solo los lee el personal que atiende (ver docs/PROTECCION-DE-DATOS.md).';


--
-- Name: COLUMN "pacientes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "pacientes"."nombres"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."nombres" IS 'Nombres del paciente.';


--
-- Name: COLUMN "pacientes"."apellidos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."apellidos" IS 'Apellidos del paciente.';


--
-- Name: COLUMN "pacientes"."fecha_nacimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."fecha_nacimiento" IS 'Fecha de nacimiento; de ella sale la edad a la fecha de cada jornada.';


--
-- Name: COLUMN "pacientes"."sexo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."sexo" IS 'Sexo del paciente, enum sexo_paciente desde la 00132 (issue #699). Hasta entonces era un VARCHAR(20) sin CHECK y cada pantalla podia escribir lo que quisiera.';


--
-- Name: COLUMN "pacientes"."comunidad_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."comunidad_id" IS 'Comunidad del paciente. Opcional desde la issue #657: en jornada no siempre se sabe, y obligarla llevaba a inventar una comunidad o a no registrar a la persona. fn_buscar_pacientes la une con LEFT JOIN para que un paciente sin comunidad siga apareciendo en el listado.';


--
-- Name: COLUMN "pacientes"."telefono_contacto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."telefono_contacto" IS 'Telefono para contactar sobre este paciente: puede ser el suyo o el de un tutor/familiar (comun en comunidades rurales con pacientes menores o adultos mayores sin telefono propio). Se llama distinto a perfiles.telefono/donantes.telefono a proposito -esas si son siempre el telefono de la persona duena del registro- y se documenta en vez de unificarse (issue #412). OPCIONAL desde la issue #838: en muchas comunidades no hay ningun numero al que llamar, y exigirlo llevaba a inventar uno o a no registrar al paciente.';


--
-- Name: COLUMN "pacientes"."idioma"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."idioma" IS 'Idioma en que se le atiende (idiomas.codigo).';


--
-- Name: COLUMN "pacientes"."dpi"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."dpi" IS 'Documento Personal de Identificacion, opcional (un menor o una persona sin documento no lo tiene). Unico cuando existe.';


--
-- Name: COLUMN "pacientes"."fecha_baja"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."fecha_baja" IS 'Fecha en que se dio de baja al paciente (fallecimiento, fusion u otro motivo). NULL = activo.';


--
-- Name: COLUMN "pacientes"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "pacientes"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "pacientes"."tipo_sangre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."tipo_sangre" IS 'Grupo sanguineo, si se conoce.';


--
-- Name: COLUMN "pacientes"."nombre_responsable"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."nombre_responsable" IS 'Persona responsable (de un menor o de quien no puede responder por si mismo).';


--
-- Name: COLUMN "pacientes"."parentesco_responsable"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."parentesco_responsable" IS 'Parentesco de la persona responsable con el paciente.';


--
-- Name: COLUMN "pacientes"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."pacientes"."registrado_por" IS 'Quien registro al paciente (00182). Lo llena el DEFAULT con auth.uid(); NULL en los pacientes anteriores a la 00182 y en los que carga el seed. Quien registro al paciente puede asignarle areas (politicas de paciente_area).';


--
-- Name: CONSTRAINT "chk_pacientes_dpi_13_digitos" ON "pacientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "chk_pacientes_dpi_13_digitos" ON "public"."pacientes" IS 'El DPI guatemalteco tiene exactamente 13 digitos (issue #699). Espejo de REGEX_DPI en packages/shared/pacientes/validaciones.js. NULL sigue permitido: el DPI es opcional. Validado sobre las filas anteriores en la 00137 (issue #847): las que solo tenian separadores se limpiaron, el resto quedo en NULL, y el DPI anterior de cada una esta en eventos_auditoria.';


--
-- Name: pacientes_reporte; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."pacientes_reporte" AS
 SELECT "id",
    "comunidad_id"
   FROM "public"."pacientes"
  WHERE "public"."puede_consultar_reportes"();


--
-- Name: VIEW "pacientes_reporte"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."pacientes_reporte" IS 'Subconjunto no identificable de pacientes (id, comunidad_id) para reportes agregados. SECURITY DEFINER: el owner lee la tabla base pacientes (sin politica para los roles consultivos, 00032); el WHERE de la vista restringe filas a administrador, a los dos roles consultivos y a quien tenga el permiso fino reportes.exportar (issue #409). Acceso controlado por GRANT (las vistas no soportan RLS).';


--
-- Name: padecimientos_cronicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."padecimientos_cronicos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "condicion_id" "uuid" NOT NULL,
    "fecha_diagnostico" "date" NOT NULL,
    "estado" "public"."estado_condicion_cronica" DEFAULT 'activa'::"public"."estado_condicion_cronica" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "padecimientos_cronicos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."padecimientos_cronicos" IS 'Condiciones cronicas de un paciente, con su fecha de diagnostico y si siguen activas.';


--
-- Name: COLUMN "padecimientos_cronicos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "padecimientos_cronicos"."paciente_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."paciente_id" IS 'Paciente que tiene la condicion.';


--
-- Name: COLUMN "padecimientos_cronicos"."condicion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."condicion_id" IS 'Condicion del catalogo.';


--
-- Name: COLUMN "padecimientos_cronicos"."fecha_diagnostico"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."fecha_diagnostico" IS 'Cuando se diagnostico, si se sabe; no puede ser futura.';


--
-- Name: COLUMN "padecimientos_cronicos"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."estado" IS 'Si la condicion sigue activa o ya se controlo o resolvio.';


--
-- Name: COLUMN "padecimientos_cronicos"."notas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."notas" IS 'Observaciones de quien la registro.';


--
-- Name: COLUMN "padecimientos_cronicos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "padecimientos_cronicos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."padecimientos_cronicos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: perfil_especialidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."perfil_especialidad" (
    "perfil_id" "uuid" NOT NULL,
    "nombre_especialidad" character varying(100) NOT NULL
);


--
-- Name: TABLE "perfil_especialidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."perfil_especialidad" IS 'Especialidades clinicas de un perfil (medicina general, odontologia, ...). Una persona puede tener varias.';


--
-- Name: COLUMN "perfil_especialidad"."perfil_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfil_especialidad"."perfil_id" IS 'Perfil al que pertenece la especialidad.';


--
-- Name: COLUMN "perfil_especialidad"."nombre_especialidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."perfil_especialidad"."nombre_especialidad" IS 'Nombre de la especialidad.';


--
-- Name: perfiles_directorio; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."perfiles_directorio" AS
 SELECT "id",
    "nombres",
    "apellidos",
    "rol",
    "activo",
    "fecha_ingreso",
    "created_at",
    "updated_at",
        CASE
            WHEN ("public"."es_administrador"() OR ("id" = "auth"."uid"())) THEN "telefono"
            ELSE NULL::character varying
        END AS "telefono",
        CASE
            WHEN ("public"."es_administrador"() OR ("id" = "auth"."uid"())) THEN "email"
            ELSE NULL::"extensions"."citext"
        END AS "email"
   FROM "public"."perfiles"
  WHERE ("public"."es_administrador"() OR ("id" = "auth"."uid"()) OR "public"."accede_a_modulo_por_matriz"('colaboradores'::"text") OR "public"."tiene_permiso"('usuarios.gestionar_permisos'::"text") OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."tiene_permiso"('proyectos.gestionar'::"text"));


--
-- Name: VIEW "perfiles_directorio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."perfiles_directorio" IS 'Perfiles sin datos de contacto sensibles (telefono, email) salvo para administrador y para el propio perfil. Junta directiva leia por aqui hasta la 00141 (issue #864), que la deja con Reportes como unica pantalla; la vista se conserva porque sigue siendo el unico camino enmascarado a perfiles ajenos y porque cada quien lee su propia fila por ella.';


--
-- Name: permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."permisos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "clave" character varying(100) NOT NULL,
    "modulo" character varying(50) NOT NULL,
    "descripcion" "text"
);


--
-- Name: TABLE "permisos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."permisos" IS 'Catalogo de permisos finos que se pueden delegar por rol (rol_permiso) o por persona (usuario_permiso). Ver docs/PERMISOS.md.';


--
-- Name: COLUMN "permisos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."permisos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "permisos"."clave"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."permisos"."clave" IS 'Clave estable del permiso, con la forma modulo.accion (por ejemplo proyectos.gestionar). La usa tiene_permiso().';


--
-- Name: COLUMN "permisos"."modulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."permisos"."modulo" IS 'Modulo al que pertenece el permiso.';


--
-- Name: COLUMN "permisos"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."permisos"."descripcion" IS 'Que habilita el permiso, en palabras de la organizacion.';


--
-- Name: presentaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."presentaciones" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "presentaciones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."presentaciones" IS 'Catalogo de presentaciones de un articulo (caja, frasco, blister, ...).';


--
-- Name: COLUMN "presentaciones"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."presentaciones"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "presentaciones"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."presentaciones"."nombre" IS 'Nombre de la presentacion; unico.';


--
-- Name: COLUMN "presentaciones"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."presentaciones"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: principios_activos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."principios_activos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nombre_normalizado" character varying(100) GENERATED ALWAYS AS ("lower"("public"."f_unaccent"(("nombre")::"text"))) STORED
);


--
-- Name: TABLE "principios_activos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."principios_activos" IS 'Catalogo de principios activos (paracetamol, amoxicilina, ...).';


--
-- Name: COLUMN "principios_activos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."principios_activos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "principios_activos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."principios_activos"."nombre" IS 'Nombre del principio activo.';


--
-- Name: COLUMN "principios_activos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."principios_activos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "principios_activos"."nombre_normalizado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."principios_activos"."nombre_normalizado" IS 'nombre en minusculas y sin acentos, calculado por la base de datos. Garantiza que dos nombres que solo difieren en acentos o mayusculas no coexistan, y es lo que packages/shared/inventario/principios-activos.api.js usa con .ilike() para buscar sin depender de como la persona haya escrito los acentos.';


--
-- Name: privilegios_de_anon; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."privilegios_de_anon" AS
 SELECT "table_name",
    "privilege_type"
   FROM "information_schema"."role_table_grants"
  WHERE ((("grantee")::"name" = 'anon'::"name") AND (("table_schema")::"name" = 'public'::"name"));


--
-- Name: VIEW "privilegios_de_anon"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."privilegios_de_anon" IS 'Verificacion de la issue #435: debe devolver cero filas. Lista cualquier privilegio que el rol
   anon tenga sobre una tabla o vista del schema public. En este proyecto anon no necesita acceso
   a ninguna, porque el inicio de sesion no pasa por PostgREST. La prueba
   supabase/tests/database/privilegios_anon.sql lo automatiza y el CI la corre en cada PR.';


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proveedores" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "contacto" character varying(150),
    "tipo" "public"."tipo_proveedor" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "donante_id" "uuid",
    CONSTRAINT "chk_proveedores_donante_solo_en_tipo_donante" CHECK ((("donante_id" IS NULL) OR ("tipo" = 'donante'::"public"."tipo_proveedor")))
);


--
-- Name: TABLE "proveedores"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proveedores" IS 'Proveedores y donantes de los que entra inventario.';


--
-- Name: COLUMN "proveedores"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proveedores"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."nombre" IS 'Nombre del proveedor.';


--
-- Name: COLUMN "proveedores"."contacto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."contacto" IS 'Persona o dato de contacto.';


--
-- Name: COLUMN "proveedores"."tipo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."tipo" IS 'Si es un proveedor comercial o un donante.';


--
-- Name: COLUMN "proveedores"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "proveedores"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "proveedores"."donante_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proveedores"."donante_id" IS 'Donante del que sale este proveedor (00175). Lo mantiene un trigger sobre donantes: el nombre y el contacto se editan en el donante, no aqui.';


--
-- Name: proyecto_estado_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyecto_estado_historial" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "proyecto_id" "uuid" NOT NULL,
    "estado_anterior" "public"."estado_proyecto",
    "estado_nuevo" "public"."estado_proyecto" NOT NULL,
    "cambiado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "proyecto_estado_historial"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyecto_estado_historial" IS 'Cada cambio de estado de un proyecto, con quien lo hizo. Lo escribe un trigger.';


--
-- Name: COLUMN "proyecto_estado_historial"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyecto_estado_historial"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."proyecto_id" IS 'Proyecto.';


--
-- Name: COLUMN "proyecto_estado_historial"."estado_anterior"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."estado_anterior" IS 'Estado del que salio; NULL al crearse.';


--
-- Name: COLUMN "proyecto_estado_historial"."estado_nuevo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."estado_nuevo" IS 'Estado al que paso.';


--
-- Name: COLUMN "proyecto_estado_historial"."cambiado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."cambiado_por" IS 'Quien hizo el cambio.';


--
-- Name: COLUMN "proyecto_estado_historial"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_estado_historial"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: proyecto_hitos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyecto_hitos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "proyecto_id" "uuid" NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "descripcion" "text",
    "fecha_prevista" "date" NOT NULL,
    "fecha_real" "date",
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "proyecto_hitos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyecto_hitos" IS 'Hitos de un proyecto social. Un hito esta pendiente mientras fecha_real sea nula.';


--
-- Name: COLUMN "proyecto_hitos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyecto_hitos"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."proyecto_id" IS 'Proyecto.';


--
-- Name: COLUMN "proyecto_hitos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."nombre" IS 'Nombre del hito.';


--
-- Name: COLUMN "proyecto_hitos"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."descripcion" IS 'Detalle del hito, opcional.';


--
-- Name: COLUMN "proyecto_hitos"."fecha_prevista"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."fecha_prevista" IS 'Cuando se espera cumplir.';


--
-- Name: COLUMN "proyecto_hitos"."fecha_real"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."fecha_real" IS 'Fecha en que el hito se cumplio. Nula mientras siga pendiente. No se compara con fecha_prevista: cumplir antes de lo previsto es valido.';


--
-- Name: COLUMN "proyecto_hitos"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."registrado_por" IS 'Quien creo el hito. El valor por defecto lo toma de auth.uid() para que la aplicacion no tenga que enviarlo ni pueda falsearlo.';


--
-- Name: COLUMN "proyecto_hitos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "proyecto_hitos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_hitos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: proyecto_insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyecto_insumos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "proyecto_id" "uuid" NOT NULL,
    "medicamento_id" "uuid" NOT NULL,
    "cantidad" integer NOT NULL,
    "unidad" character varying(30) NOT NULL,
    "costo_unitario_estimado" numeric(12,2),
    "nota" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_proyecto_insumos_cantidad" CHECK (("cantidad" > 0)),
    CONSTRAINT "chk_proyecto_insumos_costo" CHECK ((("costo_unitario_estimado" IS NULL) OR ("costo_unitario_estimado" >= (0)::numeric))),
    CONSTRAINT "chk_proyecto_insumos_nota" CHECK ((("nota" IS NULL) OR (("length"("btrim"("nota")) > 0) AND ("length"("nota") <= 500)))),
    CONSTRAINT "chk_proyecto_insumos_unidad" CHECK (("length"("btrim"(("unidad")::"text")) > 0))
);


--
-- Name: TABLE "proyecto_insumos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyecto_insumos" IS 'Articulos (medicamentos o insumos del catalogo de inventario) PREVISTOS para un proyecto: su cantidad, unidad y costo unitario estimado. Es una lista de planificacion: NO descuenta ni reserva existencias ni crea movimientos de inventario (ver la cabecera de la 00147).';


--
-- Name: COLUMN "proyecto_insumos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyecto_insumos"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."proyecto_id" IS 'Proyecto para el que se previo el articulo.';


--
-- Name: COLUMN "proyecto_insumos"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."medicamento_id" IS 'Articulo del catalogo de inventario.';


--
-- Name: COLUMN "proyecto_insumos"."cantidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."cantidad" IS 'Cantidad prevista; mayor que cero.';


--
-- Name: COLUMN "proyecto_insumos"."unidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."unidad" IS 'Unidad de la cantidad.';


--
-- Name: COLUMN "proyecto_insumos"."costo_unitario_estimado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."costo_unitario_estimado" IS 'Costo estimado de UNA unidad, en quetzales. NULL cuando no se estimo; 0 es un costo estimado de cero, no la ausencia de estimacion. El total de la fila es cantidad x este valor y no se guarda.';


--
-- Name: COLUMN "proyecto_insumos"."nota"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."nota" IS 'Observacion opcional.';


--
-- Name: COLUMN "proyecto_insumos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "proyecto_insumos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_insumos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: proyecto_personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyecto_personal" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "proyecto_id" "uuid" NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "rol_en_proyecto" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_proyecto_personal_rol" CHECK ((("rol_en_proyecto" IS NULL) OR (("length"("btrim"("rol_en_proyecto")) > 0) AND ("length"("rol_en_proyecto") <= 100))))
);


--
-- Name: TABLE "proyecto_personal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyecto_personal" IS 'Equipo de un proyecto: quien participa en el, con una funcion opcional (rol_en_proyecto). No es jornada_personal (00012): aquel es el cuadro de turnos de una jornada y este es la gente del proyecto, este o no en el turno de alguna de sus jornadas.';


--
-- Name: COLUMN "proyecto_personal"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyecto_personal"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."proyecto_id" IS 'Proyecto.';


--
-- Name: COLUMN "proyecto_personal"."perfil_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."perfil_id" IS 'Persona que participa.';


--
-- Name: COLUMN "proyecto_personal"."rol_en_proyecto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."rol_en_proyecto" IS 'Funcion de la persona dentro de ESTE proyecto, en texto libre. No es perfiles.rol (el rol de sistema) ni jornada_personal.rol_en_jornada (el rol clinico de un turno). NULL cuando no se anoto ninguno.';


--
-- Name: COLUMN "proyecto_personal"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "proyecto_personal"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_personal"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: proyecto_seguimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyecto_seguimiento" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "proyecto_id" "uuid" NOT NULL,
    "nota" "text",
    "porcentaje_anterior" integer,
    "porcentaje_nuevo" integer,
    "registrado_por" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_proyecto_seguimiento_contenido" CHECK ((("nota" IS NOT NULL) OR ("porcentaje_nuevo" IS NOT NULL))),
    CONSTRAINT "chk_proyecto_seguimiento_porcentajes" CHECK (((("porcentaje_anterior" IS NULL) OR (("porcentaje_anterior" >= 0) AND ("porcentaje_anterior" <= 100))) AND (("porcentaje_nuevo" IS NULL) OR (("porcentaje_nuevo" >= 0) AND ("porcentaje_nuevo" <= 100)))))
);


--
-- Name: TABLE "proyecto_seguimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyecto_seguimiento" IS 'Bitacora de un proyecto: notas escritas a mano y cambios de porcentaje de avance, estos ultimos anotados por trigger. No lleva updated_at ni politicas de UPDATE o DELETE porque una bitacora no se corrige, se anota encima.';


--
-- Name: COLUMN "proyecto_seguimiento"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyecto_seguimiento"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."proyecto_id" IS 'Proyecto.';


--
-- Name: COLUMN "proyecto_seguimiento"."nota"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."nota" IS 'Nota escrita a mano, opcional si hay cambio de porcentaje.';


--
-- Name: COLUMN "proyecto_seguimiento"."porcentaje_anterior"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."porcentaje_anterior" IS 'Avance antes del cambio.';


--
-- Name: COLUMN "proyecto_seguimiento"."porcentaje_nuevo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."porcentaje_nuevo" IS 'Avance despues del cambio.';


--
-- Name: COLUMN "proyecto_seguimiento"."registrado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."registrado_por" IS 'Quien anoto.';


--
-- Name: COLUMN "proyecto_seguimiento"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyecto_seguimiento"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: CONSTRAINT "chk_proyecto_seguimiento_contenido" ON "proyecto_seguimiento"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "chk_proyecto_seguimiento_contenido" ON "public"."proyecto_seguimiento" IS 'Una entrada sin nota y sin cambio de porcentaje no dice nada, asi que no se guarda.';


--
-- Name: proyectos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."proyectos" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "descripcion" "text",
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "responsable_id" "uuid",
    "estado" "public"."estado_proyecto" DEFAULT 'planificado'::"public"."estado_proyecto" NOT NULL,
    "porcentaje_avance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_proyectos_porcentaje_avance" CHECK ((("porcentaje_avance" >= 0) AND ("porcentaje_avance" <= 100)))
);


--
-- Name: TABLE "proyectos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."proyectos" IS 'Proyecto social que agrupa jornadas: su equipo, gastos e insumos salen de ellas. Uno cancelado ya no se modifica (00154).';


--
-- Name: COLUMN "proyectos"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "proyectos"."nombre"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."nombre" IS 'Nombre del proyecto.';


--
-- Name: COLUMN "proyectos"."descripcion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."descripcion" IS 'De que trata.';


--
-- Name: COLUMN "proyectos"."fecha_inicio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."fecha_inicio" IS 'Cuando empieza.';


--
-- Name: COLUMN "proyectos"."fecha_fin"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."fecha_fin" IS 'Cuando termina; no antes del inicio.';


--
-- Name: COLUMN "proyectos"."responsable_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."responsable_id" IS 'Persona a cargo.';


--
-- Name: COLUMN "proyectos"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."estado" IS 'Planificado, en curso, finalizado o cancelado. Finalizado y cancelado son terminales.';


--
-- Name: COLUMN "proyectos"."porcentaje_avance"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."porcentaje_avance" IS 'Avance declarado, de 0 a 100. Cada cambio queda en proyecto_seguimiento.';


--
-- Name: COLUMN "proyectos"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "proyectos"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."proyectos"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: receta_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."receta_detalle" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "receta_id" "uuid" NOT NULL,
    "medicamento_id" "uuid" NOT NULL,
    "lote_id" "uuid",
    "dosis" character varying(100) NOT NULL,
    "frecuencia" character varying(100) NOT NULL,
    "duracion" character varying(100) NOT NULL,
    "cantidad_entregada" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bodega_id" "uuid",
    "cantidad_ajustada" integer,
    "ajustada_por" "uuid",
    "ajustada_en" timestamp with time zone,
    CONSTRAINT "chk_receta_detalle_ajuste_coherente" CHECK (((("cantidad_ajustada" IS NULL) AND ("ajustada_por" IS NULL) AND ("ajustada_en" IS NULL)) OR (("cantidad_ajustada" IS NOT NULL) AND ("ajustada_por" IS NOT NULL) AND ("ajustada_en" IS NOT NULL)))),
    CONSTRAINT "chk_receta_detalle_cantidad_ajustada_positiva" CHECK ((("cantidad_ajustada" IS NULL) OR ("cantidad_ajustada" > 0))),
    CONSTRAINT "chk_receta_detalle_cantidad_positiva" CHECK (("cantidad_entregada" > 0))
);


--
-- Name: TABLE "receta_detalle"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."receta_detalle" IS 'Renglones de una receta: cada medicamento, su dosis y cuanto se entrego, de que lote.';


--
-- Name: COLUMN "receta_detalle"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "receta_detalle"."receta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."receta_id" IS 'Receta a la que pertenece el renglon.';


--
-- Name: COLUMN "receta_detalle"."medicamento_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."medicamento_id" IS 'Medicamento recetado.';


--
-- Name: COLUMN "receta_detalle"."lote_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."lote_id" IS 'Lote del que salio lo entregado.';


--
-- Name: COLUMN "receta_detalle"."dosis"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."dosis" IS 'Dosis indicada (por ejemplo 1 tableta).';


--
-- Name: COLUMN "receta_detalle"."frecuencia"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."frecuencia" IS 'Cada cuanto (por ejemplo cada 8 horas).';


--
-- Name: COLUMN "receta_detalle"."duracion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."duracion" IS 'Por cuanto tiempo (por ejemplo 5 dias).';


--
-- Name: COLUMN "receta_detalle"."cantidad_entregada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."cantidad_entregada" IS 'Unidades entregadas; salen del inventario de la bodega de la jornada.';


--
-- Name: COLUMN "receta_detalle"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "receta_detalle"."bodega_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."bodega_id" IS 'Bodega de la que salio este renglon (issue #764). NULL cuando el renglon no tiene lote (receta sin lote especifico, 00019): sin lote no hay bodega de la que descontar.';


--
-- Name: COLUMN "receta_detalle"."cantidad_ajustada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."cantidad_ajustada" IS 'Ultima cantidad confirmada como realmente entregada, si difiere de cantidad_entregada (issue #764). NULL mientras nadie la corrija: en ese caso cantidad_entregada sigue siendo la cifra vigente. Solo fn_ajustar_entrega_receta() escribe esta columna.';


--
-- Name: COLUMN "receta_detalle"."ajustada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."ajustada_por" IS 'Quien confirmo la ultima correccion de cantidad_ajustada (issue #764).';


--
-- Name: COLUMN "receta_detalle"."ajustada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."receta_detalle"."ajustada_en" IS 'Cuando se confirmo la ultima correccion de cantidad_ajustada (issue #764).';


--
-- Name: recetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."recetas" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "consulta_id" "uuid" NOT NULL,
    "medico_id" "uuid" NOT NULL,
    "folio" character varying(50) DEFAULT ('REC-'::"text" || "upper"(SUBSTRING(("extensions"."gen_random_uuid"())::"text" FROM 1 FOR 8))) NOT NULL,
    "indicaciones_generales" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estado" "public"."estado_receta" DEFAULT 'emitida'::"public"."estado_receta" NOT NULL,
    "motivo_anulacion" "text",
    "anulada_por" "uuid",
    "anulada_en" timestamp with time zone,
    CONSTRAINT "chk_recetas_anulacion_coherente" CHECK (((("estado" = 'emitida'::"public"."estado_receta") AND ("motivo_anulacion" IS NULL) AND ("anulada_por" IS NULL) AND ("anulada_en" IS NULL)) OR (("estado" = 'anulada'::"public"."estado_receta") AND ("motivo_anulacion" IS NOT NULL) AND ("anulada_por" IS NOT NULL) AND ("anulada_en" IS NOT NULL))))
);


--
-- Name: TABLE "recetas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."recetas" IS 'Receta emitida en una consulta. Se anula, no se borra: queda con su motivo y quien la anulo.';


--
-- Name: COLUMN "recetas"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "recetas"."consulta_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."consulta_id" IS 'Consulta en la que se emitio.';


--
-- Name: COLUMN "recetas"."medico_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."medico_id" IS 'Medico que la emitio.';


--
-- Name: COLUMN "recetas"."folio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."folio" IS 'Folio que se imprime en la receta. Lo genera la base.';


--
-- Name: COLUMN "recetas"."indicaciones_generales"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."indicaciones_generales" IS 'Indicaciones para el paciente que no son de un medicamento en particular.';


--
-- Name: COLUMN "recetas"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "recetas"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: COLUMN "recetas"."estado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."estado" IS 'Una receta emitida no se edita: se anula indicando el motivo (issue #120, RF-11). El CHECK chk_recetas_anulacion_coherente obliga a que motivo_anulacion, anulada_por y anulada_en viajen juntos con el estado anulada, y a que esten en NULL mientras siga emitida.';


--
-- Name: COLUMN "recetas"."motivo_anulacion"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."motivo_anulacion" IS 'Por que se anulo; obligatorio al anular.';


--
-- Name: COLUMN "recetas"."anulada_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."anulada_por" IS 'Quien anulo la receta. Desde la 00075, la politica de UPDATE exige que coincida con la sesion cuando quien anula es el medico: solo la administradora puede registrar a un tercero.';


--
-- Name: COLUMN "recetas"."anulada_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."recetas"."anulada_en" IS 'Cuando se anulo. NULL mientras siga emitida.';


--
-- Name: rol_modulo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rol_modulo" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "rol" "public"."rol_usuario" NOT NULL,
    "modulo" character varying(50) NOT NULL,
    "otorgado_por" "uuid" DEFAULT "auth"."uid"(),
    "otorgado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_rol_modulo_modulo" CHECK ((("modulo")::"text" = ANY ((ARRAY['pacientes'::character varying, 'inventario'::character varying, 'jornadas'::character varying, 'proyectos'::character varying, 'presupuestos'::character varying, 'donaciones'::character varying, 'reportes'::character varying, 'colaboradores'::character varying])::"text"[]))),
    CONSTRAINT "chk_rol_modulo_no_por_defecto" CHECK ((NOT "public"."modulo_por_defecto"("rol", ("modulo")::"text")))
);


--
-- Name: TABLE "rol_modulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."rol_modulo" IS 'Modulos que la administradora abrio a un rol ademas de los suyos (matriz de acceso, web). Abrir es de solo lectura: las politicas de escritura no miran esta tabla.';


--
-- Name: COLUMN "rol_modulo"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_modulo"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "rol_modulo"."rol"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_modulo"."rol" IS 'Rol al que se le abre el modulo.';


--
-- Name: COLUMN "rol_modulo"."modulo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_modulo"."modulo" IS 'Modulo de la navegacion que se abre (id de MODULOS en packages/shared/navegacion.js).';


--
-- Name: COLUMN "rol_modulo"."otorgado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_modulo"."otorgado_por" IS 'Quien lo abrio.';


--
-- Name: COLUMN "rol_modulo"."otorgado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_modulo"."otorgado_en" IS 'Cuando se abrio.';


--
-- Name: rol_permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rol_permiso" (
    "rol" "public"."rol_usuario" NOT NULL,
    "permiso_id" "uuid" NOT NULL
);


--
-- Name: TABLE "rol_permiso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."rol_permiso" IS 'Permisos finos que un rol tiene por defecto.';


--
-- Name: COLUMN "rol_permiso"."rol"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_permiso"."rol" IS 'Rol que recibe el permiso.';


--
-- Name: COLUMN "rol_permiso"."permiso_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."rol_permiso"."permiso_id" IS 'Permiso que recibe.';


--
-- Name: tablas_sin_rls; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."tablas_sin_rls" AS
 SELECT "tablename"
   FROM "pg_tables"
  WHERE (("schemaname" = 'public'::"name") AND (NOT "rowsecurity"));


--
-- Name: VIEW "tablas_sin_rls"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."tablas_sin_rls" IS 'Verificacion de RLS: debe devolver cero filas. Lista las tablas del schema public sin row level security habilitado.';


--
-- Name: triajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."triajes" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "atencion_id" "uuid" NOT NULL,
    "presion_sistolica" smallint,
    "presion_diastolica" smallint,
    "glucosa" smallint,
    "peso" numeric(5,2),
    "talla" numeric(5,2),
    "temperatura" numeric(4,1),
    "frecuencia_cardiaca" smallint,
    "imc" numeric(6,1) GENERATED ALWAYS AS ("round"(("peso" / "power"(("talla" / 100.0), (2)::numeric)), 1)) STORED,
    "tomado_por" "uuid" NOT NULL,
    "tomado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_triajes_al_menos_un_signo" CHECK ((("presion_sistolica" IS NOT NULL) OR ("frecuencia_cardiaca" IS NOT NULL) OR ("glucosa" IS NOT NULL) OR ("peso" IS NOT NULL) OR ("talla" IS NOT NULL) OR ("temperatura" IS NOT NULL))),
    CONSTRAINT "chk_triajes_frecuencia_cardiaca_rango" CHECK ((("frecuencia_cardiaca" >= 20) AND ("frecuencia_cardiaca" <= 250))),
    CONSTRAINT "chk_triajes_glucosa_rango" CHECK ((("glucosa" >= 20) AND ("glucosa" <= 800))),
    CONSTRAINT "chk_triajes_imc_rango" CHECK ((("imc" IS NULL) OR (("imc" >= (5)::numeric) AND ("imc" <= (200)::numeric)))),
    CONSTRAINT "chk_triajes_peso_rango" CHECK ((("peso" >= (1)::numeric) AND ("peso" <= (400)::numeric))),
    CONSTRAINT "chk_triajes_presion_coherente" CHECK (("presion_sistolica" > "presion_diastolica")),
    CONSTRAINT "chk_triajes_presion_completa" CHECK ((("presion_sistolica" IS NULL) = ("presion_diastolica" IS NULL))),
    CONSTRAINT "chk_triajes_presion_diastolica_rango" CHECK ((("presion_diastolica" >= 20) AND ("presion_diastolica" <= 200))),
    CONSTRAINT "chk_triajes_presion_sistolica_rango" CHECK ((("presion_sistolica" >= 40) AND ("presion_sistolica" <= 300))),
    CONSTRAINT "chk_triajes_talla_rango" CHECK ((("talla" >= (30)::numeric) AND ("talla" <= (250)::numeric))),
    CONSTRAINT "chk_triajes_temperatura_rango" CHECK ((("temperatura" >= (25)::numeric) AND ("temperatura" <= (45)::numeric)))
);


--
-- Name: TABLE "triajes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."triajes" IS 'Signos vitales tomados a un paciente en una atencion, antes de la consulta.';


--
-- Name: COLUMN "triajes"."id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."id" IS 'Identificador de la fila. Lo genera la base.';


--
-- Name: COLUMN "triajes"."atencion_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."atencion_id" IS 'Atencion en la que se tomaron.';


--
-- Name: COLUMN "triajes"."presion_sistolica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."presion_sistolica" IS 'mmHg. Opcional desde la 00136 (issue #840): va junto con la diastolica o no va ninguna.';


--
-- Name: COLUMN "triajes"."presion_diastolica"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."presion_diastolica" IS 'Presion arterial diastolica, en mmHg.';


--
-- Name: COLUMN "triajes"."glucosa"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."glucosa" IS 'Glucosa capilar, en mg/dL.';


--
-- Name: COLUMN "triajes"."peso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."peso" IS 'Peso, en kilogramos.';


--
-- Name: COLUMN "triajes"."talla"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."talla" IS 'Talla, en centimetros. Con el peso da el IMC (columna generada).';


--
-- Name: COLUMN "triajes"."temperatura"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."temperatura" IS 'Temperatura, en grados Celsius.';


--
-- Name: COLUMN "triajes"."frecuencia_cardiaca"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."frecuencia_cardiaca" IS 'Latidos por minuto. Opcional desde la 00136 (issue #840).';


--
-- Name: COLUMN "triajes"."imc"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."imc" IS 'Indice de masa corporal, columna generada desde la 00013: ROUND(peso / (talla/100)^2, 1). Nunca se envia desde el cliente. NUMERIC(6,1) desde la 00133 (issue #699): con NUMERIC(4,1) una talla tecleada en metros desbordaba el INSERT con 22003 en vez de avisar.';


--
-- Name: COLUMN "triajes"."tomado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."tomado_por" IS 'Quien tomo los signos. Lo pone la base con auth.uid().';


--
-- Name: COLUMN "triajes"."tomado_en"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."tomado_en" IS 'Cuando se tomaron.';


--
-- Name: COLUMN "triajes"."created_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."created_at" IS 'Cuando se creo la fila. Lo pone la base.';


--
-- Name: COLUMN "triajes"."updated_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."triajes"."updated_at" IS 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.';


--
-- Name: CONSTRAINT "chk_triajes_imc_rango" ON "triajes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "chk_triajes_imc_rango" ON "public"."triajes" IS 'Acota el IMC a un rango humano posible (issue #699). Fuera de el, lo que hay casi siempre es una talla en metros o un peso en libras, y un 23514 con nombre permite decir que campo revisar. El espejo en el cliente es validarTriaje() en packages/shared/pacientes/triaje.validaciones.js, que lo avisa antes de viajar a la base.';


--
-- Name: usuario_permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."usuario_permiso" (
    "perfil_id" "uuid" NOT NULL,
    "permiso_id" "uuid" NOT NULL,
    "concedido" boolean NOT NULL,
    "otorgado_por" "uuid",
    "motivo" "text"
);


--
-- Name: TABLE "usuario_permiso"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."usuario_permiso" IS 'Excepciones por persona sobre los permisos de su rol: conceder uno que el rol no trae o revocar uno que si trae.';


--
-- Name: COLUMN "usuario_permiso"."perfil_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."usuario_permiso"."perfil_id" IS 'Persona a la que se le hace la excepcion.';


--
-- Name: COLUMN "usuario_permiso"."permiso_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."usuario_permiso"."permiso_id" IS 'Permiso concedido o revocado.';


--
-- Name: COLUMN "usuario_permiso"."concedido"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."usuario_permiso"."concedido" IS 'TRUE concede el permiso; FALSE lo revoca de forma explicita aunque el rol lo traiga.';


--
-- Name: COLUMN "usuario_permiso"."otorgado_por"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."usuario_permiso"."otorgado_por" IS 'Quien hizo la excepcion.';


--
-- Name: COLUMN "usuario_permiso"."motivo"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."usuario_permiso"."motivo" IS 'Por que se hizo, opcional.';


--
-- Name: vista_cola_jornada; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."vista_cola_jornada" AS
 SELECT "a"."id" AS "atencion_id",
    "a"."jornada_id",
    "a"."paciente_id",
    "p"."nombres",
    "p"."apellidos",
    "a"."created_at" AS "iniciada_en",
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM ("public"."consultas" "c"
                 JOIN "public"."recetas" "r" ON (("r"."consulta_id" = "c"."id")))
              WHERE ("c"."atencion_id" = "a"."id"))) THEN 'espera entrega'::"text"
            WHEN ("ultima"."creada_en" IS NOT NULL) THEN 'lista para cerrar'::"text"
            WHEN ("t"."id" IS NOT NULL) THEN 'espera consulta'::"text"
            ELSE 'espera triaje'::"text"
        END AS "etapa",
        CASE
            WHEN ("ultima"."creada_en" IS NOT NULL) THEN "ultima"."creada_en"
            WHEN ("t"."id" IS NOT NULL) THEN "t"."created_at"
            ELSE "a"."created_at"
        END AS "esperando_desde"
   FROM ((("public"."atenciones" "a"
     JOIN "public"."pacientes" "p" ON (("p"."id" = "a"."paciente_id")))
     LEFT JOIN "public"."triajes" "t" ON (("t"."atencion_id" = "a"."id")))
     LEFT JOIN LATERAL ( SELECT "max"("c"."created_at") AS "creada_en"
           FROM "public"."consultas" "c"
          WHERE ("c"."atencion_id" = "a"."id")) "ultima" ON (true))
  WHERE (("a"."cerrada_en" IS NULL) AND ("public"."es_administrador"() OR "public"."participa_en_jornada"("a"."jornada_id")));


--
-- Name: VIEW "vista_cola_jornada"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."vista_cola_jornada" IS 'Cola de pacientes de una jornada, por etapa del flujo (issue #173, RF-24): una fila por atencion abierta. La etapa se decide de lo mas avanzado a lo menos (00136). Desde la 00184 (issue #927) una visita con varias consultas o recetas no repite al paciente.';


--
-- Name: vista_lotes_disponibles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."vista_lotes_disponibles" WITH ("security_invoker"='true') AS
 SELECT "l"."id" AS "lote_id",
    "l"."medicamento_id",
    "m"."nombre" AS "medicamento_nombre",
    "l"."numero_lote",
    "l"."fecha_vencimiento",
    ("e"."cantidad_disponible" - "c"."comprometida") AS "cantidad_disponible",
    "e"."created_at",
    "e"."updated_at",
    "e"."bodega_id",
    "b"."nombre" AS "bodega_nombre",
    "e"."cantidad_disponible" AS "cantidad_fisica",
    "c"."comprometida" AS "cantidad_comprometida"
   FROM (((("public"."existencias" "e"
     JOIN "public"."lotes" "l" ON (("l"."id" = "e"."lote_id")))
     JOIN "public"."medicamentos" "m" ON (("m"."id" = "l"."medicamento_id")))
     JOIN "public"."bodegas" "b" ON (("b"."id" = "e"."bodega_id")))
     CROSS JOIN LATERAL ( SELECT "public"."fn_cantidad_comprometida"("e"."lote_id", "e"."bodega_id") AS "comprometida") "c")
  WHERE (("e"."cantidad_disponible" > 0) AND (("e"."cantidad_disponible" - "c"."comprometida") > 0) AND (("l"."fecha_vencimiento" IS NULL) OR ("l"."fecha_vencimiento" >= CURRENT_DATE)));


--
-- Name: VIEW "vista_lotes_disponibles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."vista_lotes_disponibles" IS 'Combinaciones (lote, bodega) que se pueden entregar: lote vigente (o sin fecha, 00171) y existencia que no este comprometida en una salida pendiente (00186). cantidad_disponible es lo neto; cantidad_fisica y cantidad_comprometida, de donde sale. security_invoker = TRUE respeta la RLS de existencias, lotes, medicamentos y bodegas (00034).';


--
-- Name: vista_reporte_impacto; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."vista_reporte_impacto" WITH ("security_invoker"='false') AS
 WITH "pacientes_por_jornada" AS (
         SELECT "a"."jornada_id",
            "count"(DISTINCT "a"."paciente_id") AS "pacientes_atendidos"
           FROM "public"."atenciones" "a"
          GROUP BY "a"."jornada_id"
        ), "consultas_por_jornada" AS (
         SELECT "c"."jornada_id",
            "count"(*) AS "consultas_realizadas"
           FROM "public"."consultas" "c"
          GROUP BY "c"."jornada_id"
        ), "entregas_por_jornada" AS (
         SELECT "c"."jornada_id",
            "count"(DISTINCT "r"."id") AS "tratamientos_entregados",
            COALESCE("sum"(COALESCE("rd"."cantidad_ajustada", "rd"."cantidad_entregada")), (0)::bigint) AS "medicamentos_utilizados"
           FROM (("public"."consultas" "c"
             JOIN "public"."recetas" "r" ON ((("r"."consulta_id" = "c"."id") AND ("r"."estado" = 'emitida'::"public"."estado_receta"))))
             LEFT JOIN "public"."receta_detalle" "rd" ON (("rd"."receta_id" = "r"."id")))
          GROUP BY "c"."jornada_id"
        )
 SELECT "j"."id" AS "jornada_id",
    "j"."nombre" AS "jornada",
    "j"."fecha",
    "j"."estado" AS "estado_jornada",
    "com"."id" AS "comunidad_id",
    "com"."nombre" AS "comunidad",
    COALESCE("p"."pacientes_atendidos", (0)::bigint) AS "pacientes_atendidos",
    COALESCE("cs"."consultas_realizadas", (0)::bigint) AS "consultas_realizadas",
    COALESCE("e"."tratamientos_entregados", (0)::bigint) AS "tratamientos_entregados",
    COALESCE("e"."medicamentos_utilizados", (0)::bigint) AS "medicamentos_utilizados",
    "j"."proyecto_id",
    "pr"."nombre" AS "proyecto"
   FROM ((((("public"."jornadas" "j"
     JOIN "public"."comunidades" "com" ON (("com"."id" = "j"."comunidad_id")))
     LEFT JOIN "public"."proyectos" "pr" ON (("pr"."id" = "j"."proyecto_id")))
     LEFT JOIN "pacientes_por_jornada" "p" ON (("p"."jornada_id" = "j"."id")))
     LEFT JOIN "consultas_por_jornada" "cs" ON (("cs"."jornada_id" = "j"."id")))
     LEFT JOIN "entregas_por_jornada" "e" ON (("e"."jornada_id" = "j"."id")))
  WHERE "public"."puede_consultar_reportes"();


--
-- Name: VIEW "vista_reporte_impacto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."vista_reporte_impacto" IS 'Indicadores de impacto por jornada, agrupables por jornada, comunidad y rango de fechas.
   DECISION (issue #407): los roles consultivos ven agregados, nunca filas clinicas. Las
   politicas de lectura que la 00041 abrio sobre atenciones, consultas, recetas y
   receta_detalle se eliminaron aqui: RLS filtra filas, no columnas, y una politica FOR SELECT
   entrega la fila entera, incluido el texto clinico libre de consultas.
   La vista no lleva security_invoker: el dueno lee las tablas base y el WHERE de aqui abajo
   restringe quien obtiene filas, el mismo patron de perfiles_directorio (00038) y
   pacientes_reporte (00041). Las vistas no soportan RLS, asi que el acceso se gobierna con
   GRANT.
   La proxima issue de reportes NO debe volver a abrir las tablas base: si un reporte necesita
   mas datos, se amplia esta vista o se crea otra con el mismo patron.';


--
-- Name: COLUMN "vista_reporte_impacto"."comunidad_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."comunidad_id" IS 'Comunidad de la jornada. El indicador de comunidades beneficiadas se obtiene contando los distintos valores de esta columna.';


--
-- Name: COLUMN "vista_reporte_impacto"."pacientes_atendidos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."pacientes_atendidos" IS 'Pacientes distintos con atencion registrada en la jornada.';


--
-- Name: COLUMN "vista_reporte_impacto"."consultas_realizadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."consultas_realizadas" IS 'Consultas medicas registradas en la jornada.';


--
-- Name: COLUMN "vista_reporte_impacto"."tratamientos_entregados"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."tratamientos_entregados" IS 'Recetas emitidas en la jornada. Una receta sin renglones cuenta igual.';


--
-- Name: COLUMN "vista_reporte_impacto"."medicamentos_utilizados"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."medicamentos_utilizados" IS 'Unidades entregadas, sumadas desde receta_detalle.cantidad_entregada.';


--
-- Name: COLUMN "vista_reporte_impacto"."proyecto_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."proyecto_id" IS 'Proyecto al que pertenece la jornada, o NULL si la jornada no cuelga de ninguno. Permite la agrupacion por proyecto que pide la issue #205.';


--
-- Name: COLUMN "vista_reporte_impacto"."proyecto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."vista_reporte_impacto"."proyecto" IS 'Nombre del proyecto, para etiquetar el grupo sin una segunda consulta.';


--
-- Name: vista_reporte_impacto_por_comunidad; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."vista_reporte_impacto_por_comunidad" WITH ("security_invoker"='false') AS
 WITH "atenciones_con_comunidad" AS (
         SELECT "a"."id" AS "atencion_id",
            "a"."jornada_id",
            "a"."paciente_id",
            COALESCE("p_1"."comunidad_id", "j_1"."comunidad_id") AS "comunidad_id"
           FROM (("public"."atenciones" "a"
             JOIN "public"."jornadas" "j_1" ON (("j_1"."id" = "a"."jornada_id")))
             JOIN "public"."pacientes" "p_1" ON (("p_1"."id" = "a"."paciente_id")))
        ), "pacientes_por_grupo" AS (
         SELECT "ac"."jornada_id",
            "ac"."comunidad_id",
            "count"(DISTINCT "ac"."paciente_id") AS "pacientes_atendidos"
           FROM "atenciones_con_comunidad" "ac"
          GROUP BY "ac"."jornada_id", "ac"."comunidad_id"
        ), "consultas_por_grupo" AS (
         SELECT "ac"."jornada_id",
            "ac"."comunidad_id",
            "count"(*) AS "consultas_realizadas"
           FROM ("public"."consultas" "c"
             JOIN "atenciones_con_comunidad" "ac" ON (("ac"."atencion_id" = "c"."atencion_id")))
          GROUP BY "ac"."jornada_id", "ac"."comunidad_id"
        ), "entregas_por_grupo" AS (
         SELECT "ac"."jornada_id",
            "ac"."comunidad_id",
            "count"(DISTINCT "r"."id") AS "tratamientos_entregados",
            COALESCE("sum"(COALESCE("rd"."cantidad_ajustada", "rd"."cantidad_entregada")), (0)::bigint) AS "medicamentos_utilizados"
           FROM ((("public"."consultas" "c"
             JOIN "atenciones_con_comunidad" "ac" ON (("ac"."atencion_id" = "c"."atencion_id")))
             JOIN "public"."recetas" "r" ON ((("r"."consulta_id" = "c"."id") AND ("r"."estado" = 'emitida'::"public"."estado_receta"))))
             LEFT JOIN "public"."receta_detalle" "rd" ON (("rd"."receta_id" = "r"."id")))
          GROUP BY "ac"."jornada_id", "ac"."comunidad_id"
        ), "grupos" AS (
         SELECT "pg"."jornada_id",
            "pg"."comunidad_id"
           FROM "pacientes_por_grupo" "pg"
        UNION
         SELECT "j_1"."id",
            "j_1"."comunidad_id"
           FROM "public"."jornadas" "j_1"
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM "public"."atenciones" "a"
                  WHERE ("a"."jornada_id" = "j_1"."id"))))
        )
 SELECT "j"."id" AS "jornada_id",
    "j"."nombre" AS "jornada",
    "j"."fecha",
    "j"."estado" AS "estado_jornada",
    "com"."id" AS "comunidad_id",
    "com"."nombre" AS "comunidad",
    COALESCE("p"."pacientes_atendidos", (0)::bigint) AS "pacientes_atendidos",
    COALESCE("cs"."consultas_realizadas", (0)::bigint) AS "consultas_realizadas",
    COALESCE("e"."tratamientos_entregados", (0)::bigint) AS "tratamientos_entregados",
    COALESCE("e"."medicamentos_utilizados", (0)::bigint) AS "medicamentos_utilizados",
    "j"."proyecto_id",
    "pr"."nombre" AS "proyecto"
   FROM (((((("grupos" "g"
     JOIN "public"."jornadas" "j" ON (("j"."id" = "g"."jornada_id")))
     JOIN "public"."comunidades" "com" ON (("com"."id" = "g"."comunidad_id")))
     LEFT JOIN "public"."proyectos" "pr" ON (("pr"."id" = "j"."proyecto_id")))
     LEFT JOIN "pacientes_por_grupo" "p" ON ((("p"."jornada_id" = "g"."jornada_id") AND ("p"."comunidad_id" = "g"."comunidad_id"))))
     LEFT JOIN "consultas_por_grupo" "cs" ON ((("cs"."jornada_id" = "g"."jornada_id") AND ("cs"."comunidad_id" = "g"."comunidad_id"))))
     LEFT JOIN "entregas_por_grupo" "e" ON ((("e"."jornada_id" = "g"."jornada_id") AND ("e"."comunidad_id" = "g"."comunidad_id"))))
  WHERE "public"."puede_consultar_reportes"();


--
-- Name: VIEW "vista_reporte_impacto_por_comunidad"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."vista_reporte_impacto_por_comunidad" IS 'Indicadores de impacto por jornada y por comunidad de origen del paciente (la de la jornada si el paciente no tiene). Una jornada puede tener varias filas; sumadas dan lo mismo que vista_reporte_impacto (00155).';


--
-- Name: expedientes numero_ficha; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expedientes" ALTER COLUMN "numero_ficha" SET DEFAULT "lpad"(("nextval"('"public"."expedientes_numero_ficha_seq"'::"regclass"))::"text", 6, '0'::"text");


--
-- Name: jornadas codigo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas" ALTER COLUMN "codigo" SET DEFAULT ('JOR-'::"text" || "lpad"(("nextval"('"public"."jornadas_codigo_seq"'::"regclass"))::"text", 6, '0'::"text"));


--
-- Name: alerta_caducidad_detalle alerta_caducidad_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alerta_caducidad_detalle"
    ADD CONSTRAINT "alerta_caducidad_detalle_pkey" PRIMARY KEY ("id");


--
-- Name: alertas_caducidad alertas_caducidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alertas_caducidad"
    ADD CONSTRAINT "alertas_caducidad_pkey" PRIMARY KEY ("id");


--
-- Name: areas_atencion areas_atencion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."areas_atencion"
    ADD CONSTRAINT "areas_atencion_pkey" PRIMARY KEY ("id");


--
-- Name: atenciones atenciones_paciente_id_jornada_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atenciones"
    ADD CONSTRAINT "atenciones_paciente_id_jornada_id_key" UNIQUE ("paciente_id", "jornada_id");


--
-- Name: atenciones atenciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atenciones"
    ADD CONSTRAINT "atenciones_pkey" PRIMARY KEY ("id");


--
-- Name: avisos_caducidad avisos_caducidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."avisos_caducidad"
    ADD CONSTRAINT "avisos_caducidad_pkey" PRIMARY KEY ("id");


--
-- Name: bodegas bodegas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bodegas"
    ADD CONSTRAINT "bodegas_nombre_key" UNIQUE ("nombre");


--
-- Name: bodegas bodegas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bodegas"
    ADD CONSTRAINT "bodegas_pkey" PRIMARY KEY ("id");


--
-- Name: categorias_de_gasto categorias_de_gasto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_de_gasto"
    ADD CONSTRAINT "categorias_de_gasto_pkey" PRIMARY KEY ("id");


--
-- Name: medicamentos chk_medicamentos_concentracion_de_medicamento; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE "public"."medicamentos"
    ADD CONSTRAINT "chk_medicamentos_concentracion_de_medicamento" CHECK ((("tipo_articulo" <> 'medicamento'::"public"."tipo_articulo") OR ("length"("btrim"((COALESCE("concentracion", ''::character varying))::"text")) > 0))) NOT VALID;


--
-- Name: citas citas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_pkey" PRIMARY KEY ("id");


--
-- Name: clinicas clinicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."clinicas"
    ADD CONSTRAINT "clinicas_pkey" PRIMARY KEY ("id");


--
-- Name: comunidades comunidades_municipio_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comunidades"
    ADD CONSTRAINT "comunidades_municipio_id_nombre_key" UNIQUE ("municipio_id", "nombre");


--
-- Name: comunidades comunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comunidades"
    ADD CONSTRAINT "comunidades_pkey" PRIMARY KEY ("id");


--
-- Name: condiciones_cronicas condiciones_cronicas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."condiciones_cronicas"
    ADD CONSTRAINT "condiciones_cronicas_nombre_key" UNIQUE ("nombre");


--
-- Name: condiciones_cronicas condiciones_cronicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."condiciones_cronicas"
    ADD CONSTRAINT "condiciones_cronicas_pkey" PRIMARY KEY ("id");


--
-- Name: configuracion_alertas_caducidad configuracion_alertas_caducidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."configuracion_alertas_caducidad"
    ADD CONSTRAINT "configuracion_alertas_caducidad_pkey" PRIMARY KEY ("id");


--
-- Name: consulta_diagnostico consulta_diagnostico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consulta_diagnostico"
    ADD CONSTRAINT "consulta_diagnostico_pkey" PRIMARY KEY ("id");


--
-- Name: consultas consultas_cita_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_cita_id_key" UNIQUE ("cita_id");


--
-- Name: consultas consultas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_pkey" PRIMARY KEY ("id");


--
-- Name: departamentos departamentos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_nombre_key" UNIQUE ("nombre");


--
-- Name: departamentos departamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id");


--
-- Name: diagnosticos diagnosticos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."diagnosticos"
    ADD CONSTRAINT "diagnosticos_pkey" PRIMARY KEY ("id");


--
-- Name: donacion_detalle donacion_detalle_lote_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donacion_detalle"
    ADD CONSTRAINT "donacion_detalle_lote_id_key" UNIQUE ("lote_id");


--
-- Name: donacion_detalle donacion_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donacion_detalle"
    ADD CONSTRAINT "donacion_detalle_pkey" PRIMARY KEY ("id");


--
-- Name: donaciones donaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_pkey" PRIMARY KEY ("id");


--
-- Name: donantes donantes_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donantes"
    ADD CONSTRAINT "donantes_nombre_key" UNIQUE ("nombre");


--
-- Name: donantes donantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donantes"
    ADD CONSTRAINT "donantes_pkey" PRIMARY KEY ("id");


--
-- Name: eventos_auditoria eventos_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."eventos_auditoria"
    ADD CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id");


--
-- Name: existencias existencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."existencias"
    ADD CONSTRAINT "existencias_pkey" PRIMARY KEY ("id");


--
-- Name: expedientes expedientes_numero_ficha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expedientes"
    ADD CONSTRAINT "expedientes_numero_ficha_key" UNIQUE ("numero_ficha");


--
-- Name: expedientes expedientes_paciente_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expedientes"
    ADD CONSTRAINT "expedientes_paciente_id_key" UNIQUE ("paciente_id");


--
-- Name: expedientes expedientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expedientes"
    ADD CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id");


--
-- Name: fuentes_de_presupuesto fuentes_de_presupuesto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fuentes_de_presupuesto"
    ADD CONSTRAINT "fuentes_de_presupuesto_pkey" PRIMARY KEY ("id");


--
-- Name: fusiones_pacientes fusiones_pacientes_paciente_absorbido_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fusiones_pacientes"
    ADD CONSTRAINT "fusiones_pacientes_paciente_absorbido_id_key" UNIQUE ("paciente_absorbido_id");


--
-- Name: fusiones_pacientes fusiones_pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fusiones_pacientes"
    ADD CONSTRAINT "fusiones_pacientes_pkey" PRIMARY KEY ("id");


--
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_pkey" PRIMARY KEY ("id");


--
-- Name: idiomas idiomas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."idiomas"
    ADD CONSTRAINT "idiomas_codigo_key" UNIQUE ("codigo");


--
-- Name: idiomas idiomas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."idiomas"
    ADD CONSTRAINT "idiomas_nombre_key" UNIQUE ("nombre");


--
-- Name: idiomas idiomas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."idiomas"
    ADD CONSTRAINT "idiomas_pkey" PRIMARY KEY ("id");


--
-- Name: jornada_estado_historial jornada_estado_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_estado_historial"
    ADD CONSTRAINT "jornada_estado_historial_pkey" PRIMARY KEY ("id");


--
-- Name: jornada_insumos jornada_insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_insumos"
    ADD CONSTRAINT "jornada_insumos_pkey" PRIMARY KEY ("id");


--
-- Name: jornada_personal jornada_personal_jornada_id_perfil_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_personal"
    ADD CONSTRAINT "jornada_personal_jornada_id_perfil_id_key" UNIQUE ("jornada_id", "perfil_id");


--
-- Name: jornada_personal jornada_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_personal"
    ADD CONSTRAINT "jornada_personal_pkey" PRIMARY KEY ("id");


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_pkey" PRIMARY KEY ("id");


--
-- Name: jornadas jornadas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_codigo_key" UNIQUE ("codigo");


--
-- Name: jornadas jornadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id");


--
-- Name: limites_de_uso limites_de_uso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."limites_de_uso"
    ADD CONSTRAINT "limites_de_uso_pkey" PRIMARY KEY ("recurso", "actor_id");


--
-- Name: lotes lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_pkey" PRIMARY KEY ("id");


--
-- Name: medicamento_principio medicamento_principio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."medicamento_principio"
    ADD CONSTRAINT "medicamento_principio_pkey" PRIMARY KEY ("medicamento_id", "principio_id");


--
-- Name: medicamentos medicamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."medicamentos"
    ADD CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id");


--
-- Name: movimientos_de_caja movimientos_de_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_de_caja"
    ADD CONSTRAINT "movimientos_de_caja_pkey" PRIMARY KEY ("id");


--
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id");


--
-- Name: municipios municipios_departamento_id_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."municipios"
    ADD CONSTRAINT "municipios_departamento_id_nombre_key" UNIQUE ("departamento_id", "nombre");


--
-- Name: municipios municipios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."municipios"
    ADD CONSTRAINT "municipios_pkey" PRIMARY KEY ("id");


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");


--
-- Name: paciente_area paciente_area_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."paciente_area"
    ADD CONSTRAINT "paciente_area_pkey" PRIMARY KEY ("paciente_id", "area_id");


--
-- Name: pacientes pacientes_dpi_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_dpi_key" UNIQUE ("dpi");


--
-- Name: pacientes pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id");


--
-- Name: padecimientos_cronicos padecimientos_cronicos_paciente_id_condicion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."padecimientos_cronicos"
    ADD CONSTRAINT "padecimientos_cronicos_paciente_id_condicion_id_key" UNIQUE ("paciente_id", "condicion_id");


--
-- Name: padecimientos_cronicos padecimientos_cronicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."padecimientos_cronicos"
    ADD CONSTRAINT "padecimientos_cronicos_pkey" PRIMARY KEY ("id");


--
-- Name: perfil_especialidad perfil_especialidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfil_especialidad"
    ADD CONSTRAINT "perfil_especialidad_pkey" PRIMARY KEY ("perfil_id", "nombre_especialidad");


--
-- Name: perfiles perfiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_email_key" UNIQUE ("email");


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");


--
-- Name: permisos permisos_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."permisos"
    ADD CONSTRAINT "permisos_clave_key" UNIQUE ("clave");


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."permisos"
    ADD CONSTRAINT "permisos_pkey" PRIMARY KEY ("id");


--
-- Name: presentaciones presentaciones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."presentaciones"
    ADD CONSTRAINT "presentaciones_nombre_key" UNIQUE ("nombre");


--
-- Name: presentaciones presentaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."presentaciones"
    ADD CONSTRAINT "presentaciones_pkey" PRIMARY KEY ("id");


--
-- Name: principios_activos principios_activos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."principios_activos"
    ADD CONSTRAINT "principios_activos_nombre_key" UNIQUE ("nombre");


--
-- Name: principios_activos principios_activos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."principios_activos"
    ADD CONSTRAINT "principios_activos_pkey" PRIMARY KEY ("id");


--
-- Name: proveedores proveedores_donante_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_donante_id_key" UNIQUE ("donante_id");


--
-- Name: proveedores proveedores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_nombre_key" UNIQUE ("nombre");


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id");


--
-- Name: proyecto_estado_historial proyecto_estado_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_estado_historial"
    ADD CONSTRAINT "proyecto_estado_historial_pkey" PRIMARY KEY ("id");


--
-- Name: proyecto_hitos proyecto_hitos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_hitos"
    ADD CONSTRAINT "proyecto_hitos_pkey" PRIMARY KEY ("id");


--
-- Name: proyecto_insumos proyecto_insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_insumos"
    ADD CONSTRAINT "proyecto_insumos_pkey" PRIMARY KEY ("id");


--
-- Name: proyecto_insumos proyecto_insumos_proyecto_id_medicamento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_insumos"
    ADD CONSTRAINT "proyecto_insumos_proyecto_id_medicamento_id_key" UNIQUE ("proyecto_id", "medicamento_id");


--
-- Name: proyecto_personal proyecto_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_personal"
    ADD CONSTRAINT "proyecto_personal_pkey" PRIMARY KEY ("id");


--
-- Name: proyecto_personal proyecto_personal_proyecto_id_perfil_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_personal"
    ADD CONSTRAINT "proyecto_personal_proyecto_id_perfil_id_key" UNIQUE ("proyecto_id", "perfil_id");


--
-- Name: proyecto_seguimiento proyecto_seguimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_seguimiento"
    ADD CONSTRAINT "proyecto_seguimiento_pkey" PRIMARY KEY ("id");


--
-- Name: proyectos proyectos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyectos"
    ADD CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id");


--
-- Name: receta_detalle receta_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_pkey" PRIMARY KEY ("id");


--
-- Name: recetas recetas_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recetas"
    ADD CONSTRAINT "recetas_folio_key" UNIQUE ("folio");


--
-- Name: recetas recetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recetas"
    ADD CONSTRAINT "recetas_pkey" PRIMARY KEY ("id");


--
-- Name: rol_modulo rol_modulo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rol_modulo"
    ADD CONSTRAINT "rol_modulo_pkey" PRIMARY KEY ("id");


--
-- Name: rol_permiso rol_permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rol_permiso"
    ADD CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol", "permiso_id");


--
-- Name: triajes triajes_atencion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."triajes"
    ADD CONSTRAINT "triajes_atencion_id_key" UNIQUE ("atencion_id");


--
-- Name: triajes triajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."triajes"
    ADD CONSTRAINT "triajes_pkey" PRIMARY KEY ("id");


--
-- Name: avisos_caducidad uq_avisos_caducidad_alerta_umbral; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."avisos_caducidad"
    ADD CONSTRAINT "uq_avisos_caducidad_alerta_umbral" UNIQUE ("alerta_id", "umbral_dias");


--
-- Name: categorias_de_gasto uq_categorias_de_gasto_nombre_exacto; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_de_gasto"
    ADD CONSTRAINT "uq_categorias_de_gasto_nombre_exacto" UNIQUE ("nombre");


--
-- Name: configuracion_alertas_caducidad uq_configuracion_alertas_caducidad_unica; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."configuracion_alertas_caducidad"
    ADD CONSTRAINT "uq_configuracion_alertas_caducidad_unica" UNIQUE ("unica");


--
-- Name: consulta_diagnostico uq_consulta_diagnostico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consulta_diagnostico"
    ADD CONSTRAINT "uq_consulta_diagnostico" UNIQUE ("consulta_id", "diagnostico_id");


--
-- Name: existencias uq_existencias_lote_bodega; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."existencias"
    ADD CONSTRAINT "uq_existencias_lote_bodega" UNIQUE ("lote_id", "bodega_id");


--
-- Name: jornada_insumos uq_jornada_insumos_articulo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_insumos"
    ADD CONSTRAINT "uq_jornada_insumos_articulo" UNIQUE ("jornada_id", "medicamento_id");


--
-- Name: lotes uq_lotes_medicamento_proveedor_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "uq_lotes_medicamento_proveedor_numero" UNIQUE ("medicamento_id", "proveedor_id", "numero_lote");


--
-- Name: rol_modulo uq_rol_modulo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rol_modulo"
    ADD CONSTRAINT "uq_rol_modulo" UNIQUE ("rol", "modulo");


--
-- Name: usuario_permiso usuario_permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usuario_permiso"
    ADD CONSTRAINT "usuario_permiso_pkey" PRIMARY KEY ("perfil_id", "permiso_id");


--
-- Name: idx_alerta_caducidad_detalle_alerta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_alerta_caducidad_detalle_alerta_id" ON "public"."alerta_caducidad_detalle" USING "btree" ("alerta_id");


--
-- Name: idx_alertas_caducidad_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_alertas_caducidad_estado" ON "public"."alertas_caducidad" USING "btree" ("estado");


--
-- Name: idx_alertas_caducidad_lote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_alertas_caducidad_lote_id" ON "public"."alertas_caducidad" USING "btree" ("lote_id");


--
-- Name: idx_areas_atencion_nombre_normalizado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_areas_atencion_nombre_normalizado" ON "public"."areas_atencion" USING "btree" ("lower"("public"."f_unaccent"("btrim"(("nombre")::"text"))));


--
-- Name: INDEX "idx_areas_atencion_nombre_normalizado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."idx_areas_atencion_nombre_normalizado" IS 'Un area por nombre, sin distinguir mayusculas, acentos ni espacios de los extremos (00182).';


--
-- Name: idx_atenciones_jornada_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_atenciones_jornada_abiertas" ON "public"."atenciones" USING "btree" ("jornada_id") WHERE ("cerrada_en" IS NULL);


--
-- Name: idx_atenciones_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_atenciones_jornada_id" ON "public"."atenciones" USING "btree" ("jornada_id");


--
-- Name: idx_citas_clinica_horario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_citas_clinica_horario" ON "public"."citas" USING "btree" ("clinica_id", "inicia_en", "termina_en") WHERE ("estado" <> 'cancelada'::"public"."estado_cita");


--
-- Name: idx_citas_jornada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_citas_jornada" ON "public"."citas" USING "btree" ("jornada_id", "inicia_en");


--
-- Name: idx_citas_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_citas_paciente" ON "public"."citas" USING "btree" ("paciente_id");


--
-- Name: idx_citas_profesional; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_citas_profesional" ON "public"."citas" USING "btree" ("profesional_id") WHERE ("profesional_id" IS NOT NULL);


--
-- Name: idx_clinicas_nombre_normalizado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_clinicas_nombre_normalizado" ON "public"."clinicas" USING "btree" ("lower"("public"."f_unaccent"("btrim"(("nombre")::"text"))));


--
-- Name: INDEX "idx_clinicas_nombre_normalizado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."idx_clinicas_nombre_normalizado" IS 'Una clinica por nombre, sin distinguir mayusculas, acentos ni espacios de los extremos (00183).';


--
-- Name: idx_comunidades_municipio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comunidades_municipio_id" ON "public"."comunidades" USING "btree" ("municipio_id");


--
-- Name: idx_condiciones_cronicas_nombre_normalizado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_condiciones_cronicas_nombre_normalizado" ON "public"."condiciones_cronicas" USING "btree" ("lower"("public"."f_unaccent"("btrim"(("nombre")::"text"))));


--
-- Name: INDEX "idx_condiciones_cronicas_nombre_normalizado"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."idx_condiciones_cronicas_nombre_normalizado" IS 'Impide dos condiciones cuyo nombre solo difiere en mayusculas, acentos o espacios de los extremos. Complementa el UNIQUE de la columna cruda (00010), que no los distingue.';


--
-- Name: idx_consulta_diagnostico_consulta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consulta_diagnostico_consulta_id" ON "public"."consulta_diagnostico" USING "btree" ("consulta_id");


--
-- Name: idx_consulta_diagnostico_diagnostico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consulta_diagnostico_diagnostico_id" ON "public"."consulta_diagnostico" USING "btree" ("diagnostico_id");


--
-- Name: idx_consultas_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consultas_area" ON "public"."consultas" USING "btree" ("area_id") WHERE ("area_id" IS NOT NULL);


--
-- Name: idx_consultas_atencion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consultas_atencion_id" ON "public"."consultas" USING "btree" ("atencion_id");


--
-- Name: idx_consultas_expediente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consultas_expediente_id" ON "public"."consultas" USING "btree" ("expediente_id");


--
-- Name: idx_consultas_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consultas_jornada_id" ON "public"."consultas" USING "btree" ("jornada_id");


--
-- Name: idx_consultas_medico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_consultas_medico_id" ON "public"."consultas" USING "btree" ("medico_id");


--
-- Name: idx_diagnosticos_codigo_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_diagnosticos_codigo_unico" ON "public"."diagnosticos" USING "btree" ("codigo") WHERE ("codigo" IS NOT NULL);


--
-- Name: idx_diagnosticos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_diagnosticos_nombre" ON "public"."diagnosticos" USING "btree" ("nombre");


--
-- Name: idx_donacion_detalle_donacion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donacion_detalle_donacion_id" ON "public"."donacion_detalle" USING "btree" ("donacion_id");


--
-- Name: idx_donacion_detalle_medicamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donacion_detalle_medicamento_id" ON "public"."donacion_detalle" USING "btree" ("medicamento_id");


--
-- Name: idx_donaciones_donante_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donaciones_donante_id" ON "public"."donaciones" USING "btree" ("donante_id");


--
-- Name: idx_donaciones_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donaciones_estado" ON "public"."donaciones" USING "btree" ("estado");


--
-- Name: idx_donaciones_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donaciones_fecha" ON "public"."donaciones" USING "btree" ("fecha");


--
-- Name: idx_donaciones_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donaciones_jornada_id" ON "public"."donaciones" USING "btree" ("jornada_id");


--
-- Name: idx_donaciones_proyecto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donaciones_proyecto_id" ON "public"."donaciones" USING "btree" ("proyecto_id");


--
-- Name: idx_donantes_nombre_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_donantes_nombre_trgm" ON "public"."donantes" USING "gin" ("lower"("public"."f_unaccent"(("nombre")::"text")) "extensions"."gin_trgm_ops");


--
-- Name: idx_eventos_auditoria_realizado_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_eventos_auditoria_realizado_en" ON "public"."eventos_auditoria" USING "btree" ("realizado_en" DESC);


--
-- Name: idx_eventos_auditoria_realizado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_eventos_auditoria_realizado_por" ON "public"."eventos_auditoria" USING "btree" ("realizado_por") WHERE ("realizado_por" IS NOT NULL);


--
-- Name: idx_eventos_auditoria_tabla_fila; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_eventos_auditoria_tabla_fila" ON "public"."eventos_auditoria" USING "btree" ("tabla_afectada", "fila_id");


--
-- Name: idx_existencias_bodega_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_existencias_bodega_id" ON "public"."existencias" USING "btree" ("bodega_id");


--
-- Name: idx_fusiones_pacientes_sobreviviente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fusiones_pacientes_sobreviviente_id" ON "public"."fusiones_pacientes" USING "btree" ("paciente_sobreviviente_id");


--
-- Name: idx_gastos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gastos_estado" ON "public"."gastos" USING "btree" ("estado");


--
-- Name: idx_gastos_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gastos_jornada_id" ON "public"."gastos" USING "btree" ("jornada_id");


--
-- Name: idx_jornada_estado_historial_cambiado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornada_estado_historial_cambiado_por" ON "public"."jornada_estado_historial" USING "btree" ("cambiado_por");


--
-- Name: idx_jornada_estado_historial_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornada_estado_historial_jornada_id" ON "public"."jornada_estado_historial" USING "btree" ("jornada_id");


--
-- Name: idx_jornada_insumos_medicamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornada_insumos_medicamento_id" ON "public"."jornada_insumos" USING "btree" ("medicamento_id");


--
-- Name: idx_jornada_personal_perfil_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornada_personal_perfil_id" ON "public"."jornada_personal" USING "btree" ("perfil_id");


--
-- Name: idx_jornadas_botiquin_bodega_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornadas_botiquin_bodega_id" ON "public"."jornadas" USING "btree" ("botiquin_bodega_id");


--
-- Name: idx_jornadas_comunidad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornadas_comunidad_id" ON "public"."jornadas" USING "btree" ("comunidad_id");


--
-- Name: idx_jornadas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornadas_fecha" ON "public"."jornadas" USING "btree" ("fecha");


--
-- Name: idx_jornadas_proyecto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornadas_proyecto_id" ON "public"."jornadas" USING "btree" ("proyecto_id");


--
-- Name: idx_jornadas_responsable_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_jornadas_responsable_id" ON "public"."jornadas" USING "btree" ("responsable_id");


--
-- Name: idx_lotes_fecha_vencimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lotes_fecha_vencimiento" ON "public"."lotes" USING "btree" ("fecha_vencimiento");


--
-- Name: idx_lotes_proveedor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lotes_proveedor_id" ON "public"."lotes" USING "btree" ("proveedor_id");


--
-- Name: idx_medicamento_principio_principio_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_medicamento_principio_principio_id" ON "public"."medicamento_principio" USING "btree" ("principio_id");


--
-- Name: idx_movimientos_bodega_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_bodega_id" ON "public"."movimientos_inventario" USING "btree" ("bodega_id");


--
-- Name: idx_movimientos_de_caja_aporte_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_de_caja_aporte_id" ON "public"."movimientos_de_caja" USING "btree" ("aporte_id");


--
-- Name: idx_movimientos_de_caja_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_de_caja_jornada_id" ON "public"."movimientos_de_caja" USING "btree" ("jornada_id");


--
-- Name: idx_movimientos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_estado" ON "public"."movimientos_inventario" USING "btree" ("estado");


--
-- Name: idx_movimientos_inventario_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_inventario_jornada_id" ON "public"."movimientos_inventario" USING "btree" ("jornada_id") WHERE ("jornada_id" IS NOT NULL);


--
-- Name: idx_movimientos_inventario_receta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_inventario_receta_id" ON "public"."movimientos_inventario" USING "btree" ("receta_id") WHERE ("receta_id" IS NOT NULL);


--
-- Name: idx_movimientos_lote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_movimientos_lote_id" ON "public"."movimientos_inventario" USING "btree" ("lote_id");


--
-- Name: idx_municipios_departamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_municipios_departamento_id" ON "public"."municipios" USING "btree" ("departamento_id");


--
-- Name: idx_notificaciones_correo_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notificaciones_correo_pendiente" ON "public"."notificaciones" USING "btree" ("created_at") WHERE ("correo_enviado_en" IS NULL);


--
-- Name: idx_notificaciones_perfil_creada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notificaciones_perfil_creada" ON "public"."notificaciones" USING "btree" ("perfil_id", "created_at" DESC);


--
-- Name: idx_paciente_area_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_paciente_area_area" ON "public"."paciente_area" USING "btree" ("area_id");


--
-- Name: idx_pacientes_comunidad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pacientes_comunidad_id" ON "public"."pacientes" USING "btree" ("comunidad_id");


--
-- Name: idx_pacientes_nombre_completo_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pacientes_nombre_completo_trgm" ON "public"."pacientes" USING "gin" ("lower"("public"."f_unaccent"(((("nombres")::"text" || ' '::"text") || ("apellidos")::"text"))) "extensions"."gin_trgm_ops");


--
-- Name: idx_pacientes_registrado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pacientes_registrado_por" ON "public"."pacientes" USING "btree" ("registrado_por");


--
-- Name: idx_padecimientos_cronicos_condicion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_padecimientos_cronicos_condicion_id" ON "public"."padecimientos_cronicos" USING "btree" ("condicion_id");


--
-- Name: idx_padecimientos_cronicos_paciente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_padecimientos_cronicos_paciente_id" ON "public"."padecimientos_cronicos" USING "btree" ("paciente_id");


--
-- Name: idx_presupuesto_origen_donacion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_presupuesto_origen_donacion_id" ON "public"."jornada_presupuesto_origen" USING "btree" ("donacion_id");


--
-- Name: idx_presupuesto_origen_jornada_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_presupuesto_origen_jornada_id" ON "public"."jornada_presupuesto_origen" USING "btree" ("jornada_id");


--
-- Name: idx_presupuesto_origen_traspasado_desde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_presupuesto_origen_traspasado_desde" ON "public"."jornada_presupuesto_origen" USING "btree" ("traspasado_desde");


--
-- Name: idx_principios_activos_nombre_normalizado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_principios_activos_nombre_normalizado" ON "public"."principios_activos" USING "btree" ("nombre_normalizado");


--
-- Name: idx_proyecto_estado_historial_cambiado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_estado_historial_cambiado_por" ON "public"."proyecto_estado_historial" USING "btree" ("cambiado_por");


--
-- Name: idx_proyecto_estado_historial_proyecto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_estado_historial_proyecto_id" ON "public"."proyecto_estado_historial" USING "btree" ("proyecto_id");


--
-- Name: idx_proyecto_hitos_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_hitos_pendientes" ON "public"."proyecto_hitos" USING "btree" ("proyecto_id") WHERE ("fecha_real" IS NULL);


--
-- Name: INDEX "idx_proyecto_hitos_pendientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX "public"."idx_proyecto_hitos_pendientes" IS 'Indice parcial para la advertencia de cierre, que solo pregunta por los hitos sin fecha real.';


--
-- Name: idx_proyecto_hitos_proyecto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_hitos_proyecto_id" ON "public"."proyecto_hitos" USING "btree" ("proyecto_id");


--
-- Name: idx_proyecto_insumos_medicamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_insumos_medicamento_id" ON "public"."proyecto_insumos" USING "btree" ("medicamento_id");


--
-- Name: idx_proyecto_personal_perfil_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_personal_perfil_id" ON "public"."proyecto_personal" USING "btree" ("perfil_id");


--
-- Name: idx_proyecto_seguimiento_proyecto_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_proyecto_seguimiento_proyecto_fecha" ON "public"."proyecto_seguimiento" USING "btree" ("proyecto_id", "created_at" DESC);


--
-- Name: idx_receta_detalle_lote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_receta_detalle_lote_id" ON "public"."receta_detalle" USING "btree" ("lote_id");


--
-- Name: idx_receta_detalle_medicamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_receta_detalle_medicamento_id" ON "public"."receta_detalle" USING "btree" ("medicamento_id");


--
-- Name: idx_receta_detalle_receta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_receta_detalle_receta_id" ON "public"."receta_detalle" USING "btree" ("receta_id");


--
-- Name: idx_recetas_consulta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_recetas_consulta_id" ON "public"."recetas" USING "btree" ("consulta_id");


--
-- Name: idx_recetas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_recetas_estado" ON "public"."recetas" USING "btree" ("estado");


--
-- Name: idx_recetas_medico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_recetas_medico_id" ON "public"."recetas" USING "btree" ("medico_id");


--
-- Name: idx_triajes_tomado_por; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_triajes_tomado_por" ON "public"."triajes" USING "btree" ("tomado_por");


--
-- Name: idx_unico_diagnostico_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_unico_diagnostico_principal" ON "public"."consulta_diagnostico" USING "btree" ("consulta_id") WHERE ("es_principal" IS TRUE);


--
-- Name: uq_alertas_caducidad_lote_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_alertas_caducidad_lote_pendiente" ON "public"."alertas_caducidad" USING "btree" ("lote_id") WHERE ("estado" = 'pendiente'::"public"."estado_alerta");


--
-- Name: uq_bodegas_una_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_bodegas_una_principal" ON "public"."bodegas" USING "btree" ("es_principal") WHERE "es_principal";


--
-- Name: uq_categorias_de_gasto_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_categorias_de_gasto_nombre" ON "public"."categorias_de_gasto" USING "btree" ("lower"("nombre"));


--
-- Name: uq_fuentes_de_presupuesto_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_fuentes_de_presupuesto_nombre" ON "public"."fuentes_de_presupuesto" USING "btree" ("lower"("btrim"(("nombre")::"text")));


--
-- Name: uq_movimientos_de_caja_salida_por_aporte; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_movimientos_de_caja_salida_por_aporte" ON "public"."movimientos_de_caja" USING "btree" ("aporte_id") WHERE (("tipo")::"text" = 'salida'::"text");


--
-- Name: uq_notificaciones_incidencia; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_notificaciones_incidencia" ON "public"."notificaciones" USING "btree" ("perfil_id", "origen_tabla", "origen_id") WHERE ("origen_tabla" <> 'medicamentos'::"text");


--
-- Name: movimientos_inventario tr_actualizar_existencias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_actualizar_existencias" BEFORE UPDATE ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_actualizar_existencias"();


--
-- Name: gastos tr_autoaprobar_gasto_administrador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_autoaprobar_gasto_administrador" BEFORE INSERT ON "public"."gastos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_autoaprobar_gasto_administrador"();


--
-- Name: movimientos_inventario tr_autoaprobar_movimiento_inventario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_autoaprobar_movimiento_inventario" BEFORE INSERT ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_autoaprobar_movimiento_inventario"();


--
-- Name: TRIGGER "tr_autoaprobar_movimiento_inventario" ON "movimientos_inventario"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "tr_autoaprobar_movimiento_inventario" ON "public"."movimientos_inventario" IS 'Auto-aprueba al insertar cuando quien registra el movimiento es administrador. Issue #294.';


--
-- Name: gastos tr_bloquear_gasto_finalizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_bloquear_gasto_finalizado" BEFORE DELETE OR UPDATE ON "public"."gastos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_bloquear_gasto_finalizado"();


--
-- Name: movimientos_inventario tr_bloquear_movimiento_finalizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_bloquear_movimiento_finalizado" BEFORE DELETE OR UPDATE ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_bloquear_movimiento_finalizado"();


--
-- Name: gastos tr_gastos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_gastos_updated_at" BEFORE UPDATE ON "public"."gastos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: movimientos_inventario tr_proteger_decision_de_movimiento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_proteger_decision_de_movimiento" BEFORE UPDATE ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proteger_decision_de_movimiento"();


--
-- Name: jornadas tr_validar_transicion_estado_jornada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_validar_transicion_estado_jornada" BEFORE UPDATE OF "estado" ON "public"."jornadas" FOR EACH ROW WHEN (("old"."estado" IS DISTINCT FROM "new"."estado")) EXECUTE FUNCTION "public"."fn_validar_transicion_estado_jornada"();


--
-- Name: TRIGGER "tr_validar_transicion_estado_jornada" ON "jornadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "tr_validar_transicion_estado_jornada" ON "public"."jornadas" IS 'Impide guardar un cambio de estado de jornada que no este en la lista de transiciones permitidas, o una reapertura hecha por alguien que no sea administrador. Issue #171.';


--
-- Name: proyectos tr_validar_transicion_estado_proyecto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tr_validar_transicion_estado_proyecto" BEFORE UPDATE OF "estado" ON "public"."proyectos" FOR EACH ROW WHEN (("old"."estado" IS DISTINCT FROM "new"."estado")) EXECUTE FUNCTION "public"."fn_validar_transicion_estado_proyecto"();


--
-- Name: TRIGGER "tr_validar_transicion_estado_proyecto" ON "proyectos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "tr_validar_transicion_estado_proyecto" ON "public"."proyectos" IS 'Impide guardar un cambio de estado de proyecto que no este en la lista de transiciones permitidas.';


--
-- Name: alertas_caducidad trg_alertas_caducidad_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_alertas_caducidad_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."alertas_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: alertas_caducidad trg_alertas_caducidad_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_alertas_caducidad_updated_at" BEFORE UPDATE ON "public"."alertas_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: areas_atencion trg_areas_atencion_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_areas_atencion_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."areas_atencion" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: areas_atencion trg_areas_atencion_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_areas_atencion_updated_at" BEFORE UPDATE ON "public"."areas_atencion" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: atenciones trg_atenciones_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_atenciones_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."atenciones" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: atenciones trg_atenciones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_atenciones_updated_at" BEFORE UPDATE ON "public"."atenciones" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: avisos_caducidad trg_avisos_caducidad_notificar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_avisos_caducidad_notificar" AFTER INSERT ON "public"."avisos_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notificar_aviso_caducidad"();


--
-- Name: bodegas trg_bodegas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_bodegas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."bodegas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: bodegas trg_bodegas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_bodegas_updated_at" BEFORE UPDATE ON "public"."bodegas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: categorias_de_gasto trg_categorias_de_gasto_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_categorias_de_gasto_auditoria" AFTER INSERT ON "public"."categorias_de_gasto" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: TRIGGER "trg_categorias_de_gasto_auditoria" ON "categorias_de_gasto"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_categorias_de_gasto_auditoria" ON "public"."categorias_de_gasto" IS 'Deja en la bitacora de auditoria quien creo cada categoria de gasto.';


--
-- Name: citas trg_citas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_citas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."citas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: citas trg_citas_exige_permiso_de_agenda; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_citas_exige_permiso_de_agenda" BEFORE UPDATE ON "public"."citas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cita_exige_permiso_de_agenda"();


--
-- Name: citas trg_citas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_citas_updated_at" BEFORE UPDATE ON "public"."citas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: citas trg_citas_validar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_citas_validar" BEFORE INSERT OR UPDATE ON "public"."citas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_cita"();


--
-- Name: clinicas trg_clinicas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_clinicas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."clinicas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: clinicas trg_clinicas_salas_cubren_lo_agendado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_clinicas_salas_cubren_lo_agendado" BEFORE UPDATE OF "salas_disponibles" ON "public"."clinicas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_clinica_salas_cubren_lo_agendado"();


--
-- Name: clinicas trg_clinicas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_clinicas_updated_at" BEFORE UPDATE ON "public"."clinicas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: comunidades trg_comunidades_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_comunidades_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."comunidades" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: comunidades trg_comunidades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_comunidades_updated_at" BEFORE UPDATE ON "public"."comunidades" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: condiciones_cronicas trg_condiciones_cronicas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_condiciones_cronicas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."condiciones_cronicas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: configuracion_alertas_caducidad trg_configuracion_alertas_caducidad_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_configuracion_alertas_caducidad_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."configuracion_alertas_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: configuracion_alertas_caducidad trg_configuracion_alertas_caducidad_normalizar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_configuracion_alertas_caducidad_normalizar" BEFORE INSERT OR UPDATE ON "public"."configuracion_alertas_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"();


--
-- Name: configuracion_alertas_caducidad trg_configuracion_alertas_caducidad_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_configuracion_alertas_caducidad_updated_at" BEFORE UPDATE ON "public"."configuracion_alertas_caducidad" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: consulta_diagnostico trg_consulta_diagnostico_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_consulta_diagnostico_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."consulta_diagnostico" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: consultas trg_consultas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_consultas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: consultas trg_consultas_cita_antes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_consultas_cita_antes" BEFORE INSERT OR UPDATE OF "cita_id", "area_id" ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_consulta_de_cita_antes"();


--
-- Name: consultas trg_consultas_cita_despues; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_consultas_cita_despues" AFTER INSERT OR UPDATE OF "cita_id" ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_consulta_de_cita_despues"();


--
-- Name: consultas trg_consultas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_consultas_updated_at" BEFORE UPDATE ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_consultas_updated_at" ON "consultas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_consultas_updated_at" ON "public"."consultas" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de consultas.';


--
-- Name: departamentos trg_departamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_departamentos_updated_at" BEFORE UPDATE ON "public"."departamentos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: diagnosticos trg_diagnosticos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_diagnosticos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."diagnosticos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: diagnosticos trg_diagnosticos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_diagnosticos_updated_at" BEFORE UPDATE ON "public"."diagnosticos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: donacion_detalle trg_donacion_detalle_aportar_a_su_jornada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donacion_detalle_aportar_a_su_jornada" AFTER INSERT ON "public"."donacion_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."fn_aportar_donacion_a_su_jornada"();


--
-- Name: TRIGGER "trg_donacion_detalle_aportar_a_su_jornada" ON "donacion_detalle"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_donacion_detalle_aportar_a_su_jornada" ON "public"."donacion_detalle" IS 'El dinero donado para una jornada entra solo a su presupuesto (00187).';


--
-- Name: donacion_detalle trg_donacion_detalle_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donacion_detalle_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."donacion_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: donacion_detalle trg_donacion_detalle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donacion_detalle_updated_at" BEFORE UPDATE ON "public"."donacion_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: donacion_detalle trg_donacion_detalle_validar_lote; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donacion_detalle_validar_lote" BEFORE INSERT OR UPDATE OF "lote_id" ON "public"."donacion_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_lote_de_renglon_de_donacion"();


--
-- Name: donaciones trg_donaciones_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donaciones_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."donaciones" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: donaciones trg_donaciones_proyecto_de_la_jornada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donaciones_proyecto_de_la_jornada" BEFORE INSERT OR UPDATE OF "jornada_id", "proyecto_id" ON "public"."donaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_de_la_jornada_de_la_donacion"();


--
-- Name: donaciones trg_donaciones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donaciones_updated_at" BEFORE UPDATE ON "public"."donaciones" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: donantes trg_donantes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donantes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."donantes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: donantes trg_donantes_proveedor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donantes_proveedor" AFTER INSERT OR UPDATE OF "nombre", "contacto", "telefono", "email" ON "public"."donantes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proveedor_sigue_al_donante"();


--
-- Name: donantes trg_donantes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_donantes_updated_at" BEFORE UPDATE ON "public"."donantes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: existencias trg_existencias_notificar_sin_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_existencias_notificar_sin_stock" AFTER UPDATE ON "public"."existencias" REFERENCING OLD TABLE AS "viejas" NEW TABLE AS "nuevas" FOR EACH STATEMENT EXECUTE FUNCTION "public"."fn_notificar_medicamento_sin_stock"();


--
-- Name: existencias trg_existencias_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_existencias_updated_at" BEFORE UPDATE ON "public"."existencias" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: expedientes trg_expedientes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_expedientes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."expedientes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: expedientes trg_expedientes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_expedientes_updated_at" BEFORE UPDATE ON "public"."expedientes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: fuentes_de_presupuesto trg_fuentes_de_presupuesto_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_fuentes_de_presupuesto_auditoria" AFTER INSERT ON "public"."fuentes_de_presupuesto" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: fusiones_pacientes trg_fusiones_pacientes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_fusiones_pacientes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."fusiones_pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: gastos trg_gastos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_gastos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."gastos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: gastos trg_gastos_notificar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_gastos_notificar" AFTER INSERT ON "public"."gastos" FOR EACH ROW WHEN (("new"."estado" = 'pendiente'::"public"."estado_gasto")) EXECUTE FUNCTION "public"."fn_notificar_gasto_por_aprobar"();


--
-- Name: gastos trg_gastos_validar_contra_presupuesto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_gastos_validar_contra_presupuesto" BEFORE INSERT OR UPDATE ON "public"."gastos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_gasto_contra_presupuesto"();


--
-- Name: TRIGGER "trg_gastos_validar_contra_presupuesto" ON "gastos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_gastos_validar_contra_presupuesto" ON "public"."gastos" IS 'Sin gastos nuevos en una jornada finalizada, fecha del gasto hasta el dia de su jornada (o hoy) y lo comprometido dentro del presupuesto asignado (00159).';


--
-- Name: pacientes trg_impedir_baja_de_paciente; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_baja_de_paciente" BEFORE UPDATE OF "fecha_baja" ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_baja_de_paciente_sin_ser_administrador"();


--
-- Name: diagnosticos trg_impedir_desactivar_diagnostico; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_desactivar_diagnostico" BEFORE UPDATE OF "activo" ON "public"."diagnosticos" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_desactivar_sin_ser_administrador"();


--
-- Name: medicamentos trg_impedir_desactivar_medicamento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_desactivar_medicamento" BEFORE UPDATE OF "activo" ON "public"."medicamentos" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_desactivar_sin_ser_administrador"();


--
-- Name: areas_atencion trg_impedir_retirar_area_atencion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_retirar_area_atencion" BEFORE UPDATE OF "es_vigente" ON "public"."areas_atencion" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_retirar_sin_ser_administrador"();


--
-- Name: clinicas trg_impedir_retirar_clinica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_retirar_clinica" BEFORE UPDATE OF "es_vigente" ON "public"."clinicas" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_retirar_sin_ser_administrador"();


--
-- Name: comunidades trg_impedir_retirar_comunidad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_retirar_comunidad" BEFORE UPDATE OF "es_vigente" ON "public"."comunidades" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_retirar_sin_ser_administrador"();


--
-- Name: condiciones_cronicas trg_impedir_retirar_condicion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_impedir_retirar_condicion" BEFORE UPDATE OF "es_vigente" ON "public"."condiciones_cronicas" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_retirar_sin_ser_administrador"();


--
-- Name: jornada_insumos trg_jornada_insumos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornada_insumos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."jornada_insumos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: jornada_insumos trg_jornada_insumos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornada_insumos_updated_at" BEFORE UPDATE ON "public"."jornada_insumos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: jornada_personal trg_jornada_personal_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornada_personal_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."jornada_personal" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: jornada_personal trg_jornada_personal_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornada_personal_updated_at" BEFORE UPDATE ON "public"."jornada_personal" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_jornada_personal_updated_at" ON "jornada_personal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_jornada_personal_updated_at" ON "public"."jornada_personal" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de jornada_personal.';


--
-- Name: jornada_presupuesto_origen trg_jornada_presupuesto_origen_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornada_presupuesto_origen_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: jornadas trg_jornadas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: jornadas trg_jornadas_cancela_citas_pendientes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_cancela_citas_pendientes" AFTER UPDATE OF "estado" ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_jornada_cancela_citas_pendientes"();


--
-- Name: jornadas trg_jornadas_estado_historial; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_estado_historial" AFTER INSERT OR UPDATE OF "estado" ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_cambio_estado_jornada"();


--
-- Name: TRIGGER "trg_jornadas_estado_historial" ON "jornadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_jornadas_estado_historial" ON "public"."jornadas" IS 'Inserta una fila en jornada_estado_historial cuando se crea una jornada o cambia su estado.';


--
-- Name: jornadas trg_jornadas_fechas_reales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_fechas_reales" BEFORE INSERT OR UPDATE OF "estado" ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fechas_reales_de_jornada"();


--
-- Name: jornadas trg_jornadas_impedir_presupuesto_a_mano; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_impedir_presupuesto_a_mano" BEFORE UPDATE OF "presupuesto_asignado" ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_impedir_presupuesto_a_mano"();


--
-- Name: jornadas trg_jornadas_origen_del_presupuesto_inicial; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_origen_del_presupuesto_inicial" AFTER INSERT ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_origen_del_presupuesto_inicial"();


--
-- Name: jornadas trg_jornadas_proyecto_no_cancelado_al_asociar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_proyecto_no_cancelado_al_asociar" BEFORE UPDATE OF "proyecto_id" ON "public"."jornadas" FOR EACH ROW WHEN (("old"."proyecto_id" IS DISTINCT FROM "new"."proyecto_id")) EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: jornadas trg_jornadas_proyecto_no_cancelado_al_crear; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_proyecto_no_cancelado_al_crear" BEFORE INSERT ON "public"."jornadas" FOR EACH ROW WHEN (("new"."proyecto_id" IS NOT NULL)) EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: jornadas trg_jornadas_proyecto_obligatorio_al_cambiar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_proyecto_obligatorio_al_cambiar" BEFORE UPDATE OF "proyecto_id" ON "public"."jornadas" FOR EACH ROW WHEN (("old"."proyecto_id" IS DISTINCT FROM "new"."proyecto_id")) EXECUTE FUNCTION "public"."fn_jornada_exige_proyecto"();


--
-- Name: jornadas trg_jornadas_proyecto_obligatorio_al_crear; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_proyecto_obligatorio_al_crear" BEFORE INSERT ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_jornada_exige_proyecto"();


--
-- Name: jornadas trg_jornadas_requiere_bodega_movil_al_cambiar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_requiere_bodega_movil_al_cambiar" BEFORE UPDATE OF "botiquin_bodega_id" ON "public"."jornadas" FOR EACH ROW WHEN (("old"."botiquin_bodega_id" IS DISTINCT FROM "new"."botiquin_bodega_id")) EXECUTE FUNCTION "public"."fn_jornada_exige_bodega_movil"();


--
-- Name: jornadas trg_jornadas_requiere_bodega_movil_al_crear; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_requiere_bodega_movil_al_crear" BEFORE INSERT ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_jornada_exige_bodega_movil"();


--
-- Name: jornadas trg_jornadas_requiere_bodega_movil_libre; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_requiere_bodega_movil_libre" BEFORE INSERT OR UPDATE OF "estado", "botiquin_bodega_id" ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_jornada_bodega_movil_libre"();


--
-- Name: jornadas trg_jornadas_sin_inventario_cargado_al_cambiar_bodega; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_sin_inventario_cargado_al_cambiar_bodega" BEFORE UPDATE OF "botiquin_bodega_id" ON "public"."jornadas" FOR EACH ROW WHEN (("old"."botiquin_bodega_id" IS DISTINCT FROM "new"."botiquin_bodega_id")) EXECUTE FUNCTION "public"."fn_jornada_sin_inventario_cargado_al_cambiar_bodega"();


--
-- Name: jornadas trg_jornadas_traspasar_sobrante_al_iniciar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_traspasar_sobrante_al_iniciar" AFTER UPDATE OF "estado" ON "public"."jornadas" FOR EACH ROW WHEN ((("old"."estado" = 'planificada'::"public"."estado_jornada") AND ("new"."estado" = 'en curso'::"public"."estado_jornada"))) EXECUTE FUNCTION "public"."fn_traspasar_sobrante_al_iniciar_jornada"();


--
-- Name: jornadas trg_jornadas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_jornadas_updated_at" BEFORE UPDATE ON "public"."jornadas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_jornadas_updated_at" ON "jornadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_jornadas_updated_at" ON "public"."jornadas" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de jornadas.';


--
-- Name: lotes trg_lotes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_lotes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."lotes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: lotes trg_lotes_medicamento_con_vencimiento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_lotes_medicamento_con_vencimiento" BEFORE INSERT OR UPDATE OF "fecha_vencimiento", "medicamento_id" ON "public"."lotes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_lote_de_medicamento_tiene_vencimiento"();


--
-- Name: lotes trg_lotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_lotes_updated_at" BEFORE UPDATE ON "public"."lotes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: medicamento_principio trg_medicamento_principio_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_medicamento_principio_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."medicamento_principio" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"('medicamento_id');


--
-- Name: medicamentos trg_medicamentos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_medicamentos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."medicamentos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: medicamentos trg_medicamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_medicamentos_updated_at" BEFORE UPDATE ON "public"."medicamentos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: movimientos_inventario trg_movimientos_anular_receta_al_rechazar_su_entrega; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_movimientos_anular_receta_al_rechazar_su_entrega" AFTER UPDATE OF "estado" ON "public"."movimientos_inventario" FOR EACH ROW WHEN ((("old"."estado" = 'pendiente'::"public"."estado_movimiento") AND ("new"."estado" = 'rechazado'::"public"."estado_movimiento") AND ("new"."receta_id" IS NOT NULL) AND ("new"."tipo" = 'salida'::"public"."tipo_movimiento") AND ("new"."motivo" ~~ 'Entrega por receta medica%'::"text"))) EXECUTE FUNCTION "public"."fn_anular_receta_al_rechazar_su_entrega"();


--
-- Name: movimientos_inventario trg_movimientos_aprobar_entrega_completa_de_receta; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_movimientos_aprobar_entrega_completa_de_receta" AFTER UPDATE OF "estado" ON "public"."movimientos_inventario" FOR EACH ROW WHEN ((("old"."estado" = 'pendiente'::"public"."estado_movimiento") AND ("new"."estado" = 'aprobado'::"public"."estado_movimiento") AND ("new"."receta_id" IS NOT NULL) AND ("new"."tipo" = 'salida'::"public"."tipo_movimiento") AND ("new"."motivo" ~~ 'Entrega por receta medica%'::"text"))) EXECUTE FUNCTION "public"."fn_aprobar_entrega_completa_de_receta"();


--
-- Name: movimientos_inventario trg_movimientos_inventario_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_movimientos_inventario_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: movimientos_inventario trg_movimientos_inventario_notificar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_movimientos_inventario_notificar" AFTER INSERT ON "public"."movimientos_inventario" FOR EACH ROW WHEN (("new"."estado" = 'pendiente'::"public"."estado_movimiento")) EXECUTE FUNCTION "public"."fn_notificar_movimiento_por_validar"();


--
-- Name: municipios trg_municipios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_municipios_updated_at" BEFORE UPDATE ON "public"."municipios" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: notificaciones trg_notificaciones_disparar_correo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_notificaciones_disparar_correo" AFTER INSERT ON "public"."notificaciones" FOR EACH STATEMENT EXECUTE FUNCTION "public"."fn_disparar_correo_de_notificaciones"();


--
-- Name: paciente_area trg_paciente_area_area_vigente; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_paciente_area_area_vigente" BEFORE INSERT ON "public"."paciente_area" FOR EACH ROW EXECUTE FUNCTION "public"."fn_paciente_area_area_vigente"();


--
-- Name: paciente_area trg_paciente_area_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_paciente_area_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."paciente_area" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"('paciente_id');


--
-- Name: pacientes trg_pacientes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_pacientes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: pacientes trg_pacientes_impedir_borrado_fisico; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_pacientes_impedir_borrado_fisico" BEFORE DELETE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_borrado_fisico_paciente"();


--
-- Name: pacientes trg_pacientes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_pacientes_updated_at" BEFORE UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: padecimientos_cronicos trg_padecimientos_cronicos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_padecimientos_cronicos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."padecimientos_cronicos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: padecimientos_cronicos trg_padecimientos_cronicos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_padecimientos_cronicos_updated_at" BEFORE UPDATE ON "public"."padecimientos_cronicos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: perfil_especialidad trg_perfil_especialidad_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfil_especialidad_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."perfil_especialidad" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"('perfil_id');


--
-- Name: perfiles trg_perfiles_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: perfiles trg_perfiles_impedir_autodesactivacion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_impedir_autodesactivacion" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_autodesactivacion"();


--
-- Name: perfiles trg_perfiles_impedir_borrar_ultimo_administrador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_impedir_borrar_ultimo_administrador" BEFORE DELETE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_borrar_ultimo_administrador"();


--
-- Name: perfiles trg_perfiles_impedir_cambio_de_rol_propio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_impedir_cambio_de_rol_propio" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_cambio_de_rol_propio"();


--
-- Name: perfiles trg_perfiles_impedir_ultimo_administrador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_impedir_ultimo_administrador" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_dejar_sin_administrador_activo"();


--
-- Name: perfiles trg_perfiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_perfiles_updated_at" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: presentaciones trg_presentaciones_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presentaciones_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."presentaciones" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_impedir_devuelto_a_mano; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_impedir_devuelto_a_mano" BEFORE INSERT OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_impedir_devuelto_a_mano"();


--
-- Name: TRIGGER "trg_presupuesto_origen_impedir_devuelto_a_mano" ON "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_presupuesto_origen_impedir_devuelto_a_mano" ON "public"."jornada_presupuesto_origen" IS 'Solo la liquidacion del sobrante escribe devuelto y traspasado_desde (00160).';


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_impedir_quitar_liquidado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_impedir_quitar_liquidado" BEFORE DELETE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_impedir_quitar_aporte_liquidado"();


--
-- Name: TRIGGER "trg_presupuesto_origen_impedir_quitar_liquidado" ON "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_presupuesto_origen_impedir_quitar_liquidado" ON "public"."jornada_presupuesto_origen" IS 'Un aporte con sobrante liquidado es historia del presupuesto: no se borra (00160).';


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_proteger_comprometido; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_proteger_comprometido" BEFORE DELETE OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proteger_presupuesto_comprometido"();


--
-- Name: TRIGGER "trg_presupuesto_origen_proteger_comprometido" ON "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_presupuesto_origen_proteger_comprometido" ON "public"."jornada_presupuesto_origen" IS 'Impide quitar o rebajar un aporte por debajo de lo que la jornada ya comprometio en gastos (00159).';


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_registrado_por; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_registrado_por" BEFORE INSERT ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"();


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_salida_de_caja; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_salida_de_caja" AFTER INSERT OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_registrar_salida_de_caja"();


--
-- Name: TRIGGER "trg_presupuesto_origen_salida_de_caja" ON "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_presupuesto_origen_salida_de_caja" ON "public"."jornada_presupuesto_origen" IS 'Registra la salida de la caja de un aporte con origen caja (00168).';


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_sincronizar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_sincronizar" AFTER INSERT OR DELETE OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"();


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_updated_at" BEFORE UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_validar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_validar" BEFORE INSERT OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_origen_de_presupuesto"();


--
-- Name: jornada_presupuesto_origen trg_presupuesto_origen_validar_caja; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_presupuesto_origen_validar_caja" BEFORE INSERT OR UPDATE ON "public"."jornada_presupuesto_origen" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_aporte_de_caja"();


--
-- Name: TRIGGER "trg_presupuesto_origen_validar_caja" ON "jornada_presupuesto_origen"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_presupuesto_origen_validar_caja" ON "public"."jornada_presupuesto_origen" IS 'Un aporte de la caja no pasa del saldo de la caja (00168).';


--
-- Name: principios_activos trg_principios_activos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_principios_activos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."principios_activos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proveedores trg_proveedores_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proveedores_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proveedores" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proveedores trg_proveedores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proveedores_updated_at" BEFORE UPDATE ON "public"."proveedores" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: proyecto_hitos trg_proyecto_hitos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_hitos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proyecto_hitos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proyecto_hitos trg_proyecto_hitos_proyecto_no_cancelado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_hitos_proyecto_no_cancelado" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proyecto_hitos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: proyecto_hitos trg_proyecto_hitos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_hitos_updated_at" BEFORE UPDATE ON "public"."proyecto_hitos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: proyecto_insumos trg_proyecto_insumos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_insumos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proyecto_insumos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proyecto_insumos trg_proyecto_insumos_proyecto_no_cancelado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_insumos_proyecto_no_cancelado" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proyecto_insumos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: proyecto_insumos trg_proyecto_insumos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_insumos_updated_at" BEFORE UPDATE ON "public"."proyecto_insumos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_proyecto_insumos_updated_at" ON "proyecto_insumos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_proyecto_insumos_updated_at" ON "public"."proyecto_insumos" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyecto_insumos.';


--
-- Name: proyecto_personal trg_proyecto_personal_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_personal_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proyecto_personal" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proyecto_personal trg_proyecto_personal_proyecto_no_cancelado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_personal_proyecto_no_cancelado" BEFORE INSERT OR DELETE OR UPDATE ON "public"."proyecto_personal" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: proyecto_personal trg_proyecto_personal_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_personal_updated_at" BEFORE UPDATE ON "public"."proyecto_personal" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_proyecto_personal_updated_at" ON "proyecto_personal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_proyecto_personal_updated_at" ON "public"."proyecto_personal" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyecto_personal.';


--
-- Name: proyecto_seguimiento trg_proyecto_seguimiento_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_seguimiento_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proyecto_seguimiento" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proyecto_seguimiento trg_proyecto_seguimiento_proyecto_no_cancelado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyecto_seguimiento_proyecto_no_cancelado" BEFORE INSERT ON "public"."proyecto_seguimiento" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"();


--
-- Name: proyectos trg_proyectos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyectos_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."proyectos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: proyectos trg_proyectos_avance_seguimiento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyectos_avance_seguimiento" AFTER UPDATE OF "porcentaje_avance" ON "public"."proyectos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_avance_de_proyecto"();


--
-- Name: proyectos trg_proyectos_cancelado_no_se_modifica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyectos_cancelado_no_se_modifica" BEFORE UPDATE ON "public"."proyectos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proyecto_cancelado_no_se_modifica"();


--
-- Name: proyectos trg_proyectos_estado_historial; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyectos_estado_historial" AFTER INSERT OR UPDATE OF "estado" ON "public"."proyectos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_cambio_estado_proyecto"();


--
-- Name: TRIGGER "trg_proyectos_estado_historial" ON "proyectos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_proyectos_estado_historial" ON "public"."proyectos" IS 'Inserta una fila en proyecto_estado_historial cuando se crea un proyecto o cambia su estado.';


--
-- Name: proyectos trg_proyectos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_proyectos_updated_at" BEFORE UPDATE ON "public"."proyectos" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_proyectos_updated_at" ON "proyectos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_proyectos_updated_at" ON "public"."proyectos" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyectos.';


--
-- Name: receta_detalle trg_receta_detalle_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_receta_detalle_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."receta_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: recetas trg_recetas_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_recetas_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."recetas" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: recetas trg_recetas_devolver_inventario_al_anular; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_recetas_devolver_inventario_al_anular" AFTER UPDATE OF "estado" ON "public"."recetas" FOR EACH ROW WHEN ((("old"."estado" = 'emitida'::"public"."estado_receta") AND ("new"."estado" = 'anulada'::"public"."estado_receta"))) EXECUTE FUNCTION "public"."fn_devolver_inventario_de_receta_anulada"();


--
-- Name: recetas trg_recetas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_recetas_updated_at" BEFORE UPDATE ON "public"."recetas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: TRIGGER "trg_recetas_updated_at" ON "recetas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER "trg_recetas_updated_at" ON "public"."recetas" IS 'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de recetas.';


--
-- Name: rol_modulo trg_rol_modulo_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_rol_modulo_auditoria" AFTER INSERT OR DELETE ON "public"."rol_modulo" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: rol_permiso trg_rol_permiso_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_rol_permiso_auditoria" AFTER INSERT OR DELETE ON "public"."rol_permiso" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria_rol_permiso"();


--
-- Name: triajes trg_triajes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_triajes_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."triajes" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria"();


--
-- Name: triajes trg_triajes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_triajes_updated_at" BEFORE UPDATE ON "public"."triajes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_timestamp_updated_at"();


--
-- Name: usuario_permiso trg_usuario_permiso_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_usuario_permiso_auditoria" AFTER INSERT OR DELETE OR UPDATE ON "public"."usuario_permiso" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"();


--
-- Name: usuario_permiso trg_usuario_permiso_impedir_escalada_consultivo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_usuario_permiso_impedir_escalada_consultivo" BEFORE INSERT OR UPDATE ON "public"."usuario_permiso" FOR EACH ROW EXECUTE FUNCTION "public"."impedir_permiso_escritura_a_consultivo"();


--
-- Name: consultas trg_validar_jornada_en_curso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_validar_jornada_en_curso" BEFORE INSERT OR UPDATE ON "public"."consultas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_jornada_en_curso"();


--
-- Name: atenciones trg_validar_jornada_en_curso_atenciones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_validar_jornada_en_curso_atenciones" BEFORE INSERT OR UPDATE ON "public"."atenciones" FOR EACH ROW EXECUTE FUNCTION "public"."validar_jornada_en_curso_atenciones"();


--
-- Name: alerta_caducidad_detalle alerta_caducidad_detalle_alerta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alerta_caducidad_detalle"
    ADD CONSTRAINT "alerta_caducidad_detalle_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "public"."alertas_caducidad"("id") ON DELETE CASCADE;


--
-- Name: alerta_caducidad_detalle alerta_caducidad_detalle_bodega_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alerta_caducidad_detalle"
    ADD CONSTRAINT "alerta_caducidad_detalle_bodega_destino_id_fkey" FOREIGN KEY ("bodega_destino_id") REFERENCES "public"."bodegas"("id") ON DELETE RESTRICT;


--
-- Name: alertas_caducidad alertas_caducidad_atendida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alertas_caducidad"
    ADD CONSTRAINT "alertas_caducidad_atendida_por_fkey" FOREIGN KEY ("atendida_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: alertas_caducidad alertas_caducidad_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."alertas_caducidad"
    ADD CONSTRAINT "alertas_caducidad_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE;


--
-- Name: atenciones atenciones_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atenciones"
    ADD CONSTRAINT "atenciones_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE RESTRICT;


--
-- Name: atenciones atenciones_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atenciones"
    ADD CONSTRAINT "atenciones_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: avisos_caducidad avisos_caducidad_alerta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."avisos_caducidad"
    ADD CONSTRAINT "avisos_caducidad_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "public"."alertas_caducidad"("id") ON DELETE CASCADE;


--
-- Name: categorias_de_gasto categorias_de_gasto_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_de_gasto"
    ADD CONSTRAINT "categorias_de_gasto_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: citas citas_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas_atencion"("id") ON DELETE RESTRICT;


--
-- Name: citas citas_cancelada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_cancelada_por_fkey" FOREIGN KEY ("cancelada_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: citas citas_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "public"."clinicas"("id") ON DELETE RESTRICT;


--
-- Name: citas citas_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE RESTRICT;


--
-- Name: citas citas_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: citas citas_profesional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: citas citas_registrada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."citas"
    ADD CONSTRAINT "citas_registrada_por_fkey" FOREIGN KEY ("registrada_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: comunidades comunidades_municipio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."comunidades"
    ADD CONSTRAINT "comunidades_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE CASCADE;


--
-- Name: configuracion_alertas_caducidad configuracion_alertas_caducidad_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."configuracion_alertas_caducidad"
    ADD CONSTRAINT "configuracion_alertas_caducidad_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: consulta_diagnostico consulta_diagnostico_consulta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consulta_diagnostico"
    ADD CONSTRAINT "consulta_diagnostico_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE CASCADE;


--
-- Name: consulta_diagnostico consulta_diagnostico_diagnostico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consulta_diagnostico"
    ADD CONSTRAINT "consulta_diagnostico_diagnostico_id_fkey" FOREIGN KEY ("diagnostico_id") REFERENCES "public"."diagnosticos"("id") ON DELETE RESTRICT;


--
-- Name: consultas consultas_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas_atencion"("id") ON DELETE RESTRICT;


--
-- Name: consultas consultas_atencion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_atencion_id_fkey" FOREIGN KEY ("atencion_id") REFERENCES "public"."atenciones"("id") ON DELETE RESTRICT;


--
-- Name: consultas consultas_cita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "public"."citas"("id") ON DELETE RESTRICT;


--
-- Name: consultas consultas_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE CASCADE;


--
-- Name: consultas consultas_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE RESTRICT;


--
-- Name: consultas consultas_medico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."consultas"
    ADD CONSTRAINT "consultas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: donacion_detalle donacion_detalle_donacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donacion_detalle"
    ADD CONSTRAINT "donacion_detalle_donacion_id_fkey" FOREIGN KEY ("donacion_id") REFERENCES "public"."donaciones"("id") ON DELETE CASCADE;


--
-- Name: donacion_detalle donacion_detalle_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donacion_detalle"
    ADD CONSTRAINT "donacion_detalle_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE SET NULL;


--
-- Name: donacion_detalle donacion_detalle_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donacion_detalle"
    ADD CONSTRAINT "donacion_detalle_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE RESTRICT;


--
-- Name: donaciones donaciones_anulada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_anulada_por_fkey" FOREIGN KEY ("anulada_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: donaciones donaciones_donante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_donante_id_fkey" FOREIGN KEY ("donante_id") REFERENCES "public"."donantes"("id") ON DELETE RESTRICT;


--
-- Name: donaciones donaciones_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE SET NULL;


--
-- Name: donaciones donaciones_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE RESTRICT;


--
-- Name: donaciones donaciones_registrada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."donaciones"
    ADD CONSTRAINT "donaciones_registrada_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: existencias existencias_bodega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."existencias"
    ADD CONSTRAINT "existencias_bodega_id_fkey" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE RESTRICT;


--
-- Name: existencias existencias_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."existencias"
    ADD CONSTRAINT "existencias_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE;


--
-- Name: expedientes expedientes_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expedientes"
    ADD CONSTRAINT "expedientes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: municipios fk_departamentos; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."municipios"
    ADD CONSTRAINT "fk_departamentos" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;


--
-- Name: gastos fk_gastos_categoria; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "fk_gastos_categoria" FOREIGN KEY ("categoria") REFERENCES "public"."categorias_de_gasto"("nombre") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fuentes_de_presupuesto fuentes_de_presupuesto_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fuentes_de_presupuesto"
    ADD CONSTRAINT "fuentes_de_presupuesto_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: fusiones_pacientes fusiones_pacientes_paciente_absorbido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fusiones_pacientes"
    ADD CONSTRAINT "fusiones_pacientes_paciente_absorbido_id_fkey" FOREIGN KEY ("paciente_absorbido_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: fusiones_pacientes fusiones_pacientes_paciente_sobreviviente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fusiones_pacientes"
    ADD CONSTRAINT "fusiones_pacientes_paciente_sobreviviente_id_fkey" FOREIGN KEY ("paciente_sobreviviente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: fusiones_pacientes fusiones_pacientes_realizada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."fusiones_pacientes"
    ADD CONSTRAINT "fusiones_pacientes_realizada_por_fkey" FOREIGN KEY ("realizada_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: gastos gastos_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: gastos gastos_encargado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_encargado_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: gastos gastos_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE RESTRICT;


--
-- Name: gastos gastos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gastos"
    ADD CONSTRAINT "gastos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: jornada_estado_historial jornada_estado_historial_cambiado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_estado_historial"
    ADD CONSTRAINT "jornada_estado_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: jornada_estado_historial jornada_estado_historial_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_estado_historial"
    ADD CONSTRAINT "jornada_estado_historial_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE CASCADE;


--
-- Name: jornada_insumos jornada_insumos_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_insumos"
    ADD CONSTRAINT "jornada_insumos_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE CASCADE;


--
-- Name: jornada_insumos jornada_insumos_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_insumos"
    ADD CONSTRAINT "jornada_insumos_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE RESTRICT;


--
-- Name: jornada_personal jornada_personal_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_personal"
    ADD CONSTRAINT "jornada_personal_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE CASCADE;


--
-- Name: jornada_personal jornada_personal_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_personal"
    ADD CONSTRAINT "jornada_personal_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_donacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_donacion_id_fkey" FOREIGN KEY ("donacion_id") REFERENCES "public"."donaciones"("id") ON DELETE RESTRICT;


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_fuente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "public"."fuentes_de_presupuesto"("id") ON DELETE RESTRICT;


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE CASCADE;


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: jornada_presupuesto_origen jornada_presupuesto_origen_traspasado_desde_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornada_presupuesto_origen"
    ADD CONSTRAINT "jornada_presupuesto_origen_traspasado_desde_fkey" FOREIGN KEY ("traspasado_desde") REFERENCES "public"."jornada_presupuesto_origen"("id") ON DELETE RESTRICT;


--
-- Name: jornadas jornadas_botiquin_bodega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_botiquin_bodega_id_fkey" FOREIGN KEY ("botiquin_bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE RESTRICT;


--
-- Name: jornadas jornadas_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_comunidad_id_fkey" FOREIGN KEY ("comunidad_id") REFERENCES "public"."comunidades"("id") ON DELETE RESTRICT;


--
-- Name: jornadas jornadas_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE RESTRICT;


--
-- Name: jornadas jornadas_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."jornadas"
    ADD CONSTRAINT "jornadas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: lotes lotes_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE CASCADE;


--
-- Name: lotes lotes_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE RESTRICT;


--
-- Name: lotes lotes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id");


--
-- Name: medicamento_principio medicamento_principio_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."medicamento_principio"
    ADD CONSTRAINT "medicamento_principio_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE CASCADE;


--
-- Name: medicamento_principio medicamento_principio_principio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."medicamento_principio"
    ADD CONSTRAINT "medicamento_principio_principio_id_fkey" FOREIGN KEY ("principio_id") REFERENCES "public"."principios_activos"("id") ON DELETE RESTRICT;


--
-- Name: medicamentos medicamentos_presentacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."medicamentos"
    ADD CONSTRAINT "medicamentos_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "public"."presentaciones"("id") ON DELETE RESTRICT;


--
-- Name: movimientos_de_caja movimientos_de_caja_aporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_de_caja"
    ADD CONSTRAINT "movimientos_de_caja_aporte_id_fkey" FOREIGN KEY ("aporte_id") REFERENCES "public"."jornada_presupuesto_origen"("id") ON DELETE CASCADE;


--
-- Name: movimientos_de_caja movimientos_de_caja_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_de_caja"
    ADD CONSTRAINT "movimientos_de_caja_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE CASCADE;


--
-- Name: movimientos_de_caja movimientos_de_caja_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_de_caja"
    ADD CONSTRAINT "movimientos_de_caja_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: movimientos_inventario movimientos_inventario_bodega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_bodega_id_fkey" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE RESTRICT;


--
-- Name: movimientos_inventario movimientos_inventario_jornada_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE RESTRICT;


--
-- Name: movimientos_inventario movimientos_inventario_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE RESTRICT;


--
-- Name: movimientos_inventario movimientos_inventario_receta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: notificaciones notificaciones_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;


--
-- Name: paciente_area paciente_area_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."paciente_area"
    ADD CONSTRAINT "paciente_area_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas_atencion"("id") ON DELETE RESTRICT;


--
-- Name: paciente_area paciente_area_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."paciente_area"
    ADD CONSTRAINT "paciente_area_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: pacientes pacientes_comunidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_comunidad_id_fkey" FOREIGN KEY ("comunidad_id") REFERENCES "public"."comunidades"("id") ON DELETE RESTRICT;


--
-- Name: pacientes pacientes_idioma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_idioma_fkey" FOREIGN KEY ("idioma") REFERENCES "public"."idiomas"("codigo") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pacientes pacientes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: padecimientos_cronicos padecimientos_cronicos_condicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."padecimientos_cronicos"
    ADD CONSTRAINT "padecimientos_cronicos_condicion_id_fkey" FOREIGN KEY ("condicion_id") REFERENCES "public"."condiciones_cronicas"("id") ON DELETE RESTRICT;


--
-- Name: padecimientos_cronicos padecimientos_cronicos_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."padecimientos_cronicos"
    ADD CONSTRAINT "padecimientos_cronicos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT;


--
-- Name: perfil_especialidad perfil_especialidad_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfil_especialidad"
    ADD CONSTRAINT "perfil_especialidad_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: proveedores proveedores_donante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_donante_id_fkey" FOREIGN KEY ("donante_id") REFERENCES "public"."donantes"("id") ON DELETE RESTRICT;


--
-- Name: proyecto_estado_historial proyecto_estado_historial_cambiado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_estado_historial"
    ADD CONSTRAINT "proyecto_estado_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: proyecto_estado_historial proyecto_estado_historial_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_estado_historial"
    ADD CONSTRAINT "proyecto_estado_historial_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE CASCADE;


--
-- Name: proyecto_hitos proyecto_hitos_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_hitos"
    ADD CONSTRAINT "proyecto_hitos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE CASCADE;


--
-- Name: proyecto_hitos proyecto_hitos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_hitos"
    ADD CONSTRAINT "proyecto_hitos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: proyecto_insumos proyecto_insumos_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_insumos"
    ADD CONSTRAINT "proyecto_insumos_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE RESTRICT;


--
-- Name: proyecto_insumos proyecto_insumos_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_insumos"
    ADD CONSTRAINT "proyecto_insumos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE CASCADE;


--
-- Name: proyecto_personal proyecto_personal_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_personal"
    ADD CONSTRAINT "proyecto_personal_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;


--
-- Name: proyecto_personal proyecto_personal_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_personal"
    ADD CONSTRAINT "proyecto_personal_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE CASCADE;


--
-- Name: proyecto_seguimiento proyecto_seguimiento_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_seguimiento"
    ADD CONSTRAINT "proyecto_seguimiento_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE CASCADE;


--
-- Name: proyecto_seguimiento proyecto_seguimiento_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyecto_seguimiento"
    ADD CONSTRAINT "proyecto_seguimiento_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: proyectos proyectos_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."proyectos"
    ADD CONSTRAINT "proyectos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: receta_detalle receta_detalle_ajustada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_ajustada_por_fkey" FOREIGN KEY ("ajustada_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: receta_detalle receta_detalle_bodega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_bodega_id_fkey" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE SET NULL;


--
-- Name: receta_detalle receta_detalle_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE SET NULL;


--
-- Name: receta_detalle receta_detalle_medicamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "public"."medicamentos"("id") ON DELETE RESTRICT;


--
-- Name: receta_detalle receta_detalle_receta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."receta_detalle"
    ADD CONSTRAINT "receta_detalle_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE CASCADE;


--
-- Name: recetas recetas_anulada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recetas"
    ADD CONSTRAINT "recetas_anulada_por_fkey" FOREIGN KEY ("anulada_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: recetas recetas_consulta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recetas"
    ADD CONSTRAINT "recetas_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE CASCADE;


--
-- Name: recetas recetas_medico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recetas"
    ADD CONSTRAINT "recetas_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: rol_modulo rol_modulo_otorgado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rol_modulo"
    ADD CONSTRAINT "rol_modulo_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "public"."perfiles"("id") ON DELETE SET NULL;


--
-- Name: rol_permiso rol_permiso_permiso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rol_permiso"
    ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE CASCADE;


--
-- Name: triajes triajes_atencion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."triajes"
    ADD CONSTRAINT "triajes_atencion_id_fkey" FOREIGN KEY ("atencion_id") REFERENCES "public"."atenciones"("id") ON DELETE CASCADE;


--
-- Name: triajes triajes_tomado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."triajes"
    ADD CONSTRAINT "triajes_tomado_por_fkey" FOREIGN KEY ("tomado_por") REFERENCES "public"."perfiles"("id") ON DELETE RESTRICT;


--
-- Name: usuario_permiso usuario_permiso_otorgado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usuario_permiso"
    ADD CONSTRAINT "usuario_permiso_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "public"."perfiles"("id");


--
-- Name: usuario_permiso usuario_permiso_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usuario_permiso"
    ADD CONSTRAINT "usuario_permiso_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;


--
-- Name: usuario_permiso usuario_permiso_permiso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usuario_permiso"
    ADD CONSTRAINT "usuario_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE CASCADE;


--
-- Name: clinicas Administracion borra clinicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion borra clinicas" ON "public"."clinicas" FOR DELETE USING ("public"."es_administrador"());


--
-- Name: areas_atencion Administracion crea areas_atencion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion crea areas_atencion" ON "public"."areas_atencion" FOR INSERT WITH CHECK ("public"."es_administrador"());


--
-- Name: areas_atencion Administracion edita areas_atencion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion edita areas_atencion" ON "public"."areas_atencion" FOR UPDATE USING ("public"."es_administrador"()) WITH CHECK ("public"."es_administrador"());


--
-- Name: clinicas Administracion o jornadas.gestionar crea clinicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion o jornadas.gestionar crea clinicas" ON "public"."clinicas" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: clinicas Administracion o jornadas.gestionar edita clinicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion o jornadas.gestionar edita clinicas" ON "public"."clinicas" FOR UPDATE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: configuracion_alertas_caducidad Administracion o permiso configura alertas de caducidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion o permiso configura alertas de caducidad" ON "public"."configuracion_alertas_caducidad" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('inventario.configurar_alertas'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('inventario.configurar_alertas'::"text")));


--
-- Name: citas Administracion, gestion de jornadas o permiso de agenda en su j; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion, gestion de jornadas o permiso de agenda en su j" ON "public"."citas" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR ("public"."tiene_permiso"('citas.agendar'::"text") AND "public"."pertenece_a_jornada"("jornada_id"))));


--
-- Name: citas Administracion, gestion de jornadas y su personal de campo edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion, gestion de jornadas y su personal de campo edit" ON "public"."citas" FOR UPDATE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR ("public"."es_personal_de_campo"() AND "public"."pertenece_a_jornada"("jornada_id")))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR ("public"."es_personal_de_campo"() AND "public"."pertenece_a_jornada"("jornada_id"))));


--
-- Name: citas Administracion, gestion de jornadas y su personal leen citas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administracion, gestion de jornadas y su personal leen citas" ON "public"."citas" FOR SELECT USING (((NOT "public"."es_consultivo"()) AND ("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."pertenece_a_jornada"("jornada_id"))));


--
-- Name: movimientos_inventario Administrador aprueba o rechaza; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador aprueba o rechaza" ON "public"."movimientos_inventario" FOR UPDATE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('inventario.aprobar'::"text") OR (("registrado_por" = "auth"."uid"()) AND ("estado" = 'pendiente'::"public"."estado_movimiento")))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('inventario.aprobar'::"text") OR (("registrado_por" = "auth"."uid"()) AND ("estado" = 'pendiente'::"public"."estado_movimiento"))));


--
-- Name: POLICY "Administrador aprueba o rechaza" ON "movimientos_inventario"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Administrador aprueba o rechaza" ON "public"."movimientos_inventario" IS 'Quien registro un movimiento lo corrige mientras siga pendiente; la administradora (o quien tenga inventario.aprobar) puede siempre. El nombre de la politica es el de la 00048 y se conserva para no romper los ALTER POLICY de migraciones futuras, pero desde la 00105/00106 gobierna tambien la edicion, no solo la aprobacion.';


--
-- Name: lotes Administrador crea lotes; medico y voluntario los proponen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador crea lotes; medico y voluntario los proponen" ON "public"."lotes" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR (("public"."rol_actual"() = ANY (ARRAY['medico'::"public"."rol_usuario", 'voluntario general'::"public"."rol_usuario"])) AND ("confirmado" = false) AND ("registrado_por" = "auth"."uid"()))));


--
-- Name: lotes Administrador edita lotes; su autor mientras sean provisionales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador edita lotes; su autor mientras sean provisionales" ON "public"."lotes" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR (("registrado_por" = "auth"."uid"()) AND ("confirmado" = false)))) WITH CHECK (("public"."es_administrador"() OR (("registrado_por" = "auth"."uid"()) AND ("confirmado" = false))));


--
-- Name: perfil_especialidad Administrador o el propio perfil borran sus especialidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o el propio perfil borran sus especialidades" ON "public"."perfil_especialidad" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR ("perfil_id" = "auth"."uid"())));


--
-- Name: perfiles Administrador o el propio perfil leen perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o el propio perfil leen perfiles" ON "public"."perfiles" FOR SELECT USING (("public"."es_administrador"() OR ("id" = "auth"."uid"())));


--
-- Name: perfil_especialidad Administrador o el propio perfil leen sus especialidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o el propio perfil leen sus especialidades" ON "public"."perfil_especialidad" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR ("perfil_id" = "auth"."uid"()) OR "public"."accede_a_modulo_por_matriz"('colaboradores'::"text")));


--
-- Name: usuario_permiso Administrador o el propio perfil leen usuario_permiso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o el propio perfil leen usuario_permiso" ON "public"."usuario_permiso" FOR SELECT USING (("public"."es_administrador"() OR ("perfil_id" = "auth"."uid"()) OR "public"."tiene_permiso"('usuarios.gestionar_permisos'::"text")));


--
-- Name: perfil_especialidad Administrador o el propio perfil registran sus especialidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o el propio perfil registran sus especialidades" ON "public"."perfil_especialidad" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR ("perfil_id" = "auth"."uid"())));


--
-- Name: jornada_personal Administrador o jornadas.gestionar actualiza asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar actualiza asignaciones" ON "public"."jornada_personal" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_insumos Administrador o jornadas.gestionar actualizan insumos de jornad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar actualizan insumos de jornad" ON "public"."jornada_insumos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_insumos Administrador o jornadas.gestionar agregan insumos a jornadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar agregan insumos a jornadas" ON "public"."jornada_insumos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_personal Administrador o jornadas.gestionar asigna personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar asigna personal" ON "public"."jornada_personal" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_personal Administrador o jornadas.gestionar desasigna personal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar desasigna personal" ON "public"."jornada_personal" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_insumos Administrador o jornadas.gestionar quitan insumos de jornadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o jornadas.gestionar quitan insumos de jornadas" ON "public"."jornada_insumos" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: proyecto_personal Administrador o proyectos.gestionar actualiza equipo de proyect; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar actualiza equipo de proyect" ON "public"."proyecto_personal" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_hitos Administrador o proyectos.gestionar actualiza hitos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar actualiza hitos" ON "public"."proyecto_hitos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_insumos Administrador o proyectos.gestionar actualizan insumos de proye; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar actualizan insumos de proye" ON "public"."proyecto_insumos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_insumos Administrador o proyectos.gestionar agregan insumos a proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar agregan insumos a proyectos" ON "public"."proyecto_insumos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_seguimiento Administrador o proyectos.gestionar anota en la bitacora; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar anota en la bitacora" ON "public"."proyecto_seguimiento" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_personal Administrador o proyectos.gestionar asigna equipo de proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar asigna equipo de proyectos" ON "public"."proyecto_personal" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_hitos Administrador o proyectos.gestionar borra hitos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar borra hitos" ON "public"."proyecto_hitos" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_hitos Administrador o proyectos.gestionar crea hitos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar crea hitos" ON "public"."proyecto_hitos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_personal Administrador o proyectos.gestionar desasigna equipo de proyect; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar desasigna equipo de proyect" ON "public"."proyecto_personal" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: proyecto_insumos Administrador o proyectos.gestionar leen insumos de proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar leen insumos de proyectos" ON "public"."proyecto_insumos" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text")));


--
-- Name: proyecto_insumos Administrador o proyectos.gestionar quitan insumos de proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o proyectos.gestionar quitan insumos de proyectos" ON "public"."proyecto_insumos" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: jornada_presupuesto_origen Administrador o quien gestiona jornadas corrige origenes de pre; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona jornadas corrige origenes de pre" ON "public"."jornada_presupuesto_origen" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_estado_historial Administrador o quien gestiona jornadas lee su historial; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona jornadas lee su historial" ON "public"."jornada_estado_historial" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text")));


--
-- Name: jornada_presupuesto_origen Administrador o quien gestiona jornadas quita origenes de presu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona jornadas quita origenes de presu" ON "public"."jornada_presupuesto_origen" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornada_presupuesto_origen Administrador o quien gestiona jornadas registra origenes de pr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona jornadas registra origenes de pr" ON "public"."jornada_presupuesto_origen" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: proyecto_seguimiento Administrador o quien gestiona proyectos lee la bitacora; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona proyectos lee la bitacora" ON "public"."proyecto_seguimiento" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text")));


--
-- Name: proyecto_hitos Administrador o quien gestiona proyectos lee los hitos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona proyectos lee los hitos" ON "public"."proyecto_hitos" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text")));


--
-- Name: proyecto_estado_historial Administrador o quien gestiona proyectos lee su historial; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien gestiona proyectos lee su historial" ON "public"."proyecto_estado_historial" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text")));


--
-- Name: gastos Administrador o quien tiene presupuestos.aprobar aprueba o rech; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador o quien tiene presupuestos.aprobar aprueba o rech" ON "public"."gastos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('presupuestos.aprobar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('presupuestos.aprobar'::"text")));


--
-- Name: consulta_diagnostico Administrador quita cualquier diagnostico; medico solo el de su; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador quita cualquier diagnostico; medico solo el de su" ON "public"."consulta_diagnostico" FOR DELETE USING (("public"."es_administrador"() OR (("public"."rol_actual"() = 'medico'::"public"."rol_usuario") AND (EXISTS ( SELECT 1
   FROM "public"."consultas" "c"
  WHERE (("c"."id" = "consulta_diagnostico"."consulta_id") AND ("c"."medico_id" = "auth"."uid"())))))));


--
-- Name: gastos Administrador registra cualquier gasto; el personal asignado re; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador registra cualquier gasto; el personal asignado re" ON "public"."gastos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('presupuestos.registrar'::"text") OR ("public"."participa_en_jornada"("jornada_id") AND ("estado" = 'pendiente'::"public"."estado_gasto") AND ("registrado_por" = "auth"."uid"()))));


--
-- Name: triajes Administrador registra cualquier triaje; medico y voluntario so; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador registra cualquier triaje; medico y voluntario so" ON "public"."triajes" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ((("public"."rol_actual"() = 'medico'::"public"."rol_usuario") OR ("public"."rol_actual"() = 'voluntario general'::"public"."rol_usuario")) AND ("tomado_por" = "auth"."uid"()))));


--
-- Name: consulta_diagnostico Administrador registra en cualquier consulta; medico solo en la; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador registra en cualquier consulta; medico solo en la" ON "public"."consulta_diagnostico" FOR INSERT WITH CHECK (("public"."es_administrador"() OR (("public"."rol_actual"() = 'medico'::"public"."rol_usuario") AND (EXISTS ( SELECT 1
   FROM "public"."consultas" "c"
  WHERE (("c"."id" = "consulta_diagnostico"."consulta_id") AND ("c"."medico_id" = "auth"."uid"())))))));


--
-- Name: receta_detalle Administrador registra en cualquier receta; medico solo en la s; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador registra en cualquier receta; medico solo en la s" ON "public"."receta_detalle" FOR INSERT WITH CHECK (("public"."es_administrador"() OR (("public"."rol_actual"() = 'medico'::"public"."rol_usuario") AND (EXISTS ( SELECT 1
   FROM "public"."recetas" "r"
  WHERE (("r"."id" = "receta_detalle"."receta_id") AND ("r"."medico_id" = "auth"."uid"()) AND ("r"."estado" = 'emitida'::"public"."estado_receta")))))));


--
-- Name: atenciones Administrador y medico editan atenciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y medico editan atenciones" ON "public"."atenciones" FOR UPDATE USING (("public"."es_administrador"() OR ("public"."rol_actual"() = 'medico'::"public"."rol_usuario"))) WITH CHECK (("public"."es_administrador"() OR ("public"."rol_actual"() = 'medico'::"public"."rol_usuario")));


--
-- Name: expedientes Administrador y medico editan expedientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y medico editan expedientes" ON "public"."expedientes" FOR UPDATE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text")));


--
-- Name: pacientes Administrador y medico editan pacientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y medico editan pacientes" ON "public"."pacientes" FOR UPDATE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text")));


--
-- Name: comunidades Administrador y personal de campo actualizan comunidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo actualizan comunidades" ON "public"."comunidades" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: padecimientos_cronicos Administrador y personal de campo actualizan padecimientos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo actualizan padecimientos" ON "public"."padecimientos_cronicos" FOR UPDATE USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: medicamento_principio Administrador y personal de campo asocian principios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo asocian principios" ON "public"."medicamento_principio" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: POLICY "Administrador y personal de campo asocian principios" ON "medicamento_principio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Administrador y personal de campo asocian principios" ON "public"."medicamento_principio" IS 'Acompania a la politica de INSERT de medicamentos: fn_registrar_medicamento (00050) escribe en las dos tablas en la misma transaccion, asi que abrir una sola dejaria el alta fallando igual.';


--
-- Name: bodegas Administrador y personal de campo crean bodegas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean bodegas" ON "public"."bodegas" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: comunidades Administrador y personal de campo crean comunidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean comunidades" ON "public"."comunidades" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: diagnosticos Administrador y personal de campo crean diagnosticos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean diagnosticos" ON "public"."diagnosticos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: medicamentos Administrador y personal de campo crean medicamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean medicamentos" ON "public"."medicamentos" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: POLICY "Administrador y personal de campo crean medicamentos" ON "medicamentos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Administrador y personal de campo crean medicamentos" ON "public"."medicamentos" IS 'El nombre es el de la 00034. Desde la 00141 (issue #864) tambien da de alta el medico: el alta en linea del formulario de ingreso (issue #851) le terminaba en 42501. El UPDATE sigue siendo solo de la administradora.';


--
-- Name: presentaciones Administrador y personal de campo crean presentaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean presentaciones" ON "public"."presentaciones" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: principios_activos Administrador y personal de campo crean principios_activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean principios_activos" ON "public"."principios_activos" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: proveedores Administrador y personal de campo crean proveedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo crean proveedores" ON "public"."proveedores" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: bodegas Administrador y personal de campo editan bodegas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan bodegas" ON "public"."bodegas" FOR UPDATE USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: diagnosticos Administrador y personal de campo editan diagnosticos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan diagnosticos" ON "public"."diagnosticos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: medicamentos Administrador y personal de campo editan medicamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan medicamentos" ON "public"."medicamentos" FOR UPDATE USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: presentaciones Administrador y personal de campo editan presentaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan presentaciones" ON "public"."presentaciones" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: principios_activos Administrador y personal de campo editan principios_activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan principios_activos" ON "public"."principios_activos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: proveedores Administrador y personal de campo editan proveedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan proveedores" ON "public"."proveedores" FOR UPDATE USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: triajes Administrador y personal de campo editan triajes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo editan triajes" ON "public"."triajes" FOR UPDATE USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: consulta_diagnostico Administrador y personal de campo leen consulta_diagnostico; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen consulta_diagnostico" ON "public"."consulta_diagnostico" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: consultas Administrador y personal de campo leen consultas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen consultas" ON "public"."consultas" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: diagnosticos Administrador y personal de campo leen diagnosticos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen diagnosticos" ON "public"."diagnosticos" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: padecimientos_cronicos Administrador y personal de campo leen padecimientos_cronicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen padecimientos_cronicos" ON "public"."padecimientos_cronicos" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: receta_detalle Administrador y personal de campo leen receta_detalle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen receta_detalle" ON "public"."receta_detalle" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: recetas Administrador y personal de campo leen recetas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo leen recetas" ON "public"."recetas" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: condiciones_cronicas Administrador y personal de campo mantienen condiciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo mantienen condiciones" ON "public"."condiciones_cronicas" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"())) WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: medicamento_principio Administrador y personal de campo quitan principios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo quitan principios" ON "public"."medicamento_principio" FOR DELETE TO "authenticated" USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: POLICY "Administrador y personal de campo quitan principios" ON "medicamento_principio"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Administrador y personal de campo quitan principios" ON "public"."medicamento_principio" IS 'Quitar un principio activo de un medicamento, para cambiarlo (00166). Misma condicion que el INSERT (00148).';


--
-- Name: padecimientos_cronicos Administrador y personal de campo registran padecimientos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador y personal de campo registran padecimientos" ON "public"."padecimientos_cronicos" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."es_personal_de_campo"()));


--
-- Name: expedientes Administrador, medico y voluntario crean expedientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario crean expedientes" ON "public"."expedientes" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ("public"."rol_actual"() = 'medico'::"public"."rol_usuario") OR ("public"."rol_actual"() = 'voluntario general'::"public"."rol_usuario")));


--
-- Name: atenciones Administrador, medico y voluntario leen atenciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario leen atenciones" ON "public"."atenciones" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: expedientes Administrador, medico y voluntario leen expedientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario leen expedientes" ON "public"."expedientes" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: pacientes Administrador, medico y voluntario leen pacientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario leen pacientes" ON "public"."pacientes" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: triajes Administrador, medico y voluntario leen triajes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario leen triajes" ON "public"."triajes" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: atenciones Administrador, medico y voluntario registran atenciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario registran atenciones" ON "public"."atenciones" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ("public"."rol_actual"() = 'medico'::"public"."rol_usuario") OR ("public"."rol_actual"() = 'voluntario general'::"public"."rol_usuario")));


--
-- Name: pacientes Administrador, medico y voluntario registran pacientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, medico y voluntario registran pacientes" ON "public"."pacientes" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ("public"."rol_actual"() = 'medico'::"public"."rol_usuario") OR ("public"."rol_actual"() = 'voluntario general'::"public"."rol_usuario")));


--
-- Name: perfiles Administrador, o el propio perfil si sigue activo, editan perfi; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Administrador, o el propio perfil si sigue activo, editan perfi" ON "public"."perfiles" FOR UPDATE USING (("public"."es_administrador"() OR (("id" = "auth"."uid"()) AND "activo"))) WITH CHECK (("public"."es_administrador"() OR (("id" = "auth"."uid"()) AND "activo")));


--
-- Name: alerta_caducidad_detalle Autenticados leen alerta_caducidad_detalle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leen alerta_caducidad_detalle" ON "public"."alerta_caducidad_detalle" FOR SELECT TO "authenticated" USING (true);


--
-- Name: presentaciones Autenticados leen presentaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leen presentaciones" ON "public"."presentaciones" FOR SELECT TO "authenticated" USING (true);


--
-- Name: notificaciones Cada perfil activo lee sus notificaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cada perfil activo lee sus notificaciones" ON "public"."notificaciones" FOR SELECT TO "authenticated" USING ((("perfil_id" = "auth"."uid"()) AND ("public"."rol_actual"() IS NOT NULL)));


--
-- Name: notificaciones Cada perfil activo marca sus notificaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cada perfil activo marca sus notificaciones" ON "public"."notificaciones" FOR UPDATE TO "authenticated" USING ((("perfil_id" = "auth"."uid"()) AND ("public"."rol_actual"() IS NOT NULL))) WITH CHECK ((("perfil_id" = "auth"."uid"()) AND ("public"."rol_actual"() IS NOT NULL)));


--
-- Name: categorias_de_gasto Crean categorias de gasto quien registra o aprueba gastos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crean categorias de gasto quien registra o aprueba gastos" ON "public"."categorias_de_gasto" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('presupuestos.registrar'::"text") OR "public"."tiene_permiso"('presupuestos.aprobar'::"text")));


--
-- Name: recetas El medico anula su receta emitida; administrador cualquiera; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "El medico anula su receta emitida; administrador cualquiera" ON "public"."recetas" FOR UPDATE USING (("public"."es_administrador"() OR (("medico_id" = "auth"."uid"()) AND ("estado" = 'emitida'::"public"."estado_receta")))) WITH CHECK (("public"."es_administrador"() OR (("medico_id" = "auth"."uid"()) AND ("anulada_por" = "auth"."uid"()))));


--
-- Name: consultas El medico que creo la consulta la edita; administrador cualquie; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "El medico que creo la consulta la edita; administrador cualquie" ON "public"."consultas" FOR UPDATE USING (("public"."es_administrador"() OR ("medico_id" = "auth"."uid"()))) WITH CHECK (("public"."es_administrador"() OR ("medico_id" = "auth"."uid"())));


--
-- Name: notificaciones La administracion lee el envio de todas las notificaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "La administracion lee el envio de todas las notificaciones" ON "public"."notificaciones" FOR SELECT USING ("public"."es_administrador"());


--
-- Name: jornada_personal Leen asignaciones quien administra, gestiona o participa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen asignaciones quien administra, gestiona o participa" ON "public"."jornada_personal" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."pertenece_a_jornada"("jornada_id") OR ("perfil_id" = "auth"."uid"()) OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text")));


--
-- Name: POLICY "Leen asignaciones quien administra, gestiona o participa" ON "jornada_personal"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Leen asignaciones quien administra, gestiona o participa" ON "public"."jornada_personal" IS 'El nombre es el de la 00039. Desde la 00141 (issue #864) no lee junta directiva y si lee el equipo completo de una jornada cualquiera que participe en ella, que es lo que necesita el detalle de la jornada para mostrar "el equipo". La escritura sigue siendo solo de la administradora (00039, 00044).';


--
-- Name: categorias_de_gasto Leen categorias de gasto las personas activas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen categorias de gasto las personas activas" ON "public"."categorias_de_gasto" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: donacion_detalle Leen donacion_detalle quien administra o registra donaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen donacion_detalle quien administra o registra donaciones" ON "public"."donacion_detalle" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text") OR "public"."accede_a_modulo_por_matriz"('donaciones'::"text")));


--
-- Name: donaciones Leen donaciones quien administra o registra donaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen donaciones quien administra o registra donaciones" ON "public"."donaciones" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text") OR "public"."accede_a_modulo_por_matriz"('donaciones'::"text")));


--
-- Name: donantes Leen donantes quien administra o registra donaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen donantes quien administra o registra donaciones" ON "public"."donantes" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text") OR "public"."accede_a_modulo_por_matriz"('donaciones'::"text")));


--
-- Name: fuentes_de_presupuesto Leen fuentes de presupuesto quien lee los aportes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen fuentes de presupuesto quien lee los aportes" ON "public"."fuentes_de_presupuesto" FOR SELECT USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: gastos Leen gastos quien administra, gestiona o participa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen gastos quien administra, gestiona o participa" ON "public"."gastos" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('presupuestos.aprobar'::"text") OR "public"."tiene_permiso"('presupuestos.registrar'::"text") OR "public"."participa_en_jornada"("jornada_id") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: jornada_insumos Leen insumos de jornada quien administra o gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen insumos de jornada quien administra o gestiona" ON "public"."jornada_insumos" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text")));


--
-- Name: jornadas Leen jornadas quien administra, gestiona o participa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen jornadas quien administra, gestiona o participa" ON "public"."jornadas" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."pertenece_a_jornada"("id") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: POLICY "Leen jornadas quien administra, gestiona o participa" ON "jornadas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Leen jornadas quien administra, gestiona o participa" ON "public"."jornadas" IS 'El nombre es el de la 00039 y ya no describe la politica: junta directiva salio en la 00141 (issue #864). Hoy leen la administradora, quien esta en el cuadro de turnos de la jornada y quien figura como su responsable_id. Esa ultima rama cierra el defecto que la #838 solo habia arreglado en el cliente: ser responsable de una jornada sin estar en su jornada_personal dejaba la jornada invisible para su propio responsable.';


--
-- Name: movimientos_de_caja Leen la caja quien ve los aportes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen la caja quien ve los aportes" ON "public"."movimientos_de_caja" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: jornada_presupuesto_origen Leen origenes de presupuesto quien administra o gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen origenes de presupuesto quien administra o gestiona" ON "public"."jornada_presupuesto_origen" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text") OR "public"."accede_a_modulo_por_matriz"('jornadas'::"text") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: proyectos Leen proyectos quien administra, gestiona o pertenece; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leen proyectos quien administra, gestiona o pertenece" ON "public"."proyectos" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text") OR "public"."pertenece_a_proyecto"("id") OR "public"."accede_a_modulo_por_matriz"('proyectos'::"text") OR "public"."accede_a_modulo_por_matriz"('presupuestos'::"text")));


--
-- Name: POLICY "Leen proyectos quien administra, gestiona o pertenece" ON "proyectos"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Leen proyectos quien administra, gestiona o pertenece" ON "public"."proyectos" IS 'El nombre es el de la 00039. Desde la 00141 (issue #864) no leen los roles consultivos, y si lee el personal de campo, pero SOLO los proyectos de las jornadas en las que participa. La escritura sigue siendo de la administradora o de quien tenga proyectos.gestionar (00039, 00086).';


--
-- Name: recetas Medico emite recetas como si mismo; administrador cualquiera; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medico emite recetas como si mismo; administrador cualquiera" ON "public"."recetas" FOR INSERT WITH CHECK (("public"."es_administrador"() OR (("public"."rol_actual"() = 'medico'::"public"."rol_usuario") AND ("medico_id" = "auth"."uid"()))));


--
-- Name: consultas Medico registra consultas en su jornada asignada; administrador; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medico registra consultas en su jornada asignada; administrador" ON "public"."consultas" FOR INSERT WITH CHECK (("public"."es_administrador"() OR (("public"."rol_actual"() = 'medico'::"public"."rol_usuario") AND ("medico_id" = "auth"."uid"()) AND "public"."participa_en_jornada"("jornada_id"))));


--
-- Name: movimientos_inventario Medico y voluntario registran movimientos propios pendientes; a; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medico y voluntario registran movimientos propios pendientes; a" ON "public"."movimientos_inventario" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ((("public"."rol_actual"() = 'medico'::"public"."rol_usuario") OR ("public"."rol_actual"() = 'voluntario general'::"public"."rol_usuario")) AND ("estado" = 'pendiente'::"public"."estado_movimiento") AND ("registrado_por" = "auth"."uid"()))));


--
-- Name: condiciones_cronicas Quien atiende crea condiciones cronicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien atiende crea condiciones cronicas" ON "public"."condiciones_cronicas" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR ("public"."rol_actual"() = ANY (ARRAY['medico'::"public"."rol_usuario", 'voluntario general'::"public"."rol_usuario"]))));


--
-- Name: paciente_area Quien edita o registro al paciente asigna areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien edita o registro al paciente asigna areas" ON "public"."paciente_area" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "paciente_area"."paciente_id") AND ("p"."registrado_por" = "auth"."uid"()))))));


--
-- Name: paciente_area Quien edita o registro al paciente quita areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien edita o registro al paciente quita areas" ON "public"."paciente_area" FOR DELETE USING (("public"."es_administrador"() OR "public"."tiene_permiso"('pacientes.editar'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "paciente_area"."paciente_id") AND ("p"."registrado_por" = "auth"."uid"()))))));


--
-- Name: paciente_area Quien lee pacientes lee paciente_area; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien lee pacientes lee paciente_area" ON "public"."paciente_area" FOR SELECT USING (("public"."es_administrador"() OR "public"."es_personal_de_campo"() OR "public"."accede_a_modulo_por_matriz"('pacientes'::"text")));


--
-- Name: donacion_detalle Quien registra donaciones enlaza el lote de un renglon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien registra donaciones enlaza el lote de un renglon" ON "public"."donacion_detalle" FOR UPDATE TO "authenticated" USING ((("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text")) AND ("lote_id" IS NULL))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text")));


--
-- Name: proyecto_personal Quien ve el proyecto ve su equipo; cada quien lee su asignacion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quien ve el proyecto ve su equipo; cada quien lee su asignacion" ON "public"."proyecto_personal" FOR SELECT TO "authenticated" USING (("public"."es_administrador"() OR ("perfil_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."proyectos" "p"
  WHERE ("p"."id" = "proyecto_personal"."proyecto_id")))));


--
-- Name: fuentes_de_presupuesto Registran fuentes de presupuesto quien registra aportes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Registran fuentes de presupuesto quien registra aportes" ON "public"."fuentes_de_presupuesto" FOR INSERT WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: alertas_caducidad Sesion activa lee alertas_caducidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee alertas_caducidad" ON "public"."alertas_caducidad" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: areas_atencion Sesion activa lee areas_atencion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee areas_atencion" ON "public"."areas_atencion" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: bodegas Sesion activa lee bodegas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee bodegas" ON "public"."bodegas" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: clinicas Sesion activa lee clinicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee clinicas" ON "public"."clinicas" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: comunidades Sesion activa lee comunidades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee comunidades" ON "public"."comunidades" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: condiciones_cronicas Sesion activa lee condiciones_cronicas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee condiciones_cronicas" ON "public"."condiciones_cronicas" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: configuracion_alertas_caducidad Sesion activa lee configuracion_alertas_caducidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee configuracion_alertas_caducidad" ON "public"."configuracion_alertas_caducidad" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: departamentos Sesion activa lee departamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee departamentos" ON "public"."departamentos" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: existencias Sesion activa lee existencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee existencias" ON "public"."existencias" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: idiomas Sesion activa lee idiomas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee idiomas" ON "public"."idiomas" FOR SELECT TO "authenticated" USING (true);


--
-- Name: lotes Sesion activa lee lotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee lotes" ON "public"."lotes" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: medicamento_principio Sesion activa lee medicamento_principio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee medicamento_principio" ON "public"."medicamento_principio" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: medicamentos Sesion activa lee medicamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee medicamentos" ON "public"."medicamentos" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: movimientos_inventario Sesion activa lee movimientos_inventario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee movimientos_inventario" ON "public"."movimientos_inventario" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: municipios Sesion activa lee municipios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee municipios" ON "public"."municipios" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: permisos Sesion activa lee permisos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee permisos" ON "public"."permisos" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: principios_activos Sesion activa lee principios_activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee principios_activos" ON "public"."principios_activos" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: proveedores Sesion activa lee proveedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee proveedores" ON "public"."proveedores" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: rol_modulo Sesion activa lee rol_modulo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee rol_modulo" ON "public"."rol_modulo" FOR SELECT USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: rol_permiso Sesion activa lee rol_permiso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sesion activa lee rol_permiso" ON "public"."rol_permiso" FOR SELECT TO "authenticated" USING (("public"."rol_actual"() IS NOT NULL));


--
-- Name: donantes Solo administrador actualiza donantes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador actualiza donantes" ON "public"."donantes" FOR UPDATE TO "authenticated" USING ("public"."es_administrador"()) WITH CHECK ("public"."es_administrador"());


--
-- Name: proyectos Solo administrador actualiza proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador actualiza proyectos" ON "public"."proyectos" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: usuario_permiso Solo administrador actualiza usuario_permiso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador actualiza usuario_permiso" ON "public"."usuario_permiso" FOR UPDATE USING (("public"."es_administrador"() OR ("public"."tiene_permiso"('usuarios.gestionar_permisos'::"text") AND ("perfil_id" <> "auth"."uid"())))) WITH CHECK (("public"."es_administrador"() OR ("public"."tiene_permiso"('usuarios.gestionar_permisos'::"text") AND ("perfil_id" <> "auth"."uid"()))));


--
-- Name: alertas_caducidad Solo administrador atiende alertas_caducidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador atiende alertas_caducidad" ON "public"."alertas_caducidad" FOR UPDATE USING ("public"."es_administrador"()) WITH CHECK ("public"."es_administrador"());


--
-- Name: padecimientos_cronicos Solo administrador borra padecimientos_cronicos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador borra padecimientos_cronicos" ON "public"."padecimientos_cronicos" FOR DELETE USING ("public"."es_administrador"());


--
-- Name: usuario_permiso Solo administrador borra usuario_permiso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador borra usuario_permiso" ON "public"."usuario_permiso" FOR DELETE USING (("public"."es_administrador"() OR ("public"."tiene_permiso"('usuarios.gestionar_permisos'::"text") AND ("perfil_id" <> "auth"."uid"()))));


--
-- Name: rol_modulo Solo administrador concede modulos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador concede modulos" ON "public"."rol_modulo" FOR INSERT WITH CHECK ("public"."es_administrador"());


--
-- Name: existencias Solo administrador crea existencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador crea existencias" ON "public"."existencias" FOR INSERT WITH CHECK ("public"."es_administrador"());


--
-- Name: perfiles Solo administrador crea perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador crea perfiles" ON "public"."perfiles" FOR INSERT WITH CHECK ("public"."es_administrador"());


--
-- Name: proyectos Solo administrador crea proyectos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador crea proyectos" ON "public"."proyectos" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('proyectos.gestionar'::"text")));


--
-- Name: existencias Solo administrador edita existencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador edita existencias" ON "public"."existencias" FOR UPDATE USING ("public"."es_administrador"()) WITH CHECK ("public"."es_administrador"());


--
-- Name: presentaciones Solo administrador elimina presentaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador elimina presentaciones" ON "public"."presentaciones" FOR DELETE TO "authenticated" USING ("public"."es_administrador"());


--
-- Name: principios_activos Solo administrador elimina principios_activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador elimina principios_activos" ON "public"."principios_activos" FOR DELETE TO "authenticated" USING ("public"."es_administrador"());


--
-- Name: usuario_permiso Solo administrador escribe usuario_permiso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador escribe usuario_permiso" ON "public"."usuario_permiso" FOR INSERT WITH CHECK (("public"."es_administrador"() OR ("public"."tiene_permiso"('usuarios.gestionar_permisos'::"text") AND ("perfil_id" <> "auth"."uid"()))));


--
-- Name: avisos_caducidad Solo administrador lee avisos_caducidad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador lee avisos_caducidad" ON "public"."avisos_caducidad" FOR SELECT TO "authenticated" USING ("public"."es_administrador"());


--
-- Name: eventos_auditoria Solo administrador lee eventos_auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador lee eventos_auditoria" ON "public"."eventos_auditoria" FOR SELECT USING ("public"."es_administrador"());


--
-- Name: fusiones_pacientes Solo administrador lee fusiones_pacientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador lee fusiones_pacientes" ON "public"."fusiones_pacientes" FOR SELECT TO "authenticated" USING ("public"."es_administrador"());


--
-- Name: jornadas Solo administrador o quien tiene jornadas.gestionar actualiza j; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador o quien tiene jornadas.gestionar actualiza j" ON "public"."jornadas" FOR UPDATE TO "authenticated" USING (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text"))) WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: jornadas Solo administrador o quien tiene jornadas.gestionar crea jornad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador o quien tiene jornadas.gestionar crea jornad" ON "public"."jornadas" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('jornadas.gestionar'::"text")));


--
-- Name: donacion_detalle Solo administrador registra donacion_detalle; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador registra donacion_detalle" ON "public"."donacion_detalle" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text")));


--
-- Name: donaciones Solo administrador registra donaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador registra donaciones" ON "public"."donaciones" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text")));


--
-- Name: donantes Solo administrador registra donantes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador registra donantes" ON "public"."donantes" FOR INSERT TO "authenticated" WITH CHECK (("public"."es_administrador"() OR "public"."tiene_permiso"('donaciones.registrar'::"text")));


--
-- Name: rol_modulo Solo administrador retira modulos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo administrador retira modulos" ON "public"."rol_modulo" FOR DELETE USING ("public"."es_administrador"());


--
-- Name: alerta_caducidad_detalle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."alerta_caducidad_detalle" ENABLE ROW LEVEL SECURITY;

--
-- Name: alertas_caducidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."alertas_caducidad" ENABLE ROW LEVEL SECURITY;

--
-- Name: areas_atencion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."areas_atencion" ENABLE ROW LEVEL SECURITY;

--
-- Name: atenciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."atenciones" ENABLE ROW LEVEL SECURITY;

--
-- Name: avisos_caducidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."avisos_caducidad" ENABLE ROW LEVEL SECURITY;

--
-- Name: bodegas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bodegas" ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_de_gasto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."categorias_de_gasto" ENABLE ROW LEVEL SECURITY;

--
-- Name: citas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."citas" ENABLE ROW LEVEL SECURITY;

--
-- Name: clinicas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."clinicas" ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."comunidades" ENABLE ROW LEVEL SECURITY;

--
-- Name: condiciones_cronicas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."condiciones_cronicas" ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_alertas_caducidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."configuracion_alertas_caducidad" ENABLE ROW LEVEL SECURITY;

--
-- Name: consulta_diagnostico; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."consulta_diagnostico" ENABLE ROW LEVEL SECURITY;

--
-- Name: consultas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."consultas" ENABLE ROW LEVEL SECURITY;

--
-- Name: departamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."departamentos" ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnosticos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."diagnosticos" ENABLE ROW LEVEL SECURITY;

--
-- Name: donacion_detalle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."donacion_detalle" ENABLE ROW LEVEL SECURITY;

--
-- Name: donaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."donaciones" ENABLE ROW LEVEL SECURITY;

--
-- Name: donantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."donantes" ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."eventos_auditoria" ENABLE ROW LEVEL SECURITY;

--
-- Name: existencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."existencias" ENABLE ROW LEVEL SECURITY;

--
-- Name: expedientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."expedientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: fuentes_de_presupuesto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."fuentes_de_presupuesto" ENABLE ROW LEVEL SECURITY;

--
-- Name: fusiones_pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."fusiones_pacientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: gastos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."gastos" ENABLE ROW LEVEL SECURITY;

--
-- Name: idiomas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."idiomas" ENABLE ROW LEVEL SECURITY;

--
-- Name: jornada_estado_historial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."jornada_estado_historial" ENABLE ROW LEVEL SECURITY;

--
-- Name: jornada_insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."jornada_insumos" ENABLE ROW LEVEL SECURITY;

--
-- Name: jornada_personal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."jornada_personal" ENABLE ROW LEVEL SECURITY;

--
-- Name: jornada_presupuesto_origen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."jornada_presupuesto_origen" ENABLE ROW LEVEL SECURITY;

--
-- Name: jornadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."jornadas" ENABLE ROW LEVEL SECURITY;

--
-- Name: limites_de_uso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."limites_de_uso" ENABLE ROW LEVEL SECURITY;

--
-- Name: lotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lotes" ENABLE ROW LEVEL SECURITY;

--
-- Name: medicamento_principio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."medicamento_principio" ENABLE ROW LEVEL SECURITY;

--
-- Name: medicamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."medicamentos" ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos_de_caja; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."movimientos_de_caja" ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos_inventario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."movimientos_inventario" ENABLE ROW LEVEL SECURITY;

--
-- Name: municipios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."municipios" ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;

--
-- Name: paciente_area; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."paciente_area" ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pacientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: padecimientos_cronicos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."padecimientos_cronicos" ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_especialidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."perfil_especialidad" ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: permisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."permisos" ENABLE ROW LEVEL SECURITY;

--
-- Name: presentaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."presentaciones" ENABLE ROW LEVEL SECURITY;

--
-- Name: principios_activos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."principios_activos" ENABLE ROW LEVEL SECURITY;

--
-- Name: proveedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proveedores" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyecto_estado_historial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyecto_estado_historial" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyecto_hitos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyecto_hitos" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyecto_insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyecto_insumos" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyecto_personal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyecto_personal" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyecto_seguimiento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyecto_seguimiento" ENABLE ROW LEVEL SECURITY;

--
-- Name: proyectos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."proyectos" ENABLE ROW LEVEL SECURITY;

--
-- Name: receta_detalle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."receta_detalle" ENABLE ROW LEVEL SECURITY;

--
-- Name: recetas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."recetas" ENABLE ROW LEVEL SECURITY;

--
-- Name: rol_modulo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rol_modulo" ENABLE ROW LEVEL SECURITY;

--
-- Name: rol_permiso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rol_permiso" ENABLE ROW LEVEL SECURITY;

--
-- Name: triajes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."triajes" ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_permiso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."usuario_permiso" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "accede_a_modulo_por_matriz"("p_modulo" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."accede_a_modulo_por_matriz"("p_modulo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accede_a_modulo_por_matriz"("p_modulo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accede_a_modulo_por_matriz"("p_modulo" "text") TO "service_role";


--
-- Name: FUNCTION "actualizar_timestamp_updated_at"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_timestamp_updated_at"() TO "service_role";


--
-- Name: FUNCTION "alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."alta_de_cuenta_permitida"("p_usuario_de_sesion" "text", "p_app_meta" "jsonb") TO "service_role";


--
-- Name: FUNCTION "comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comprometido_de_jornada"("p_jornada_id" "uuid", "p_sin_gasto" "uuid") TO "service_role";


--
-- Name: FUNCTION "crear_perfil_nuevo_usuario"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."crear_perfil_nuevo_usuario"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_perfil_nuevo_usuario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_perfil_nuevo_usuario"() TO "service_role";


--
-- Name: FUNCTION "equipo_de_proyecto"("p_proyecto_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."equipo_de_proyecto"("p_proyecto_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."equipo_de_proyecto"("p_proyecto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equipo_de_proyecto"("p_proyecto_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "es_administrador"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."es_administrador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_administrador"() TO "service_role";


--
-- Name: FUNCTION "es_consultivo"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."es_consultivo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_consultivo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_consultivo"() TO "service_role";


--
-- Name: FUNCTION "es_personal_de_campo"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."es_personal_de_campo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."es_personal_de_campo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_personal_de_campo"() TO "service_role";


--
-- Name: FUNCTION "existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."existencias_totales_por_bodega"("p_bodega_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "f_unaccent"("texto" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."f_unaccent"("texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."f_unaccent"("texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."f_unaccent"("texto" "text") TO "service_role";


--
-- Name: FUNCTION "fn_actualizar_existencias"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_actualizar_existencias"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_actualizar_existencias"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_actualizar_existencias"() TO "service_role";


--
-- Name: FUNCTION "fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ajustar_entrega_receta"("p_receta_detalle_id" "uuid", "p_cantidad_real" integer) TO "service_role";


--
-- Name: FUNCTION "fn_anular_receta_al_rechazar_su_entrega"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_anular_receta_al_rechazar_su_entrega"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_anular_receta_al_rechazar_su_entrega"() TO "service_role";


--
-- Name: FUNCTION "fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_aplicar_ajuste_existencias"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_tipo" "public"."tipo_movimiento", "p_cantidad" integer) TO "service_role";


--
-- Name: FUNCTION "fn_aportar_donacion_a_su_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_aportar_donacion_a_su_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aportar_donacion_a_su_jornada"() TO "service_role";


--
-- Name: FUNCTION "fn_aprobar_entrega_completa_de_receta"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_aprobar_entrega_completa_de_receta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_aprobar_entrega_completa_de_receta"() TO "service_role";


--
-- Name: FUNCTION "fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_atenciones_de_persona_por_jornada"("p_perfil_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_atender_alerta_caducidad"("p_alerta_id" "uuid", "p_acciones" "jsonb") TO "service_role";


--
-- Name: FUNCTION "fn_autoaprobar_gasto_administrador"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_autoaprobar_gasto_administrador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_autoaprobar_gasto_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_autoaprobar_gasto_administrador"() TO "service_role";


--
-- Name: FUNCTION "fn_autoaprobar_movimiento_inventario"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_autoaprobar_movimiento_inventario"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_autoaprobar_movimiento_inventario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_autoaprobar_movimiento_inventario"() TO "service_role";


--
-- Name: FUNCTION "fn_bloquear_gasto_finalizado"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_bloquear_gasto_finalizado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_bloquear_gasto_finalizado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_bloquear_gasto_finalizado"() TO "service_role";


--
-- Name: FUNCTION "fn_bloquear_movimiento_finalizado"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_bloquear_movimiento_finalizado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_bloquear_movimiento_finalizado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_bloquear_movimiento_finalizado"() TO "service_role";


--
-- Name: FUNCTION "fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_bodega_de_entrega_de_consulta"("p_consulta_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_buscar_pacientes"("p_termino" "text", "p_comunidad_id" "uuid", "p_pagina" integer, "p_por_pagina" integer, "p_condicion_cronica_id" "uuid", "p_sexo" "text", "p_edad_min" integer, "p_edad_max" integer, "p_area_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cambiar_principio_de_medicamento"("p_medicamento_id" "uuid", "p_principio_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cantidad_comprometida"("p_lote_id" "uuid", "p_bodega_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cargar_insumo_a_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_cantidad" integer) TO "service_role";


--
-- Name: FUNCTION "fn_cita_exige_permiso_de_agenda"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_cita_exige_permiso_de_agenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_cita_exige_permiso_de_agenda"() TO "service_role";


--
-- Name: FUNCTION "fn_clinica_salas_cubren_lo_agendado"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_clinica_salas_cubren_lo_agendado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_clinica_salas_cubren_lo_agendado"() TO "service_role";


--
-- Name: FUNCTION "fn_consulta_de_cita_antes"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_consulta_de_cita_antes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_consulta_de_cita_antes"() TO "service_role";


--
-- Name: FUNCTION "fn_consulta_de_cita_despues"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_consulta_de_cita_despues"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_consulta_de_cita_despues"() TO "service_role";


--
-- Name: FUNCTION "fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_consumo_de_insumos_de_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_contar_atenciones_incompletas"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_contar_atenciones_incompletas"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_contar_atenciones_incompletas"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_contar_atenciones_incompletas"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_usuario_administrativo"("p_correo" "text", "p_nombres" "text", "p_apellidos" "text", "p_rol" "public"."rol_usuario") TO "service_role";


--
-- Name: FUNCTION "fn_detectar_pacientes_duplicados"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_detectar_pacientes_duplicados"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_detectar_pacientes_duplicados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_detectar_pacientes_duplicados"() TO "service_role";


--
-- Name: FUNCTION "fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_devolver_de_bodega_de_jornada"("p_jornada_id" "uuid", "p_lote_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer) TO "service_role";


--
-- Name: FUNCTION "fn_devolver_inventario_de_receta_anulada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_devolver_inventario_de_receta_anulada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_devolver_inventario_de_receta_anulada"() TO "service_role";


--
-- Name: FUNCTION "fn_disparar_correo_de_notificaciones"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_disparar_correo_de_notificaciones"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_disparar_correo_de_notificaciones"() TO "service_role";


--
-- Name: FUNCTION "fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_disponible_neto"("p_lote_id" "uuid", "p_bodega_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_eliminar_clinica"("p_clinica_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_eliminar_clinica"("p_clinica_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_eliminar_clinica"("p_clinica_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_eliminar_clinica"("p_clinica_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_es_aprobacion_de_sistema"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_es_aprobacion_de_sistema"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_es_aprobacion_de_sistema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_es_aprobacion_de_sistema"() TO "service_role";


--
-- Name: FUNCTION "fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_etapa_caducidad"("p_dias" integer, "p_umbrales" integer[]) TO "service_role";


--
-- Name: FUNCTION "fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_existencias_disponibles"("p_bodega_id" "uuid", "p_busqueda" "text", "p_limite" integer, "p_desplazamiento" integer) TO "service_role";


--
-- Name: FUNCTION "fn_fechas_reales_de_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_fechas_reales_de_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fechas_reales_de_jornada"() TO "service_role";


--
-- Name: FUNCTION "fn_fijar_registrado_por_origen_de_presupuesto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fijar_registrado_por_origen_de_presupuesto"() TO "service_role";


--
-- Name: TABLE "fusiones_pacientes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."fusiones_pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."fusiones_pacientes" TO "service_role";


--
-- Name: FUNCTION "fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fusionar_pacientes"("p_sobreviviente_id" "uuid", "p_absorbido_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_generar_alertas_caducidad"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_generar_alertas_caducidad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_generar_alertas_caducidad"() TO "service_role";


--
-- Name: FUNCTION "fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generar_receta"("p_consulta_id" "uuid", "p_medico_id" "uuid", "p_indicaciones_generales" "text", "p_detalle" "jsonb") TO "service_role";


--
-- Name: FUNCTION "fn_hoy_guatemala"("p_instante" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_hoy_guatemala"("p_instante" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_hoy_guatemala"("p_instante" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_hoy_guatemala"("p_instante" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "fn_impedir_devuelto_a_mano"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."fn_impedir_devuelto_a_mano"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_impedir_devuelto_a_mano"() TO "service_role";


--
-- Name: FUNCTION "fn_impedir_presupuesto_a_mano"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_impedir_presupuesto_a_mano"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_impedir_presupuesto_a_mano"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_impedir_presupuesto_a_mano"() TO "service_role";


--
-- Name: FUNCTION "fn_impedir_quitar_aporte_liquidado"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."fn_impedir_quitar_aporte_liquidado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_impedir_quitar_aporte_liquidado"() TO "service_role";


--
-- Name: FUNCTION "fn_insumos_de_proyecto"("p_proyecto_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_insumos_de_proyecto"("p_proyecto_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_insumos_de_proyecto"("p_proyecto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_insumos_de_proyecto"("p_proyecto_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_jornada_bodega_movil_libre"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_bodega_movil_libre"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_bodega_movil_libre"() TO "service_role";


--
-- Name: FUNCTION "fn_jornada_cancela_citas_pendientes"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_cancela_citas_pendientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_cancela_citas_pendientes"() TO "service_role";


--
-- Name: FUNCTION "fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_jornada_duena_de_bodega"("p_bodega_id" "uuid", "p_excluir" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_jornada_en_curso_de_bodega"("p_bodega_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_jornada_exige_bodega_movil"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_exige_bodega_movil"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_exige_bodega_movil"() TO "service_role";


--
-- Name: FUNCTION "fn_jornada_exige_proyecto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_exige_proyecto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_exige_proyecto"() TO "service_role";


--
-- Name: FUNCTION "fn_jornada_sin_inventario_cargado_al_cambiar_bodega"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_jornada_sin_inventario_cargado_al_cambiar_bodega"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_jornada_sin_inventario_cargado_al_cambiar_bodega"() TO "service_role";


--
-- Name: FUNCTION "fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_liquidar_sobrante_de_jornada"("p_jornada_id" "uuid", "p_decisiones" "jsonb") TO "service_role";


--
-- Name: FUNCTION "fn_lote_de_medicamento_tiene_vencimiento"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_lote_de_medicamento_tiene_vencimiento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_lote_de_medicamento_tiene_vencimiento"() TO "service_role";


--
-- Name: FUNCTION "fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_lotes_en_ventana_de_caducidad"("p_hoy" "date", "p_umbrales" integer[]) TO "service_role";


--
-- Name: FUNCTION "fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_maximo_de_citas_simultaneas"("p_clinica_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_excluir_id" "uuid", OUT "cantidad" integer, OUT "momento" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_medicamento_tiene_existencias"("p_medicamento_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_normalizar_configuracion_alertas_caducidad"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalizar_configuracion_alertas_caducidad"() TO "service_role";


--
-- Name: FUNCTION "fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_administradores"("p_categoria" "public"."categoria_notificacion", "p_titulo" "text", "p_cuerpo" "text", "p_enlace" "text", "p_origen_tabla" "text", "p_origen_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_notificar_aviso_caducidad"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_notificar_aviso_caducidad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_aviso_caducidad"() TO "service_role";


--
-- Name: FUNCTION "fn_notificar_gasto_por_aprobar"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_notificar_gasto_por_aprobar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_gasto_por_aprobar"() TO "service_role";


--
-- Name: FUNCTION "fn_notificar_medicamento_sin_stock"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_notificar_medicamento_sin_stock"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_medicamento_sin_stock"() TO "service_role";


--
-- Name: FUNCTION "fn_notificar_movimiento_por_validar"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_notificar_movimiento_por_validar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_notificar_movimiento_por_validar"() TO "service_role";


--
-- Name: FUNCTION "fn_opciones_reporte_enfermedades"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_opciones_reporte_enfermedades"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_opciones_reporte_enfermedades"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_opciones_reporte_enfermedades"() TO "service_role";


--
-- Name: FUNCTION "fn_origen_del_presupuesto_inicial"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_origen_del_presupuesto_inicial"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_origen_del_presupuesto_inicial"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_origen_del_presupuesto_inicial"() TO "service_role";


--
-- Name: FUNCTION "fn_paciente_area_area_vigente"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_paciente_area_area_vigente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_paciente_area_area_vigente"() TO "service_role";


--
-- Name: FUNCTION "fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pasar_insumo_de_proyecto_a_jornada"("p_insumo_id" "uuid", "p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_proteger_decision_de_movimiento"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proteger_decision_de_movimiento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proteger_decision_de_movimiento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_proteger_decision_de_movimiento"() TO "service_role";


--
-- Name: FUNCTION "fn_proteger_presupuesto_comprometido"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proteger_presupuesto_comprometido"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proteger_presupuesto_comprometido"() TO "service_role";


--
-- Name: FUNCTION "fn_proveedor_sigue_al_donante"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proveedor_sigue_al_donante"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proveedor_sigue_al_donante"() TO "service_role";


--
-- Name: FUNCTION "fn_proyecto_cancelado_no_se_modifica"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proyecto_cancelado_no_se_modifica"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proyecto_cancelado_no_se_modifica"() TO "service_role";


--
-- Name: FUNCTION "fn_proyecto_de_la_fila_no_esta_cancelado"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proyecto_de_la_fila_no_esta_cancelado"() TO "service_role";


--
-- Name: FUNCTION "fn_proyecto_de_la_jornada_de_la_donacion"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_proyecto_de_la_jornada_de_la_donacion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_proyecto_de_la_jornada_de_la_donacion"() TO "service_role";


--
-- Name: FUNCTION "fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_queda_de_jornada_en_lote"("p_jornada_id" "uuid", "p_lote_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_reclamar_correos_de_notificaciones"("p_limite" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_reclamar_correos_de_notificaciones"("p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reclamar_correos_de_notificaciones"("p_limite" integer) TO "service_role";


--
-- Name: FUNCTION "fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_donacion"("p_donante_id" "uuid", "p_tipo" "public"."tipo_donacion", "p_fecha" "date", "p_detalle" "jsonb", "p_proyecto_id" "uuid", "p_observaciones" "text", "p_jornada_id" "uuid") TO "service_role";


--
-- Name: TABLE "medicamentos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."medicamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."medicamentos" TO "service_role";


--
-- Name: FUNCTION "fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_medicamento"("p_nombre" character varying, "p_concentracion" character varying, "p_presentacion_id" "uuid", "p_marca" character varying, "p_principios_ids" "uuid"[], "p_forma_farmaceutica" character varying, "p_es_pediatrico" boolean, "p_tipo_articulo" "public"."tipo_articulo") TO "service_role";


--
-- Name: FUNCTION "fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_paciente"("p_nombres" character varying, "p_apellidos" character varying, "p_fecha_nacimiento" "date", "p_sexo" character varying, "p_comunidad_id" "uuid", "p_telefono_contacto" character varying, "p_idioma" character varying, "p_dpi" character varying, "p_tipo_sangre" "public"."tipo_sanguineo", "p_nombre_responsable" character varying, "p_parentesco_responsable" character varying, "p_area_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_a_cuenta_de_jornada"("p_lote_id" "uuid", "p_bodega_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid", "p_registrado_por" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_registrar_salida_de_caja"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_registrar_salida_de_caja"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_de_caja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_de_caja"() TO "service_role";


--
-- Name: FUNCTION "fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_enfermedades"("p_agrupar_por" "text", "p_desde" "date", "p_hasta" "date", "p_jornada_ids" "uuid"[], "p_comunidad_ids" "uuid"[], "p_municipio_id" integer, "p_departamento_id" integer, "p_proyecto_id" "uuid", "p_diagnostico_id" "uuid", "p_solo_principales" boolean, "p_comunidad_de" "text") TO "service_role";


--
-- Name: FUNCTION "fn_reporte_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_reporte_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reporte_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reporte_pacientes_atendidos"("p_agrupar_por" "text", "p_jornada_id" "uuid", "p_comunidad_id" "uuid", "p_desde" "date", "p_hasta" "date") TO "service_role";


--
-- Name: FUNCTION "fn_saldo_de_caja_sin_filtro"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_saldo_de_caja_sin_filtro"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_saldo_de_caja_sin_filtro"() TO "service_role";


--
-- Name: FUNCTION "fn_sincronizar_alertas_caducidad"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_sincronizar_alertas_caducidad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sincronizar_alertas_caducidad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sincronizar_alertas_caducidad"() TO "service_role";


--
-- Name: FUNCTION "fn_sincronizar_presupuesto_de_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sincronizar_presupuesto_de_jornada"() TO "service_role";


--
-- Name: FUNCTION "fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_sincronizar_proveedor_de_donante"("p_donante_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_texto_de_hora_guatemala"("p_momento" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_trasladar_entre_bodegas"("p_lote_id" "uuid", "p_bodega_origen_id" "uuid", "p_bodega_destino_id" "uuid", "p_cantidad" integer, "p_motivo" "text", "p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_traspasar_sobrante_a_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_traspasar_sobrante_al_iniciar_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_traspasar_sobrante_al_iniciar_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_traspasar_sobrante_al_iniciar_jornada"() TO "service_role";


--
-- Name: FUNCTION "fn_umbrales_caducidad_validos"("p_umbrales" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_umbrales_caducidad_validos"("p_umbrales" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_umbrales_caducidad_validos"("p_umbrales" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_umbrales_caducidad_validos"("p_umbrales" integer[]) TO "service_role";


--
-- Name: FUNCTION "fn_validar_aporte_de_caja"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_aporte_de_caja"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_aporte_de_caja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_aporte_de_caja"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_cita"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_cita"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_cita"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_gasto_contra_presupuesto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_gasto_contra_presupuesto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_gasto_contra_presupuesto"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_lote_de_renglon_de_donacion"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."fn_validar_lote_de_renglon_de_donacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_lote_de_renglon_de_donacion"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_origen_de_presupuesto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_origen_de_presupuesto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_origen_de_presupuesto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_origen_de_presupuesto"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_transicion_estado_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_transicion_estado_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_transicion_estado_jornada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_transicion_estado_jornada"() TO "service_role";


--
-- Name: FUNCTION "fn_validar_transicion_estado_proyecto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_validar_transicion_estado_proyecto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_validar_transicion_estado_proyecto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_transicion_estado_proyecto"() TO "service_role";


--
-- Name: FUNCTION "fn_valor_de_inventario_disponible"("p_bodega_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_valor_de_inventario_disponible"("p_bodega_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_valor_de_inventario_disponible"("p_bodega_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_valor_de_inventario_disponible"("p_bodega_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_verificar_limite_busqueda_pacientes"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_verificar_limite_busqueda_pacientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_verificar_limite_busqueda_pacientes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verificar_limite_busqueda_pacientes"() TO "service_role";


--
-- Name: FUNCTION "fn_verificar_limite_invitaciones"("p_administrador_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_verificar_limite_invitaciones"("p_administrador_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_verificar_limite_invitaciones"("p_administrador_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verificar_limite_invitaciones"("p_administrador_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verificar_y_contar_limite"("p_recurso" "text", "p_actor_id" "uuid", "p_maximo" integer, "p_ventana" interval) TO "service_role";


--
-- Name: FUNCTION "impedir_autodesactivacion"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_autodesactivacion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_autodesactivacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_autodesactivacion"() TO "service_role";


--
-- Name: FUNCTION "impedir_baja_de_paciente_sin_ser_administrador"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."impedir_baja_de_paciente_sin_ser_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_baja_de_paciente_sin_ser_administrador"() TO "service_role";


--
-- Name: FUNCTION "impedir_borrado_fisico_paciente"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_borrado_fisico_paciente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_borrado_fisico_paciente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_borrado_fisico_paciente"() TO "service_role";


--
-- Name: FUNCTION "impedir_borrar_ultimo_administrador"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_borrar_ultimo_administrador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_borrar_ultimo_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_borrar_ultimo_administrador"() TO "service_role";


--
-- Name: FUNCTION "impedir_cambio_de_rol_propio"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_cambio_de_rol_propio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_cambio_de_rol_propio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_cambio_de_rol_propio"() TO "service_role";


--
-- Name: FUNCTION "impedir_dejar_sin_administrador_activo"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_dejar_sin_administrador_activo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_dejar_sin_administrador_activo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_dejar_sin_administrador_activo"() TO "service_role";


--
-- Name: FUNCTION "impedir_desactivar_sin_ser_administrador"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."impedir_desactivar_sin_ser_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_desactivar_sin_ser_administrador"() TO "service_role";


--
-- Name: FUNCTION "impedir_permiso_escritura_a_consultivo"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."impedir_permiso_escritura_a_consultivo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."impedir_permiso_escritura_a_consultivo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_permiso_escritura_a_consultivo"() TO "service_role";


--
-- Name: FUNCTION "impedir_retirar_sin_ser_administrador"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."impedir_retirar_sin_ser_administrador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."impedir_retirar_sin_ser_administrador"() TO "service_role";


--
-- Name: FUNCTION "mis_accesos"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."mis_accesos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mis_accesos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mis_accesos"() TO "service_role";


--
-- Name: FUNCTION "modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."modulo_por_defecto"("p_rol" "public"."rol_usuario", "p_modulo" "text") TO "service_role";


--
-- Name: FUNCTION "participa_en_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."participa_en_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."participa_en_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."participa_en_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."personal_registro_atenciones"("p_jornada_id" "uuid", "p_perfil_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "pertenece_a_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."pertenece_a_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pertenece_a_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pertenece_a_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "pertenece_a_proyecto"("p_proyecto_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."pertenece_a_proyecto"("p_proyecto_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pertenece_a_proyecto"("p_proyecto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pertenece_a_proyecto"("p_proyecto_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "presupuesto_de_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."presupuesto_de_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presupuesto_de_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."presupuesto_de_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "presupuesto_de_proyecto"("p_proyecto_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."presupuesto_de_proyecto"("p_proyecto_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presupuesto_de_proyecto"("p_proyecto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."presupuesto_de_proyecto"("p_proyecto_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "presupuesto_del_sistema"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."presupuesto_del_sistema"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presupuesto_del_sistema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."presupuesto_del_sistema"() TO "service_role";


--
-- Name: FUNCTION "presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."presupuestos_de_jornadas"("p_jornada_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."presupuestos_de_proyectos"("p_proyecto_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "puede_consultar_reportes"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."puede_consultar_reportes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."puede_consultar_reportes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_consultar_reportes"() TO "service_role";


--
-- Name: FUNCTION "registrar_avance_de_proyecto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."registrar_avance_de_proyecto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_avance_de_proyecto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_avance_de_proyecto"() TO "service_role";


--
-- Name: FUNCTION "registrar_cambio_estado_jornada"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."registrar_cambio_estado_jornada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_cambio_estado_jornada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cambio_estado_jornada"() TO "service_role";


--
-- Name: FUNCTION "registrar_cambio_estado_proyecto"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."registrar_cambio_estado_proyecto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_cambio_estado_proyecto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cambio_estado_proyecto"() TO "service_role";


--
-- Name: FUNCTION "registrar_evento_auditoria"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."registrar_evento_auditoria"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria"() TO "service_role";


--
-- Name: FUNCTION "registrar_evento_auditoria_rol_permiso"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria_rol_permiso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria_rol_permiso"() TO "service_role";


--
-- Name: FUNCTION "registrar_evento_auditoria_usuario_permiso"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_evento_auditoria_usuario_permiso"() TO "service_role";


--
-- Name: FUNCTION "rls_auto_enable"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


--
-- Name: FUNCTION "rol_actual"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."rol_actual"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rol_actual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rol_actual"() TO "service_role";


--
-- Name: FUNCTION "saldo_de_caja"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."saldo_de_caja"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."saldo_de_caja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."saldo_de_caja"() TO "service_role";


--
-- Name: FUNCTION "sobrante_de_jornada"("p_jornada_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."sobrante_de_jornada"("p_jornada_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sobrante_de_jornada"("p_jornada_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sobrante_de_jornada"("p_jornada_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "tiene_permiso"("p_codigo" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."tiene_permiso"("p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tiene_permiso"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tiene_permiso"("p_codigo" "text") TO "service_role";


--
-- Name: FUNCTION "validar_jornada_en_curso"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."validar_jornada_en_curso"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_jornada_en_curso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_jornada_en_curso"() TO "service_role";


--
-- Name: FUNCTION "validar_jornada_en_curso_atenciones"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."validar_jornada_en_curso_atenciones"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_jornada_en_curso_atenciones"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_jornada_en_curso_atenciones"() TO "service_role";


--
-- Name: TABLE "alerta_caducidad_detalle"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."alerta_caducidad_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."alerta_caducidad_detalle" TO "service_role";


--
-- Name: TABLE "alertas_caducidad"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."alertas_caducidad" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas_caducidad" TO "service_role";


--
-- Name: TABLE "areas_atencion"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."areas_atencion" TO "authenticated";
GRANT ALL ON TABLE "public"."areas_atencion" TO "service_role";


--
-- Name: TABLE "atenciones"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."atenciones" TO "authenticated";
GRANT ALL ON TABLE "public"."atenciones" TO "service_role";


--
-- Name: TABLE "avisos_caducidad"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."avisos_caducidad" TO "service_role";
GRANT SELECT ON TABLE "public"."avisos_caducidad" TO "authenticated";


--
-- Name: TABLE "bodegas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."bodegas" TO "authenticated";
GRANT ALL ON TABLE "public"."bodegas" TO "service_role";


--
-- Name: TABLE "categorias_de_gasto"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."categorias_de_gasto" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_de_gasto" TO "service_role";


--
-- Name: TABLE "citas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."citas" TO "authenticated";
GRANT ALL ON TABLE "public"."citas" TO "service_role";


--
-- Name: TABLE "clinicas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."clinicas" TO "authenticated";
GRANT ALL ON TABLE "public"."clinicas" TO "service_role";


--
-- Name: TABLE "comunidades"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."comunidades" TO "authenticated";
GRANT ALL ON TABLE "public"."comunidades" TO "service_role";


--
-- Name: TABLE "condiciones_cronicas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."condiciones_cronicas" TO "authenticated";
GRANT ALL ON TABLE "public"."condiciones_cronicas" TO "service_role";


--
-- Name: TABLE "configuracion_alertas_caducidad"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."configuracion_alertas_caducidad" TO "service_role";
GRANT SELECT ON TABLE "public"."configuracion_alertas_caducidad" TO "authenticated";


--
-- Name: COLUMN "configuracion_alertas_caducidad"."umbrales_dias"; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE("umbrales_dias") ON TABLE "public"."configuracion_alertas_caducidad" TO "authenticated";


--
-- Name: TABLE "consulta_diagnostico"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."consulta_diagnostico" TO "authenticated";
GRANT ALL ON TABLE "public"."consulta_diagnostico" TO "service_role";


--
-- Name: TABLE "consultas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."consultas" TO "authenticated";
GRANT ALL ON TABLE "public"."consultas" TO "service_role";


--
-- Name: TABLE "departamentos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."departamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."departamentos" TO "service_role";


--
-- Name: TABLE "diagnosticos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."diagnosticos" TO "authenticated";
GRANT ALL ON TABLE "public"."diagnosticos" TO "service_role";


--
-- Name: TABLE "donacion_detalle"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."donacion_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."donacion_detalle" TO "service_role";


--
-- Name: COLUMN "donacion_detalle"."lote_id"; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE("lote_id") ON TABLE "public"."donacion_detalle" TO "authenticated";


--
-- Name: TABLE "donaciones"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."donaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."donaciones" TO "service_role";


--
-- Name: TABLE "donantes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."donantes" TO "authenticated";
GRANT ALL ON TABLE "public"."donantes" TO "service_role";


--
-- Name: TABLE "eventos_auditoria"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."eventos_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_auditoria" TO "service_role";


--
-- Name: SEQUENCE "eventos_auditoria_id_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."eventos_auditoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."eventos_auditoria_id_seq" TO "service_role";


--
-- Name: TABLE "existencias"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."existencias" TO "authenticated";
GRANT ALL ON TABLE "public"."existencias" TO "service_role";


--
-- Name: TABLE "expedientes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."expedientes" TO "authenticated";
GRANT ALL ON TABLE "public"."expedientes" TO "service_role";


--
-- Name: SEQUENCE "expedientes_numero_ficha_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."expedientes_numero_ficha_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."expedientes_numero_ficha_seq" TO "service_role";


--
-- Name: TABLE "fuentes_de_presupuesto"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."fuentes_de_presupuesto" TO "authenticated";
GRANT ALL ON TABLE "public"."fuentes_de_presupuesto" TO "service_role";


--
-- Name: TABLE "gastos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."gastos" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos" TO "service_role";


--
-- Name: TABLE "idiomas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."idiomas" TO "authenticated";
GRANT ALL ON TABLE "public"."idiomas" TO "service_role";


--
-- Name: TABLE "jornada_estado_historial"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."jornada_estado_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."jornada_estado_historial" TO "service_role";


--
-- Name: TABLE "jornada_insumos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."jornada_insumos" TO "authenticated";
GRANT ALL ON TABLE "public"."jornada_insumos" TO "service_role";


--
-- Name: TABLE "jornada_personal"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."jornada_personal" TO "authenticated";
GRANT ALL ON TABLE "public"."jornada_personal" TO "service_role";


--
-- Name: TABLE "jornada_presupuesto_origen"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."jornada_presupuesto_origen" TO "authenticated";
GRANT ALL ON TABLE "public"."jornada_presupuesto_origen" TO "service_role";


--
-- Name: TABLE "jornadas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."jornadas" TO "authenticated";
GRANT ALL ON TABLE "public"."jornadas" TO "service_role";


--
-- Name: SEQUENCE "jornadas_codigo_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."jornadas_codigo_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."jornadas_codigo_seq" TO "service_role";


--
-- Name: TABLE "limites_de_uso"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."limites_de_uso" TO "authenticated";
GRANT ALL ON TABLE "public"."limites_de_uso" TO "service_role";


--
-- Name: TABLE "lotes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."lotes" TO "authenticated";
GRANT ALL ON TABLE "public"."lotes" TO "service_role";


--
-- Name: TABLE "medicamento_principio"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."medicamento_principio" TO "authenticated";
GRANT ALL ON TABLE "public"."medicamento_principio" TO "service_role";


--
-- Name: TABLE "movimientos_de_caja"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."movimientos_de_caja" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_de_caja" TO "service_role";


--
-- Name: TABLE "movimientos_inventario"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."movimientos_inventario" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_inventario" TO "service_role";


--
-- Name: TABLE "municipios"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."municipios" TO "authenticated";
GRANT ALL ON TABLE "public"."municipios" TO "service_role";


--
-- Name: TABLE "perfiles"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";


--
-- Name: TABLE "nombres_de_perfiles"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."nombres_de_perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."nombres_de_perfiles" TO "service_role";


--
-- Name: TABLE "notificaciones"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";
GRANT SELECT ON TABLE "public"."notificaciones" TO "authenticated";


--
-- Name: COLUMN "notificaciones"."leida_en"; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE("leida_en") ON TABLE "public"."notificaciones" TO "authenticated";


--
-- Name: TABLE "paciente_area"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."paciente_area" TO "authenticated";
GRANT ALL ON TABLE "public"."paciente_area" TO "service_role";


--
-- Name: TABLE "pacientes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes" TO "service_role";


--
-- Name: TABLE "pacientes_reporte"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."pacientes_reporte" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes_reporte" TO "service_role";


--
-- Name: TABLE "padecimientos_cronicos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."padecimientos_cronicos" TO "authenticated";
GRANT ALL ON TABLE "public"."padecimientos_cronicos" TO "service_role";


--
-- Name: TABLE "perfil_especialidad"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."perfil_especialidad" TO "authenticated";
GRANT ALL ON TABLE "public"."perfil_especialidad" TO "service_role";


--
-- Name: TABLE "perfiles_directorio"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."perfiles_directorio" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles_directorio" TO "service_role";


--
-- Name: TABLE "permisos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."permisos" TO "authenticated";
GRANT ALL ON TABLE "public"."permisos" TO "service_role";


--
-- Name: TABLE "presentaciones"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."presentaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."presentaciones" TO "service_role";


--
-- Name: TABLE "principios_activos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."principios_activos" TO "authenticated";
GRANT ALL ON TABLE "public"."principios_activos" TO "service_role";


--
-- Name: TABLE "privilegios_de_anon"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."privilegios_de_anon" TO "service_role";


--
-- Name: TABLE "proveedores"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."proveedores" TO "authenticated";
GRANT ALL ON TABLE "public"."proveedores" TO "service_role";


--
-- Name: TABLE "proyecto_estado_historial"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."proyecto_estado_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_estado_historial" TO "service_role";


--
-- Name: TABLE "proyecto_hitos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."proyecto_hitos" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_hitos" TO "service_role";


--
-- Name: TABLE "proyecto_insumos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."proyecto_insumos" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_insumos" TO "service_role";


--
-- Name: TABLE "proyecto_personal"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."proyecto_personal" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_personal" TO "service_role";


--
-- Name: TABLE "proyecto_seguimiento"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."proyecto_seguimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_seguimiento" TO "service_role";


--
-- Name: TABLE "proyectos"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."proyectos" TO "authenticated";
GRANT ALL ON TABLE "public"."proyectos" TO "service_role";


--
-- Name: TABLE "receta_detalle"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."receta_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."receta_detalle" TO "service_role";


--
-- Name: TABLE "recetas"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."recetas" TO "authenticated";
GRANT ALL ON TABLE "public"."recetas" TO "service_role";


--
-- Name: TABLE "rol_modulo"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."rol_modulo" TO "authenticated";
GRANT ALL ON TABLE "public"."rol_modulo" TO "service_role";


--
-- Name: TABLE "rol_permiso"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."rol_permiso" TO "authenticated";
GRANT ALL ON TABLE "public"."rol_permiso" TO "service_role";


--
-- Name: TABLE "tablas_sin_rls"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."tablas_sin_rls" TO "service_role";


--
-- Name: TABLE "triajes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."triajes" TO "authenticated";
GRANT ALL ON TABLE "public"."triajes" TO "service_role";


--
-- Name: TABLE "usuario_permiso"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."usuario_permiso" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario_permiso" TO "service_role";


--
-- Name: TABLE "vista_cola_jornada"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."vista_cola_jornada" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_cola_jornada" TO "service_role";


--
-- Name: TABLE "vista_lotes_disponibles"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."vista_lotes_disponibles" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_lotes_disponibles" TO "service_role";


--
-- Name: TABLE "vista_reporte_impacto"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."vista_reporte_impacto" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_reporte_impacto" TO "service_role";


--
-- Name: TABLE "vista_reporte_impacto_por_comunidad"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."vista_reporte_impacto_por_comunidad" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_reporte_impacto_por_comunidad" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--


