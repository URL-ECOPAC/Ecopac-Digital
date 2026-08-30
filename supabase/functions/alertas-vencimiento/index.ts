// Ecopac Digital - Edge Function programada de alertas de vencimiento (issue #166, RF-19).
//
// Revisa diariamente los lotes con existencia positiva que vencen dentro de 30 dias y genera
// una alerta pendiente por cada uno que todavia no la tenga. La logica de que lote necesita
// alerta -y la garantia de no duplicar- vive en fn_generar_alertas_caducidad() (migracion
// 00088, SQL): esta funcion es un envoltorio delgado que solo la invoca y reporta el resultado.
//
// DISPARO: cron externo (.github/workflows/alertas-vencimiento.yml), no pg_cron -- el proyecto
// esta en el plan gratuito de Supabase, que no lo incluye.
//
// POR QUE Deno.serve() Y createClient() EXPLICITOS, NO EL TEMPLATE `withSupabase` NUEVO
//
// `supabase functions new` genera hoy un boilerplate con un helper `withSupabase({ auth: [...]
// })` cuyo contrato exacto (que trae `ctx`, si "secret" mapea 1:1 a SUPABASE_SERVICE_ROLE_KEY o
// es parte de un sistema de llaves nuevo que este proyecto todavia no adopta) no se pudo
// verificar del todo. Deno.serve(), createClient() (importado via el import map de
// supabase/functions/deno.json, igual que invitar-usuario/index.ts, issue #523) y
// Deno.env.get() son las primitivas estables y documentadas desde hace años, sin ambiguedad de
// import ni de contrato: se prefiere lo verificable a lo nuevo sin confirmar. Es ademas el mismo
// patron que ya eligio invitar-usuario de forma independiente.
//
// AUTENTICACION, EN DOS CAPAS
//
// 1. El runtime de Edge Functions exige un JWT valido por defecto (verify_jwt, no se apaga en
//    supabase/config.toml): un caller sin Authorization valido nunca llega a este codigo.
// 2. Aqui se exige ademas que ese JWT sea exactamente la llave de servicio: es el mismo secreto
//    que esta funcion necesita para llamar a fn_generar_alertas_caducidad() (SECURITY DEFINER,
//    sin GRANT a authenticated/anon, 00088), asi que un JWT valido pero de otro origen -por
//    ejemplo la llave anonima, que si pasa la capa 1- no alcanza para disparar la rutina.

import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req: Request) => {
  const llaveDeServicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const autorizacion = req.headers.get("Authorization") ?? "";

  if (!llaveDeServicio || autorizacion !== `Bearer ${llaveDeServicio}`) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("alertas-vencimiento: falta SUPABASE_URL en el entorno de la funcion.");
    return new Response(JSON.stringify({ error: "Configuracion incompleta del entorno." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, llaveDeServicio);

  const { data, error } = await supabase.rpc("fn_generar_alertas_caducidad");

  if (error) {
    // Se registra completo en los logs de la funcion (Supabase los captura); no queda ninguna
    // ejecucion a medias porque fn_generar_alertas_caducidad() es una sola sentencia SQL
    // atomica -- un fallo no inserta nada, no hay estado parcial que limpiar aqui.
    console.error("alertas-vencimiento: fn_generar_alertas_caducidad fallo.", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`alertas-vencimiento: ${data} alerta(s) nueva(s) generada(s).`);

  return new Response(JSON.stringify({ alertasGeneradas: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
