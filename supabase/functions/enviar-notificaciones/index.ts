// Ecopac Digital - Edge Function que manda por correo las notificaciones al administrador
// (issue #755).
//
// DISPARO: el trigger trg_notificaciones_disparar_correo (00138) la llama con pg_net en cuanto se
// registra una incidencia, con la URL y la llave de servicio guardadas en Supabase Vault. La
// rutina diaria (alertas-vencimiento) hace el mismo barrido como reintento, asi que un correo que
// no salio por el webhook sale a mas tardar al dia siguiente.
//
// Barre TODO lo pendiente, no una notificacion concreta: el webhook no manda ids. Asi no importa
// si una llamada se pierde o si dos coinciden: fn_reclamar_correos_de_notificaciones() reparte las
// filas sin que ninguna salga dos veces.
//
// AUTENTICACION: el mismo esquema de dos capas que alertas-vencimiento/index.ts -el runtime exige
// un JWT valido, y aqui se exige ademas que sea exactamente la llave de servicio-.

import { createClient } from "@supabase/supabase-js";
import { enviarCorreosPendientes, leerConfiguracionSmtp } from "../_shared/correo.ts";

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const llaveDeServicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const autorizacion = req.headers.get("Authorization") ?? "";

  if (!llaveDeServicio || autorizacion !== `Bearer ${llaveDeServicio}`) {
    return responder({ error: "No autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("enviar-notificaciones: falta SUPABASE_URL en el entorno de la funcion.");
    return responder({ error: "Configuracion incompleta del entorno." }, 500);
  }

  const supabase = createClient(supabaseUrl, llaveDeServicio);

  try {
    const resultado = await enviarCorreosPendientes(supabase, leerConfiguracionSmtp());
    console.log(
      `enviar-notificaciones: correo ${resultado.correo}, ${resultado.correosEnviados} enviado(s), ` +
        `${resultado.correosFallidos} fallido(s).`,
    );
    return responder(resultado);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error("enviar-notificaciones:", mensaje);
    return responder({ error: mensaje }, 500);
  }
});
