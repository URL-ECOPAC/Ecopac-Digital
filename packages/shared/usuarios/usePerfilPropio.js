// View model de la pantalla de perfil propio y cambio de contrasena (issue #102).
//
// No llama a useSesion() por su cuenta: recibe `usuario`, `perfil` y `refrescarPerfil` de quien
// la usa (en la web, useSesionCompartida()). Abrir una segunda suscripcion a la sesion aqui
// dentro repetiria exactamente el problema que SesionProvider.jsx ya documenta resolver: dos
// lecturas de perfil que se resuelven a distinto ritmo (ver
// apps/web/src/contexto/SesionProvider.jsx y docs/ARQUITECTURA-FRONTEND.md).

import { useCallback, useEffect, useMemo, useState } from "react";

import { obtenerSupabase } from "../api/cliente.js";
import { CODIGOS_DE_ERROR_DE_SUPABASE, normalizarError } from "../api/errores-de-supabase.js";
import { actualizarUsuario, obtenerEspecialidadesDePerfil, reverificarContrasena } from "./api.js";
import { CAMPOS_USUARIO } from "./campos.js";
import { esAdministrador } from "./roles.js";
import { validarCambioContrasena } from "./validaciones.js";

/**
 * Ids de CAMPOS_USUARIO que esta pantalla muestra, EN EL MISMO ORDEN en que campos.js ya los
 * declara (nombres, apellidos, email, telefono, rol, especialidades). fechaIngreso y activo
 * quedan fuera: el issue no pide mostrarlos aqui.
 */
const IDS_CAMPOS_PERFIL_PROPIO = ["nombres", "apellidos", "email", "telefono", "rol", "especialidades"];

/** Ids editables por cualquier rol, sin condicion (criterio 2 del issue #102). */
const IDS_SIEMPRE_EDITABLES = new Set(["nombres", "apellidos", "telefono"]);

function campoUsuario(id) {
  return CAMPOS_USUARIO.find((campo) => campo.id === id);
}

/**
 * Arma los descriptores de campo que dibuja la pantalla, reutilizando la etiqueta y el `tipo`
 * que CAMPOS_USUARIO ya declara para cada uno: ni el hook ni el JSX escriben una etiqueta nueva.
 *
 * `editable` es la unica decision que esta pantalla agrega por encima del descriptor
 * compartido: nombres/apellidos/telefono siempre; rol solo si `esAdmin` (criterio 3); correo y
 * especialidades nunca. A proposito NO se usa `campo.permiso`
 * ('usuarios.gestionar_permisos', campos.js:47) para decidir el rol: ese metadato no tiene
 * consumidor todavia y no es lo mismo que "ser administrador" — tener la misma regla escrita en
 * dos lugares garantiza que un dia digan cosas distintas.
 *
 * Funcion pura y exportada aparte del hook para poder probarla sin montar un componente: este
 * paquete corre vitest con environment "node" (mismo motivo que nombreCompletoDe() en
 * useUsuariosListado.js).
 *
 * @param {boolean} esAdmin
 * @returns {Array<object>} Los descriptores de CAMPOS_USUARIO que aplican, con `editable` agregado.
 */
export function camposDePerfilPropio(esAdmin) {
  return IDS_CAMPOS_PERFIL_PROPIO.map((id) => {
    const campo = campoUsuario(id);
    const editable = IDS_SIEMPRE_EDITABLES.has(id) || (id === "rol" && Boolean(esAdmin));
    return { ...campo, editable };
  });
}

/**
 * Valores iniciales (y de reinicio) del formulario, a partir del perfil de la sesion.
 *
 * Incluye `email` aunque nunca se envie a guardar (datosParaGuardarPerfil() no lo toma): esta
 * aqui solo para que la pantalla tenga de donde leer el TextField deshabilitado del correo sin
 * volver a bifurcar entre "leer de valores" y "leer de perfil" segun el campo.
 *
 * @param {object|null} perfil
 * @returns {{ nombres: string, apellidos: string, email: string, telefono: string,
 *   rol: string|null }}
 */
export function valoresIniciales(perfil) {
  return {
    nombres: perfil?.nombres ?? "",
    apellidos: perfil?.apellidos ?? "",
    email: perfil?.email ?? "",
    telefono: perfil?.telefono ?? "",
    rol: perfil?.rol ?? null,
  };
}

/**
 * Datos que se envian a actualizarUsuario(): nombres/apellidos/telefono siempre, rol solo si
 * `esAdmin` (criterio 3). Omitir `rol` para quien no es administrador es una eleccion, no algo
 * de lo que dependa la seguridad: aunque se mandara, el trigger `impedir_cambio_de_rol_propio`
 * (migracion 00038) solo bloquea un valor DISTINTO al que ya tenia, y quien no es administrador
 * nunca tiene forma de cambiar `valores.rol` en esta pantalla (el Selector ni se dibuja, ver
 * camposDePerfilPropio). La defensa real sigue siendo el trigger, esto es solo no mandar una
 * columna que no hace falta tocar.
 *
 * @param {{ nombres: string, apellidos: string, telefono: string, rol: string|null }} valores
 * @param {boolean} esAdmin
 */
export function datosParaGuardarPerfil(valores, esAdmin) {
  const { nombres, apellidos, telefono, rol } = valores;
  return esAdmin ? { nombres, apellidos, telefono, rol } : { nombres, apellidos, telefono };
}

const VALORES_CONTRASENA_VACIOS = { actual: "", nueva: "", confirmarNueva: "" };

/**
 * View model de la pantalla de perfil propio.
 *
 * Guardar el perfil llama a `refrescarPerfil()` (useSesion, issue #98) al terminar: un UPDATE a
 * `perfiles` no dispara ningun evento de Supabase Auth por su cuenta, asi que sin este llamado
 * la barra lateral se quedaria mostrando el nombre/rol viejo hasta el proximo evento de sesion
 * (criterio 5). Se relee de la base en vez de asumir que lo que se mando a guardar es lo que
 * quedo: si RLS o el trigger de rol rechazaron algo, la barra tiene que reflejar lo que de
 * verdad hay en la base.
 *
 * El cambio de contrasena reverifica la actual con reverificarContrasena() (usuarios/api.js)
 * antes de llamar a `auth.updateUser()`: Supabase no tiene un endpoint dedicado para "confirmar
 * la contrasena de quien ya tiene sesion", asi que reverificarContrasena() se autentica de
 * nuevo con ella (ver su comentario en api.js para el detalle de por que eso no rompe ni
 * parpadea la sesion vigente). La sesion se mantiene activa despues de un cambio exitoso: no se
 * cierra la sesion actual ni las de otros dispositivos, porque el issue no lo pide.
 *
 * @param {{
 *   usuario: {id: string}|null,
 *   perfil: {email?: string, nombres?: string, apellidos?: string, telefono?: string,
 *     rol?: string}|null,
 *   refrescarPerfil: () => Promise<void>,
 * }} sesion Lo que la pantalla ya lee de useSesionCompartida() (o useSesion() en movil).
 */
export function usePerfilPropio({ usuario, perfil, refrescarPerfil }) {
  const esAdmin = esAdministrador(perfil?.rol);
  const campos = useMemo(() => camposDePerfilPropio(esAdmin), [esAdmin]);

  const [valores, setValores] = useState(() => valoresIniciales(perfil));
  const [erroresDeCampo, setErroresDeCampo] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState(null);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  // Deliberadamente [perfil?.id] y no [perfil]: esta misma pantalla tiene, debajo, un segundo
  // formulario (cambiar contrasena) que comparte esta sesion. Cambiar la contrasena dispara
  // USER_UPDATED (auth.updateUser()), y useSesion() reacciona a ese evento releyendo el perfil
  // con aplicarSesion() - un objeto NUEVO, mismo id, misma data (ver useSesion.js). Si este
  // efecto dependiera de "perfil" a secas, esa relectura reiniciaria nombres/apellidos/telefono
  // a lo ultimo guardado en la base justo mientras la persona podria estar a mitad de escribir
  // un cambio en el otro formulario, borrandoselo sin que haya guardado nada todavia.
  // perfil.id es lo unico que de verdad tiene que reiniciar el formulario: identifica "es la
  // misma persona", y solo cambia al montar la pantalla.
  useEffect(() => {
    setValores(valoresIniciales(perfil));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const [especialidades, setEspecialidades] = useState([]);
  const [cargandoEspecialidades, setCargandoEspecialidades] = useState(true);

  useEffect(() => {
    let vigente = true;

    if (!usuario?.id) {
      setEspecialidades([]);
      setCargandoEspecialidades(false);
      return undefined;
    }

    setCargandoEspecialidades(true);
    obtenerEspecialidadesDePerfil(usuario.id).then(({ especialidades: lista }) => {
      // Una lista vacia no es un error: RLS filtra sin avisar (mismo criterio que
      // obtenerEspecialidadesDePerfil() documenta en api.js), asi que no hace falta -ni se
      // puede- distinguir aqui "sin especialidades" de "RLS las escondio".
      if (vigente) {
        setEspecialidades(lista ?? []);
        setCargandoEspecialidades(false);
      }
    });

    return () => {
      vigente = false;
    };
  }, [usuario?.id]);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const guardarPerfil = useCallback(
    async (evento) => {
      evento?.preventDefault?.();

      setErrorGlobal(null);
      setGuardadoExitoso(false);
      setGuardando(true);

      const datos = datosParaGuardarPerfil(valores, esAdmin);
      const { errores, error } = await actualizarUsuario(usuario?.id, datos);

      if (error) {
        if (errores && Object.keys(errores).length > 0) {
          setErroresDeCampo(errores);
        } else {
          setErrorGlobal(error.mensaje);
        }
        setGuardando(false);
        return;
      }

      setErroresDeCampo({});
      await refrescarPerfil();
      setGuardando(false);
      setGuardadoExitoso(true);
    },
    [valores, esAdmin, usuario?.id, refrescarPerfil],
  );

  // --- Cambio de contrasena (criterio 4) ---

  const [contrasena, setContrasena] = useState(VALORES_CONTRASENA_VACIOS);
  const [erroresDeContrasena, setErroresDeContrasena] = useState({});
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [errorGlobalDeContrasena, setErrorGlobalDeContrasena] = useState(null);
  const [contrasenaCambiada, setContrasenaCambiada] = useState(false);

  const setCampoDeContrasena = useCallback((id, valor) => {
    setContrasenaCambiada(false);
    setContrasena((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const cambiarContrasena = useCallback(
    async (evento) => {
      evento?.preventDefault?.();

      setErrorGlobalDeContrasena(null);
      setContrasenaCambiada(false);

      const errores = validarCambioContrasena(contrasena);
      setErroresDeContrasena(errores);
      if (Object.keys(errores).length > 0) return;

      setCambiandoContrasena(true);

      const { valida, error: errorDeReverificacion } = await reverificarContrasena(
        perfil?.email,
        contrasena.actual,
      );

      if (!valida) {
        const esActualIncorrecta =
          errorDeReverificacion?.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS;

        // CREDENCIALES_INVALIDAS trae el mensaje generico de login ("El correo o la contrasena
        // no son correctos."): aqui no hay campo de correo, asi que se muestra un texto propio
        // bajo el campo en vez de error.mensaje. Cualquier otro codigo (red, desconocido) si usa
        // el mensaje normalizado tal cual, igual que el resto del proyecto.
        if (esActualIncorrecta) {
          setErroresDeContrasena({ actual: "La contrasena actual no es correcta." });
        } else {
          setErrorGlobalDeContrasena(
            errorDeReverificacion?.mensaje ?? "No se pudo confirmar tu contrasena actual.",
          );
        }
        setCambiandoContrasena(false);
        return;
      }

      try {
        const { error } = await obtenerSupabase().auth.updateUser({ password: contrasena.nueva });

        if (error) {
          setErrorGlobalDeContrasena(normalizarError(error).mensaje);
          return;
        }

        setContrasena(VALORES_CONTRASENA_VACIOS);
        setContrasenaCambiada(true);
      } catch (error) {
        setErrorGlobalDeContrasena(normalizarError(error).mensaje);
      } finally {
        setCambiandoContrasena(false);
      }
    },
    [contrasena, perfil?.email],
  );

  return {
    campos,
    valores,
    setCampo,
    erroresDeCampo,
    guardando,
    errorGlobal,
    guardadoExitoso,
    guardarPerfil,

    especialidades,
    cargandoEspecialidades,

    esAdministrador: esAdmin,

    contrasena,
    setCampoDeContrasena,
    erroresDeContrasena,
    cambiandoContrasena,
    errorGlobalDeContrasena,
    contrasenaCambiada,
    cambiarContrasena,
  };
}
