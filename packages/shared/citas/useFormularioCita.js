// Alta y edicion de una cita (issue #927).
//
// Lo que decide este hook y no la pantalla:
// - Las opciones: jornadas planificadas o en curso, clinicas y areas vigentes (mas la elegida si se
//   retiro), y como profesionales solo los medicos del cuadro de turnos de la jornada elegida.
// - Al cambiar de jornada se recargan los profesionales y se suelta el que ya no esta; si la fecha
//   queda antes de la jornada, pasa a la de la jornada. Al mover el inicio por encima del fin, el
//   fin se corre a 30 minutos despues.
// - Antes de guardar: validarCita y el espejo de cupo y traslapes con las citas que se cruzan
//   (citasQueSeCruzan). La base vuelve a comprobarlo con bloqueo; si otra persona agendo en medio,
//   su mensaje llega por errorDeCita.
// - Una cita creada se reagenda entera; atendida o cancelada, solo sus notas (edicionDeCita).
// - El aviso de cita fuera del turno del profesional, que no bloquea.

import { useCallback, useEffect, useMemo, useState } from "react";

import { obtenerCatalogoDeAreas } from "../pacientes/areas.api.js";
import { opcionesDeAreas } from "../pacientes/areas.campos.js";
import { buscarOpcionPorEtiqueta } from "../formato/opciones.js";
import {
  actualizarCita,
  citasQueSeCruzan,
  crearCita,
  listarJornadasParaAgendar,
  listarProfesionalesDeJornada,
} from "./api.js";
import {
  CAMPOS_CITA,
  CAMPOS_EDITABLES_SIN_AGENDA,
  opcionesDeJornadasParaAgendar,
  opcionesDeProfesionales,
  valoresDeCitaNueva,
} from "./campos.js";
import { crearClinica, listarClinicas } from "./clinicas.api.js";
import { opcionesDeClinicas } from "./clinicas.campos.js";
import { puedeMantenerClinicas } from "./clinicas.permisos.js";
import { validarClinica } from "./clinicas.validaciones.js";
import {
  DURACION_DE_CITA_MIN,
  fechaEnGuatemala,
  horaEnGuatemala,
  minutosDelDia,
  sumarMinutos,
} from "./horas.js";
import { edicionDeCita, puedeAgendarCitas } from "./permisos.js";
import {
  avisoDeFueraDeTurno,
  conflictosDeCita,
  intervaloDeCita,
  validarCita,
} from "./validaciones.js";

/** Salas con que nace una clinica creada desde el formulario de cita; se ajustan en Clinicas. */
export const SALAS_DE_CLINICA_EN_LINEA = 1;

/**
 * Los valores del formulario a partir de una cita que ya existe.
 *
 * @param {object} cita
 * @returns {object}
 */
export function valoresDeCita(cita) {
  return {
    pacienteId: cita.pacienteId,
    jornadaId: cita.jornadaId,
    clinicaId: cita.clinicaId,
    areaId: cita.areaId,
    profesionalId: cita.profesionalId ?? "",
    fecha: fechaEnGuatemala(cita.iniciaEn),
    horaInicio: horaEnGuatemala(cita.iniciaEn),
    horaFin: horaEnGuatemala(cita.terminaEn),
    notas: cita.notas ?? "",
  };
}

/**
 * Como cambian los valores al cambiar un campo: las reglas que encadenan campos. Pura.
 *
 * @param {object} valores
 * @param {string} id
 * @param {unknown} valor
 * @param {{ fechaDeJornada?: string|null }} [contexto]
 * @returns {object}
 */
export function aplicarCambioDeCita(valores, id, valor, { fechaDeJornada = null } = {}) {
  const siguientes = { ...valores, [id]: valor ?? "" };
  if (id === "jornadaId") {
    siguientes.profesionalId = "";
    if (fechaDeJornada && (!siguientes.fecha || siguientes.fecha < fechaDeJornada)) {
      siguientes.fecha = fechaDeJornada;
    }
  }
  if (id === "horaInicio") {
    const inicio = minutosDelDia(siguientes.horaInicio);
    const fin = minutosDelDia(siguientes.horaFin);
    if (inicio !== null && (fin === null || fin <= inicio)) {
      siguientes.horaFin = sumarMinutos(siguientes.horaInicio, DURACION_DE_CITA_MIN);
    }
  }
  return siguientes;
}

/**
 * Las columnas que cambian al editar: con la agenda bloqueada, solo las notas.
 *
 * @param {object} valores
 * @param {{ agenda: boolean }} edicion
 * @returns {object}
 */
export function datosAGuardar(valores, edicion = { agenda: true }) {
  if (!edicion.agenda) {
    return Object.fromEntries(CAMPOS_EDITABLES_SIN_AGENDA.map((id) => [id, valores[id]]));
  }
  const intervalo = intervaloDeCita(valores);
  return {
    pacienteId: valores.pacienteId,
    jornadaId: valores.jornadaId,
    clinicaId: valores.clinicaId,
    areaId: valores.areaId,
    profesionalId: valores.profesionalId || null,
    iniciaEn: intervalo?.iniciaEn,
    terminaEn: intervalo?.terminaEn,
    notas: valores.notas,
  };
}

/**
 * @param {object} parametros
 * @param {string} [parametros.rol]
 * @param {object|null} [parametros.cita] La cita que se edita; null para una nueva.
 * @param {{ pacienteId?: string, paciente?: string, jornadaId?: string, fecha?: string,
 *   horaInicio?: string, clinicaId?: string, areaId?: string }} [parametros.inicial]
 * @returns {object}
 */
export function useFormularioCita({ rol, cita = null, inicial = {} } = {}) {
  const [valores, setValores] = useState(() =>
    cita ? valoresDeCita(cita) : valoresDeCitaNueva(inicial),
  );
  const [paciente, setPacienteElegido] = useState(() =>
    cita
      ? { id: cita.pacienteId, nombre: cita.paciente }
      : inicial.pacienteId
        ? { id: inicial.pacienteId, nombre: inicial.paciente ?? null }
        : null,
  );
  const [jornadas, setJornadas] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresAltaClinica, setErroresAltaClinica] = useState({});
  const [creandoClinica, setCreandoClinica] = useState(false);

  const edicion = useMemo(
    () => (cita ? edicionDeCita(rol, cita) : { agenda: puedeAgendarCitas(rol), notas: true }),
    [rol, cita],
  );

  const cargarClinicas = useCallback(async () => {
    const respuesta = await listarClinicas();
    setClinicas(respuesta.clinicas);
    return respuesta;
  }, []);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarJornadasParaAgendar(), cargarClinicas(), obtenerCatalogoDeAreas()]).then(
      ([respuestaJornadas, respuestaClinicas, respuestaAreas]) => {
        if (!vigente) return;
        setJornadas(respuestaJornadas.jornadas);
        setAreas(respuestaAreas.areas);
        setError(respuestaJornadas.error ?? respuestaClinicas.error ?? respuestaAreas.error);
      },
    );
    return () => {
      vigente = false;
    };
  }, [cargarClinicas]);

  useEffect(() => {
    let vigente = true;
    listarProfesionalesDeJornada(valores.jornadaId).then((respuesta) => {
      if (vigente) setProfesionales(respuesta.profesionales);
    });
    return () => {
      vigente = false;
    };
  }, [valores.jornadaId]);

  // La jornada de la cita que se edita, aunque ya no admita citas: el formulario no la pierde.
  const jornadasVisibles = useMemo(() => {
    if (!cita || jornadas.some((jornada) => jornada.id === cita.jornadaId)) return jornadas;
    return [
      ...jornadas,
      { id: cita.jornadaId, nombre: cita.jornada ?? "Jornada", fecha: cita.fechaDeJornada },
    ];
  }, [jornadas, cita]);

  const jornadaElegida = jornadasVisibles.find((jornada) => jornada.id === valores.jornadaId);

  const setValor = useCallback(
    (id, valor) => {
      const fechaDeJornada =
        id === "jornadaId"
          ? (jornadasVisibles.find((jornada) => jornada.id === valor)?.fecha ?? null)
          : null;
      setValores((anteriores) => aplicarCambioDeCita(anteriores, id, valor, { fechaDeJornada }));
      setErrores((anteriores) => ({ ...anteriores, [id]: undefined }));
    },
    [jornadasVisibles],
  );

  const setPaciente = useCallback((elegido) => {
    setPacienteElegido(elegido ?? null);
    setValores((anteriores) => ({ ...anteriores, pacienteId: elegido?.id ?? "" }));
    setErrores((anteriores) => ({ ...anteriores, pacienteId: undefined }));
  }, []);

  const opcionesClinicas = useMemo(
    () => opcionesDeClinicas(clinicas, valores.clinicaId),
    [clinicas, valores.clinicaId],
  );

  /** Alta en linea de una clinica: nace con una sala; si el nombre ya existe, se elige esa. */
  const crearClinicaEnLinea = useCallback(
    async (nombre) => {
      const existente = buscarOpcionPorEtiqueta(
        clinicas.map((clinica) => ({ value: clinica.id, label: clinica.nombre })),
        nombre,
      );
      if (existente) {
        setValor("clinicaId", existente.value);
        return { clinica: { id: existente.value }, errores: {}, error: null };
      }
      const erroresDeNombre = validarClinica({ nombre }, { completo: false });
      if (Object.keys(erroresDeNombre).length > 0) {
        setErroresAltaClinica(erroresDeNombre);
        return { clinica: null, errores: erroresDeNombre, error: null };
      }
      setCreandoClinica(true);
      const respuesta = await crearClinica({ nombre, salasDisponibles: SALAS_DE_CLINICA_EN_LINEA });
      setCreandoClinica(false);
      setErroresAltaClinica(respuesta.errores ?? {});
      if (respuesta.clinica) {
        await cargarClinicas();
        setValor("clinicaId", respuesta.clinica.id);
      }
      return respuesta;
    },
    [clinicas, cargarClinicas, setValor],
  );

  const profesionalElegido =
    profesionales.find((profesional) => profesional.id === valores.profesionalId) ?? null;
  const avisos = useMemo(() => {
    const fueraDeTurno = avisoDeFueraDeTurno(valores, profesionalElegido);
    return fueraDeTurno ? { profesionalId: fueraDeTurno } : {};
  }, [valores, profesionalElegido]);

  const guardar = useCallback(async () => {
    setError(null);

    if (edicion.agenda) {
      const erroresDelFormulario = validarCita(valores, {
        fechaDeJornada: jornadaElegida?.fecha ?? null,
      });
      if (Object.keys(erroresDelFormulario).length > 0) {
        setErrores(erroresDelFormulario);
        return { ok: false };
      }
    }

    setEnviando(true);

    if (edicion.agenda) {
      const intervalo = intervaloDeCita(valores);
      const cruces = await citasQueSeCruzan({ ...intervalo, ...valores });
      const clinica = clinicas.find((una) => una.id === valores.clinicaId);
      const conflictos = conflictosDeCita({ id: cita?.id, ...valores }, intervalo, {
        delPaciente: cruces.citas.filter((otra) => otra.pacienteId === valores.pacienteId),
        delProfesional: cruces.citas.filter(
          (otra) => valores.profesionalId && otra.profesionalId === valores.profesionalId,
        ),
        deLaClinica: cruces.citas.filter((otra) => otra.clinicaId === valores.clinicaId),
        salas: clinica?.salasDisponibles ?? null,
      });
      if (Object.keys(conflictos).length > 0) {
        setErrores(conflictos);
        setEnviando(false);
        return { ok: false };
      }
    }

    const datos = datosAGuardar(valores, edicion);
    const respuesta = cita ? await actualizarCita(cita.id, datos) : await crearCita(datos);
    setEnviando(false);

    if (respuesta.error) {
      setError(respuesta.error);
      return { ok: false };
    }
    return { ok: true, cita: respuesta.cita };
  }, [edicion, valores, jornadaElegida, clinicas, cita]);

  return {
    esNueva: !cita,
    campos: CAMPOS_CITA,
    valores,
    setValor,
    paciente,
    setPaciente,
    pacienteFijo: Boolean(cita) || Boolean(inicial.pacienteId),
    edicion,
    errores,
    avisos,
    error,
    enviando,
    guardar,
    catalogos: {
      jornadas: opcionesDeJornadasParaAgendar(jornadasVisibles),
      clinicas: opcionesClinicas,
      areasAtencion: opcionesDeAreas(areas, [valores.areaId]),
      profesionales: opcionesDeProfesionales(profesionales),
    },
    altaDeClinica: {
      puedeCrear: puedeMantenerClinicas(rol),
      crear: crearClinicaEnLinea,
      errores: erroresAltaClinica,
      creando: creandoClinica,
    },
  };
}
