// Cabeceras CORS estandar para las Edge Functions invocadas desde apps/web con
// supabase-js (functions.invoke() hace un preflight OPTIONS antes del POST real).
// Sin esto el navegador bloquea la respuesta antes de que el codigo de la pantalla la vea.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
