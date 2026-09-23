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
  componerCorreoDeInvitacion,
  enviarCorreosPendientes,
  envolverEnPlantilla,
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

// ============================================================================
// Correo de invitacion (issue #864)
// ============================================================================
function contiene(texto: string, fragmento: string) {
  if (!texto.includes(fragmento)) {
    throw new Error(`No se encontro ${JSON.stringify(fragmento)} en el correo`);
  }
}

function noContiene(texto: string, fragmento: string) {
  if (texto.includes(fragmento)) {
    throw new Error(`No deberia estar ${JSON.stringify(fragmento)} en el correo`);
  }
}

// Lo que la issue pide distinguir: este correo NO puede leerse como un restablecimiento. Quien
// lo recibe estrena su cuenta y nunca tuvo contrasena.
Deno.test("el correo de invitacion se lee como una bienvenida, no como un restablecimiento", () => {
  const correo = componerCorreoDeInvitacion(
    "Ana",
    "https://app.ecopac.test/nueva-contrasena?origen=invitacion",
    "https://app.ecopac.test",
  );

  assertEquals(correo.asunto, "Te damos la bienvenida a Ecopac Digital");
  contiene(correo.texto, "Hola, Ana:");
  contiene(correo.texto, "Te dieron de alta en Ecopac Digital");
  contiene(correo.html, "Te damos la bienvenida");
  noContiene(correo.asunto, "Restablece");
  noContiene(correo.texto, "Restablece");
});

Deno.test("sin nombre saluda igual, sin dejar el hueco a la vista", () => {
  const correo = componerCorreoDeInvitacion("", "https://app.ecopac.test/x", "https://app.ecopac.test");

  contiene(correo.texto, "Hola:");
  noContiene(correo.texto, "Hola, :");
});

Deno.test("el enlace viaja en las dos versiones, para quien lee el correo en texto plano", () => {
  const enlace = "https://app.ecopac.test/nueva-contrasena?origen=invitacion&token=abc";
  const correo = componerCorreoDeInvitacion("Ana", enlace, "https://app.ecopac.test");

  contiene(correo.texto, enlace);
  contiene(correo.html, enlace);
});

// El logotipo se sirve desde la web, no incrustado: Gmail no pinta imagenes `data:`.
Deno.test("la plantilla trae el logotipo de la web y los cuatro colores de la marca", () => {
  const html = envolverEnPlantilla(
    "https://app.ecopac.test/",
    "Titulo",
    "<p>Cuerpo</p>",
    "Boton",
    "https://app.ecopac.test/destino",
    "Pie",
  );

  // La barra final de la URL base no se duplica.
  contiene(html, 'src="https://app.ecopac.test/logo-ecopac.png"');
  noContiene(html, "https://app.ecopac.test//logo-ecopac.png");

  for (const color of ["#3db648", "#29abe2", "#f7941d", "#e91e8c"]) {
    contiene(html, color);
  }

  // Estilos en linea y tabla: es lo unico que se ve igual en Gmail, Outlook y un telefono.
  contiene(html, "<table");
  noContiene(html, "<style");
});

Deno.test("quien no puede pulsar el boton igual tiene la direccion a la vista", () => {
  const html = envolverEnPlantilla(
    "https://app.ecopac.test",
    "Titulo",
    "<p>Cuerpo</p>",
    "Boton",
    "https://app.ecopac.test/destino-largo",
    "Pie",
  );

  contiene(html, "copia y pega esta direcci");
  contiene(html, "https://app.ecopac.test/destino-largo");
});
