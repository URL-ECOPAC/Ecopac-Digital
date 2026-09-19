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
