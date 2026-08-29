import { useCallback, useEffect, useMemo, useState } from "react";

import { useBusquedaPacientes } from "../hooks/useBusquedaPacientes.js";
import { calcularEdad } from "../formato/fechas.js";
import { obtenerCatalogoDeCondiciones } from "./condiciones.api.js";
import { FILTROS_PACIENTE_VACIOS } from "./filtros.js";

/**
 * Opciones del filtro de sexo.
 *
 * El valor es la etiqueta, y no una inicial, porque pacientes.sexo es un varchar(20) sin CHECK
 * que guarda la palabra completa. Mandar "F" hacia fn_buscar_pacientes comparaba "F" con
 * "Femenino" y devolvia cero filas sin error: el filtro parecia funcionar y no filtraba nada.
 */
export const OPCIONES_SEXO = [
  { valor: "Femenino", etiqueta: "Femenino" },
  { valor: "Masculino", etiqueta: "Masculino" },
];

/**
 * Arma el catalogo de comunidades a partir de los pacientes ya cargados.
 *
 * Mismo criterio que catalogoComunidadesDesde() en jornadas/useJornadasKanban.js: el filtro
 * solo necesita ofrecer las comunidades que de verdad aparecen en los resultados, asi que no
 * hace falta una consulta aparte al catalogo completo.
 *
 * @param {object[]} pacientes
 * @returns {{ valor: string, etiqueta: string }[]}
 */
export function catalogoComunidadesDePacientes(pacientes = []) {
  const mapa = new Map();
  for (const paciente of pacientes) {
    if (paciente.comunidadId && paciente.comunidad?.nombre && !mapa.has(paciente.comunidadId)) {
      mapa.set(paciente.comunidadId, paciente.comunidad.nombre);
    }
  }
  return Array.from(mapa, ([valor, etiqueta]) => ({ valor, etiqueta })).sort((uno, otro) =>
    uno.etiqueta.localeCompare(otro.etiqueta, "es"),
  );
}

/**
 * Arma cada fila de la tabla a partir de un resultado de busqueda.
 *
 * La edad se calcula aqui con calcularEdad() de formato/fechas.js y no en la pantalla: es la
 * misma utilidad que usa el resto del sistema, y la regla de la arquitectura es que las apps no
 * formatean ni calculan nada.
 *
 * De calcularEdad() se toma solo .anios: devuelve { anios, meses, texto } desde el PR #335, y la
 * columna esta declarada NUMERO con sufijo "anios", asi que recibir el objeto entero pintaba
 * "[object Object] anios". Una fecha invalida o futura deja la celda vacia, que es lo que
 * calcularEdad() indica devolviendo null.
 *
 * @param {object[]} pacientes
 * @returns {object[]}
 */
export function armarFilasDePacientes(pacientes = []) {
  return pacientes.map((paciente) => ({
    ...paciente,
    nombreCompleto: [paciente.nombres, paciente.apellidos].filter(Boolean).join(" ").trim(),
    edad: calcularEdad(paciente.fechaNacimiento)?.anios ?? null,
    comunidad: paciente.comunidad?.nombre ?? null,
  }));
}

/**
 * Traduce el estado de los filtros de pantalla a los parametros que espera buscarPacientes().
 *
 * `rangoEdad` viaja como un par `{ min, max }` en la pantalla porque asi lo declara
 * FILTROS_PACIENTE, pero el servidor recibe dos numeros sueltos. Un filtro sin valor se omite
 * en vez de mandarse en null, para que la pantalla pueda pasar su estado tal cual.
 *
 * @param {object} filtros Estado de FILTROS_PACIENTE.
 * @returns {object}
 */
export function aFiltrosDeBusqueda(filtros = {}) {
  return {
    // Es una pantalla de listado: al entrar, sin que nadie haya escrito nada, tiene que
    // mostrar pacientes. Sin esta bandera buscarPacientes() devuelve vacio a proposito.
    listarTodos: true,
    condicionCronicaId: filtros.condicionCronica || undefined,
    sexo: filtros.sexo || undefined,
    edadMin: filtros.rangoEdad?.min ?? undefined,
    edadMax: filtros.rangoEdad?.max ?? undefined,
  };
}

/**
 * View model del listado de pacientes, compartido por la pantalla web (#124) y la movil (#133).
 *
 * La busqueda con retardo y el descarte de respuestas obsoletas no se reimplementan aqui: los
 * pone useBusquedaPacientes() (#116). Este hook agrega los otros cuatro filtros, arma las filas
 * y resuelve los catalogos que alimentan los selects.
 *
 * Los cinco filtros se aplican en el servidor. Filtrar en el cliente sobre una lista paginada
 * recortaria solo la pagina actual y dejaria el total mintiendo.
 *
 * @param {{ porPagina?: number }} [opciones]
 */
export function usePacientesListado({ porPagina } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_PACIENTE_VACIOS);
  const [condicionesCronicas, setCondicionesCronicas] = useState([]);

  const filtrosDeServidor = useMemo(() => aFiltrosDeBusqueda(filtros), [filtros]);

  const {
    termino,
    setTermino,
    resultados,
    total,
    cargando,
    error,
    hayMas,
    cargarMas,
  } = useBusquedaPacientes({
    comunidad: filtros.comunidad || undefined,
    filtros: filtrosDeServidor,
    porPagina,
  });

  useEffect(() => {
    let vigente = true;
    obtenerCatalogoDeCondiciones().then((respuesta) => {
      if (!vigente) return;
      const catalogo = respuesta.condiciones ?? respuesta.catalogo ?? [];
      setCondicionesCronicas(
        catalogo.map((condicion) => ({ valor: condicion.id, etiqueta: condicion.nombre })),
      );
    });
    return () => {
      vigente = false;
    };
  }, []);

  const setFiltro = useCallback(
    (id, valor) => {
      // La busqueda vive en useBusquedaPacientes, que es quien aplica el retardo; el resto de
      // filtros son estado local de esta pantalla.
      if (id === "busqueda") {
        setTermino(valor ?? "");
        return;
      }
      setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
    },
    [setTermino],
  );

  const limpiarFiltros = useCallback(() => {
    setTermino("");
    setFiltros(FILTROS_PACIENTE_VACIOS);
  }, [setTermino]);

  const filas = useMemo(() => armarFilasDePacientes(resultados), [resultados]);

  return {
    filas,
    // La pantalla dibuja un solo objeto de filtros, con la busqueda incluida.
    filtros: { ...filtros, busqueda: termino },
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    total,
    hayMas,
    cargarMas,
    catalogos: {
      comunidades: catalogoComunidadesDePacientes(resultados),
      sexo: OPCIONES_SEXO,
      condicionesCronicas,
    },
  };
}
