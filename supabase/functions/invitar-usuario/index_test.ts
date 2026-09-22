// Pruebas de invitar-usuario: un administrador desactivado, con un JWT todavia vigente, no
// puede seguir invitando personal nuevo (issue #691); y el limite de invitaciones por hora se
// consulta antes de crear la cuenta, sin dejarla a medias si se supera (issue #761).
//
// Corre con: deno test --config supabase/functions/deno.json --allow-env supabase/functions
//
// No corre contra el stack local ni contra red real: manejarSolicitud() recibe un `crearCliente`
// falso (ver index.ts) que devuelve un cliente minimo, con solo los metodos que el handler
// invoca. Es la primera prueba de una Edge Function en este repo -pgTAP no puede ejercitar
// codigo Deno, solo politicas y funciones SQL (esas ya las cubre
// supabase/tests/database/perfil_inactivo_sin_privilegios.sql)-, asi que no hay CI wireado
// todavia para este archivo: es responsabilidad de quien toque invitar-usuario correrlo a mano.
//
// Sin dependencias externas a proposito: agregar @std/assert obligaria a sumarlo al import map
// de deno.json (deno lint rechaza un import inline de jsr:/npm:/https:) solo para dos
// comparaciones, asi que se usa un assertEquals casero.

import { manejarSolicitud } from "./index.ts";

function assertEquals(actual: unknown, esperado: unknown) {
  if (actual !== esperado) {
    throw new Error(`Se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(actual)}`);
  }
}

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_ANON_KEY", "anon-de-prueba");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-de-prueba");

const BODY_VALIDO = {
  nombres: "Persona",
  apellidos: "De prueba",
  email: "nueva@ecopac.test",
  rol: "voluntario general",
};

function solicitud() {
  return new Request("http://localhost/invitar-usuario", {
    method: "POST",
    headers: { Authorization: "Bearer jwt-de-prueba" },
    body: JSON.stringify(BODY_VALIDO),
  });
}

/**
 * Cliente falso minimo: cubre exactamente lo que invitar-usuario/index.ts invoca en sus tres
 * `crearCliente(...)` (clienteDeQuienLlama, supabaseAdmin, supabaseAnon). Ninguna prueba
 * necesita distinguir cual de los tres se esta construyendo, asi que la misma fabrica sirve
 * para las tres llamadas.
 *
 * `opciones.errorDeLimite` (issue #761) simula que `fn_verificar_limite_invitaciones` fallo -el
 * unico llamado real de `.rpc()` que necesita poder fallar aparte de
 * `fn_crear_usuario_administrativo`-. `llamadasRpc`, expuesto en la fabrica devuelta, deja
 * comprobar que `fn_crear_usuario_administrativo` no se invoco cuando el limite rechaza antes.
 */
function clienteFalso(
  perfilDeQuienLlama: { rol: string; activo: boolean } | null,
  opciones: { errorDeLimite?: { code: string; message: string } } = {},
) {
  const llamadasRpc: string[] = [];
  // Issue #864: a donde manda el correo de "elige tu contrasena". Se guarda para poder
  // comprobarlo, que es justo lo que no se estaba comprobando cuando el enlace caia en la raiz.
  const destinosDeCorreo: (string | undefined)[] = [];

  function crearClienteFalso() {
    return {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: "00000000-0000-0000-0000-000000000001" } },
            error: null,
          }),
        resetPasswordForEmail: (
          _correo: string,
          opcionesDeCorreo?: { redirectTo?: string },
        ) => {
          destinosDeCorreo.push(opcionesDeCorreo?.redirectTo);
          return Promise.resolve({ error: null });
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: perfilDeQuienLlama, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      rpc: (nombre: string) => {
        llamadasRpc.push(nombre);
        if (nombre === "fn_verificar_limite_invitaciones" && opciones.errorDeLimite) {
          return Promise.resolve({ data: null, error: opciones.errorDeLimite });
        }
        return Promise.resolve({ data: "10000000-0000-0000-0000-000000000002", error: null });
      },
      // deno-lint-ignore no-explicit-any
    } as any;
  }

  // deno-lint-ignore no-explicit-any
  (crearClienteFalso as any).llamadasRpc = llamadasRpc;
  // deno-lint-ignore no-explicit-any
  (crearClienteFalso as any).destinosDeCorreo = destinosDeCorreo;
  return crearClienteFalso;
}

Deno.test(
  "administrador desactivado con JWT vigente no puede invitar (issue #691)",
  async () => {
    const res = await manejarSolicitud(solicitud(), {
      crearCliente: clienteFalso({ rol: "administrador", activo: false }),
    });

    assertEquals(res.status, 403);
    const cuerpo = await res.json();
    assertEquals(cuerpo.code, "42501");
  },
);

Deno.test("un rol distinto de administrador, aunque activo, no puede invitar", async () => {
  const res = await manejarSolicitud(solicitud(), {
    crearCliente: clienteFalso({ rol: "medico", activo: true }),
  });

  assertEquals(res.status, 403);
});

Deno.test("un administrador activo si puede invitar", async () => {
  const res = await manejarSolicitud(solicitud(), {
    crearCliente: clienteFalso({ rol: "administrador", activo: true }),
  });

  assertEquals(res.status, 200);
  const cuerpo = await res.json();
  assertEquals(cuerpo.correoEnviado, true);
});

Deno.test(
  "el limite de invitaciones se consulta antes de crear la cuenta (issue #761)",
  async () => {
    const fabrica = clienteFalso(
      { rol: "administrador", activo: true },
      {
        errorDeLimite: {
          code: "53400",
          message: "Se alcanzo el limite de 20 peticiones cada 01:00:00.",
        },
      },
    );

    const res = await manejarSolicitud(solicitud(), { crearCliente: fabrica });

    assertEquals(res.status, 429);
    const cuerpo = await res.json();
    assertEquals(cuerpo.code, "53400");

    // deno-lint-ignore no-explicit-any
    const llamadas = (fabrica as any).llamadasRpc as string[];
    assertEquals(llamadas.includes("fn_crear_usuario_administrativo"), false);
  },
);

Deno.test("una peticion normal sigue funcionando cuando el limite no se supero", async () => {
  const fabrica = clienteFalso({ rol: "administrador", activo: true });

  const res = await manejarSolicitud(solicitud(), { crearCliente: fabrica });

  assertEquals(res.status, 200);
  // deno-lint-ignore no-explicit-any
  const llamadas = (fabrica as any).llamadasRpc as string[];
  assertEquals(llamadas.includes("fn_verificar_limite_invitaciones"), true);
  assertEquals(llamadas.includes("fn_crear_usuario_administrativo"), true);
});

// ISSUE #864, punto 5. El correo de invitacion llegaba, pero su enlace mandaba a la RAIZ de la
// aplicacion: se enviaba sin `redirectTo` y ganaba el Site URL de Supabase Auth. Comprobado de
// punta a punta en local antes del arreglo: la persona invitada abria el enlace y aterrizaba en
// la pantalla de inicio, con sesion y sin contrasena, sin nada que la llevara a ponerse una.
Deno.test("el correo de invitacion lleva a /nueva-contrasena cuando WEB_URL esta puesta", async () => {
  Deno.env.set("WEB_URL", "http://localhost:5173");
  const crearCliente = clienteFalso({ rol: "administrador", activo: true });

  const res = await manejarSolicitud(solicitud(), { crearCliente });

  assertEquals(res.status, 200);
  // deno-lint-ignore no-explicit-any
  const destinos = (crearCliente as any).destinosDeCorreo as (string | undefined)[];
  assertEquals(destinos.length, 1);
  assertEquals(destinos[0], "http://localhost:5173/nueva-contrasena");
});

// Una barra de mas al final de WEB_URL no tiene que producir "//nueva-contrasena": ese destino
// no coincidiria con el que se registre en Redirect URLs y Supabase lo ignoraria, volviendo en
// silencio al Site URL -- es decir, al defecto de arriba otra vez.
Deno.test("WEB_URL con barra final no duplica la barra del destino", async () => {
  Deno.env.set("WEB_URL", "http://localhost:5173/");
  const crearCliente = clienteFalso({ rol: "administrador", activo: true });

  await manejarSolicitud(solicitud(), { crearCliente });

  // deno-lint-ignore no-explicit-any
  const destinos = (crearCliente as any).destinosDeCorreo as (string | undefined)[];
  assertEquals(destinos[0], "http://localhost:5173/nueva-contrasena");
});

// Sin WEB_URL se vuelve al comportamiento anterior en vez de romper el alta: el correo sale
// igual y gana el Site URL. Un despliegue sin esa variable no deja de invitar.
Deno.test("sin WEB_URL el correo sale igual, sin redirectTo", async () => {
  Deno.env.delete("WEB_URL");
  const crearCliente = clienteFalso({ rol: "administrador", activo: true });

  const res = await manejarSolicitud(solicitud(), { crearCliente });

  assertEquals(res.status, 200);
  // deno-lint-ignore no-explicit-any
  const destinos = (crearCliente as any).destinosDeCorreo as (string | undefined)[];
  assertEquals(destinos[0], undefined);
});
