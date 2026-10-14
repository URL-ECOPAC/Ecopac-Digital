import { useCallback, useEffect, useMemo, useState } from "react";

import { CAMPOS_DONANTE, ESTADOS_DONANTE, OPCIONES_TIPO_DONANTE } from "./campos.js";
import { COLUMNAS_DONANTE } from "./columnas.js";
import {
  darDeBajaDonante,
  listarDonantes,
  obtenerHistoricoDonante,
  reactivarDonante,
  registrarDonante,
  actualizarDonante,
} from "./donantes.api.js";
import { TIPOS_DE_DONANTE } from "../enums.js";
import { FILTROS_DONANTE } from "./filtros.js";
import {
  puedeCorregirDonaciones,
  puedeRegistrarDonaciones,
  puedeVerDonaciones,
} from "./permisos.js";
import { validarDonante } from "./validaciones.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

/** Valor del filtro de tipo que no filtra nada. */
export const TIPO_DONANTE_TODOS = "todos";

/** Valores del filtro de estado. La pantalla arranca en ACTIVOS: lo de todos los dias. */
export const FILTRO_ESTADO_DONANTE = Object.freeze({
  ACTIVOS: "activos",
  INACTIVOS: "inactivos",
  TODOS: "todos",
});

export const OPCIONES_FILTRO_ESTADO_DONANTE = [
  { value: FILTRO_ESTADO_DONANTE.ACTIVOS, label: "Activos" },
  { value: FILTRO_ESTADO_DONANTE.INACTIVOS, label: "Dados de baja" },
  { value: FILTRO_ESTADO_DONANTE.TODOS, label: "Todos" },
];

/** Valores iniciales del formulario de alta/edicion, mismas claves que CAMPOS_DONANTE
 * (campos.js) y que las columnas escribibles de `donantes` (00022). `tipo` arranca en
 * `persona`, mismo default que ya usa el modal de alta rapida de useRegistroDonacion.js. */
const CAMPOS_VACIOS = Object.freeze({
  nombre: "",
  tipo: TIPOS_DE_DONANTE.PERSONA,
  contacto: "",
  telefono: "",
  email: "",
  direccion: "",
});

/**
 * Deja la lista con los donantes que cumplen la busqueda y el filtro de tipo.
 *
 * Es una funcion aparte y exportada para poder probar el filtrado sin montar el hook, igual que
 * hacen combinarResultados() y hayMasResultados() en hooks/useBusquedaPacientes.js:
 * packages/shared corre sin DOM a proposito.
 *
 * El filtrado ocurre en memoria y no en el servidor. listarDonantes() acepta un parametro
 * `busqueda` que hace la busqueda con ilike, pero usarlo aqui dispararia una consulta por
 * tecla: no hay debounce en esta pantalla y el catalogo de donantes de una ONG cabe entero en
 * la primera carga. Si algun dia deja de caber, la salida es reusar useBusquedaPacientes, no
 * agregar una consulta por pulsacion.
 *
 * @param {object[]} donantes
 * @param {string} busqueda
 * @param {string} tipo Uno de TIPOS_DE_DONANTE, o TIPO_DONANTE_TODOS.
 * @param {string} [estado] Uno de FILTRO_ESTADO_DONANTE; sin el, no filtra por estado.
 * @returns {object[]}
 */
export function filtrarDonantes(
  donantes = [],
  busqueda = "",
  tipo = TIPO_DONANTE_TODOS,
  estado = FILTRO_ESTADO_DONANTE.TODOS,
) {
  const termino = busqueda.trim().toLowerCase();

  return donantes.filter((donante) => {
    // Sin termino, la busqueda no descarta a nadie. Antes se comparaba siempre con includes(),
    // asi que un donante sin nombre desaparecia de la lista incluso con la busqueda vacia.
    const coincideNombre =
      termino === "" || (donante?.nombre ?? "").toLowerCase().includes(termino);
    const coincideTipo = tipo === TIPO_DONANTE_TODOS || donante?.tipo === tipo;
    const coincideEstado =
      estado === FILTRO_ESTADO_DONANTE.TODOS ||
      (estado === FILTRO_ESTADO_DONANTE.ACTIVOS) === Boolean(donante?.activo);
    return coincideNombre && coincideTipo && coincideEstado;
  });
}

/**
 * Pantalla de administracion de donantes: listado, filtros, alta, edicion y ficha.
 *
 * Reescrito por la issue #598. La version anterior llamaba a `donantesApi.obtenerDonantes()` y
 * a `donantesApi.obtenerDonantePorId()`, y donantes.api.js no exporta ningun objeto
 * `donantesApi` ni esas dos funciones: el hook estaba escrito contra una API que nunca existio,
 * y por eso no se podia ni exportar desde el barril sin romper la compilacion de la web.
 *
 * Tampoco recibe ya el cliente de Supabase en una prop `client`. Lo resuelve donantes.api.js
 * con obtenerSupabase(), que es la regla del repositorio: las apps no tocan
 * @supabase/supabase-js y el cliente no viaja por props hasta un componente.
 *
 * `obtenerDonantePorId` no se sustituye por ninguna consulta nueva: el donante ya esta en la
 * lista cargada, asi que la ficha lo toma de ahi y solo va al servidor por lo que no tiene, que
 * es el historico de donaciones.
 *
 * @param {object} opciones
 * @param {string} opciones.usuarioRol Rol de quien mira la pantalla.
 * @returns {object}
 */
export function useDonantesPage({ usuarioRol } = {}) {
  const [donantes, setDonantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(TIPO_DONANTE_TODOS);
  const [filtroEstado, setFiltroEstado] = useState(FILTRO_ESTADO_DONANTE.ACTIVOS);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState(null);

  const [donanteSeleccionado, setDonanteSeleccionado] = useState(null);
  const [historicoDelDonante, setHistoricoDelDonante] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estado del formulario del modal de alta/edicion. Vive aqui, no en DonantesPage.jsx, mismo
  // criterio que useRegistroDonacion.js guarda nuevoDonanteNombre/nuevoDonanteTipo: la pantalla
  // solo renderiza, el hook es dueno del estado (docs/ARQUITECTURA-FRONTEND.md).
  const [valoresFormulario, setValoresFormulario] = useState(CAMPOS_VACIOS);
  const [errorFormulario, setErrorFormulario] = useState(null);

  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);
  // Corregir o dar de baja a un donante no se delega: la politica de UPDATE es de la administradora.
  const puedeCorregir = puedeCorregirDonaciones(usuarioRol);

  const cargarDonantes = useCallback(async () => {
    if (!tieneAccesoLectura) {
      setDonantes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    // Todos, no solo los activos: el filtro de estado decide que se ve. Con soloActivos un donante
    // dado de baja desaparecia de la pantalla y ya no habia como reactivarlo.
    const { datos, error: fallo } = await listarDonantes(
      { soloActivos: false },
      { rolUsuario: usuarioRol },
    );

    if (fallo) {
      setError(fallo);
      setDonantes([]);
    } else {
      setDonantes(datos ?? []);
      setError(null);
    }
    setCargando(false);
  }, [usuarioRol, tieneAccesoLectura]);

  useEffect(() => {
    cargarDonantes();
  }, [cargarDonantes]);

  const donantesFiltrados = useMemo(
    () => filtrarDonantes(donantes, busqueda, filtroTipo, filtroEstado),
    [donantes, busqueda, filtroTipo, filtroEstado],
  );

  const abrirAlta = useCallback(() => {
    if (!puedeEscribir) return;
    setDonanteSeleccionado(null);
    setHistoricoDelDonante(null);
    setModoEdicion(false);
    setValoresFormulario(CAMPOS_VACIOS);
    setErrorFormulario(null);
    setModalAbierto(true);
  }, [puedeEscribir]);

  const abrirEdicion = useCallback(
    (donante) => {
      if (!puedeEscribir) return;
      setDonanteSeleccionado(donante);
      setModoEdicion(true);
      // Solo las columnas escribibles (mismas claves que CAMPOS_DONANTE): id/activo/timestamps
      // de la fila no son parte del formulario.
      setValoresFormulario({
        nombre: donante.nombre ?? "",
        tipo: donante.tipo ?? TIPOS_DE_DONANTE.PERSONA,
        contacto: donante.contacto ?? "",
        telefono: donante.telefono ?? "",
        email: donante.email ?? "",
        direccion: donante.direccion ?? "",
      });
      setErrorFormulario(null);
      setModalAbierto(true);
    },
    [puedeEscribir],
  );

  const setCampoFormulario = useCallback((campo, valor) => {
    setValoresFormulario((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const cerrarModal = useCallback(() => {
    setModalAbierto(false);
    setModoEdicion(false);
    setValoresFormulario(CAMPOS_VACIOS);
    setErrorFormulario(null);
  }, []);

  /**
   * Abre la ficha de un donante que ya esta en la lista y le trae su historico.
   *
   * Si el historico falla, la ficha se abre igual con los datos del donante: no poder mostrar
   * cuanto ha donado no es motivo para no mostrar quien es.
   */
  const verFicha = useCallback(
    async (donanteId) => {
      const donante = donantes.find((candidato) => candidato.id === donanteId) ?? null;
      setDonanteSeleccionado(donante);
      setHistoricoDelDonante(null);
      setErrorEstado(null);

      if (!donante || !tieneAccesoLectura) return;

      const { datos } = await obtenerHistoricoDonante(donanteId, { rolUsuario: usuarioRol });
      setHistoricoDelDonante(datos ?? null);
    },
    [donantes, usuarioRol, tieneAccesoLectura],
  );

  /**
   * Guarda el donante del modal: lo registra si es un alta, lo actualiza si es una edicion.
   *
   * Valida con `validarDonante()` antes de escribir, mismo criterio que `guardarDonacion()` en
   * useRegistroDonacion.js con `validarDonacion()`: si hay errores no llega a Supabase.
   * `validarDonante()` ya existia sin consumidor (comentario de campos.js:84-85, "la regla se
   * queda en validarDonante(), no aqui") porque este hook nunca la llamaba.
   *
   * Devuelve `{ ok, error }` para que la pantalla decida si cierra el modal o deja los datos
   * escritos para corregirlos. El error tambien queda en `errorFormulario`, que es lo que lee el
   * modal para mostrarlo.
   */
  const guardarDonante = useCallback(
    async (datosDelFormulario) => {
      const editando = modoEdicion && donanteSeleccionado;
      if (editando ? !puedeCorregir : !puedeEscribir) {
        const error = {
          mensaje: editando
            ? "Solo la administradora corrige los datos de un donante."
            : "No tienes permiso para registrar donantes.",
        };
        setErrorFormulario(error);
        return { ok: false, error };
      }

      const erroresDeValidacion = validarDonante(datosDelFormulario);
      if (Object.keys(erroresDeValidacion).length > 0) {
        const error = {
          mensaje: "Revisa los datos del formulario antes de guardar.",
          campos: erroresDeValidacion,
        };
        setErrorFormulario(error);
        return { ok: false, error };
      }

      setGuardando(true);
      const respuesta =
        modoEdicion && donanteSeleccionado
          ? await actualizarDonante(donanteSeleccionado.id, datosDelFormulario, {
              rolUsuario: usuarioRol,
            })
          : await registrarDonante(datosDelFormulario, { rolUsuario: usuarioRol });
      setGuardando(false);

      if (respuesta.error) {
        setErrorFormulario(respuesta.error);
        return { ok: false, error: respuesta.error };
      }

      await cargarDonantes();
      cerrarModal();
      return { ok: true, error: null };
    },
    [
      puedeEscribir,
      puedeCorregir,
      modoEdicion,
      donanteSeleccionado,
      usuarioRol,
      cargarDonantes,
      cerrarModal,
    ],
  );

  /**
   * Da de baja a un donante (`activo` false) o lo reactiva (`activo` true). Es baja logica: la
   * fila y su historico se quedan, y un donante dado de baja deja de ofrecerse al registrar una
   * donacion (useRegistroDonacion lista solo activos).
   *
   * La ficha abierta se actualiza con la fila que devuelve el servidor, para que el estado y el
   * boton cambien sin cerrarla.
   */
  const cambiarEstadoDonante = useCallback(
    async (donanteId, activo) => {
      if (!puedeCorregir) {
        const error = { mensaje: "Solo la administradora da de baja o reactiva a un donante." };
        setErrorEstado(error);
        return { ok: false, error };
      }

      setCambiandoEstado(true);
      setErrorEstado(null);
      const accion = activo ? reactivarDonante : darDeBajaDonante;
      const { datos, error: fallo } = await accion(donanteId, { rolUsuario: usuarioRol });
      setCambiandoEstado(false);

      if (fallo) {
        setErrorEstado(fallo);
        return { ok: false, error: fallo };
      }

      setDonanteSeleccionado((actual) =>
        actual?.id === donanteId ? { ...actual, ...datos } : actual,
      );
      await cargarDonantes();
      return { ok: true, error: null };
    },
    [puedeCorregir, usuarioRol, cargarDonantes],
  );

  const darDeBaja = useCallback(
    (donanteId) => cambiarEstadoDonante(donanteId, false),
    [cambiarEstadoDonante],
  );
  const reactivar = useCallback(
    (donanteId) => cambiarEstadoDonante(donanteId, true),
    [cambiarEstadoDonante],
  );

  // Se recarga sola cuando cambian estas tablas (00163).
  useCambiosEnTiempoReal(["donantes", "donaciones", "donacion_detalle"], cargarDonantes);

  return {
    permisos: { tieneAccesoLectura, puedeEscribir, puedeCorregir },
    cargando,
    guardando,
    error,
    columnas: COLUMNAS_DONANTE,
    filtrosSpec: FILTROS_DONANTE,
    camposSpec: CAMPOS_DONANTE,
    // Catalogos que DataList resuelve por nombre desde COLUMNAS_DONANTE (etiquetasDesde:
    // 'tiposDeDonante'/'estadoDonante'), mismo patron que useUsuariosListado.js -> catalogos.
    // Los dos ya existian en campos.js sin ningun consumidor: la tabla nunca los pidio porque
    // DonantesPage.jsx armaba la tabla a mano en vez de usar DataList.
    catalogos: {
      tiposDeDonante: OPCIONES_TIPO_DONANTE,
      estadoDonante: ESTADOS_DONANTE,
    },
    donantes: donantesFiltrados,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    filtroEstado,
    setFiltroEstado,
    opcionesFiltroEstado: OPCIONES_FILTRO_ESTADO_DONANTE,
    modalAbierto,
    setModalAbierto,
    cerrarModal,
    donanteSeleccionado,
    historicoDelDonante,
    modoEdicion,
    valoresFormulario,
    setCampoFormulario,
    errorFormulario,
    abrirAlta,
    abrirEdicion,
    verFicha,
    guardarDonante,
    darDeBaja,
    reactivar,
    cambiandoEstado,
    errorEstado,
    recargar: cargarDonantes,
  };
}
