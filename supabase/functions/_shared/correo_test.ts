// Pruebas del correo de notificaciones (issue #755): como se arma, y que el barrido solo marca
// como enviado lo que el servidor SMTP acepto.
//
// Corre con: deno test --config supabase/functions/deno.json --allow-env supabase/functions
//
// Mismo criterio que cors_test.ts: sin @std/assert, un assertEquals casero para no sumar una
// dependencia al import map solo para comparaciones. Sin red: el cliente de Supabase y el
// transporte SMTP son dobles.

import {
  type ConfiguracionSmtp,
  componerCorreo,
  enviarCorreosPendientes,
  leerConfiguracionSmtp,
  type NotificacionParaCorreo,
  type Transporte,
} from "./correo.ts";

function assertEquals(actual: unknown, esperado: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    throw new Error(`Se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(actual)}`);
  }
}

function assert(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

function notificacion(extra: Partial<NotificacionParaCorreo> = {}): NotificacionParaCorreo {
  return {
    id: "n-1",
    email: "admin@ecopac.test",
    nombres: "Ana",
    categoria: "caducidad",
    titulo: "Lote vencido: Medicamento de prueba",
    cuerpo: "El lote L-1 vencio el 01/09/2026 y tiene 5 unidades en existencia.",
    enlace: "/inventario?tab=alertas",
    created_at: "2026-09-18T12:00:00Z",
    ...extra,
  };
}

const CONFIG: ConfiguracionSmtp = {
  host: "smtp.test",
  puerto: 465,
  remitente: "Ecopac Digital <no-responder@ecopac.test>",
  urlWeb: "https://app.ecopac.test/",
};

Deno.test("el asunto lleva el titulo de la notificacion", () => {
  const correo = componerCorreo(notificacion(), CONFIG.urlWeb);
  assertEquals(correo.asunto, "[Ecopac Digital] Lote vencido: Medicamento de prueba");
});

Deno.test("el enlace une la URL de la web con la ruta, sin doble barra", () => {
  const correo = componerCorreo(notificacion(), CONFIG.urlWeb);
  assert(
    correo.texto.includes("https://app.ecopac.test/inventario?tab=alertas"),
    `el texto no trae el enlace completo: ${correo.texto}`,
  );
});

Deno.test("el HTML escapa lo que viene de la base", () => {
  const correo = componerCorreo(
    notificacion({ cuerpo: 'Motivo: <script>alert("x")</script>' }),
    CONFIG.urlWeb,
  );
  assert(!correo.html.includes("<script>"), "el HTML dejo pasar una etiqueta sin escapar");
  assert(correo.html.includes("&lt;script&gt;"), "el HTML no escapo la etiqueta");
});

Deno.test("sin WEB_URL la configuracion SMTP no esta completa", () => {
  Deno.env.set("SMTP_HOST", "smtp.test");
  Deno.env.set("SMTP_FROM", "no-responder@ecopac.test");
  Deno.env.delete("WEB_URL");
  assertEquals(leerConfiguracionSmtp(), null);
  Deno.env.delete("SMTP_HOST");
  Deno.env.delete("SMTP_FROM");
});

// Doble del cliente de Supabase: entrega los pendientes una vez y registra lo que se actualiza.
function clienteFalso(pendientes: NotificacionParaCorreo[]) {
  let entregados = false;
  const marcadasEnviadas: string[] = [];
  const errores: Record<string, string> = {};
  let llamadasAReclamar = 0;

  const cliente = {
    rpc(_funcion: string, _args: Record<string, unknown>) {
      llamadasAReclamar += 1;
      const data = entregados ? [] : pendientes;
      entregados = true;
      return Promise.resolve({ data, error: null });
    },
    from(_tabla: string) {
      return {
        update(valores: Record<string, unknown>) {
          return {
            in(_columna: string, ids: string[]) {
              if (valores.correo_enviado_en) marcadasEnviadas.push(...ids);
              return Promise.resolve({ error: null });
            },
            eq(_columna: string, id: string) {
              errores[id] = String(valores.correo_error);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return {
    cliente,
    marcadasEnviadas,
    errores,
    llamadas: () => llamadasAReclamar,
  };
}

Deno.test("sin configuracion SMTP no reclama nada: las notificaciones siguen pendientes", async () => {
  const falso = clienteFalso([notificacion()]);
  const resultado = await enviarCorreosPendientes(falso.cliente, null, null);
  assertEquals(resultado, { correo: "sin configurar", correosEnviados: 0, correosFallidos: 0 });
  assertEquals(falso.llamadas(), 0);
});

Deno.test("manda un correo por notificacion, en orden, y marca solo las que salieron", async () => {
  const falso = clienteFalso([
    notificacion({ id: "n-1", email: "a@ecopac.test" }),
    notificacion({ id: "n-2", email: "rebota@ecopac.test" }),
    notificacion({ id: "n-3", email: "b@ecopac.test" }),
  ]);
  const destinatarios: string[] = [];
  const transporte: Transporte = {
    sendMail(mensaje) {
      destinatarios.push(mensaje.to);
      if (mensaje.to === "rebota@ecopac.test") return Promise.reject(new Error("buzon lleno"));
      return Promise.resolve({});
    },
  };

  const resultado = await enviarCorreosPendientes(falso.cliente, CONFIG, transporte);

  assertEquals(destinatarios, ["a@ecopac.test", "rebota@ecopac.test", "b@ecopac.test"]);
  assertEquals(falso.marcadasEnviadas, ["n-1", "n-3"]);
  assertEquals(falso.errores, { "n-2": "buzon lleno" });
  assertEquals(resultado, { correo: "error", correosEnviados: 2, correosFallidos: 1 });
});
