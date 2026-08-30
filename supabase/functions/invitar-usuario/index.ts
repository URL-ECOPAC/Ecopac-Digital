// Da de alta a una persona nueva (issue #523).
//
// packages/shared/usuarios/api.js -> crearUsuario() invoca esta funcion via functions.invoke(),
// que le adjunta el JWT de quien esta conectado como cabecera Authorization. El unico trabajo de
// fila (auth.users, auth.identities, perfiles.rol) lo hace fn_crear_usuario_administrativo()
// (migracion 00074, SECURITY DEFINER, REVOKE ALL FROM PUBLIC): esta funcion valida quien llama,
// la reutiliza con la llave de servicio -la unica forma de invocarla- y dispara el correo para
// establecer contrasena. No reimplementa el alta con la Admin API a proposito (ver la issue).
//
// Contrato de respuesta, exigido por normalizarError() en packages/shared/api/errores-de-supabase.js:
// un error siempre es { code, message } en el cuerpo JSON, con `code` un SQLSTATE (o el mismo
// que ya levanta fn_crear_usuario_administrativo), para que el cliente lo clasifique sin
// adivinar. crearUsuario() desempaca ese cuerpo desde error.context antes de normalizar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

// Mismo shape que COLUMNAS_DEL_PERFIL en packages/shared/usuarios/api.js. Se duplica: esta
// funcion corre en Deno, fuera del bundle de shared, y las Edge Functions de este proyecto
// todavia no comparten codigo con packages/ (ver docs/SEGURIDAD.md y la nota de alcance de la
// issue #523 sobre el despliegue).
const COLUMNAS_DEL_PERFIL =
  "id, nombres, apellidos, email, telefono, rol, activo, fechaIngreso:fecha_ingreso";

const CAMPOS_OBLIGATORIOS = ["nombres", "apellidos", "email", "rol"];

function respuestaJson(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function respuestaDeError(status: number, code: string, message: string) {
  return respuestaJson(status, { code, message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respuestaDeError(405, "42601", "Metodo no soportado: use POST.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("invitar-usuario: faltan variables de entorno de Supabase.");
    return respuestaDeError(
      500,
      "desconocido",
      "La funcion no esta configurada correctamente.",
    );
  }

  try {
    // ========================================================================
    // 1. Quien llama tiene que ser administrador. No basta con que el cliente lo compruebe
    //    (ModalAltaUsuario.jsx no tiene ningun chequeo de rol): la autorizacion real va aqui,
    //    contra la fila real de perfiles de quien hizo la peticion.
    // ========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respuestaDeError(401, "42501", "Falta la sesion.");
    }

    const clienteDeQuienLlama = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: errorDeSesion,
    } = await clienteDeQuienLlama.auth.getUser();

    if (errorDeSesion || !user) {
      return respuestaDeError(401, "42501", "La sesion no es valida o expiro.");
    }

    const { data: perfilDeQuienLlama, error: errorDePerfil } =
      await clienteDeQuienLlama
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();

    if (errorDePerfil || perfilDeQuienLlama?.rol !== "administrador") {
      return respuestaDeError(
        403,
        "42501",
        "Solo un administrador puede invitar a una persona nueva.",
      );
    }

    // ========================================================================
    // 2. Datos del body. telefono es el unico opcional: fn_crear_usuario_administrativo() no
    //    tiene parametro para esa columna, se completa aparte mas abajo.
    // ========================================================================
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respuestaDeError(
        400,
        "22P02",
        "El cuerpo de la peticion no es JSON valido.",
      );
    }

    const camposFaltantes = CAMPOS_OBLIGATORIOS.filter(
      (campo) => !body?.[campo] || String(body[campo]).trim() === "",
    );
    if (camposFaltantes.length > 0) {
      return respuestaDeError(
        400,
        "23502",
        `Faltan datos obligatorios: ${camposFaltantes.join(", ")}.`,
      );
    }

    const nombres = String(body.nombres).trim();
    const apellidos = String(body.apellidos).trim();
    const email = String(body.email).trim();
    const rol = String(body.rol).trim();
    const telefono = body.telefono ? String(body.telefono).trim() : null;

    // ========================================================================
    // 3. El alta de verdad: fn_crear_usuario_administrativo() con la llave de servicio, la
    //    unica que puede llamarla (REVOKE ALL FROM PUBLIC en la 00074). Postgres valida `rol`
    //    contra el enum rol_usuario solo: un valor invalido cae en el catch de abajo con
    //    invalid_text_representation (22P02), sin duplicar aqui la lista de roles.
    // ========================================================================
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: idNuevoUsuario, error: errorDeAlta } = await supabaseAdmin
      .rpc(
        "fn_crear_usuario_administrativo",
        {
          p_correo: email,
          p_nombres: nombres,
          p_apellidos: apellidos,
          p_rol: rol,
        },
      );

    if (errorDeAlta) {
      const status = errorDeAlta.code === "23505" ? 409 : 400;
      return respuestaDeError(
        status,
        errorDeAlta.code || "desconocido",
        errorDeAlta.message || "No se pudo dar de alta a la persona.",
      );
    }

    // telefono no lo maneja la RPC: se completa con un UPDATE aparte. No aborta el alta si
    // falla, igual que el correo de abajo: la cuenta ya quedo creada y el telefono se puede
    // completar despues editando el perfil.
    if (telefono) {
      const { error: errorDeTelefono } = await supabaseAdmin
        .from("perfiles")
        .update({ telefono })
        .eq("id", idNuevoUsuario);

      if (errorDeTelefono) {
        console.error(
          "invitar-usuario: no se pudo guardar el telefono:",
          errorDeTelefono.message,
        );
      }
    }

    // ========================================================================
    // 4. Correo para establecer contrasena. Mismo mecanismo que useRestablecerContrasena.js
    //    (packages/shared/usuarios): fn_crear_usuario_administrativo() no fija contrasena a
    //    proposito. Sin redirectTo: la URL de retorno depende de la plataforma (web arma
    //    `${window.location.origin}/nueva-contrasena`, que no existe en Deno), asi que se deja
    //    ganar el Site URL configurado en Supabase Auth, igual que hace ese hook cuando no se
    //    lo pasan. No bloquea el alta si el envio falla.
    // ========================================================================
    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { error: errorDeCorreo } = await supabaseAnon.auth
      .resetPasswordForEmail(email);
    if (errorDeCorreo) {
      console.error(
        "invitar-usuario: no se pudo enviar el correo para establecer contrasena:",
        errorDeCorreo.message,
      );
    }

    // ========================================================================
    // 5. Responder con el perfil completo, no solo el id, para que quien llama (crearUsuario())
    //    tenga los mismos datos que trae cualquier otra lectura de perfiles.
    // ========================================================================
    const { data: perfilCreado } = await supabaseAdmin
      .from("perfiles")
      .select(COLUMNAS_DEL_PERFIL)
      .eq("id", idNuevoUsuario)
      .maybeSingle();

    return respuestaJson(200, perfilCreado ?? { id: idNuevoUsuario });
  } catch (error) {
    console.error("invitar-usuario: error inesperado.", error);
    return respuestaDeError(
      500,
      "desconocido",
      "Ocurrio un error inesperado dando de alta.",
    );
  }
});
