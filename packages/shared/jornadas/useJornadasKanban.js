// View model del tablero kanban de jornadas (issue #178, arrastre y alternativa accesible
// conectados en #180).
//
// /jornadas es una sola pantalla -el kanban de tres etapas que describe
// docs/ARQUITECTURA-FRONTEND.md:19-21 y que ya rotula el placeholder de JornadasPage.jsx-, no un
// listado separado: ver PLAN.md, seccion 2, pregunta 1, decision (A). Este hook construye la
// parte de mostrar y filtrar el tablero (issue #178) y tambien el movimiento de tarjetas: un
// solo handler (moverJornada) que sirve tanto a onMover de KanbanBoard (arrastre y flechas de
// teclado, ya comparten un solo camino dentro del propio componente) como a los botones
// "Editar"/"Atras"/"Avanzar" que arma JornadasPage.jsx (issue #180, PLAN.md decision 2: un solo
// handler, para que arrastre y botones nunca diverjan).
//
// No llama a useSesion() por su cuenta: recibe `rol` de quien lo usa (en la web,
// useSesionCompartida()), mismo motivo que usePerfilPropio() documenta en usuarios/ para no
// abrir una segunda suscripcion a la sesion.
//
// Issue #183: la transicion en curso -> finalizada dejo de aplicarse desde este hook (antes lo
// hacia moverJornada(), con su propio aviso de atenciones incompletas). Ahora moverJornada()
// manda esa transicion a `pedirCierreEnDetalle`, y JornadasPage.jsx navega al detalle de la
// jornada, donde la pestaña "Cierre" (useResumenCierreJornada.js) es la unica que finaliza, con
// el resumen completo del dia. Ver PLAN.md seccion 3.

import { useCallback, useEffect, useMemo, useState } from "react";

import { cambiarEstadoJornada, contarPacientesAtendidosPorJornada, listarJornadas } from "./api.js";
import { FILTROS_JORNADA_VACIOS, OPCIONES_ESTADO_JORNADA } from "./filtros.js";
import { permisosDeJornadas } from "./permisos.js";
import { ESTADOS_JORNADA } from "../enums.js";

/**
 * Traduce el estado de filtros de la pantalla a los parametros que listarJornadas() (#170)
 * entiende. `busqueda` no viaja: no es parte de FILTROS_JORNADA_VACIOS (ver filtros.js) porque
 * listarJornadas() no acepta ningun parametro de busqueda de texto.
 */
function aFiltrosDeApi(filtros = {}) {
  return {
    estado: filtros.estado || undefined,
    comunidad: filtros.comunidad || undefined,
    fechaInicio: filtros.rangoFecha?.min || undefined,
    fechaFin: filtros.rangoFecha?.max || undefined,
  };
}

/**
 * Catalogo de comunidades para el filtro `comunidad`, derivado de las jornadas ya cargadas.
 *
 * No existe en packages/shared una funcion que liste la tabla comunidades (ni jornadas/api.js
 * declara ser dueño de ella), pero listarJornadas() ya trae `comunidadId` y
 * `comunidad: comunidades(nombre)` embebidos en cada fila (api.js:52,63): los pares (id, nombre)
 * salen de ahi sin una consulta nueva. Una jornada cuya comunidad RLS no deja ver llega con el
 * embed en null (api.js:44-45) y se omite del catalogo, no como una entrada rota.
 *
 * @param {object[]} jornadas
 * @returns {{ value: string, label: string }[]}
 */
export function catalogoComunidadesDesde(jornadas = []) {
  const mapa = new Map();
  for (const jornada of jornadas) {
    if (jornada.comunidadId && jornada.comunidad?.nombre && !mapa.has(jornada.comunidadId)) {
      mapa.set(jornada.comunidadId, jornada.comunidad.nombre);
    }
  }
  return Array.from(mapa, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

/**
 * Arma la tarjeta de una jornada con los seis datos del criterio 1 de #178 (nombre, fecha,
 * comunidad, responsable, estado y pacientes atendidos) mas `cupoEstimado`, que se suma para la
 * barra de progreso del arreglo de diseno del tablero (pacientes atendidos sobre esperados).
 * `codigo` sigue existiendo en COLUMNAS_JORNADA pero esta pantalla no lo pinta (ver columnas.js).
 *
 * `cupoEstimado` no tiene el problema de permisos de `pacientesAtendidos` de abajo: es una
 * columna propia de `jornadas` que ya trae listarJornadas() para cualquiera que pueda listar
 * jornadas, asi que se copia siempre (puede llegar `null`, jornadas.cupo_estimado es opcional,
 * 00036).
 *
 * `pacientesAtendidos` solo se agrega cuando `pacientesPorJornada` trae una fila para esta
 * jornada: una jornada ausente de ese mapa (medico o voluntario, sin SELECT sobre
 * vista_reporte_impacto, 00064) se queda sin la clave, para que la pantalla pinte un guion en
 * vez de un 0 que afirmaria una atencion que no se puede confirmar.
 */
function armarTarjeta(jornada, pacientesPorJornada) {
  const tarjeta = {
    id: jornada.id,
    nombre: jornada.nombre,
    fecha: jornada.fecha,
    comunidad: jornada.comunidad?.nombre ?? "",
    responsable: [jornada.responsable?.nombres, jornada.responsable?.apellidos]
      .filter(Boolean)
      .join(" "),
    estado: jornada.estado,
    cupoEstimado: jornada.cupoEstimado ?? null,
  };

  if (Object.prototype.hasOwnProperty.call(pacientesPorJornada, jornada.id)) {
    tarjeta.pacientesAtendidos = pacientesPorJornada[jornada.id];
  }

  return tarjeta;
}

/**
 * Indica si un movimiento del tablero ES la transicion de finalizar una jornada (issue #183):
 * unicamente en curso -> finalizada. Se llamaba necesitaAvisoDeAtencionesIncompletas() (issue
 * #171, criterio 4): antes solo importaba para decidir si valia la pena avisar; ahora decide si
 * el movimiento tiene que desviarse al flujo de cierre (pestaña "Cierre" de DetalleJornadaPage.jsx,
 * useResumenCierreJornada.js) en vez de aplicarse aca -- por eso el nombre nuevo, mismo cuerpo.
 * Funcion pura, exportada aparte del hook para poder probarla sin montarlo (environment "node",
 * sin DOM, mismo motivo por el que useFormularioJornada.test.js prueba
 * valoresInicialesDeJornada()/aDatosDeJornada() sueltas y no `enviar()` completo).
 *
 * @param {string} estadoActual Estado real de la jornada (releido de `jornadas`, no el
 *   `origenId` que manda KanbanBoard).
 * @param {string} destinoId Estado al que se intenta mover.
 * @returns {boolean}
 */
export function esFinalizacionDeJornada(estadoActual, destinoId) {
  return estadoActual === ESTADOS_JORNADA.EN_CURSO && destinoId === ESTADOS_JORNADA.FINALIZADA;
}

/**
 * Agrupa las jornadas en columnas de KanbanBoard, una por valor de OPCIONES_ESTADO_JORNADA
 * (filtros.js), en el mismo orden en que ese descriptor las declara. No hay una lista de estados
 * separada a mano: agregar o quitar un valor del enum solo requiere tocar ese descriptor.
 *
 * Son cuatro columnas, no tres: el criterio 1 de #180 ("tres columnas") es una imprecision del
 * issue frente al modelo real (estado_jornada tiene cuatro valores, 00001), documentada como
 * hallazgo en el PR y deliberadamente NO corregida aca. TRANSICIONES_JORNADA (validaciones.js)
 * gobierna a donde puede moverse una jornada, no que columnas se ven: usarla para filtrar
 * columnas convertiria una regla de movimiento en una regla de visibilidad, y le esconderia la
 * columna 'cancelada' a medico y voluntario -que solo miran el tablero, nunca mueven nada- y
 * dejaria el filtro de estado de #178 (que si ofrece 'cancelada', filtros.js) mostrando tres
 * columnas vacias sin explicacion cuando alguien filtrara por ese valor.
 *
 * @param {object[]} jornadas Filas de listarJornadas().
 * @param {Record<string, number>} pacientesPorJornada De contarPacientesAtendidosPorJornada().
 * @returns {{ id: string, titulo: string, tarjetas: object[] }[]}
 */
export function agruparJornadasPorEstado(jornadas = [], pacientesPorJornada = {}) {
  const columnas = OPCIONES_ESTADO_JORNADA.map((opcion) => ({
    id: opcion.value,
    titulo: opcion.label,
    tarjetas: [],
  }));
  const columnaPorEstado = new Map(columnas.map((columna) => [columna.id, columna]));

  for (const jornada of jornadas) {
    const columna = columnaPorEstado.get(jornada.estado);
    if (!columna) continue;
    columna.tarjetas.push(armarTarjeta(jornada, pacientesPorJornada));
  }

  return columnas;
}

/**
 * View model del tablero de jornadas, compartido por la pantalla web (#178, #180) y la futura
 * movil (#186/#187): ninguna decision de aqui abajo depende de la plataforma. El contrato de
 * `moverJornada` es exactamente el que espera `onMover` de KanbanBoard en las dos plataformas
 * (`(tarjetaId, origenId, destinoId)`, ver apps/web/src/components/KanbanBoard.jsx y
 * apps/mobile/src/components/KanbanBoard.js), asi que una pantalla movil futura puede reusarlo
 * sin cambios.
 *
 * `listarJornadas()` ya ordena por fecha ascendente (api.js:182-184); dentro de cada columna eso
 * ya deja primero la jornada mas proxima, que es lo que agrupar por estado necesita del criterio
 * 3 sin tocar esa funcion (#170, ya cerrada).
 *
 * @param {string} [rol] Rol de la sesion actual (useSesionCompartida().rol en la web), para
 *   resolver `puedeCrear`/`puedeEditar`/`puedeReabrir` con permisosDeJornadas() y para pasarle
 *   el rol a cambiarEstadoJornada(). Un rol ausente resuelve a todo en `false`, igual que
 *   permisosDeJornadas(undefined).
 */
export function useJornadasKanban(rol) {
  const [filtros, setFiltros] = useState(FILTROS_JORNADA_VACIOS);
  const [jornadas, setJornadas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [pacientesPorJornada, setPacientesPorJornada] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // Estado del movimiento de tarjetas (issue #180). `errorMovimiento` es el "explica por que"
  // del criterio 3: { jornadaId, mensaje }, o null cuando no hay nada que mostrar.
  // `pedirCierreEnDetalle` reemplaza a la vieja `confirmacionFinalizar` (issue #171, criterio 4):
  // en vez de guardar una advertencia para mostrar en un modal del propio tablero, guarda el id de
  // la jornada que el tablero tiene que mandar al flujo de cierre unico (pestaña "Cierre" de
  // DetalleJornadaPage.jsx, ver PLAN.md seccion 3 de #183) -- este hook ya no aplica el cambio a
  // finalizada por su cuenta. `moviendo` deshabilita los botones mientras hay una llamada en
  // curso, para no disparar dos movimientos de la misma tarjeta a la vez.
  const [errorMovimiento, setErrorMovimiento] = useState(null);
  const [pedirCierreEnDetalle, setPedirCierreEnDetalle] = useState(null);
  const [moviendo, setMoviendo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const { jornadas: filas, error: errorDeLista } = await listarJornadas(aFiltrosDeApi(filtros));

    if (errorDeLista) {
      setJornadas([]);
      setPacientesPorJornada({});
      setError(errorDeLista);
      setCargando(false);
      return;
    }

    setJornadas(filas);
    // El catalogo de comunidades se fija una sola vez, con la primera carga (filtros arranca en
    // FILTROS_JORNADA_VACIOS, sin filtrar). Recargar por un cambio de filtro no debe vaciar las
    // opciones del propio selector de comunidad.
    setComunidades((anteriores) =>
      anteriores.length > 0 ? anteriores : catalogoComunidadesDesde(filas),
    );

    // Dato de contexto, no el contenido de la pantalla: si esta consulta falla, el tablero se
    // dibuja igual y cada tarjeta queda sin `pacientesAtendidos` (guion), nunca en cero.
    const { conteos } = await contarPacientesAtendidosPorJornada(
      filas.map((jornada) => jornada.id),
    );
    setPacientesPorJornada(conteos);
    setCargando(false);
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFiltros(FILTROS_JORNADA_VACIOS);
  }, []);

  /**
   * Ejecuta de verdad el cambio de estado. moverJornada() ya descarto que sea la transicion de
   * finalizar (esa se desvia a `pedirCierreEnDetalle`, ver mas abajo), asi que lo que llega aca
   * es cualquier otra transicion. cambiarEstadoJornada() (api.js) es quien valida la transicion
   * y la reapertura contra TRANSICIONES_JORNADA/es_administrador() y arma el mensaje de
   * `errores.estado` cuando algo no procede (validaciones.js:67-93) -- no se repite esa logica
   * aca, se deja que la funcion ya construida decida y esta funcion solo refleja el resultado.
   *
   * No mueve nada de manera optimista: `jornadas`/`columnas` solo cambian con `cargar()`, y solo
   * se llama a `cargar()` cuando `cambiarEstadoJornada()` tuvo exito. Por eso un movimiento
   * rechazado nunca mueve la tarjeta (criterio 3 de #180, PLAN.md 1.7): no hay nada que revertir
   * porque nunca se aplico.
   *
   * `cambiarEstadoJornada()` puede devolver `{ jornada: null, error: null }` sin que nada haya
   * fallado en apariencia: es lo que pasa cuando la politica RLS de UPDATE (00039, `es_administrador()
   * OR tiene_permiso('jornadas.gestionar')`) no deja ver la fila para actualizarla -- Postgrest
   * no reporta eso como error, actualiza cero filas y listo (mismo patron sin resolver en
   * actualizarJornada(), api.js:271-309). KanbanBoard.jsx (que no se toca, ver PLAN.md 1.7)
   * pone `draggable` sin condicion, asi que un rol sin permiso igual puede soltar una tarjeta; sin
   * este chequeo esa suelta no haria nada y no explicaria por que -exactamente lo que el criterio
   * 3 de #180 pide evitar-, en vez de mover la tarjeta con un permiso que no tiene.
   */
  const aplicarMovimiento = useCallback(
    async (jornadaId, destinoId) => {
      setMoviendo(true);
      const { jornada: actualizada, error: errorDeCambio } = await cambiarEstadoJornada(
        jornadaId,
        destinoId,
        { rol },
      );
      setMoviendo(false);

      if (errorDeCambio) {
        setErrorMovimiento({ jornadaId, mensaje: errorDeCambio.mensaje });
        return;
      }

      if (!actualizada) {
        setErrorMovimiento({
          jornadaId,
          mensaje:
            "No se pudo cambiar el estado de esta jornada. Es posible que no tengas permiso, o " +
            "que otra persona ya la haya cambiado; actualiza el tablero e intenta de nuevo.",
        });
        return;
      }

      setErrorMovimiento(null);
      await cargar();
    },
    [rol, cargar],
  );

  /**
   * Handler unico de cambio de estado del tablero (issue #180, PLAN.md seccion 2 decision 2):
   * mismo camino para `onMover` de KanbanBoard (arrastre y flechas de teclado, que ya comparten
   * un solo `mover()` interno dentro del componente) y para el boton "Avanzar" que arma
   * JornadasPage.jsx. Si divergieran, una ruta permitiria algo que la otra no.
   *
   * Firma identica a la que ya esperan los dos KanbanBoard (web y movil):
   * `onMover(tarjetaId, origenId, destinoId)`.
   *
   * El estado de origen se relee de `jornadas` (no se confia en `origenId`, que viene de la
   * columna donde el tablero ya tenia pintada la tarjeta y podria estar desactualizado) para
   * decidir si esta transicion es exactamente en curso -> finalizada (issue #183): esa transicion
   * ya NO se aplica desde aca. En vez de llamar a `cambiarEstadoJornada()` (con o sin advertencia
   * de atenciones incompletas, como hacia la version de la #171), este hook manda a
   * `pedirCierreEnDetalle` el id de la jornada: JornadasPage.jsx navega al detalle, donde la
   * pestaña "Cierre" (useResumenCierreJornada.js) es la unica que finaliza, con el resumen
   * completo del dia (criterios 1-3 de #183), no solo el aviso de atenciones incompletas. Esto
   * vale igual para el boton "Avanzar" y para soltar la tarjeta arrastrada en la columna
   * "Finalizada": las dos rutas comparten este mismo `moverJornada`, asi que ninguna de las dos
   * puede finalizar sin pasar por el resumen (trampa 1 de #183, PLAN.md seccion 3).
   */
  const moverJornada = useCallback(
    async (jornadaId, origenId, destinoId) => {
      setErrorMovimiento(null);

      const jornada = jornadas.find((fila) => fila.id === jornadaId);
      const estadoActual = jornada?.estado ?? origenId;

      if (esFinalizacionDeJornada(estadoActual, destinoId)) {
        setPedirCierreEnDetalle(jornadaId);
        return;
      }

      await aplicarMovimiento(jornadaId, destinoId);
    },
    [jornadas, aplicarMovimiento],
  );

  /** Descarta el pedido de ir al flujo de cierre, una vez que JornadasPage.jsx ya navego. */
  const descartarPedidoCierre = useCallback(() => {
    setPedirCierreEnDetalle(null);
  }, []);

  /** Descarta el mensaje de un movimiento rechazado, sin reintentar nada. */
  const descartarErrorMovimiento = useCallback(() => {
    setErrorMovimiento(null);
  }, []);

  const columnas = useMemo(
    () => agruparJornadasPorEstado(jornadas, pacientesPorJornada),
    [jornadas, pacientesPorJornada],
  );

  const permisos = permisosDeJornadas(rol);

  return {
    columnas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar: cargar,
    total: jornadas.length,
    // Catalogos que FilterBar resuelve por `opcionesDesde` (FILTROS_JORNADA.comunidad).
    catalogos: { comunidades },
    puedeCrear: permisos.puedeCrear,
    puedeEditar: permisos.puedeEditar,
    puedeReabrir: permisos.puedeReabrir,
    moverJornada,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
    pedirCierreEnDetalle,
    descartarPedidoCierre,
  };
}
