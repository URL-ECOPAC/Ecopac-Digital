// Pruebas de las reglas, permisos, formulario y API de la agenda de citas (issue #927). Datos
// inventados.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { ROLES } = await import("../usuarios/roles.js");
const {
  avisoDeFueraDeTurno,
  conflictosDeCita,
  intervaloDeCita,
  maximoDeCitasSimultaneas,
  motivoDeCancelacion,
  salasLibres,
  seTraslapan,
  validarCancelacion,
  validarCita,
  LARGO_MAXIMO_MOTIVO_DE_CANCELACION,
  LARGO_MAXIMO_NOTAS_DE_CITA,
} = await import("./validaciones.js");
const {
  edicionDeCita,
  puedeAgendarCitas,
  puedeAtenderCita,
  puedeCancelarCita,
  puedeRegresarCitaACreada,
  puedeVerCitas,
} = await import("./permisos.js");
const { opcionesDeJornadasParaAgendar, opcionesDeProfesionales, valoresDeCitaNueva } =
  await import("./campos.js");
const { aplicarCambioDeCita, datosAGuardar, valoresDeCita } =
  await import("./useFormularioCita.js");
const { accionesDeCita, citaParaConsulta } = await import("./useCambioEstadoCita.js");
const { separarCitasDelPaciente } = await import("./useCitasDelPaciente.js");
const { opcionesDeProfesionalesDeCitas } = await import("./useAgendaCitas.js");
const { aInstanteDeGuatemala } = await import("./horas.js");
const {
  aCita,
  actualizarCita,
  cambiarEstadoDeCita,
  citasQueSeCruzan,
  contarCitasPendientesDeJornada,
  crearCita,
  errorDeCita,
  listarCitas,
  listarJornadasParaAgendar,
  listarProfesionalesDeJornada,
  obtenerCita,
} = await import("./api.js");

const en = (inicio, fin, extra = {}) => ({
  iniciaEn: aInstanteDeGuatemala("2026-10-03", inicio),
  terminaEn: aInstanteDeGuatemala("2026-10-03", fin),
  estado: "creada",
  ...extra,
});

const FORMULARIO = {
  pacienteId: "pac-1",
  jornadaId: "jor-1",
  clinicaId: "cli-1",
  areaId: "are-1",
  profesionalId: "",
  fecha: "2026-10-03",
  horaInicio: "10:30",
  horaFin: "11:00",
  notas: "",
};

/** Doble de supabase-js: cada tabla responde lo configurado; se anotan las llamadas. */
function crearCliente(respuestas = {}) {
  const llamadas = [];
  const cadena = (clave) => {
    const responder = () => Promise.resolve(respuestas[clave] ?? { data: [], error: null });
    const encadenable = {};
    for (const paso of [
      "select",
      "insert",
      "update",
      "eq",
      "neq",
      "in",
      "gt",
      "gte",
      "lt",
      "or",
      "order",
    ]) {
      encadenable[paso] = (...argumentos) => {
        llamadas.push({ clave, paso, argumentos });
        return encadenable;
      };
    }
    encadenable.maybeSingle = responder;
    encadenable.then = (alCumplir, alFallar) => responder().then(alCumplir, alFallar);
    return encadenable;
  };
  return { llamadas, from: (tabla) => cadena(tabla) };
}

const pasos = (cliente, paso) =>
  cliente.llamadas.filter((llamada) => llamada.paso === paso).map((llamada) => llamada.argumentos);

beforeEach(() => {
  dobles.cliente = null;
});

describe("validarCita", () => {
  it("exige paciente, jornada, clinica, area, fecha y horas", () => {
    expect(Object.keys(validarCita({}))).toEqual([
      "pacienteId",
      "jornadaId",
      "clinicaId",
      "areaId",
      "fecha",
      "horaInicio",
      "horaFin",
    ]);
    expect(validarCita(FORMULARIO)).toEqual({});
  });

  it("el fin va despues del inicio y la fecha no antes de la jornada", () => {
    expect(validarCita({ ...FORMULARIO, horaFin: "10:30" }).horaFin).toMatch(/después del inicio/);
    expect(
      validarCita({ ...FORMULARIO, fecha: "2026-10-02" }, { fechaDeJornada: "2026-10-03" }),
    ).toEqual({ fecha: "La cita no puede ser antes de la fecha de la jornada (03/10/2026)." });
  });

  it("las notas tienen un largo maximo", () => {
    expect(
      validarCita({ ...FORMULARIO, notas: "x".repeat(LARGO_MAXIMO_NOTAS_DE_CITA + 1) }).notas,
    ).toMatch(/no pueden pasar/);
  });

  it("el motivo de cancelacion es opcional y se guarda limpio o null", () => {
    expect(validarCancelacion("")).toEqual({});
    expect(validarCancelacion()).toEqual({});
    expect(validarCancelacion("x".repeat(LARGO_MAXIMO_MOTIVO_DE_CANCELACION + 1)).motivo).toMatch(
      /no puede pasar/,
    );
    expect(motivoDeCancelacion("  No llego  ")).toBe("No llego");
    expect(motivoDeCancelacion("   ")).toBeNull();
    expect(motivoDeCancelacion(undefined)).toBeNull();
  });
});

describe("el espejo de cupo y traslape", () => {
  it("el intervalo sale de la fecha y las horas, o null si no sirve", () => {
    expect(intervaloDeCita(FORMULARIO)).toEqual({
      iniciaEn: "2026-10-03T10:30:00-06:00",
      terminaEn: "2026-10-03T11:00:00-06:00",
    });
    expect(intervaloDeCita({ ...FORMULARIO, horaFin: "10:00" })).toBeNull();
    expect(intervaloDeCita()).toBeNull();
  });

  it("tocarse en el borde no es traslape", () => {
    expect(seTraslapan(en("10:00", "10:30"), en("10:30", "11:00"))).toBe(false);
    expect(seTraslapan(en("10:00", "10:45"), en("10:30", "11:00"))).toBe(true);
    expect(seTraslapan(en("10:00", "12:00"), en("10:30", "11:00"))).toBe(true);
  });

  it("cuenta el maximo simultaneo, sin la cancelada ni la que se edita", () => {
    const citas = [
      en("10:00", "11:00", { id: "a" }),
      en("10:30", "11:30", { id: "b" }),
      en("10:45", "11:15", { id: "c" }),
      en("10:30", "11:00", { id: "d", estado: "cancelada" }),
    ];
    expect(maximoDeCitasSimultaneas(citas, en("10:00", "12:00"))).toBe(3);
    expect(maximoDeCitasSimultaneas(citas, en("10:00", "12:00"), "c")).toBe(2);
    expect(maximoDeCitasSimultaneas(citas, en("12:00", "12:30"))).toBe(0);
    expect(maximoDeCitasSimultaneas([], en("10:00", "10:30"))).toBe(0);
    expect(salasLibres(2, citas, en("10:45", "11:00"))).toBe(0);
    expect(salasLibres(5, citas, en("10:45", "11:00"))).toBe(2);
  });

  it("varias citas a la misma hora caben mientras haya salas", () => {
    const otras = [en("10:30", "11:00", { id: "a" }), en("10:30", "11:00", { id: "b" })];
    const nueva = { pacienteId: "p-nuevo", clinicaId: "cli-1" };
    expect(conflictosDeCita(nueva, en("10:30", "11:00"), { deLaClinica: otras, salas: 3 })).toEqual(
      {},
    );
    expect(
      conflictosDeCita(nueva, en("10:30", "11:00"), { deLaClinica: otras, salas: 2 }).clinicaId,
    ).toBe("La clínica ya tiene sus 2 salas ocupadas a esa hora.");
    expect(
      conflictosDeCita(nueva, en("10:30", "11:00"), { deLaClinica: otras.slice(1), salas: 1 })
        .clinicaId,
    ).toBe("La clínica ya tiene sus 1 sala ocupada a esa hora.");
  });

  it("ni el paciente ni el profesional tienen dos citas a la vez", () => {
    const intervalo = en("10:30", "11:00");
    const conflictos = conflictosDeCita(
      { id: "editada", pacienteId: "p", profesionalId: "doc" },
      intervalo,
      {
        delPaciente: [
          en("10:00", "10:45", { id: "otra" }),
          en("10:30", "11:00", { id: "editada" }),
        ],
        delProfesional: [en("10:45", "11:30", { id: "otra2" })],
      },
    );
    expect(conflictos).toEqual({
      pacienteId: "El paciente ya tiene otra cita a esa hora.",
      profesionalId: "El profesional ya tiene otra cita a esa hora.",
    });
    // Sin profesional no hay traslape de profesional; la cita cancelada no cuenta.
    expect(
      conflictosDeCita({ pacienteId: "p", profesionalId: null }, intervalo, {
        delPaciente: [en("10:30", "11:00", { id: "x", estado: "cancelada" })],
        delProfesional: [en("10:30", "11:00", { id: "y" })],
      }),
    ).toEqual({});
  });

  it("avisa, sin bloquear, si la cita cae fuera del turno del profesional", () => {
    const turno = { horaInicio: "08:00", horaFin: "12:00" };
    expect(avisoDeFueraDeTurno({ horaInicio: "10:30", horaFin: "11:00" }, turno)).toBeNull();
    expect(avisoDeFueraDeTurno({ horaInicio: "11:45", horaFin: "12:15" }, turno)).toBe(
      "La cita queda fuera del turno del profesional (08:00 - 12:00).",
    );
    expect(avisoDeFueraDeTurno({ horaInicio: "10:30", horaFin: "11:00" }, null)).toBeNull();
    expect(
      avisoDeFueraDeTurno({ horaInicio: "10:30", horaFin: "11:00" }, { horaInicio: null }),
    ).toBeNull();
  });
});

describe("permisos de la agenda", () => {
  const creada = { estado: "creada", profesionalId: "doc-1" };

  it("la junta y los socios no ven citas; el personal de campo agenda", () => {
    expect(puedeVerCitas(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerCitas(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerCitas(ROLES.VOLUNTARIO)).toBe(true);
    expect(puedeVerCitas(null)).toBe(false);
    expect(puedeAgendarCitas(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeAgendarCitas(ROLES.MEDICO)).toBe(true);
    expect(puedeAgendarCitas(ROLES.VOLUNTARIO)).toBe(true);
    expect(puedeAgendarCitas(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });

  it("atiende el profesional de la cita, la administradora, o cualquier medico si no tiene", () => {
    expect(puedeAtenderCita(ROLES.MEDICO, creada, "doc-1")).toBe(true);
    expect(puedeAtenderCita(ROLES.MEDICO, creada, "doc-2")).toBe(false);
    expect(puedeAtenderCita(ROLES.MEDICO, { estado: "creada", profesionalId: null }, "doc-2")).toBe(
      true,
    );
    expect(puedeAtenderCita(ROLES.ADMINISTRADOR, creada, "admin")).toBe(true);
    // El voluntario la abre para tomar los signos; la consulta no la guarda.
    expect(puedeAtenderCita(ROLES.VOLUNTARIO, creada, "vol")).toBe(true);
    expect(puedeAtenderCita(ROLES.JUNTA_DIRECTIVA, creada, "j")).toBe(false);
    expect(puedeAtenderCita(ROLES.MEDICO, { ...creada, estado: "en_atencion" }, "doc-1")).toBe(
      true,
    );
    expect(puedeAtenderCita(ROLES.ADMINISTRADOR, { ...creada, estado: "atendida" }, "a")).toBe(
      false,
    );
    expect(puedeAtenderCita(ROLES.ADMINISTRADOR, null, "a")).toBe(false);
  });

  it("cancelar, regresar y editar siguen el estado", () => {
    expect(puedeCancelarCita(ROLES.VOLUNTARIO, creada)).toBe(true);
    expect(puedeCancelarCita(ROLES.VOLUNTARIO, { estado: "atendida" })).toBe(false);
    expect(puedeCancelarCita(ROLES.JUNTA_DIRECTIVA, creada)).toBe(false);
    expect(puedeRegresarCitaACreada(ROLES.MEDICO, { estado: "en_atencion" })).toBe(true);
    expect(puedeRegresarCitaACreada(ROLES.MEDICO, creada)).toBe(false);
    expect(edicionDeCita(ROLES.MEDICO, creada)).toEqual({ agenda: true, notas: true });
    expect(edicionDeCita(ROLES.MEDICO, { estado: "atendida" })).toEqual({
      agenda: false,
      notas: true,
    });
    expect(edicionDeCita(ROLES.JUNTA_DIRECTIVA, creada)).toEqual({ agenda: false, notas: false });
    expect(edicionDeCita(ROLES.MEDICO, null)).toEqual({ agenda: false, notas: false });
  });

  it("las acciones de la pantalla salen de los mismos permisos", () => {
    expect(accionesDeCita(ROLES.MEDICO, creada, "doc-1")).toEqual({
      atender: true,
      cancelar: true,
      regresar: false,
      editar: true,
    });
    expect(accionesDeCita(ROLES.MEDICO, { estado: "cancelada" }, "doc-1")).toEqual({
      atender: false,
      cancelar: false,
      regresar: false,
      editar: true,
    });
  });
});

describe("el formulario de cita", () => {
  it("una cita nueva arranca con lo que se pide y fin a los 30 minutos", () => {
    expect(
      valoresDeCitaNueva({ pacienteId: "p", fecha: "2026-10-05", horaInicio: "09:30" }),
    ).toMatchObject({
      pacienteId: "p",
      fecha: "2026-10-05",
      horaInicio: "09:30",
      horaFin: "10:00",
    });
    expect(valoresDeCitaNueva()).toMatchObject({ horaInicio: "08:00", horaFin: "08:30" });
  });

  it("al editar, los valores salen de la cita en hora de Guatemala", () => {
    expect(
      valoresDeCita({
        pacienteId: "p",
        jornadaId: "j",
        clinicaId: "c",
        areaId: "a",
        profesionalId: null,
        iniciaEn: "2026-10-03T16:30:00Z",
        terminaEn: "2026-10-03T17:00:00Z",
        notas: null,
      }),
    ).toEqual({
      pacienteId: "p",
      jornadaId: "j",
      clinicaId: "c",
      areaId: "a",
      profesionalId: "",
      fecha: "2026-10-03",
      horaInicio: "10:30",
      horaFin: "11:00",
      notas: "",
    });
  });

  it("cambiar de jornada suelta al profesional y lleva la fecha a la de la jornada", () => {
    const valores = { ...FORMULARIO, profesionalId: "doc", fecha: "2026-10-01" };
    expect(
      aplicarCambioDeCita(valores, "jornadaId", "jor-2", { fechaDeJornada: "2026-10-04" }),
    ).toMatchObject({ jornadaId: "jor-2", profesionalId: "", fecha: "2026-10-04" });
    expect(
      aplicarCambioDeCita({ ...valores, fecha: "2026-10-09" }, "jornadaId", "jor-2", {
        fechaDeJornada: "2026-10-04",
      }).fecha,
    ).toBe("2026-10-09");
  });

  it("mover el inicio por encima del fin corre el fin", () => {
    expect(aplicarCambioDeCita(FORMULARIO, "horaInicio", "11:15").horaFin).toBe("11:45");
    expect(aplicarCambioDeCita(FORMULARIO, "horaInicio", "10:00").horaFin).toBe("11:00");
    expect(aplicarCambioDeCita(FORMULARIO, "notas", null).notas).toBe("");
  });

  it("guarda la agenda entera, o solo las notas si ya no se reagenda", () => {
    expect(datosAGuardar({ ...FORMULARIO, profesionalId: "" })).toEqual({
      pacienteId: "pac-1",
      jornadaId: "jor-1",
      clinicaId: "cli-1",
      areaId: "are-1",
      profesionalId: null,
      iniciaEn: "2026-10-03T10:30:00-06:00",
      terminaEn: "2026-10-03T11:00:00-06:00",
      notas: "",
    });
    expect(datosAGuardar({ ...FORMULARIO, notas: "Llego tarde" }, { agenda: false })).toEqual({
      notas: "Llego tarde",
    });
  });

  it("las opciones de jornada y profesional dicen fecha y turno", () => {
    expect(
      opcionesDeJornadasParaAgendar([
        { id: "j", nombre: "Jornada Prueba", fecha: "2026-10-03" },
        { id: "k", nombre: "Sin fecha" },
      ]),
    ).toEqual([
      { value: "j", label: "Jornada Prueba · 03/10/2026" },
      { value: "k", label: "Sin fecha" },
    ]);
    expect(
      opcionesDeProfesionales([
        { id: "d", nombre: "Doc Prueba", horaInicio: "08:00", horaFin: "12:00" },
        { id: "e", nombre: "Otro Doc" },
      ]),
    ).toEqual([
      { value: "d", label: "Doc Prueba · 08:00 - 12:00" },
      { value: "e", label: "Otro Doc" },
    ]);
  });
});

describe("agenda, ficha y consulta", () => {
  it("las citas del paciente se separan en proximas y pasadas", () => {
    const { proximas, pasadas } = separarCitasDelPaciente([
      en("11:00", "11:30", { id: "tarde" }),
      en("09:00", "09:30", { id: "temprano", estado: "en_atencion" }),
      en("08:00", "08:30", { id: "vieja", estado: "atendida" }),
      en("10:00", "10:30", { id: "cancelada", estado: "cancelada" }),
    ]);
    expect(proximas.map((cita) => cita.id)).toEqual(["temprano", "tarde"]);
    expect(pasadas.map((cita) => cita.id)).toEqual(["cancelada", "vieja"]);
    expect(separarCitasDelPaciente()).toEqual({ proximas: [], pasadas: [] });
  });

  it("los profesionales del filtro salen de las citas cargadas, sin repetir", () => {
    expect(
      opcionesDeProfesionalesDeCitas([
        { profesionalId: "b", profesional: "Beto Prueba" },
        { profesionalId: "a", profesional: "Ana Prueba" },
        { profesionalId: "b", profesional: "Beto Prueba" },
        { profesionalId: null },
        { profesionalId: "c" },
      ]),
    ).toEqual([
      { value: "a", label: "Ana Prueba" },
      { value: "b", label: "Beto Prueba" },
      { value: "c", label: "Sin nombre" },
    ]);
  });

  it("la cita llega a la consulta con su jornada, su area y el detalle de Agendada", () => {
    expect(
      citaParaConsulta({
        id: "cita-1",
        jornadaId: "j",
        areaId: "a",
        clinica: "Clínica Norte",
        iniciaEn: "2026-10-03T16:30:00Z",
        profesional: null,
      }),
    ).toEqual({
      id: "cita-1",
      jornadaId: "j",
      areaId: "a",
      detalle: "Clínica Norte · 03/10/2026 10:30",
    });
  });
});

describe("api de citas", () => {
  const FILA = {
    id: "cita-1",
    pacienteId: "p",
    jornadaId: "j",
    clinicaId: "c",
    areaId: "a",
    profesionalId: null,
    iniciaEn: "2026-10-03T16:30:00+00:00",
    terminaEn: "2026-10-03T17:00:00+00:00",
    estado: "creada",
    notas: null,
    paciente: { nombres: "Ana", apellidos: "Prueba" },
    jornada: { nombre: "Jornada Prueba", fecha: "2026-10-03", estado: "en curso" },
    clinica: { nombre: "Clínica Norte", salasDisponibles: "3" },
    area: { nombre: "Odontología" },
    profesional: null,
    consulta: { id: "con-1" },
  };

  it("aCita aplana los nombres y la consulta de la cita", () => {
    expect(aCita(FILA)).toMatchObject({
      paciente: "Ana Prueba",
      jornada: "Jornada Prueba",
      fechaDeJornada: "2026-10-03",
      estadoDeJornada: "en curso",
      clinica: "Clínica Norte",
      salasDeLaClinica: 3,
      area: "Odontología",
      profesional: null,
      consultaId: "con-1",
    });
    expect(aCita({ ...FILA, consulta: [], clinica: null }).consultaId).toBeNull();
    expect(aCita(null)).toBeNull();
  });

  it("listarCitas aplica solo los filtros que vienen y ordena por hora", async () => {
    const cliente = crearCliente({ citas: { data: [FILA], error: null } });
    dobles.cliente = cliente;
    const { citas, error } = await listarCitas({
      desde: "d",
      hasta: "h",
      clinicaId: "c",
      estado: "creada",
    });
    expect(error).toBeNull();
    expect(citas).toHaveLength(1);
    expect(pasos(cliente, "gte")).toEqual([["inicia_en", "d"]]);
    expect(pasos(cliente, "lt")).toEqual([["inicia_en", "h"]]);
    expect(pasos(cliente, "eq")).toEqual([
      ["clinica_id", "c"],
      ["estado", "creada"],
    ]);
    expect(pasos(cliente, "order")).toEqual([["inicia_en", { ascending: true }]]);
  });

  it("listarCitas y obtenerCita devuelven el error sin lanzar", async () => {
    dobles.cliente = crearCliente({
      citas: { data: null, error: { code: "42501", message: "x" } },
    });
    expect((await listarCitas()).citas).toEqual([]);
    expect((await listarCitas()).error).not.toBeNull();
    expect(await obtenerCita(null)).toEqual({ cita: null, error: null });
    dobles.cliente = crearCliente({ citas: { data: FILA, error: null } });
    expect((await obtenerCita("cita-1")).cita.id).toBe("cita-1");
  });

  it("citasQueSeCruzan pide las no canceladas que se traslapan del paciente, profesional o clinica", async () => {
    expect(await citasQueSeCruzan({ iniciaEn: "i", terminaEn: "t" })).toEqual({
      citas: [],
      error: null,
    });
    const cliente = crearCliente({ citas: { data: [{ id: "x" }], error: null } });
    dobles.cliente = cliente;
    const { citas } = await citasQueSeCruzan({
      iniciaEn: "i",
      terminaEn: "t",
      pacienteId: "p",
      profesionalId: "",
      clinicaId: "c",
    });
    expect(citas).toEqual([{ id: "x" }]);
    expect(pasos(cliente, "neq")).toEqual([["estado", "cancelada"]]);
    expect(pasos(cliente, "lt")).toEqual([["inicia_en", "t"]]);
    expect(pasos(cliente, "gt")).toEqual([["termina_en", "i"]]);
    expect(pasos(cliente, "or")).toEqual([["paciente_id.eq.p,clinica_id.eq.c"]]);
  });

  it("crearCita escribe las columnas en snake_case, sin profesional vacio", async () => {
    const cliente = crearCliente({ citas: { data: FILA, error: null } });
    dobles.cliente = cliente;
    const { cita, error } = await crearCita({
      pacienteId: "p",
      jornadaId: "j",
      clinicaId: "c",
      areaId: "a",
      profesionalId: "",
      iniciaEn: "i",
      terminaEn: "t",
      notas: "  ",
    });
    expect(error).toBeNull();
    expect(cita.id).toBe("cita-1");
    expect(pasos(cliente, "insert")).toEqual([
      [
        {
          paciente_id: "p",
          jornada_id: "j",
          clinica_id: "c",
          area_id: "a",
          profesional_id: null,
          inicia_en: "i",
          termina_en: "t",
          notas: null,
        },
      ],
    ]);
  });

  it("un rechazo de fn_validar_cita llega con su mensaje; sin fila, como permiso", async () => {
    dobles.cliente = crearCliente({
      citas: {
        data: null,
        error: {
          code: "23514",
          message: "La clinica ya tiene sus 2 salas ocupadas el 03/10/2026 10:30.",
        },
      },
    });
    expect((await crearCita({ pacienteId: "p" })).error.mensaje).toBe(
      "La clínica ya tiene todas sus salas ocupadas a esa hora.",
    );
    dobles.cliente = crearCliente({ citas: { data: null, error: null } });
    expect((await actualizarCita("cita-1", { notas: "x" })).error.codigo).toBe("permiso_denegado");
    expect((await actualizarCita(null, {})).error.codigo).toBe("permiso_denegado");
  });

  it("errorDeCita deja pasar un error que no es de la agenda", () => {
    const generico = { codigo: "fallo_de_red", mensaje: "Sin conexion", detalle: "" };
    expect(errorDeCita(generico)).toBe(generico);
    expect(errorDeCita(null)).toBeNull();
    expect(
      errorDeCita({
        codigo: "check",
        mensaje: "x",
        detalle: "23514 | El paciente ya tiene otra cita a esa hora.",
      }).mensaje,
    ).toBe("El paciente ya tiene otra cita a esa hora.");
  });

  it("cambiarEstadoDeCita guarda el motivo solo al cancelar", async () => {
    const cliente = crearCliente({ citas: { data: FILA, error: null } });
    dobles.cliente = cliente;
    await cambiarEstadoDeCita("cita-1", "cancelada", { motivo: " No llego " });
    await cambiarEstadoDeCita("cita-1", "en_atencion");
    expect(pasos(cliente, "update")).toEqual([
      [{ estado: "cancelada", motivo_cancelacion: "No llego" }],
      [{ estado: "en_atencion" }],
    ]);
    expect((await cambiarEstadoDeCita(null, "creada")).error.codigo).toBe("permiso_denegado");
  });

  it("cuenta las pendientes de una jornada: creadas y en atencion", async () => {
    expect(await contarCitasPendientesDeJornada(null)).toEqual({ cantidad: 0, error: null });
    const cliente = crearCliente({ citas: { count: 4, error: null } });
    dobles.cliente = cliente;
    expect(await contarCitasPendientesDeJornada("j")).toEqual({ cantidad: 4, error: null });
    expect(pasos(cliente, "in")).toEqual([["estado", ["creada", "en_atencion"]]]);
    dobles.cliente = crearCliente({
      citas: { count: null, error: { code: "42501", message: "x" } },
    });
    expect((await contarCitasPendientesDeJornada("j")).cantidad).toBeNull();
  });

  it("las jornadas para agendar son las planificadas o en curso", async () => {
    const cliente = crearCliente({ jornadas: { data: [{ id: "j" }], error: null } });
    dobles.cliente = cliente;
    expect((await listarJornadasParaAgendar()).jornadas).toEqual([{ id: "j" }]);
    expect(pasos(cliente, "in")).toEqual([["estado", ["planificada", "en curso"]]]);
  });

  it("los profesionales son los medicos activos del cuadro de turnos, por nombre", async () => {
    expect(await listarProfesionalesDeJornada(null)).toEqual({ profesionales: [], error: null });
    const cliente = crearCliente({
      jornada_personal: {
        data: [
          {
            perfilId: "z",
            horaInicio: "08:00:00",
            horaFin: "12:00:00",
            perfil: { nombres: "Zoe", apellidos: "Prueba", activo: true },
          },
          {
            perfilId: "i",
            horaInicio: null,
            horaFin: null,
            perfil: { nombres: "Inactivo", apellidos: "X", activo: false },
          },
          {
            perfilId: "a",
            horaInicio: null,
            horaFin: null,
            perfil: { nombres: "Ana", apellidos: "Prueba", activo: true },
          },
        ],
        error: null,
      },
    });
    dobles.cliente = cliente;
    expect((await listarProfesionalesDeJornada("j")).profesionales).toEqual([
      { id: "a", nombre: "Ana Prueba", horaInicio: null, horaFin: null },
      { id: "z", nombre: "Zoe Prueba", horaInicio: "08:00", horaFin: "12:00" },
    ]);
    expect(pasos(cliente, "eq")).toEqual([
      ["jornada_id", "j"],
      ["rol_en_jornada", "medico"],
    ]);
  });
});
