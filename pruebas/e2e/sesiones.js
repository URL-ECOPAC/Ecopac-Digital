// Sesiones reales contra el stack local, una por rol (issue #222).
//
// POR QUE INICIA SESION DE VERDAD Y NO SIMULA auth.uid()
//
// Las suites pgTAP de supabase/tests/database fijan `request.jwt.claim.sub` a mano: alcanza para
// probar una politica RLS aislada, pero no recorre nada. Estas pruebas son el recorrido completo,
// asi que la sesion tiene que venir de donde viene en produccion -- GoTrue emitiendo un JWT
// contra una contrasena real -- y viajar por PostgREST igual que viaja desde la aplicacion.
// Lo que se prueba con eso no es solo la regla: es que la regla se aplica por el camino real.
//
// LAS CUENTAS SON LAS DEL SEED DEMO, NO SE CREAN AQUI
//
// supabase/seed-demo.sql (issue #94) ya siembra una cuenta por rol con su fila en
// auth.identities, que es lo que GoTrue necesita para el login por contrasena. Crear otras aqui
// duplicaria ese trabajo y, peor, dejaria las pruebas dependiendo de un recorrido de alta que no
// es el que estan probando. Todo ese archivo es ficticio y la credencial es de desarrollo: nunca
// llega a un proyecto remoto, porque `supabase db push` no ejecuta seeds (ver su cabecera).
//
// UN CLIENTE A LA VEZ
//
// packages/shared expone una sola instancia de Supabase a proposito (dos sesiones se pisan, ver
// api/cliente.js). reiniciarSupabase() existe justamente para que las pruebas puedan cambiar de
// sesion, asi que cada entrarComo() reemplaza a la anterior. Por eso el vitest.config.js de esta
// carpeta corre los archivos en serie: dos flujos en paralelo se robarian la sesion.

import {
  crearAlmacenamientoEnMemoria,
  inicializarSupabase,
  PLATAFORMAS,
  reiniciarSupabase,
} from "@ecopac/shared";

import { configuracionDelStackLocal } from "./stack-local.js";

/** La misma contrasena para las siete cuentas del seed demo. */
const CONTRASENA_DEMO = "EcopacDemo#2026";

/**
 * Las cuentas del seed que estas pruebas usan, con el id de perfil que les toca.
 *
 * MEDICO y VOLUNTARIO son los asignados a la jornada en curso (jornada_personal, seccion 8 del
 * seed). Importa: la politica de INSERT de `consultas` exige participa_en_jornada(), asi que el
 * otro medico del seed -- el de la jornada finalizada -- seria rechazado.
 */
export const CUENTAS = Object.freeze({
  ADMINISTRADORA: {
    email: "admin.demo@ecopac.test",
    perfilId: "de000001-0000-0000-0000-000000000001",
    rol: "administrador",
  },
  MEDICO: {
    email: "medico2.demo@ecopac.test",
    perfilId: "de000001-0000-0000-0000-000000000005",
    rol: "medico",
  },
  VOLUNTARIO: {
    email: "voluntario2.demo@ecopac.test",
    perfilId: "de000001-0000-0000-0000-000000000007",
    rol: "voluntario general",
  },
});

/**
 * Deja a `packages/shared` operando con la sesion de esa cuenta.
 *
 * Devuelve el cliente por comodidad, pero las pruebas no deberian usarlo: lo que se ejercita son
 * las funciones de shared, que lo obtienen solas con obtenerSupabase(). Si una prueba necesita el
 * cliente crudo para verificar algo, es senal de que a shared le falta esa funcion.
 *
 * @param {{ email: string, perfilId: string, rol: string }} cuenta Una de CUENTAS.
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient>}
 */
export async function entrarComo(cuenta) {
  reiniciarSupabase();

  const { apiUrl, anonKey } = configuracionDelStackLocal();

  const cliente = inicializarSupabase({
    almacenamiento: crearAlmacenamientoEnMemoria(),
    entorno: {
      supabaseUrl: apiUrl,
      supabaseAnonKey: anonKey,
      plataforma: PLATAFORMAS.WEB,
    },
  });

  const { error } = await cliente.auth.signInWithPassword({
    email: cuenta.email,
    password: CONTRASENA_DEMO,
  });

  if (error) {
    throw new Error(
      `No se pudo iniciar sesion como ${cuenta.email}: ${error.message}. Si el mensaje habla ` +
        "de credenciales invalidas, corre `supabase db reset` para volver a sembrar el seed demo.",
    );
  }

  return cliente;
}

/** Cierra la sesion en curso y olvida el cliente. Se llama en el afterAll de cada suite. */
export async function salir() {
  reiniciarSupabase();
}
