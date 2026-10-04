// View model de la agenda de citas (issue #927): calendario de mes y de dia, filtros y "Mis citas".
//
// Trae de la base las citas del rango visible SIN los filtros, y filtra en el cliente: para decir
// cuantas salas le quedan a la clinica filtrada en cada horario hacen falta todas sus citas, no
// solo las del area o el profesional elegidos. El rango es un mes; las citas de un mes caben.
//
// La cuenta de salas es la de las citas que la RLS deja ver. Para la administradora y quien
// gestiona jornadas son todas; el personal de campo ve las de sus jornadas, y una clinica que se
// comparte con otra jornada puede tener menos salas libres que las que se ven. La base no deja
// pasar el exceso (fn_validar_cita).

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarJornadas } from "../jornadas/api.js";
import { obtenerCatalogoDeAreas } from "../pacientes/areas.api.js";
import { opcionesDeFiltroDeAreas } from "../pacientes/areas.campos.js";
import { ROLES } from "../usuarios/roles.js";
import {
  horariosDelDia,
  moverFecha,
  rangoDeLaVista,
  semanasDelMes,
  tituloDeLaAgenda,
  VISTAS_AGENDA,
} from "./agenda.js";
import { listarCitas } from "./api.js";
import { listarClinicas } from "./clinicas.api.js";
import { OPCIONES_ESTADO_CITA } from "./estados.js";
import { FILTROS_AGENDA_CITAS_VACIOS, filtrarCitas } from "./filtros.js";
import { hoyEnGuatemala } from "./horas.js";
import { puedeAgendarCitas, puedeVerCitas } from "./permisos.js";

/**
 * Los profesionales que aparecen en las citas cargadas, para el filtro.
 *
 * @param {object[]} citas
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeProfesionalesDeCitas(citas = []) {
  const porId = new Map();
  citas.forEach((cita) => {
    if (cita.profesionalId) porId.set(cita.profesionalId, cita.profesional ?? "Sin nombre");
  });
  return [...porId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((uno, otro) => uno.label.localeCompare(otro.label, "es"));
}

/**
 * @param {{ rol?: string, perfilId?: string|null, fechaInicial?: string, vistaInicial?: string }} [opciones]
 *   La movil arranca en el dia (`VISTAS_AGENDA.DIA`): la issue pide la agenda del dia, sin mes.
 * @returns {object} Con: vista, setVista, fecha, irA, anterior, siguiente, irAHoy, titulo,
 *   semanas, horarios, citas, filtros, setFiltro, limpiarFiltros, hayFiltros, misCitas,
 *   setMisCitas, puedeVerMisCitas, catalogos, cargando, error, recargar, permitido, puedeAgendar.
 */
export function useAgendaCitas({
  rol,
  perfilId = null,
  fechaInicial,
  vistaInicial = VISTAS_AGENDA.MES,
} = {}) {
  const [vista, setVista] = useState(vistaInicial);
  const [fecha, setFecha] = useState(fechaInicial ?? hoyEnGuatemala());
  const [filtros, setFiltros] = useState(FILTROS_AGENDA_CITAS_VACIOS);
  const [misCitas, setMisCitas] = useState(false);
  const [citas, setCitas] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeVerCitas(rol);
  const puedeVerMisCitas = rol === ROLES.MEDICO && Boolean(perfilId);
  const rango = useMemo(() => rangoDeLaVista(vista, fecha), [vista, fecha]);

  useEffect(() => {
    if (!permitido) return undefined;
    let vigente = true;
    Promise.all([listarJornadas(), listarClinicas(), obtenerCatalogoDeAreas()]).then(
      ([respuestaJornadas, respuestaClinicas, respuestaAreas]) => {
        if (!vigente) return;
        setJornadas(respuestaJornadas.jornadas);
        setClinicas(respuestaClinicas.clinicas);
        setAreas(respuestaAreas.areas);
        setError(respuestaJornadas.error ?? respuestaClinicas.error ?? respuestaAreas.error);
      },
    );
    return () => {
      vigente = false;
    };
  }, [permitido]);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setCitas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const respuesta = await listarCitas({ desde: rango.desde, hasta: rango.hasta });
    setCitas(respuesta.citas);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido, rango.desde, rango.hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrosEfectivos = useMemo(
    () => (misCitas && puedeVerMisCitas ? { ...filtros, profesionalId: perfilId } : filtros),
    [filtros, misCitas, puedeVerMisCitas, perfilId],
  );

  const filtradas = useMemo(() => filtrarCitas(citas, filtrosEfectivos), [citas, filtrosEfectivos]);

  const hoy = hoyEnGuatemala();
  const semanas = useMemo(() => semanasDelMes(fecha, filtradas, hoy), [fecha, filtradas, hoy]);

  const clinicaFiltrada = clinicas.find((clinica) => clinica.id === filtros.clinicaId) ?? null;
  const horarios = useMemo(
    () =>
      horariosDelDia(fecha, filtradas, {
        salas: clinicaFiltrada?.salasDisponibles ?? null,
        citasDeLaClinica: clinicaFiltrada
          ? citas.filter((cita) => cita.clinicaId === clinicaFiltrada.id)
          : [],
      }),
    [fecha, filtradas, citas, clinicaFiltrada],
  );

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFiltros(FILTROS_AGENDA_CITAS_VACIOS);
    setMisCitas(false);
  }, []);

  /** Abrir un dia desde el mes. */
  const irA = useCallback((nuevaFecha, nuevaVista = VISTAS_AGENDA.DIA) => {
    setFecha(nuevaFecha);
    setVista(nuevaVista);
  }, []);

  const catalogos = useMemo(
    () => ({
      jornadas: jornadas.map((jornada) => ({ value: jornada.id, label: jornada.nombre })),
      clinicas: clinicas.map((clinica) => ({ value: clinica.id, label: clinica.nombre })),
      areasAtencion: opcionesDeFiltroDeAreas(areas),
      profesionales: opcionesDeProfesionalesDeCitas(citas),
      estadoCita: OPCIONES_ESTADO_CITA,
    }),
    [jornadas, clinicas, areas, citas],
  );

  return {
    vista,
    setVista,
    fecha,
    irA,
    anterior: () => setFecha((actual) => moverFecha(vista, actual, -1)),
    siguiente: () => setFecha((actual) => moverFecha(vista, actual, 1)),
    irAHoy: () => setFecha(hoyEnGuatemala()),
    titulo: tituloDeLaAgenda(vista, fecha),
    semanas,
    horarios,
    clinicaFiltrada,
    citas: filtradas,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: misCitas || Object.values(filtros).some(Boolean),
    misCitas,
    setMisCitas,
    puedeVerMisCitas,
    catalogos,
    cargando,
    error,
    recargar: cargar,
    permitido,
    puedeAgendar: puedeAgendarCitas(rol),
  };
}
