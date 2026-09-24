// Comprueba que un proyecto de Supabase respeta el `redirect_to` que manda la app al pedir un
// correo de "olvide mi contrasena" (issue #875).
//
// POR QUE HACE FALTA. GoTrue no rechaza un `redirect_to` que no este en la lista de
// redirecciones permitidas: lo descarta en silencio y usa el `site_url`. El sintoma no es un
// error, es que el correo llega y abre la web en vez de la app movil. Y la trampa concreta: el
// comodin "*" de `additional_redirect_urls` NO cubre un esquema propio como `ecopac://`, asi que
// una lista que parece abierta igual lo descarta.
//
// USO
//   npm run verificar:redireccion -- <url> <clave-publicable> <correo> [redirect_to]
//
//   npm run verificar:redireccion -- http://127.0.0.1:54421 sb_publishable_... medico.demo@ecopac.test
//
// Contra el stack local lee el enlace en Mailpit y dice si el `redirect_to` sobrevivio. Contra un
// proyecto remoto no hay bandeja que leer: informa que el correo salio y que hay que abrirlo.
//
// MANDA UN CORREO DE VERDAD a la cuenta indicada. Contra produccion, usar una cuenta de prueba.

const [, , url, clave, correo, redireccion = "ecopac://recuperar"] = process.argv;

if (!url || !clave || !correo) {
  console.error(
    "Uso: npm run verificar:redireccion -- <url> <clave-publicable> <correo> [redirect_to]",
  );
  process.exit(1);
}

const esLocal = url.includes("127.0.0.1") || url.includes("localhost");
const MAILPIT = "http://127.0.0.1:54424";

function salir(ok, mensaje, detalle) {
  console.log(`\n${ok ? "OK" : "FALLA"}: ${mensaje}`);
  if (detalle) console.log(`\n${detalle}`);
  process.exit(ok ? 0 : 1);
}

const antes = esLocal ? await contarCorreos() : 0;

const respuesta = await fetch(
  `${url.replace(/\/$/, "")}/auth/v1/recover?redirect_to=${encodeURIComponent(redireccion)}`,
  {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo }),
  },
);

if (!respuesta.ok) {
  salir(false, `el proyecto respondio ${respuesta.status} al pedir el correo de recuperacion.`);
}

console.log(`Correo de recuperacion pedido para ${correo} con redirect_to=${redireccion}`);

if (!esLocal) {
  salir(
    true,
    "el proyecto acepto la peticion.",
    `No puedo leer la bandeja de un proyecto remoto: abri el correo que acaba de llegar a
${correo} y mira el enlace. Tiene que terminar en:

  redirect_to=${redireccion}

Si termina en el Site URL del proyecto, falta registrar "${redireccion}" en
Authentication > URL Configuration > Redirect URLs (ver docs/SEGURIDAD.md, seccion 5).`,
  );
}

await new Promise((ok) => setTimeout(ok, 4000));

const mensajes = await (await fetch(`${MAILPIT}/api/v1/messages?limit=5`)).json();
if (mensajes.messages.length <= antes) {
  salir(false, "no llego ningun correo nuevo a Mailpit. Esta corriendo el stack local?");
}

const detalle = await (await fetch(`${MAILPIT}/api/v1/message/${mensajes.messages[0].ID}`)).json();
const cuerpo = (detalle.HTML || detalle.Text || "").replace(/&amp;/g, "&");
const enlace = cuerpo.match(/https?:\/\/[^"\s<>]*\/auth\/v1\/verify[^"\s<>]*/)?.[0];

if (!enlace) salir(false, "el correo llego pero no encontre en el un enlace de verificacion.");

const llega = decodeURIComponent(enlace.match(/redirect_to=([^&"\s]+)/)?.[1] ?? "");

if (llega === redireccion) {
  salir(true, `el proyecto respeta el redirect_to: el enlace lleva "${llega}".`);
}

salir(
  false,
  `el proyecto NO respeta el redirect_to.`,
  `Se pidio:  ${redireccion}
Llego:     ${llega || "(ninguno)"}

Ese valor es el Site URL del proyecto: GoTrue descarto el que se pidio porque no esta en la
lista de redirecciones permitidas. Agrega "${redireccion}" (o su comodin, por ejemplo
"ecopac://*") a additional_redirect_urls en supabase/config.toml si es el stack local, o a
Authentication > URL Configuration > Redirect URLs si es un proyecto remoto.

Ojo: el comodin "*" NO cubre esquemas propios como ecopac://. Hay que listarlo aparte.`,
);

async function contarCorreos() {
  try {
    const respuesta = await fetch(`${MAILPIT}/api/v1/messages?limit=1`);
    return (await respuesta.json()).messages_count ?? 0;
  } catch {
    return 0;
  }
}
