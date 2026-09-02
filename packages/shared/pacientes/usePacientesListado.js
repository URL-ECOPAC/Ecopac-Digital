import { useCallback, useEffect, useMemo, useState } from "react";

import { useBusquedaPacientes } from "../hooks/useBusquedaPacientes.js";
import { calcularEdad } from "../formato/fechas.js";
import { listarComunidades } from "../territorio/api.js";
import { obtenerCatalogoDeCondiciones } from "./condiciones.api.js";
import { FILTROS_PACIENTE_VACIOS } from "./filtros.js";

/**
 * Opciones del filtro de sexo.
 *
 * El `value` es el mismo texto que el `label`, y no una inicial, porque pacientes.sexo es un varchar(20) sin CHECK
 * que guarda la palabra completa. Mandar "F" hacia fn_buscar_pacientes comparaba "F" con
 * "Femenino" y devolvia cero filas sin error: el filtro parecia funcionar y no filtraba nada.
 */
export const OPCIONES_SEXO = [
  { value: "Femenino", label: "Femenino" },
  { value: "Masculino", label: "Masculino" },
];

/**
 * Dice si hay algun filtro puesto, para que la pantalla decida si ofrece limpiarlos.
 *
 * rangoEdad es un objeto `{ min, max }`, asi que un rango a medias tambien cuenta: lo que
 * importa es si el usuario toco algo, no cuantos criterios completo. Mismo criterio y misma
 * forma que hayFiltrosDeCronicos() en usePacientesCronicos.js.
 *
 * @param {object} filtros Estado de FILTROS_PACIENTE, con la busqueda incluida.
 * @returns {boolean}
 */
export function hayFiltrosDePacientes(filtros = {}) {
  return Object.keys(FILTROS_PACIENTE_VACIOS).some((clave) => {
    const valor = filtros[clave];
    if (valor && typeof valor === "object") return Object.values(valor).some((uno) => uno != null);
    return Boolean(valor);
  });
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
  const [comunidades, setComunidades] = useState([]);

  const filtrosDeServidor = useMemo(() => aFiltrosDeBusqueda(filtros), [filtros]);

  const { termino, setTermino, recargar, resultados, total, cargando, error, hayMas, cargarMas } =
    useBusquedaPacientes({
      comunidad: filtros.comunidad || undefined,
      filtros: filtrosDeServidor,
      porPagina,
    });

  useEffect(() => {
    let vigente = true;

    // El catalogo sale del catalogo, no de los resultados. Armarlo desde los resultados dejaba
    // el filtro con una sola opcion en cuanto se usaba, porque a partir de ahi los resultados
    // solo traen la comunidad ya elegida (issue #656). usePacientesCronicos ya lo hacia asi.
    listarComunidades().then((respuesta) => {
      if (!vigente) return;
      setComunidades(
        (respuesta.comunidades ?? []).map((fila) => ({ value: fila.id, label: fila.nombre })),
      );
    });

    obtenerCatalogoDeCondiciones().then((respuesta) => {
      if (!vigente) return;
      const catalogo = respuesta.condiciones ?? respuesta.catalogo ?? [];
      setCondicionesCronicas(
        catalogo.map((condicion) => ({ value: condicion.id, label: condicion.nombre })),
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
    hayFiltros: hayFiltrosDePacientes({ ...filtros, busqueda: termino }),
    recargar,
    cargando,
    error,
    total,
    hayMas,
    cargarMas,
    catalogos: {
      comunidades,
      sexo: OPCIONES_SEXO,
      condicionesCronicas,
    },
  };
}
