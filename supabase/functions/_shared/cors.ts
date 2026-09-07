// Cabeceras CORS estandar para las Edge Functions invocadas desde apps/web con
// supabase-js (functions.invoke() hace un preflight OPTIONS antes del POST real).
// Sin esto el navegador bloquea la respuesta antes de que el codigo de la pantalla la vea.
//
// Access-Control-Allow-Origin va en "*" a proposito, por ahora (issue #691). No hay en este
// repo ninguna fuente versionada de origenes permitidos -el Site URL de Supabase se configura a
// mano en el dashboard (docs/QUICKSTART.md)-, y la autenticacion de estas funciones va por
// header Authorization, no por cookie, asi que un origen abierto no habilita CSRF. Acotar esto a
// un dominio real es el alcance de la issue #241 (revision OWASP A05 de configuracion).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
