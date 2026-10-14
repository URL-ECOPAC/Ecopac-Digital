// Pruebas de la hora en Guatemala y del calendario de la agenda (issue #927). Datos inventados.

import { describe, expect, it } from "vitest";

import {
  horariosDelDia,
  mesesDelAnio,
  moverFecha,
  OPCIONES_VISTA_AGENDA,
  rangoDeLaVista,
  semanasDelMes,
  textoDeCantidadDeCitas,
  tituloDeLaAgenda,
  VISTAS_AGENDA,
} from "./agenda.js";
import { detalleDeCita, filaDeCita } from "./columnas.js";
import {
  citaOcupaSala,
  citaPendiente,
  citaSeReagenda,
  etiquetaDeEstadoDeCita,
  ESTADOS_CITA,
  puedePasarCitaA,
} from "./estados.js";
import { filtrarCitas, FILTROS_AGENDA_CITAS_VACIOS } from "./filtros.js";
import {
  aInstanteDeGuatemala,
  fechaEnGuatemala,
  formatearFechaHoraDeCita,
  formatearHorarioDeCita,
  horaEnGuatemala,
  hoyEnGuatemala,
  minutosDelDia,
  partesEnGuatemala,
  rangoDelDia,
  sumarDias,
  sumarMinutos,
} from "./horas.js";

const cita = (id, fecha, inicio, fin, extra = {}) => ({
  id,
  iniciaEn: aInstanteDeGuatemala(fecha, inicio),
  terminaEn: aInstanteDeGuatemala(fecha, fin),
  estado: ESTADOS_CITA.CREADA,
  ...extra,
});

describe("la hora en Guatemala", () => {
  it("arma el instante con el desplazamiento fijo de -06:00", () => {
    expect(aInstanteDeGuatemala("2026-10-03", "10:30")).toBe("2026-10-03T10:30:00-06:00");
    expect(aInstanteDeGuatemala("2026-10-03", "24:00")).toBeNull();
    expect(aInstanteDeGuatemala("", "10:30")).toBeNull();
    expect(aInstanteDeGuatemala("2026-10-03", "")).toBeNull();
  });

  it("lee un instante UTC en la hora de Guatemala, sin depender del dispositivo", () => {
    expect(partesEnGuatemala("2026-10-03T16:30:00Z")).toEqual({
      fecha: "2026-10-03",
      hora: "10:30",
    });
    // Pasada la medianoche UTC sigue siendo el dia anterior en Guatemala.
    expect(fechaEnGuatemala("2026-10-04T02:00:00+00:00")).toBe("2026-10-03");
    expect(horaEnGuatemala("2026-10-04T02:00:00+00:00")).toBe("20:00");
    expect(partesEnGuatemala(null)).toBeNull();
    expect(partesEnGuatemala("no es fecha")).toBeNull();
    expect(horaEnGuatemala(null)).toBe("");
  });

  it("formatea la fecha con hora y el horario de una cita", () => {
    expect(formatearFechaHoraDeCita("2026-10-03T16:30:00Z")).toBe("03/10/2026 10:30");
    expect(formatearFechaHoraDeCita(null)).toBe("");
    expect(formatearHorarioDeCita(cita("a", "2026-10-03", "10:30", "11:00"))).toBe("10:30 - 11:00");
  });

  it("suma minutos sin pasar del dia y dias por calendario", () => {
    expect(sumarMinutos("10:45", 30)).toBe("11:15");
    expect(sumarMinutos("23:50", 30)).toBe("23:59");
    expect(sumarMinutos("x", 30)).toBe("");
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("x", 1)).toBe("");
    expect(minutosDelDia("01:30")).toBe(90);
    expect(minutosDelDia("10:30:00")).toBe(630);
    expect(minutosDelDia(null)).toBeNull();
  });

  it("hoy y el rango de un dia son de Guatemala", () => {
    expect(hoyEnGuatemala(new Date("2026-10-04T03:00:00Z"))).toBe("2026-10-03");
    expect(rangoDelDia("2026-10-03")).toEqual({
      desde: "2026-10-03T00:00:00-06:00",
      hasta: "2026-10-04T00:00:00-06:00",
    });
    expect(rangoDelDia("x")).toBeNull();
  });
});

describe("estados de la cita", () => {
  it("siguen las transiciones de fn_validar_cita; atendida no se pone a mano", () => {
    expect(puedePasarCitaA("creada", "en_atencion")).toBe(true);
    expect(puedePasarCitaA("creada", "cancelada")).toBe(true);
    expect(puedePasarCitaA("en_atencion", "creada")).toBe(true);
    expect(puedePasarCitaA("en_atencion", "atendida")).toBe(false);
    expect(puedePasarCitaA("atendida", "cancelada")).toBe(false);
    expect(puedePasarCitaA("cancelada", "creada")).toBe(false);
    expect(puedePasarCitaA("otro", "creada")).toBe(false);
  });

  it("la cancelada libera la sala; solo la creada se reagenda", () => {
    expect(citaOcupaSala({ estado: "cancelada" })).toBe(false);
    expect(citaOcupaSala({ estado: "atendida" })).toBe(true);
    expect(citaOcupaSala(null)).toBe(false);
    expect(citaSeReagenda({ estado: "creada" })).toBe(true);
    expect(citaSeReagenda({ estado: "en_atencion" })).toBe(false);
    expect(citaPendiente({ estado: "en_atencion" })).toBe(true);
    expect(citaPendiente({ estado: "atendida" })).toBe(false);
  });

  it("las etiquetas son las de la issue", () => {
    expect(["creada", "en_atencion", "atendida", "cancelada"].map(etiquetaDeEstadoDeCita)).toEqual([
      "Creado",
      "En atención",
      "Atendido",
      "Cancelado",
    ]);
    expect(etiquetaDeEstadoDeCita("raro")).toBe("raro");
    expect(etiquetaDeEstadoDeCita(undefined)).toBe("");
  });
});

describe("el mes de la agenda", () => {
  it("cubre semanas completas de lunes a domingo", () => {
    // Octubre de 2026 empieza en jueves y termina en sabado.
    const rango = rangoDeLaVista(VISTAS_AGENDA.MES, "2026-10-15");
    expect(rango.primerDia).toBe("2026-09-28");
    expect(rango.ultimoDia).toBe("2026-11-01");
    expect(rango.desde).toBe("2026-09-28T00:00:00-06:00");
    expect(rango.hasta).toBe("2026-11-02T00:00:00-06:00");
  });

  it("la cuadricula marca el mes, hoy y las citas de cada dia en orden", () => {
    const citas = [
      cita("tarde", "2026-10-03", "15:00", "15:30"),
      cita("temprano", "2026-10-03", "08:00", "08:30"),
      cita("otro", "2026-10-20", "09:00", "09:30"),
    ];
    const semanas = semanasDelMes("2026-10-01", citas, "2026-10-03");
    expect(semanas).toHaveLength(5);
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(semanas[0][0]).toMatchObject({ fecha: "2026-09-28", delMes: false, dia: 28 });
    const tres = semanas[0].find((dia) => dia.fecha === "2026-10-03");
    expect(tres.esHoy).toBe(true);
    expect(tres.citas.map((una) => una.id)).toEqual(["temprano", "tarde"]);
  });

  it("diciembre pasa al siguiente anio", () => {
    expect(rangoDeLaVista(VISTAS_AGENDA.MES, "2026-12-10").ultimoDia).toBe("2027-01-03");
    expect(moverFecha(VISTAS_AGENDA.MES, "2026-12-10", 1)).toBe("2027-01-01");
    expect(moverFecha(VISTAS_AGENDA.MES, "2026-01-10", -1)).toBe("2025-12-01");
  });

  it("los titulos se leen en espanol", () => {
    expect(tituloDeLaAgenda(VISTAS_AGENDA.MES, "2026-10-03")).toBe("Octubre de 2026");
    expect(tituloDeLaAgenda(VISTAS_AGENDA.DIA, "2026-10-03")).toBe("Sábado 3 de octubre de 2026");
    expect(tituloDeLaAgenda(VISTAS_AGENDA.DIA, "")).toBe("");
  });
});

describe("el dia de la agenda", () => {
  it("el dia va de un dia a otro y su rango es ese dia", () => {
    expect(moverFecha(VISTAS_AGENDA.DIA, "2026-10-31", 1)).toBe("2026-11-01");
    expect(rangoDeLaVista(VISTAS_AGENDA.DIA, "2026-10-03")).toMatchObject({
      primerDia: "2026-10-03",
      desde: "2026-10-03T00:00:00-06:00",
      hasta: "2026-10-04T00:00:00-06:00",
    });
  });

  it("horarios de 30 minutos de 07:00 a 18:00, con las citas que empiezan en cada uno", () => {
    const horarios = horariosDelDia("2026-10-03", [
      cita("a", "2026-10-03", "10:30", "11:00"),
      cita("b", "2026-10-03", "10:45", "11:15"),
      cita("otro-dia", "2026-10-04", "10:30", "11:00"),
    ]);
    expect(horarios[0].hora).toBe("07:00");
    expect(horarios.at(-1).hora).toBe("17:30");
    const diezYMedia = horarios.find((horario) => horario.hora === "10:30");
    expect(diezYMedia.citas.map((una) => una.id)).toEqual(["a", "b"]);
    expect(diezYMedia.salasLibres).toBeNull();
  });

  it("se amplia para que quepa una cita fuera del horario normal", () => {
    const horarios = horariosDelDia("2026-10-03", [
      cita("madrugada", "2026-10-03", "06:15", "06:45"),
      cita("noche", "2026-10-03", "19:00", "19:30"),
    ]);
    expect(horarios[0].hora).toBe("06:00");
    expect(horarios.at(-1).hora).toBe("19:00");
  });

  it("con clinica filtrada cuenta las salas libres con todas sus citas no canceladas", () => {
    const deLaClinica = [
      cita("a", "2026-10-03", "10:00", "11:00"),
      cita("b", "2026-10-03", "10:30", "11:00"),
      cita("c", "2026-10-03", "10:30", "11:00", { estado: "cancelada" }),
    ];
    const horarios = horariosDelDia("2026-10-03", [], { salas: 3, citasDeLaClinica: deLaClinica });
    const libres = Object.fromEntries(
      horarios.map((horario) => [horario.hora, horario.salasLibres]),
    );
    expect(libres["09:30"]).toBe(3);
    expect(libres["10:00"]).toBe(2);
    expect(libres["10:30"]).toBe(1);
    expect(libres["11:00"]).toBe(3);
  });
});

describe("filtros y presentacion", () => {
  const citas = [
    {
      id: "1",
      jornadaId: "j1",
      clinicaId: "c1",
      areaId: "a1",
      profesionalId: "p1",
      estado: "creada",
    },
    {
      id: "2",
      jornadaId: "j1",
      clinicaId: "c2",
      areaId: "a1",
      profesionalId: null,
      estado: "atendida",
    },
    {
      id: "3",
      jornadaId: "j2",
      clinicaId: "c1",
      areaId: "a2",
      profesionalId: "p1",
      estado: "creada",
    },
  ];

  it("sin filtros devuelve todas; cada filtro se suma", () => {
    expect(filtrarCitas(citas, FILTROS_AGENDA_CITAS_VACIOS)).toHaveLength(3);
    expect(filtrarCitas(citas).map((una) => una.id)).toEqual(["1", "2", "3"]);
    expect(
      filtrarCitas(citas, { ...FILTROS_AGENDA_CITAS_VACIOS, jornadaId: "j1", clinicaId: "c1" }).map(
        (una) => una.id,
      ),
    ).toEqual(["1"]);
    expect(
      filtrarCitas(citas, { ...FILTROS_AGENDA_CITAS_VACIOS, profesionalId: "p1", estado: "creada" })
        .length,
    ).toBe(2);
  });

  it("la fila de la cita trae la fecha y hora en Guatemala y el profesional que falta", () => {
    const fila = filaDeCita({
      ...cita("x", "2026-10-03", "10:30", "11:00"),
      profesional: null,
      paciente: "Ana Prueba",
    });
    expect(fila.cuando).toBe("03/10/2026 10:30 - 11:00");
    expect(fila.profesional).toBe("Sin asignar");
    expect(filaDeCita(null)).toBeNull();
  });

  it("el detalle omite lo que no tiene dato", () => {
    const detalle = detalleDeCita({
      ...cita("x", "2026-10-03", "10:30", "11:00"),
      paciente: "Ana Prueba",
      clinica: "Clínica Norte",
      area: "Odontología",
      jornada: "Jornada Prueba",
      profesional: "Doc Prueba",
      notas: null,
      motivoCancelacion: null,
    });
    expect(detalle.map((campo) => campo.id)).toEqual([
      "paciente",
      "cuando",
      "jornada",
      "clinica",
      "area",
      "profesional",
    ]);
    expect(detalleDeCita(null)).toEqual([]);
  });
});

describe("el anio de la agenda", () => {
  it("las vistas van de lo general a lo particular", () => {
    expect(OPCIONES_VISTA_AGENDA.map((vista) => vista.value)).toEqual(["anio", "mes", "dia"]);
  });

  it("el anio cubre del 1 de enero al 31 de diciembre y se mueve de anio en anio", () => {
    expect(rangoDeLaVista(VISTAS_AGENDA.ANIO, "2026-10-03")).toEqual({
      primerDia: "2026-01-01",
      ultimoDia: "2026-12-31",
      desde: "2026-01-01T00:00:00-06:00",
      hasta: "2027-01-01T00:00:00-06:00",
    });
    expect(moverFecha(VISTAS_AGENDA.ANIO, "2026-10-03", 1)).toBe("2027-10-01");
    expect(moverFecha(VISTAS_AGENDA.ANIO, "2026-10-03", -1)).toBe("2025-10-01");
    expect(tituloDeLaAgenda(VISTAS_AGENDA.ANIO, "2026-10-03")).toBe("2026");
  });

  it("doce meses, cada uno con sus citas activas por mes y por dia; la cancelada no cuenta", () => {
    const meses = mesesDelAnio(
      "2026-10-03",
      [
        cita("a", "2026-10-03", "10:30", "11:00"),
        cita("b", "2026-10-03", "11:00", "11:30"),
        cita("c", "2026-10-03", "12:00", "12:30", { estado: "cancelada" }),
        cita("d", "2026-12-24", "09:00", "09:30"),
      ],
      "2026-10-03",
    );
    expect(meses).toHaveLength(12);
    expect(meses[0]).toMatchObject({ fecha: "2026-01-01", nombre: "Enero", activas: 0 });
    expect(meses[9]).toMatchObject({ fecha: "2026-10-01", nombre: "Octubre", activas: 2 });
    expect(meses[11].activas).toBe(1);
    const tres = meses[9].semanas.flat().find((dia) => dia.fecha === "2026-10-03");
    expect(tres).toMatchObject({ activas: 2, esHoy: true });
    expect(tres.citas).toHaveLength(3);
  });

  it("dice la cantidad en singular o plural", () => {
    expect(textoDeCantidadDeCitas(1)).toBe("1 cita");
    expect(textoDeCantidadDeCitas(3)).toBe("3 citas");
  });
});
