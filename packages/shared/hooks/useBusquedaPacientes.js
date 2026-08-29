import { useCallback, useEffect, useRef, useState } from "react";

import { buscarPacientes } from "../pacientes/api.js";

/** Milisegundos de inactividad antes de consultar. El criterio de la issue pide al menos 300. */
export const RETARDO_DE_BUSQUEDA_MS = 300;

/**
 * Decide si una respuesta que acaba de llegar sigue siendo la que la pantalla espera.
 *
 * Cada peticion sale con un numero correlativo; si mientras viajaba se disparo otra, el numero
 * vigente ya avanzo y esta respuesta quedo obsoleta. Es una funcion aparte y exportada para
 * poder probar la condicion de carrera sin montar el hook, igual que haVencidoPorInactividad()
 * en useExpiracionPorInactividad.js.
 *
 * @param {number} idDeLaRespuesta Numero con el que salio la peticion.
 * @param {number} idVigente Numero de la ultima peticion disparada.
 * @returns {boolean}
 */
export function esRespuestaVigente(idDeLaRespuesta, idVigente) {
  return idDeLaRespuesta === idVigente;
}

/**
 * Combina lo que ya estaba en pantalla con lo que acaba de llegar.
 *
 * La primera pagina reemplaza: es una busqueda nueva. Las siguientes se agregan al final, que
 * es lo que hace "cargar mas". Descarta los repetidos por id, porque si alguien registra un
 * paciente mientras se pagina, las filas se recorren y una misma persona puede caer en dos
 * paginas.
 *
 * @param {object[]} previos
 * @param {object[]} nuevos
 * @param {number} pagina
 * @returns {object[]}
 */
export function combinarResultados(previos = [], nuevos = [], pagina = 1) {
  if (pagina <= 1) return [...nuevos];

  const vistos = new Set(previos.map((paciente) => paciente.id));
  return [...previos, ...nuevos.filter((paciente) => !vistos.has(paciente.id))];
}

/**
 * Indica si quedan resultados por traer.
 *
 * @param {number} cargados Cuantos hay ya en pantalla.
 * @param {number} total Cuantos cumplen la busqueda en total.
 * @returns {boolean}
 */
export function hayMasResultados(cargados, total) {
  return (Number(cargados) || 0) < (Number(total) || 0);
}

/**
 * Busqueda de pacientes con retardo, para que escribir no dispare una consulta por tecla.
 *
 * Funciona igual en web y en movil: no toca `document`, `window` ni ninguna API de plataforma,
 * solo `setTimeout`, que existe en las dos.
 *
 * Como protege contra los resultados desordenados, que es lo que motiva la issue:
 *
 * 1. Mientras se escribe, el temporizador anterior se cancela y vuelve a empezar. Una peticion
 *    que todavia no salio, simplemente no sale.
 * 2. Cada peticion que si sale lleva un numero correlativo. Cuando vuelve, solo se pinta si ese
 *    numero sigue siendo el vigente; si el usuario siguio escribiendo, la respuesta llega tarde
 *    y se descarta. Asi una peticion lenta nunca sobrescribe a una mas reciente.
 *
 * Limitacion conocida: la peticion ya enviada no se aborta de verdad, porque
 * `buscarPacientes()` no admite un `AbortSignal`. Se descarta su resultado, que es lo que la
 * pantalla necesita, pero la respuesta igual viaja por la red. Abortarla de verdad exige
 * cambiar esa funcion, que es de otra issue.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.comunidad] UUID de comunidad para acotar la busqueda.
 * @param {object} [opciones.filtros] Filtros extra que se reenvian tal cual a
 *   buscarPacientes(): condicionCronicaId, sexo, edadMin y edadMax. Se pasa un objeto en vez
 *   de una lista de parametros para que agregar un filtro nuevo en el servidor no obligue a
 *   cambiar la firma de este hook (issue #124).
 * @param {number} [opciones.porPagina] Tamano de pagina.
 * @param {number} [opciones.retardoMs] Retardo antes de consultar; se baja en las pruebas.
 */
export function useBusquedaPacientes({
  comunidad,
  filtros,
  porPagina,
  retardoMs = RETARDO_DE_BUSQUEDA_MS,
} = {}) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [terminoDemasiadoCorto, setTerminoDemasiadoCorto] = useState(false);

  // Numero de la ultima peticion disparada. Vive en una ref y no en el estado porque cambiarlo
  // no debe redibujar nada: solo sirve para decidir que respuesta se pinta.
  const peticionVigente = useRef(0);

  // Los filtros llegan como objeto nuevo en cada render, asi que compararlos por identidad
  // dispararia una consulta por render. Se compara su contenido serializado.
  const claveDeFiltros = JSON.stringify(filtros ?? {});

  const consultar = useCallback(
    async (paginaAConsultar) => {
      peticionVigente.current += 1;
      const idDeEstaPeticion = peticionVigente.current;

      setCargando(true);
      setError(null);

      const respuesta = await buscarPacientes({
        ...filtros,
        termino,
        comunidadId: comunidad,
        pagina: paginaAConsultar,
        porPagina,
      });

      // Aqui esta la guarda contra el desorden: si mientras viajaba salio otra peticion, esta
      // respuesta ya no le sirve a nadie y no toca el estado.
      if (!esRespuestaVigente(idDeEstaPeticion, peticionVigente.current)) return;

      if (respuesta.error) {
        setError(respuesta.error);
        setCargando(false);
        return;
      }

      setResultados((previos) =>
        combinarResultados(previos, respuesta.pacientes ?? [], paginaAConsultar),
      );
      setTotal(respuesta.total ?? 0);
      setTerminoDemasiadoCorto(respuesta.terminoDemasiadoCorto === true);
      setPagina(paginaAConsultar);
      setCargando(false);
    },
    [termino, comunidad, porPagina, claveDeFiltros],
  );

  useEffect(() => {
    const temporizador = setTimeout(() => consultar(1), retardoMs);

    // Cancelar el temporizador es la cancelacion de verdad: la peticion no llega a salir.
    return () => clearTimeout(temporizador);
  }, [consultar, retardoMs]);

  const cargarMas = useCallback(() => {
    if (cargando || !hayMasResultados(resultados.length, total)) return;
    consultar(pagina + 1);
  }, [cargando, resultados.length, total, pagina, consultar]);

  return {
    termino,
    setTermino,
    resultados,
    total,
    cargando,
    error,
    terminoDemasiadoCorto,
    hayMas: hayMasResultados(resultados.length, total),
    cargarMas,
  };
}
