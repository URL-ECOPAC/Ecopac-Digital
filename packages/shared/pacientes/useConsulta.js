// La consulta como unidad del historial clinico (issue #840, bloque F).
//
// LA VISION, DICTADA POR EL USUARIO
//
// Llega un paciente, se busca o se registra, y se pulsa "Nueva consulta". No hay "Nuevo triaje":
// es lo mismo. Dentro de esa consulta se registran, o no, los signos vitales; se registra la
// consulta; y se registra, o no, la receta. Cada visita es una unidad del historial.
//
// QUE REEMPLAZA
//
// Tres flujos sueltos que se abrian cada uno por su lado: useRegistroTriaje (el triaje),
// useRegistroConsulta (la consulta) y, para corregir, useCorreccionTriaje y useCorreccionConsulta,
// con formularios distintos para crear y para editar. Aqui hay UN solo formulario -signos mas
// consulta- que sirve igual para una visita nueva y para una que ya existe (regla B1): lo que ya
// esta se precarga, lo que falta se puede agregar, y lo que no se puede cambiar se muestra de solo
// lectura en vez de desaparecer.
//
// EL MODELO NO CAMBIA
//
// Una visita es una fila de `atenciones` (UNIQUE paciente, jornada). De ella cuelgan `triajes`
// (1:1), `consultas` y, de la consulta, `recetas`. Este hook no inventa ninguna tabla: decide que
// escribir en cada una al guardar.
//
// VARIAS CONSULTAS POR VISITA (issue #927)
//
// Una visita puede tener una consulta por cita, ademas de la que no salio de ninguna. Por eso el
// hook trabaja sobre UNA consulta de la visita (consultaObjetivoDeVisita): la de la cita que se
// atiende, la que se eligio en el historial, o la que no salio de una cita. Con cita, la consulta
// es siempre nueva en la visita (la primera no se sobrescribe), lleva cita_id y su area queda fija.
// Los signos siguen siendo uno por visita.
//
// LA RECETA
//
// No se escribe aqui: necesita la consulta ya guardada (cuelga de ella) y tiene su propio flujo
// con inventario (useGeneracionReceta, fn_generar_receta). Este hook dice si se puede agregar y
// sobre que consulta; la pantalla abre ese flujo como el tercer paso.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolverAtencion } from "../atenciones/api.js";
import { puedeRegistrarEnJornada } from "../jornadas/validaciones.js";
import { calcularEdad } from "../formato/fechas.js";
import { obtenerCatalogoDeAreas } from "./areas.api.js";
import { opcionesDeAreas } from "./areas.campos.js";
import { CAMPOS_CONSULTA, CAMPOS_TRIAJE } from "./campos.js";
import {
  actualizarConsulta,
  agregarDiagnosticoAConsulta,
  crearDiagnostico,
  listarDiagnosticos,
  quitarDiagnosticoDeConsulta,
  registrarConsulta,
} from "./consultas.api.js";
import { seccionesConCampos } from "./consultas.secciones.js";
import { detalleDeConsultaAgendada, obtenerVisitasDePaciente } from "./historial.api.js";
import {
  puedeAdministrarDiagnosticos,
  puedeCorregirConsulta,
  puedeCorregirTriaje,
  puedeCrearConsulta,
  puedeEmitirReceta,
  puedeTomarTriaje,
  puedeVerHistorial,
} from "./permisos.js";
import { actualizarTriaje, registrarTriaje } from "./triaje.api.js";
import {
  avisosDeSignos,
  calcularImc,
  haySignosCapturados,
  validarCambioDeTriaje,
  validarTriaje,
} from "./triaje.validaciones.js";
const IDS_DE_TEXTO_DE_CONSULTA = CAMPOS_CONSULTA.filter((campo) => campo.id !== "diagnosticos").map(
  (campo) => campo.id,
);

/** Cuanto se espera despues de la ultima tecla para guardar el borrador. */
export const RETARDO_DE_BORRADOR_MS = 800;

/**
 * Donde se guarda el borrador de una consulta nueva. Por paciente y jornada, no por atencion:
 * la atencion todavia no existe mientras se escribe (se crea al guardar).
 *
 * @param {string} pacienteId
 * @param {string} jornadaId
 * @returns {string}
 */
export function claveDeBorrador(pacienteId, jornadaId, citaId = null) {
  // Con cita, un borrador por cita: el paciente puede tener otra cita en la misma jornada.
  return citaId
    ? `ecopac:consulta:${pacienteId}:${jornadaId}:${citaId}`
    : `ecopac:consulta:${pacienteId}:${jornadaId}`;
}

/**
 * Si la consulta es agendada y con que detalle (issue #927): la que se atiende desde una cita, o
 * una que ya salio de una cita y se reabre desde el historial. En las dos el area es la de la cita
 * y no se cambia: la base la vuelve a poner (fn_consulta_de_cita_antes, 00184).
 *
 * @param {{ detalle?: string|null }|null} cita La cita que se atiende, si se atiende una.
 * @param {object|null} consulta La consulta sobre la que se trabaja.
 * @returns {{ detalle: string|null }|null}
 */
export function agendadaDeConsulta(cita, consulta) {
  if (cita) return { detalle: cita.detalle ?? null };
  if (consulta?.citaId) return { detalle: detalleDeConsultaAgendada(consulta) };
  return null;
}

/**
 * La consulta de la visita sobre la que se trabaja (issue #927). Pura.
 *
 * - Con `cita`: la que salio de esa cita, o ninguna (se va a crear).
 * - Con `consultaId`: esa (se eligio en el historial).
 * - Sin nada: la que no salio de una cita, como antes de las citas: una consulta sin cita completa
 *   o corrige la de la visita, no crea otra.
 *
 * @param {object|null} visita Lo que devuelve aVisita().
 * @param {{ cita?: { id: string }|null, consultaId?: string|null }} [opciones]
 * @returns {object|null}
 */
export function consultaObjetivoDeVisita(visita, { cita = null, consultaId = null } = {}) {
  const consultas = visita?.consultas ?? (visita?.consulta ? [visita.consulta] : []);
  if (cita?.id) return consultas.find((consulta) => consulta.citaId === cita.id) ?? null;
  if (consultaId) return consultas.find((consulta) => consulta.id === consultaId) ?? null;
  return consultas.find((consulta) => !consulta.citaId) ?? null;
}

/**
 * Solo los signos que se midieron: un signo vacio no viaja al INSERT.
 *
 * @param {object} [valores]
 * @returns {object}
 */
export function soloSignosCapturados(valores = {}) {
  return Object.fromEntries(
    Object.entries(valores).filter(
      ([, valor]) => valor !== "" && valor !== null && valor !== undefined,
    ),
  );
}

/**
 * Si la consulta tiene algo escrito. Una lista de diagnosticos vacia no cuenta.
 *
 * @param {object} [valores]
 * @returns {boolean}
 */
export function hayBorradorConDatos(valores = {}) {
  return Object.values(valores).some((valor) =>
    Array.isArray(valor) ? valor.length > 0 : String(valor ?? "").trim() !== "",
  );
}

/**
 * Los valores del formulario en la forma que espera registrarConsulta(). El primer diagnostico
 * elegido es el principal.
 *
 * @param {object} [valores]
 * @param {object} opciones
 * @param {string} opciones.expedienteId
 * @param {string} opciones.atencionId
 * @param {string} opciones.medicoId
 * @param {string} opciones.jornadaId
 * @param {string|null} [opciones.citaId] La cita de la que sale la consulta (00184).
 * @returns {object} Con: expediente, atencion, medico, jornada, citaId, areaId, motivoConsulta, antecedentes, sintomas, exploracion, tratamiento, observaciones, planSeguimiento, diagnosticos.
 */
export function aDatosDeConsulta(
  valores = {},
  { expedienteId, atencionId, medicoId, jornadaId, citaId = null },
) {
  return {
    expediente: expedienteId,
    atencion: atencionId,
    medico: medicoId,
    jornada: jornadaId,
    citaId,
    areaId: valores.areaId || null,
    motivoConsulta: valores.motivoConsulta,
    antecedentes: valores.antecedentes || null,
    sintomas: valores.sintomas || null,
    exploracion: valores.exploracion || null,
    tratamiento: valores.tratamiento || null,
    observaciones: valores.observaciones || null,
    planSeguimiento: valores.planSeguimiento || null,
    diagnosticos: (valores.diagnosticos ?? []).map((id, indice) => ({
      diagnosticoId: id,
      esPrincipal: indice === 0,
    })),
  };
}

/**
 * Los signos de una visita como valores del formulario. `""` para lo que no se midio: es el vacio
 * que entienden los campos numericos de las dos apps.
 *
 * @param {object|null} visita Lo que devuelve aVisita().
 * @returns {object}
 */
export function valoresDeSignos(visita) {
  return CAMPOS_TRIAJE.reduce((valores, campo) => {
    const valor = visita?.signos?.[campo.id];
    valores[campo.id] = valor === null || valor === undefined ? "" : valor;
    return valores;
  }, {});
}

/**
 * La consulta de una visita como valores del formulario. Los diagnosticos van como lista de ids
 * con el principal primero, que es el orden en el que registrarConsulta() decide cual es el
 * principal.
 *
 * @param {object|null} visita
 * @param {object|null} [consulta] La consulta de la visita a mostrar; por defecto la primera.
 * @returns {object}
 */
export function valoresDeConsulta(visita, consulta = visita?.consulta) {
  const valores = Object.fromEntries(
    IDS_DE_TEXTO_DE_CONSULTA.map((id) => [id, consulta?.[id] ?? ""]),
  );
  const diagnosticos = [...(consulta?.diagnosticos ?? [])]
    .sort((uno, otro) => Number(otro.esPrincipal) - Number(uno.esPrincipal))
    .map((diagnostico) => diagnostico.id)
    .filter(Boolean);
  return { ...valores, diagnosticos };
}

/**
 * Lo que cambio en los signos respecto de lo guardado, para corregir solo eso.
 *
 * @param {object} valores
 * @param {object} iniciales
 * @returns {object}
 */
export function cambiosDeSignos(valores, iniciales) {
  return Object.fromEntries(
    Object.keys(iniciales)
      .filter((id) => String(valores[id] ?? "") !== String(iniciales[id] ?? ""))
      .map((id) => [id, valores[id]]),
  );
}

/**
 * Que diagnosticos agregar y cuales quitar para pasar de los guardados a los elegidos.
 *
 * @param {string[]} elegidos Ids de diagnostico elegidos en el formulario.
 * @param {{ id: string, vinculoId: string }[]} guardados Los de la consulta, con su vinculo.
 * @returns {{ agregar: string[], quitar: string[] }} `quitar` son ids de vinculo.
 */
export function cambiosDeDiagnosticos(elegidos = [], guardados = []) {
  const idsGuardados = new Set(guardados.map((diagnostico) => diagnostico.id));
  const idsElegidos = new Set(elegidos);
  return {
    agregar: elegidos.filter((id) => !idsGuardados.has(id)),
    quitar: guardados
      .filter((diagnostico) => !idsElegidos.has(diagnostico.id))
      .map((diagnostico) => diagnostico.vinculoId)
      .filter(Boolean),
  };
}

/**
 * Que puede hacer este rol con cada parte de la visita. Pura para probarla sin montar.
 *
 * Crear y corregir no son el mismo permiso: un voluntario toma signos pero no los corrige
 * (00033), y un medico solo corrige sus propias consultas.
 *
 * @param {string} rol
 * @param {object|null} visita
 * @param {string|null} perfilId
 * @param {object|null} [consultaExistente] La consulta sobre la que se trabaja; por defecto la
 *   primera de la visita.
 * @returns {{ signos: boolean, consulta: boolean, receta: boolean }}
 */
export function permisosDeConsulta(
  rol,
  visita,
  perfilId,
  consultaExistente = visita?.consulta ?? null,
) {
  const signosExistentes = Boolean(visita?.signos);
  return {
    signos: signosExistentes ? puedeCorregirTriaje(rol) : puedeTomarTriaje(rol),
    consulta: consultaExistente
      ? puedeCorregirConsulta(rol, consultaExistente, perfilId)
      : puedeCrearConsulta(rol),
    receta: puedeEmitirReceta(rol),
  };
}

/**
 * @param {object} opciones
 * @param {{ id: string, fechaNacimiento?: string, expediente?: { id: string } }} opciones.paciente
 * @param {object|null} [opciones.visita] Visita existente (aVisita()), para completarla o
 *   corregirla. Sin ella, es una consulta nueva en `jornadaId`.
 * @param {string|null} [opciones.jornadaId] Jornada de una consulta nueva.
 * @param {string} [opciones.estadoDeJornada]
 * @param {{ id: string, jornadaId: string, areaId: string }|null} [opciones.cita] La cita que se
 *   atiende (issue #927): la consulta se crea con ella y su area queda fija.
 * @param {string|null} [opciones.consultaId] Que consulta de la visita corregir, cuando tiene varias.
 * @param {string} opciones.perfilId
 * @param {string} opciones.rol
 * @param {object} [opciones.almacenamiento] Adaptador de la app (AsyncStorage/localStorage). Con
 *   el, lo que se escribe en una consulta nueva se guarda solo cada pocos cientos de milisegundos
 *   y sobrevive a un cierre accidental: en jornada, con la bateria justa, pasa.
 *
 * @returns {object} Con: visita, esNueva, jornadaId, bloqueo, permisos, camposDeSignos, signos, setSigno, avisos, imc, signosTomadosPor, seccionesDeConsulta, consulta, setCampoDeConsulta, catalogos, crearDiagnosticoNuevo, errorDiagnostico, errores, error, enviando, guardadaAlMenosUnaVez, guardar, descartarBorrador, hayCambios, receta.
 */
export function useConsulta({
  paciente,
  visita: visitaInicial = null,
  jornadaId: jornadaElegida = null,
  cita = null,
  consultaId = null,
  estadoDeJornada,
  perfilId,
  rol,
  almacenamiento,
} = {}) {
  const [visita, setVisita] = useState(visitaInicial);
  const jornadaId = visita?.jornadaId ?? jornadaElegida ?? cita?.jornadaId ?? null;
  const citaId = cita?.id ?? null;
  const citaAreaId = cita?.areaId ?? null;

  const consultaObjetivo = useMemo(
    () => consultaObjetivoDeVisita(visita, { cita: citaId ? { id: citaId } : null, consultaId }),
    [visita, citaId, consultaId],
  );

  const iniciales = useMemo(() => {
    const valores = valoresDeConsulta(visita, consultaObjetivo);
    // Una consulta nueva de una cita arranca con el area de la cita.
    if (!consultaObjetivo && citaAreaId) valores.areaId = citaAreaId;
    return { signos: valoresDeSignos(visita), consulta: valores };
  }, [visita, consultaObjetivo, citaAreaId]);
  const [signos, setSignos] = useState(iniciales.signos);
  const [consulta, setConsulta] = useState(iniciales.consulta);
  const [errores, setErrores] = useState({ signos: {}, consulta: {} });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [guardadaAlMenosUnaVez, setGuardadaAlMenosUnaVez] = useState(false);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [errorDiagnostico, setErrorDiagnostico] = useState(null);

  // Al cambiar la visita (se guardo, o se eligio otra jornada que ya tenia una) el formulario
  // pasa a mostrar lo que hay guardado.
  useEffect(() => {
    setSignos(iniciales.signos);
    setConsulta(iniciales.consulta);
    setErrores({ signos: {}, consulta: {} });
  }, [iniciales]);

  // Una consulta "nueva" en una jornada donde el paciente ya tiene visita no es nueva: es esa
  // visita, a completar. atenciones es UNIQUE (paciente, jornada), asi que crear otra fallaria.
  const jornadaABuscar = jornadaElegida ?? cita?.jornadaId ?? null;
  useEffect(() => {
    if (visitaInicial || !paciente?.id || !jornadaABuscar || !puedeVerHistorial(rol)) {
      return undefined;
    }
    let vigente = true;
    obtenerVisitasDePaciente(paciente.id, { rol, jornadaId: jornadaABuscar }).then(
      ({ visitas }) => {
        if (vigente) setVisita(visitas[0] ?? null);
      },
    );
    return () => {
      vigente = false;
    };
  }, [visitaInicial, paciente?.id, jornadaABuscar, rol]);

  useEffect(() => {
    let vigente = true;
    listarDiagnosticos().then(({ diagnosticos: filas }) => {
      if (!vigente) return;
      setDiagnosticos(
        (filas ?? []).map((fila) => ({
          value: fila.id,
          label: [fila.codigo, fila.nombre].filter(Boolean).join(" "),
        })),
      );
    });
    // Todas: una consulta vieja puede tener un area retirada (opcionesDeAreas la deja visible).
    obtenerCatalogoDeAreas().then(({ areas: filas }) => {
      if (vigente) setAreas(filas ?? []);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const permisos = permisosDeConsulta(rol, visita, perfilId, consultaObjetivo);

  // Agregar una parte que falta solo se puede en una jornada que acepta registros. Corregir lo
  // que ya esta no depende de la jornada: un error de digitacion se corrige cuando se ve.
  const bloqueo = useMemo(() => {
    if (!jornadaId) {
      return { puede: false, motivo: "Elige la jornada en la que se atiende al paciente." };
    }
    if (estadoDeJornada === undefined) return { puede: true, motivo: null };
    return puedeRegistrarEnJornada(estadoDeJornada);
  }, [jornadaId, estadoDeJornada]);

  const edad = useMemo(() => calcularEdad(paciente?.fechaNacimiento), [paciente?.fechaNacimiento]);
  const avisos = useMemo(() => avisosDeSignos(signos, edad), [signos, edad]);
  const imc = useMemo(() => calcularImc(signos.peso, signos.talla), [signos.peso, signos.talla]);

  // Borrador: solo para una consulta nueva. Una consulta existente ya esta guardada en la base.
  const claveBorrador =
    !consultaObjetivo && paciente?.id && jornadaId
      ? claveDeBorrador(paciente.id, jornadaId, citaId)
      : null;
  const borradorCargado = useRef(null);

  useEffect(() => {
    if (!claveBorrador || !almacenamiento || borradorCargado.current === claveBorrador) {
      return undefined;
    }
    let vigente = true;
    (async () => {
      try {
        const guardado = await almacenamiento.getItem(claveBorrador);
        if (vigente && guardado) {
          const { signos: signosGuardados, consulta: consultaGuardada } = JSON.parse(guardado);
          if (signosGuardados) setSignos((actuales) => ({ ...actuales, ...signosGuardados }));
          if (consultaGuardada) setConsulta((actuales) => ({ ...actuales, ...consultaGuardada }));
        }
      } catch {
        // Un borrador ilegible no puede impedir escribir la consulta: se descarta.
        await almacenamiento.removeItem(claveBorrador);
      }
      if (vigente) borradorCargado.current = claveBorrador;
    })();
    return () => {
      vigente = false;
    };
  }, [claveBorrador, almacenamiento]);

  useEffect(() => {
    if (!claveBorrador || !almacenamiento || borradorCargado.current !== claveBorrador) {
      return undefined;
    }
    if (!hayBorradorConDatos(consulta) && !haySignosCapturados(signos)) return undefined;

    const temporizador = setTimeout(() => {
      almacenamiento.setItem(claveBorrador, JSON.stringify({ signos, consulta }));
    }, RETARDO_DE_BORRADOR_MS);
    return () => clearTimeout(temporizador);
  }, [signos, consulta, claveBorrador, almacenamiento]);

  const descartarBorrador = useCallback(async () => {
    setSignos(valoresDeSignos(null));
    setConsulta(valoresDeConsulta(null));
    if (claveBorrador && almacenamiento) await almacenamiento.removeItem(claveBorrador);
  }, [claveBorrador, almacenamiento]);

  const setSigno = useCallback((id, valor) => {
    setSignos((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => ({ ...anteriores, signos: sinError(anteriores.signos, id) }));
  }, []);

  const setCampoDeConsulta = useCallback((id, valor) => {
    setConsulta((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => ({ ...anteriores, consulta: sinError(anteriores.consulta, id) }));
  }, []);

  const recargarVisita = useCallback(async () => {
    if (!paciente?.id || !jornadaId || !puedeVerHistorial(rol)) return null;
    const { visitas } = await obtenerVisitasDePaciente(paciente.id, { rol, jornadaId });
    const actual = visitas[0] ?? null;
    setVisita(actual);
    return actual;
  }, [paciente?.id, jornadaId, rol]);

  const guardar = useCallback(async () => {
    setError(null);
    const signosExistentes = visita?.signos ?? null;
    const consultaExistente = consultaObjetivo;
    const hayConsulta = hayBorradorConDatos(consulta);
    const haySignos = haySignosCapturados(signos);
    const cambiosSignos = signosExistentes ? cambiosDeSignos(signos, iniciales.signos) : {};

    // 1. Validar todo ANTES de escribir nada: una atencion creada para una consulta que despues
    //    no pasa la validacion queda como una visita vacia en el historial.
    const erroresSignos = signosExistentes
      ? validarCambioDeTriaje(cambiosSignos)
      : haySignos
        ? validarTriaje(signos)
        : {};
    if (signosExistentes && !haySignos) {
      erroresSignos.signos =
        "Los signos de esta visita no se pueden borrar todos. Corrige el valor equivocado.";
    }
    const erroresConsulta =
      (hayConsulta || consultaExistente) && String(consulta.motivoConsulta ?? "").trim() === ""
        ? { motivoConsulta: "El motivo de consulta es obligatorio." }
        : {};

    if (Object.keys(erroresSignos).length > 0 || Object.keys(erroresConsulta).length > 0) {
      setErrores({ signos: erroresSignos, consulta: erroresConsulta });
      return { ok: false };
    }

    const escribeSignos = signosExistentes
      ? Object.keys(cambiosSignos).length > 0
      : haySignos && permisos.signos;
    const escribeConsulta = consultaExistente
      ? permisos.consulta
      : hayConsulta && permisos.consulta;

    if (!escribeSignos && !escribeConsulta) {
      setError({ mensaje: "No hay nada que guardar: registra los signos o la consulta." });
      return { ok: false };
    }

    const agregaAlgo =
      (!signosExistentes && escribeSignos) || (!consultaExistente && escribeConsulta);
    if (agregaAlgo && !bloqueo.puede) {
      setError({ mensaje: bloqueo.motivo });
      return { ok: false };
    }

    setEnviando(true);
    try {
      // 2. La atencion: la de la visita, o una nueva en la jornada elegida.
      let atencionId = visita?.atencionId ?? null;
      if (!atencionId) {
        const resuelta = await resolverAtencion(paciente.id, jornadaId, { estadoDeJornada });
        if (!resuelta.atencionId) {
          setError(resuelta.error ?? { mensaje: "No se pudo abrir la visita del paciente." });
          return { ok: false };
        }
        atencionId = resuelta.atencionId;
      }

      // 3. Los signos.
      if (escribeSignos) {
        const resultado = signosExistentes
          ? await actualizarTriaje(signosExistentes.id, cambiosSignos)
          : await registrarTriaje(atencionId, soloSignosCapturados(signos), {
              tomadoPor: perfilId,
            });
        if (resultado.error || Object.keys(resultado.errores ?? {}).length > 0) {
          setErrores((anteriores) => ({ ...anteriores, signos: resultado.errores ?? {} }));
          setError(resultado.error);
          await recargarVisita();
          return { ok: false };
        }
      }

      // 4. La consulta, con sus diagnosticos.
      if (escribeConsulta) {
        const fallo = consultaExistente
          ? await corregirConsulta(consultaExistente, consulta)
          : (
              await registrarConsulta(
                aDatosDeConsulta(consulta, {
                  expedienteId: paciente.expediente?.id,
                  atencionId,
                  medicoId: perfilId,
                  jornadaId,
                  citaId,
                }),
                { estadoDeJornada },
              )
            ).error;
        if (fallo) {
          setError(fallo);
          await recargarVisita();
          return { ok: false };
        }
      }

      if (claveBorrador && almacenamiento) await almacenamiento.removeItem(claveBorrador);
      const actualizada = await recargarVisita();
      setGuardadaAlMenosUnaVez(true);
      return { ok: true, visita: actualizada, atencionId };
    } finally {
      setEnviando(false);
    }
  }, [
    visita,
    consultaObjetivo,
    citaId,
    consulta,
    signos,
    iniciales,
    permisos.signos,
    permisos.consulta,
    bloqueo,
    paciente,
    jornadaId,
    estadoDeJornada,
    perfilId,
    recargarVisita,
    claveBorrador,
    almacenamiento,
  ]);

  // Alta de un diagnostico sin salir de la consulta, para quien puede mantener el catalogo.
  const crearDiagnosticoNuevo = useCallback(async (nombre) => {
    setErrorDiagnostico(null);
    const { diagnostico, error: fallo } = await crearDiagnostico({ nombre });
    if (fallo || !diagnostico) {
      setErrorDiagnostico(fallo ?? null);
      return null;
    }
    setDiagnosticos((actuales) =>
      [
        ...actuales,
        {
          value: diagnostico.id,
          label: [diagnostico.codigo, diagnostico.nombre].filter(Boolean).join(" "),
        },
      ].sort((uno, otro) => uno.label.localeCompare(otro.label, "es")),
    );
    return diagnostico.id;
  }, []);

  const consultaGuardada = consultaObjetivo;

  const agendada = useMemo(
    () => agendadaDeConsulta(cita, consultaObjetivo),
    [cita, consultaObjetivo],
  );
  const esAgendada = Boolean(agendada);

  const seccionesDeConsulta = useMemo(
    () =>
      seccionesConCampos().map((seccion) => ({
        ...seccion,
        campos: seccion.campos.map((campo) =>
          campo.id === "areaId" && esAgendada ? { ...campo, soloLectura: true } : campo,
        ),
      })),
    [esAgendada],
  );

  return {
    visita,
    esNueva: !visita,
    jornadaId,
    bloqueo,
    permisos,

    camposDeSignos: CAMPOS_TRIAJE,
    signos,
    setSigno,
    avisos,
    imc,
    signosTomadosPor: visita?.signosTomadosPor ?? null,

    seccionesDeConsulta,
    consulta,
    setCampoDeConsulta,
    catalogos: { diagnosticos, areasAtencion: opcionesDeAreas(areas, [consulta.areaId]) },
    // La consulta sobre la que se trabaja (null si se va a crear) y, si es agendada, su cita.
    consultaActual: consultaObjetivo,
    cita,
    agendada,
    crearDiagnosticoNuevo: puedeAdministrarDiagnosticos(rol) ? crearDiagnosticoNuevo : null,
    errorDiagnostico,

    errores,
    error,
    enviando,
    guardadaAlMenosUnaVez,
    guardar,
    descartarBorrador,
    // Hay algo escrito que se perderia al salir sin guardar.
    hayCambios:
      !enviando &&
      (Object.keys(cambiosDeConsulta(consulta, iniciales.consulta)).length > 0 ||
        Object.keys(cambiosDeSignos(signos, iniciales.signos)).length > 0),

    // El tercer paso. Una receta cuelga de la consulta guardada.
    receta: {
      existentes: consultaObjetivo?.recetas ?? visita?.recetas ?? [],
      consultaId: consultaGuardada?.id ?? null,
      puedeAgregar: permisos.receta && Boolean(consultaGuardada),
    },
  };
}

/** Los campos de la consulta que difieren de lo guardado. */
function cambiosDeConsulta(valores, iniciales) {
  return Object.fromEntries(
    Object.keys(iniciales)
      .filter((id) => JSON.stringify(valores[id] ?? "") !== JSON.stringify(iniciales[id] ?? ""))
      .map((id) => [id, valores[id]]),
  );
}

function sinError(errores, id) {
  if (!(id in errores)) return errores;
  return Object.fromEntries(Object.entries(errores).filter(([clave]) => clave !== id));
}

/**
 * Corrige una consulta existente: sus textos y, uno a uno, sus diagnosticos (00127).
 *
 * @returns {Promise<object|null>} El primer error, o null si todo salio bien.
 */
async function corregirConsulta(existente, valores) {
  const textos = Object.fromEntries(IDS_DE_TEXTO_DE_CONSULTA.map((id) => [id, valores[id]]));
  const { error } = await actualizarConsulta(existente.id, textos);
  if (error) return error;

  const { agregar, quitar } = cambiosDeDiagnosticos(valores.diagnosticos, existente.diagnosticos);
  for (const vinculoId of quitar) {
    const resultado = await quitarDiagnosticoDeConsulta(vinculoId);
    if (resultado.error) return resultado.error;
  }
  for (const diagnosticoId of agregar) {
    const resultado = await agregarDiagnosticoAConsulta(existente.id, diagnosticoId);
    if (resultado.error) return resultado.error;
  }
  return null;
}
