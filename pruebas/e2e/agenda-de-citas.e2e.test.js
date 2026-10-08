// Flujo critico: la agenda de citas de punta a punta (issue #927).
//
//   clinica de una sala -> agendar -> la clinica se llena y rechaza la siguiente ->
//   Atender -> la consulta de siempre con la cita -> la cita queda atendida -> el historial la
//   marca Agendada
//
// Cada paso con el rol que lo hace de verdad: la administradora da de alta la clinica, el
// voluntario de la jornada agenda (citas.agendar, 00185), el medico abre la cita y registra la
// consulta. Las reglas que se ejercitan son las de la base -fn_validar_cita, los triggers de la
// consulta agendada- a traves de las funciones de @ecopac/shared, no por SQL directo.
//
// La hora sale de la fecha de la jornada en curso del seed (CURRENT_DATE de la base, en UTC): una
// cita no puede ser antes de su jornada, y despues de las 18:00 de Guatemala la base ya va en el
// dia siguiente.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aInstanteDeGuatemala,
  cambiarEstadoDeCita,
  crearCita,
  crearClinica,
  obtenerCatalogoDeAreas,
  obtenerCita,
  obtenerVisitasDePaciente,
  registrarConsulta,
  resolverAtencion,
} from "@ecopac/shared";

import { cerrarConexion, consultar, DEMO } from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

/** Expediente del paciente demo (seed, seccion 4). */
const EXPEDIENTE_DEMO = "de000006-0000-0000-0000-000000000002";
/** Otro paciente del seed, para la cita que la clinica llena rechaza. */
const OTRO_PACIENTE = "de000005-0000-0000-0000-000000000003";

const NOMBRE_DE_CLINICA = "Clinica E2E 927";

const flujo = {
  clinicaId: null,
  areaId: null,
  citaId: null,
  consultaId: null,
  iniciaEn: null,
  terminaEn: null,
};

beforeAll(async () => {
  const [jornada] = await consultar("SELECT fecha::text AS fecha FROM jornadas WHERE id = $1", [
    DEMO.jornadaEnCurso,
  ]);
  flujo.iniciaEn = aInstanteDeGuatemala(jornada.fecha, "15:00");
  flujo.terminaEn = aInstanteDeGuatemala(jornada.fecha, "15:30");
});

afterAll(async () => {
  await salir();
  if (flujo.consultaId) {
    await consultar("DELETE FROM consultas WHERE id = $1", [flujo.consultaId]);
  }
  if (flujo.clinicaId) {
    await consultar("DELETE FROM citas WHERE clinica_id = $1", [flujo.clinicaId]);
    await consultar("DELETE FROM clinicas WHERE id = $1", [flujo.clinicaId]);
  }
  await cerrarConexion();
});

describe("agenda de citas (issue #927)", () => {
  it("1. la administradora da de alta una clinica de una sala", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);
    const { clinica, errores, error } = await crearClinica({
      nombre: NOMBRE_DE_CLINICA,
      salasDisponibles: 1,
    });
    expect(error).toBeNull();
    expect(errores).toEqual({});
    flujo.clinicaId = clinica.id;

    const { areas } = await obtenerCatalogoDeAreas();
    flujo.areaId = areas.find((area) => area.nombre === "Odontología")?.id;
    expect(flujo.areaId).toBeTruthy();
  });

  it("2. el voluntario de la jornada agenda la cita con el medico", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);
    const { cita, error } = await crearCita({
      pacienteId: DEMO.paciente,
      jornadaId: DEMO.jornadaEnCurso,
      clinicaId: flujo.clinicaId,
      areaId: flujo.areaId,
      profesionalId: CUENTAS.MEDICO.perfilId,
      iniciaEn: flujo.iniciaEn,
      terminaEn: flujo.terminaEn,
      notas: "Cita de la prueba e2e",
    });
    expect(error).toBeNull();
    expect(cita).toMatchObject({
      estado: "creada",
      clinica: NOMBRE_DE_CLINICA,
      area: "Odontología",
    });
    flujo.citaId = cita.id;
  });

  it("3. con la unica sala ocupada, la clinica rechaza otra cita a la misma hora", async () => {
    const { cita, error } = await crearCita({
      pacienteId: OTRO_PACIENTE,
      jornadaId: DEMO.jornadaEnCurso,
      clinicaId: flujo.clinicaId,
      areaId: flujo.areaId,
      iniciaEn: flujo.iniciaEn,
      terminaEn: flujo.terminaEn,
    });
    expect(cita).toBeNull();
    expect(error?.mensaje).toBe("La clínica ya tiene todas sus salas ocupadas a esa hora.");
  });

  it("4. el medico abre la cita (Atender) y registra la consulta con ella", async () => {
    await entrarComo(CUENTAS.MEDICO);
    const abierta = await cambiarEstadoDeCita(flujo.citaId, "en_atencion");
    expect(abierta.error).toBeNull();
    expect(abierta.cita.estado).toBe("en_atencion");

    const { atencionId, error: errorAtencion } = await resolverAtencion(
      DEMO.paciente,
      DEMO.jornadaEnCurso,
    );
    expect(errorAtencion).toBeNull();

    const { consulta, error } = await registrarConsulta({
      expediente: EXPEDIENTE_DEMO,
      atencion: atencionId,
      medico: CUENTAS.MEDICO.perfilId,
      jornada: DEMO.jornadaEnCurso,
      citaId: flujo.citaId,
      motivoConsulta: "Control dental agendado (e2e)",
    });
    expect(error).toBeNull();
    flujo.consultaId = consulta.id;
  });

  it("5. guardar la consulta deja la cita atendida, en la misma transaccion", async () => {
    const { cita } = await obtenerCita(flujo.citaId);
    expect(cita).toMatchObject({ estado: "atendida", consultaId: flujo.consultaId });
  });

  it("6. el historial marca la consulta como Agendada, con su area y su cita", async () => {
    const { visitas, error } = await obtenerVisitasDePaciente(DEMO.paciente, {
      rol: CUENTAS.MEDICO.rol,
      jornadaId: DEMO.jornadaEnCurso,
    });
    expect(error).toBeNull();
    const agendada = visitas
      .flatMap((visita) => visita.consultas ?? [])
      .find((consulta) => consulta.id === flujo.consultaId);
    expect(agendada).toMatchObject({
      agendada: true,
      citaId: flujo.citaId,
      area: "Odontología",
    });
    expect(agendada.cita.clinica).toBe(NOMBRE_DE_CLINICA);
  });
});
