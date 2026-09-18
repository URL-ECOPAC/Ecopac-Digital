// Cabeceras CORS para las Edge Functions invocadas desde apps/web con supabase-js
// (functions.invoke() hace un preflight OPTIONS antes del POST real). Sin esto el navegador
// bloquea la respuesta antes de que el codigo de la pantalla la vea.
//
// Access-Control-Allow-Origin era "*" a proposito (issue #691): la autenticacion de estas
// funciones va por header Authorization, no por cookie, asi que un origen abierto no habilitaba
// CSRF. Aun asi no hay razon para no acotarlo a los origenes reales (issue #760), asi que se
// refleja el Origin de la peticion solo si esta en ALLOWED_ORIGINS.
//
// ALLOWED_ORIGINS es un secret de la Edge Function (no de supabase/config.toml: eso solo aplica
// al stack local, ver docs/SEGURIDAD.md), lista de origenes exactos (esquema+host+puerto, sin
// barra final) separados por comas. La app todavia no esta desplegada (no hay dominio real que
// fijar todavia): mientras ALLOWED_ORIGINS no se configure en un ambiente, ningun origen se
// refleja alli y las llamadas desde el navegador quedan bloqueadas por CORS -fail-closed, no
// fail-open-. Configurar el secret real antes o al desplegar por primera vez a cada ambiente:
// `supabase secrets set ALLOWED_ORIGINS=https://dominio-real --project-ref <ref>`.
export function corsHeadersPara(req: Request): Record<string, string> {
  const origenesPermitidos = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);

  const origen = req.headers.get("Origin");
  const encabezados: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // La respuesta varia segun el Origin de la peticion: sin esto, un cache intermedio podria
    // servir la respuesta pensada para un origen a otro distinto.
    Vary: "Origin",
  };

  if (origen && origenesPermitidos.includes(origen)) {
    encabezados["Access-Control-Allow-Origin"] = origen;
  }

  return encabezados;
}
