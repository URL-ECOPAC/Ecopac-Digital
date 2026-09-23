// Correo de las notificaciones al administrador (issue #755).
//
// Dos piezas, separadas a proposito:
//
// - componerCorreo() es pura: recibe una notificacion y devuelve asunto, texto y HTML. Se prueba
//   sin red ni SMTP (correo_test.ts).
// - enviarCorreosPendientes() es la que habla con la base y con el servidor SMTP. La usan
//   enviar-notificaciones (disparada por el webhook de pg_net en el momento de la incidencia) y
//   alertas-vencimiento (la rutina diaria, que de paso reintenta lo que haya quedado sin salir).
//
// UN CORREO POR NOTIFICACION, EN ORDEN DE LLEGADA
//
// Es lo que se decidio para la #755: el correo no se agrupa ni se resume. El buzon de la
// aplicacion es donde se agrupa por categoria; el correo llega tal como se produjo cada incidencia.
//
// POR QUE EL HTML NO LLEVA COLOR
//
// Todo color del proyecto sale de @ecopac/ui-tokens, y esta funcion no lo puede importar: el
// despliegue de Edge Functions solo sube supabase/functions. Antes que escribir hexadecimales a
// mano -la deuda que docs/DISENO.md esta migrando- el correo va en HTML sin estilos, que ademas
// es lo que mejor se lee en cualquier cliente de correo.

import nodemailer from "nodemailer";

export type NotificacionParaCorreo = {
  id: string;
  email: string;
  nombres: string | null;
  categoria: string;
  titulo: string;
  cuerpo: string;
  enlace: string;
  created_at: string;
};

export type Correo = { asunto: string; texto: string; html: string };

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Arma el correo de una notificacion. `urlWeb` es la raiz de la aplicacion web (sin barra final);
 * el enlace de la notificacion ya es una ruta que empieza por "/".
 */
export function componerCorreo(notificacion: NotificacionParaCorreo, urlWeb: string): Correo {
  const saludo = notificacion.nombres ? `Hola, ${notificacion.nombres}:` : "Hola:";
  const destino = `${urlWeb.replace(/\/+$/, "")}${notificacion.enlace}`;
  const pie =
    "Recibes este correo porque tienes el rol de administrador en Ecopac Digital. " +
    "La misma notificacion esta en el buzon de tu perfil.";

  return {
    asunto: `[Ecopac Digital] ${notificacion.titulo}`,
    texto: [saludo, "", notificacion.cuerpo, "", `Abrir en Ecopac Digital: ${destino}`, "", pie].join(
      "\n",
    ),
    html: [
      `<p>${escaparHtml(saludo)}</p>`,
      `<p>${escaparHtml(notificacion.cuerpo)}</p>`,
      `<p><a href="${escaparHtml(destino)}">Abrir en Ecopac Digital</a></p>`,
      `<p><small>${escaparHtml(pie)}</small></p>`,
    ].join("\n"),
  };
}

/**
 * Envoltorio HTML de los correos que manda el sistema (issue #864).
 *
 * Un correo no es una pagina: no hay hoja de estilos, no hay flexbox y la mitad de los clientes
 * recorta lo que no entiende. Por eso esto es una tabla con estilos en linea, que es lo unico
 * que se ve igual en Gmail, Outlook y un telefono, y por eso los colores van escritos aqui en
 * vez de salir de los tokens: `var(--color-primary)` no existe dentro de un correo. Son los
 * mismos valores que publica @ecopac/ui-tokens (docs/DISENO.md).
 *
 * El filete de arriba son los cuatro colores del logo, en el mismo orden. El logotipo se sirve
 * desde la propia web (`/logo-ecopac.png`): incrustarlo en base64 no sirve, porque Gmail no
 * pinta imagenes `data:`. Si el correo se abre sin conexion a la web, el `alt` deja el nombre.
 *
 * @param urlWeb Base de la aplicacion, sin barra final.
 * @param titulo Encabezado del correo, ya escapado.
 * @param cuerpoHtml Parrafos del cuerpo, ya escapados.
 * @param textoDelBoton Rotulo de la llamada a la accion, ya escapado.
 * @param enlace Destino del boton.
 * @param pieHtml Nota final en letra chica, ya escapada.
 */
export function envolverEnPlantilla(
  urlWeb: string,
  titulo: string,
  cuerpoHtml: string,
  textoDelBoton: string,
  enlace: string,
  pieHtml: string,
): string {
  const base = urlWeb.replace(/\/+$/, "");

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px 12px;background-color:#f7f8fa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2d2d2d;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e4e9;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr style="height:4px;">
                    <td style="background-color:#3db648;height:4px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="background-color:#29abe2;height:4px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="background-color:#f7941d;height:4px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="background-color:#e91e8c;height:4px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:32px 32px 8px;">
                <img src="${base}/logo-ecopac.png" width="64" height="64" alt="Ecopac" style="display:block;border:0;width:64px;height:64px;" />
                <div style="margin-top:12px;font-size:18px;font-weight:700;color:#2d2d2d;letter-spacing:0.01em;">Ecopac Digital</div>
                <div style="margin-top:2px;font-size:12px;color:#7a7a8a;text-transform:uppercase;letter-spacing:0.08em;">Jornadas medicas</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2d2d2d;">${titulo}</h1>
                ${cuerpoHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 8px;">
                <a href="${enlace}" style="background-color:#3db648;border-radius:999px;color:#ffffff;display:inline-block;font-size:15px;font-weight:600;padding:14px 32px;text-decoration:none;">${textoDelBoton}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#7a7a8a;">${pieHtml}</p>
                <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#7a7a8a;">Si el boton no funciona, copia y pega esta direccion en tu navegador:<br /><span style="color:#29abe2;word-break:break-all;">${enlace}</span></p>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;font-size:11px;color:#7a7a8a;">Ecopac Guatemala &middot; Este es un correo automatico, no hace falta responderlo.</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Correo de invitacion a una persona recien dada de alta (issue #864).
 *
 * POR QUE NO LO MANDA SUPABASE. El alta administrativa crea la cuenta sin contrasena y despues
 * habia que mandar un enlace para que la persona eligiera la suya. Eso se hacia con
 * `resetPasswordForEmail()`, que dispara la plantilla `recovery` de GoTrue -- **la misma que usa
 * "olvide mi contrasena"**. Resultado: a quien estrenaba su cuenta le llegaba un "restablece tu
 * contrasena", en ingles y de "Admin <admin@email.com>", de una contrasena que nunca tuvo. Y no
 * habia forma de distinguirlos cambiando la plantilla, porque es una sola para los dos casos.
 *
 * Con este correo propio, la plantilla `recovery` queda dedicada a lo unico que le corresponde
 * -- recuperar el acceso de quien ya tenia cuenta -- y la invitacion dice lo que es.
 *
 * @param nombres Nombre de pila de quien recibe la invitacion; puede venir vacio.
 * @param enlace El action link que devuelve `admin.generateLink()`, ya con su redirectTo.
 */
export function componerCorreoDeInvitacion(
  nombres: string,
  enlace: string,
  urlWeb: string,
): Correo {
  const saludo = nombres ? `Hola, ${nombres}:` : "Hola:";
  const cuerpo =
    "Te dieron de alta en Ecopac Digital, el sistema con el que la organizacion lleva las " +
    "jornadas medicas, el inventario y los expedientes de los pacientes.";
  const instruccion =
    "Para entrar por primera vez solo falta un paso: elegir la contrasena con la que vas a " +
    "iniciar sesion.";
  const pie =
    "Si no esperabas este correo puedes ignorarlo: mientras no elijas una contrasena, la " +
    "cuenta no se puede usar. El enlace caduca por seguridad; si ya no funciona, pide uno " +
    "nuevo desde \u00abOlvidaste tu contrasena?\u00bb en la pantalla de inicio de sesion.";

  return {
    asunto: "Te damos la bienvenida a Ecopac Digital",
    texto: [
      saludo,
      "",
      cuerpo,
      "",
      instruccion,
      "",
      `Elegir mi contrasena: ${enlace}`,
      "",
      pie,
    ].join("\n"),
    html: envolverEnPlantilla(
      urlWeb,
      "Te damos la bienvenida",
      [
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escaparHtml(saludo)}</p>`,
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escaparHtml(cuerpo)}</p>`,
        `<p style="margin:0;font-size:15px;line-height:1.6;">${escaparHtml(instruccion)}</p>`,
      ].join("\n"),
      "Elegir mi contrase&ntilde;a",
      enlace,
      escaparHtml(pie),
    ),
  };
}

export type ConfiguracionSmtp = {
  host: string;
  puerto: number;
  usuario?: string;
  contrasena?: string;
  remitente: string;
  urlWeb: string;
};

/**
 * Lee la configuracion SMTP del entorno de la funcion. Devuelve null si falta lo minimo (host,
 * remitente y la URL de la web): en ese caso no se reclama ninguna notificacion, asi que quedan
 * pendientes para cuando se configure, en vez de marcarse como intentadas sin haber salido.
 *
 * WEB_URL no tiene valor por defecto a proposito: un "http://localhost:5173" de respaldo mandaria
 * desde produccion correos con un enlace que no abre nada, y nadie lo notaria.
 */
export function leerConfiguracionSmtp(): ConfiguracionSmtp | null {
  const host = Deno.env.get("SMTP_HOST");
  const remitente = Deno.env.get("SMTP_FROM");
  const urlWeb = Deno.env.get("WEB_URL");
  if (!host || !remitente || !urlWeb) return null;

  return {
    host,
    puerto: Number(Deno.env.get("SMTP_PORT") ?? "465"),
    usuario: Deno.env.get("SMTP_USER") || undefined,
    contrasena: Deno.env.get("SMTP_PASS") || undefined,
    remitente,
    urlWeb,
  };
}

// Solo lo que se usa de nodemailer y de supabase-js: permite probar con dobles sin red.
export type Transporte = {
  sendMail(mensaje: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
};

type ClienteSupabase = {
  rpc(
    funcion: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(tabla: string): {
    update(valores: Record<string, unknown>): {
      in(columna: string, valores: string[]): PromiseLike<{ error: { message: string } | null }>;
      eq(columna: string, valor: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export function crearTransporte(config: ConfiguracionSmtp): Transporte {
  return nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    // 465 es SMTPS (TLS desde el primer byte). Es ademas el unico puerto de envio que las Edge
    // Functions de Supabase dejan abrir: 25 y 587 estan bloqueados en el proyecto hospedado.
    secure: config.puerto === 465,
    auth: config.usuario ? { user: config.usuario, pass: config.contrasena } : undefined,
  });
}

export type ResultadoDeEnvio = {
  correo: "enviado" | "sin configurar" | "error";
  correosEnviados: number;
  correosFallidos: number;
};

const TAMANO_DE_LOTE = 50;
const LOTES_POR_CORRIDA = 10;

/**
 * Reclama las notificaciones sin correo (fn_reclamar_correos_de_notificaciones, 00138) y manda un
 * correo por cada una, en orden de llegada. Solo marca correo_enviado_en en las que el servidor
 * SMTP acepto: una que fallo guarda el motivo en correo_error y se reintenta en la siguiente
 * corrida pasados 15 minutos.
 */
export async function enviarCorreosPendientes(
  supabase: ClienteSupabase,
  config: ConfiguracionSmtp | null,
  transporte: Transporte | null = config ? crearTransporte(config) : null,
): Promise<ResultadoDeEnvio> {
  if (!config || !transporte) {
    return { correo: "sin configurar", correosEnviados: 0, correosFallidos: 0 };
  }

  let correosEnviados = 0;
  let correosFallidos = 0;

  for (let lote = 0; lote < LOTES_POR_CORRIDA; lote += 1) {
    const { data, error } = await supabase.rpc("fn_reclamar_correos_de_notificaciones", {
      p_limite: TAMANO_DE_LOTE,
    });
    if (error) throw new Error(`fn_reclamar_correos_de_notificaciones fallo: ${error.message}`);

    const pendientes = (data ?? []) as NotificacionParaCorreo[];
    if (pendientes.length === 0) break;

    const enviadas: string[] = [];
    for (const notificacion of pendientes) {
      const correo = componerCorreo(notificacion, config.urlWeb);
      try {
        await transporte.sendMail({
          from: config.remitente,
          to: notificacion.email,
          subject: correo.asunto,
          text: correo.texto,
          html: correo.html,
        });
        enviadas.push(notificacion.id);
      } catch (errorDeEnvio) {
        correosFallidos += 1;
        const motivo = errorDeEnvio instanceof Error ? errorDeEnvio.message : String(errorDeEnvio);
        console.error(`enviar-notificaciones: fallo el correo de ${notificacion.id}:`, motivo);
        await supabase
          .from("notificaciones")
          .update({ correo_error: motivo })
          .eq("id", notificacion.id);
      }
    }

    if (enviadas.length > 0) {
      const { error: errorAlMarcar } = await supabase
        .from("notificaciones")
        .update({ correo_enviado_en: new Date().toISOString(), correo_error: null })
        .in("id", enviadas);
      if (errorAlMarcar) {
        throw new Error(`No se pudo marcar los correos enviados: ${errorAlMarcar.message}`);
      }
      correosEnviados += enviadas.length;
    }

    if (pendientes.length < TAMANO_DE_LOTE) break;
  }

  return {
    correo: correosFallidos > 0 ? "error" : "enviado",
    correosEnviados,
    correosFallidos,
  };
}
