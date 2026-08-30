import { useCallback, useEffect, useMemo, useState } from "react";

import { CAMPOS_DONANTE } from "./campos.js";
import { COLUMNAS_DONANTE } from "./columnas.js";
import {
  darDeBajaDonante,
  listarDonantes,
  obtenerHistoricoDonante,
  registrarDonante,
  actualizarDonante,
} from "./donantes.api.js";
import { FILTROS_DONANTE } from "./filtros.js";
import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";

/** Valor del filtro de tipo que no filtra nada. */
export const TIPO_DONANTE_TODOS = "todos";

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
 * @returns {object[]}
 */
export function filtrarDonantes(donantes = [], busqueda = "", tipo = TIPO_DONANTE_TODOS) {
  const termino = busqueda.trim().toLowerCase();

  return donantes.filter((donante) => {
    // Sin termino, la busqueda no descarta a nadie. Antes se comparaba siempre con includes(),
    // asi que un donante sin nombre desaparecia de la lista incluso con la busqueda vacia.
    const coincideNombre =
      termino === "" || (donante?.nombre ?? "").toLowerCase().includes(termino);
    const coincideTipo = tipo === TIPO_DONANTE_TODOS || donante?.tipo === tipo;
    return coincideNombre && coincideTipo;
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

  const [donanteSeleccionado, setDonanteSeleccionado] = useState(null);
  const [historicoDelDonante, setHistoricoDelDonante] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);

  const cargarDonantes = useCallback(async () => {
    if (!tieneAccesoLectura) {
      setDonantes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    const { datos, error: fallo } = await listarDonantes(
      { soloActivos: true },
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
    () => filtrarDonantes(donantes, busqueda, filtroTipo),
    [donantes, busqueda, filtroTipo],
  );

  const abrirAlta = useCallback(() => {
    if (!puedeEscribir) return;
    setDonanteSeleccionado(null);
    setHistoricoDelDonante(null);
    setModoEdicion(false);
    setModalAbierto(true);
  }, [puedeEscribir]);

  const abrirEdicion = useCallback(
    (donante) => {
      if (!puedeEscribir) return;
      setDonanteSeleccionado(donante);
      setModoEdicion(true);
      setModalAbierto(true);
    },
    [puedeEscribir],
  );

  const cerrarModal = useCallback(() => {
    setModalAbierto(false);
    setModoEdicion(false);
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

      if (!donante || !tieneAccesoLectura) return;

      const { datos } = await obtenerHistoricoDonante(donanteId, { rolUsuario: usuarioRol });
      setHistoricoDelDonante(datos ?? null);
    },
    [donantes, usuarioRol, tieneAccesoLectura],
  );

  /**
   * Guarda el donante del modal: lo registra si es un alta, lo actualiza si es una edicion.
   *
   * Devuelve `{ ok, error }` para que la pantalla decida si cierra el modal o deja los datos
   * escritos para corregirlos.
   */
  const guardarDonante = useCallback(
    async (datosDelFormulario) => {
      if (!puedeEscribir) {
        return { ok: false, error: { mensaje: "No tienes permiso para registrar donantes." } };
      }

      setGuardando(true);
      const respuesta =
        modoEdicion && donanteSeleccionado
          ? await actualizarDonante(donanteSeleccionado.id, datosDelFormulario, {
              rolUsuario: usuarioRol,
            })
          : await registrarDonante(datosDelFormulario, { rolUsuario: usuarioRol });
      setGuardando(false);

      if (respuesta.error) return { ok: false, error: respuesta.error };

      await cargarDonantes();
      cerrarModal();
      return { ok: true, error: null };
    },
    [
      puedeEscribir,
      modoEdicion,
      donanteSeleccionado,
      usuarioRol,
      cargarDonantes,
      cerrarModal,
    ],
  );

  /** Da de baja a un donante. Es baja logica: donantes.activo pasa a false, la fila se queda. */
  const darDeBaja = useCallback(
    async (donanteId) => {
      if (!puedeEscribir) {
        return { ok: false, error: { mensaje: "No tienes permiso para dar de baja donantes." } };
      }

      const { error: fallo } = await darDeBajaDonante(donanteId, { rolUsuario: usuarioRol });
      if (fallo) return { ok: false, error: fallo };

      await cargarDonantes();
      return { ok: true, error: null };
    },
    [puedeEscribir, usuarioRol, cargarDonantes],
  );

  return {
    permisos: { tieneAccesoLectura, puedeEscribir },
    cargando,
    guardando,
    error,
    columnas: COLUMNAS_DONANTE,
    filtrosSpec: FILTROS_DONANTE,
    camposSpec: CAMPOS_DONANTE,
    donantes: donantesFiltrados,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    setModalAbierto,
    cerrarModal,
    donanteSeleccionado,
    historicoDelDonante,
    modoEdicion,
    abrirAlta,
    abrirEdicion,
    verFicha,
    guardarDonante,
    darDeBaja,
    recargar: cargarDonantes,
  };
}
