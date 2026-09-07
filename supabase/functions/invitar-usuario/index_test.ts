// Pruebas de invitar-usuario (issue #691): un administrador desactivado, con un JWT todavia
// vigente, no puede seguir invitando personal nuevo.
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
 */
function clienteFalso(perfilDeQuienLlama: { rol: string; activo: boolean } | null) {
  return function crearClienteFalso() {
    return {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: "00000000-0000-0000-0000-000000000001" } },
            error: null,
          }),
        resetPasswordForEmail: () => Promise.resolve({ error: null }),
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
      rpc: () =>
        Promise.resolve({ data: "10000000-0000-0000-0000-000000000002", error: null }),
      // deno-lint-ignore no-explicit-any
    } as any;
  };
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
