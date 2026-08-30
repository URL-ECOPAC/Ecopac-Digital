// Pruebas de las reglas de negocio de jornadas y asignaciones de personal.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion.
//
// Ningun dato real: las jornadas, comunidades y personas son inventadas.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import { ESTADOS_JORNADA } from "../enums.js";
import {
  advertirChoqueDeHorario,
  advertirJornadaDuplicada,
  esTransicionDeJornadaValida,
  puedeRegistrarEnJornada,
  TRANSICIONES_JORNADA,
  transicionesDeJornadaDesde,
  validarAsignaciones,
  validarAsignacionPersonal,
  validarCambioDeEstadoJornada,
  validarJornada,
} from "./validaciones.js";

/** Jornada valida minima, para que cada prueba altere solo el campo que le interesa. */
function jornadaValida(cambios = {}) {
  return {
    nombre: "Jornada de salud en Solola",
    fecha: fechaEnDias(5),
    comunidad: "10000000-0000-0000-0000-000000000001",
    responsable: "00000000-0000-0000-0000-000000000001",
    ...cambios,
  };
}

/** Asignacion valida minima, para que cada prueba altere solo el campo que le interesa. */
function asignacionValida(cambios = {}) {
  return {
    perfil: "00000000-0000-0000-0000-000000000010",
    rolEnJornada: "medico",
    horaInicio: "08:00",
    horaFin: "13:00",
    ...cambios,
  };
}

/** Fecha AAAA-MM-DD a `dias` dias de hoy, en el calendario local. */
function fechaEnDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

describe("validarJornada", () => {
  it("no reporta nada cuando la jornada esta completa", () => {
    expect(validarJornada(jornadaValida())).toEqual({});
  });

  it("exige nombre, fecha, comunidad y responsable", () => {
    expect(validarJornada(jornadaValida({ nombre: "" }))).toHaveProperty("nombre");
    expect(validarJornada(jornadaValida({ fecha: "" }))).toHaveProperty("fecha");
    expect(validarJornada(jornadaValida({ comunidad: "" }))).toHaveProperty("comunidad");
    expect(validarJornada(jornadaValida({ responsable: "" }))).toHaveProperty("responsable");
  });

  it("no deja planificar una jornada en una fecha pasada", () => {
    const errores = validarJornada(jornadaValida({ fecha: fechaEnDias(-1) }));

    expect(errores).toHaveProperty("fecha");
    expect(errores.fecha).toContain("anterior a hoy");
  });

  it("acepta una jornada hoy y en el futuro", () => {
    expect(validarJornada(jornadaValida({ fecha: fechaEnDias(0) }))).toEqual({});
    expect(validarJornada(jornadaValida({ fecha: fechaEnDias(30) }))).toEqual({});
  });

  it("rechaza una fecha que no se puede interpretar", () => {
    expect(validarJornada(jornadaValida({ fecha: "no-es-fecha" }))).toHaveProperty("fecha");
  });

  it("aplica el limite del VARCHAR(150) del nombre", () => {
    expect(validarJornada(jornadaValida({ nombre: "a".repeat(151) }))).toHaveProperty("nombre");
  });
});

describe("validarAsignacionPersonal", () => {
  it("no reporta nada cuando la asignacion esta completa", () => {
    expect(validarAsignacionPersonal(asignacionValida())).toEqual({});
  });

  it("exige perfil, rol, hora de inicio y hora de fin", () => {
    expect(validarAsignacionPersonal(asignacionValida({ perfil: "" }))).toHaveProperty("perfil");
    expect(validarAsignacionPersonal(asignacionValida({ rolEnJornada: "" }))).toHaveProperty(
      "rolEnJornada",
    );
    expect(validarAsignacionPersonal(asignacionValida({ horaInicio: "" }))).toHaveProperty(
      "horaInicio",
    );
    expect(validarAsignacionPersonal(asignacionValida({ horaFin: "" }))).toHaveProperty("horaFin");
  });

  it("rechaza una hora de fin igual o anterior a la de inicio", () => {
    expect(validarAsignacionPersonal(asignacionValida({ horaFin: "08:00" }))).toHaveProperty(
      "horaFin",
    );
    expect(validarAsignacionPersonal(asignacionValida({ horaFin: "07:00" }))).toHaveProperty(
      "horaFin",
    );
  });

  it("acepta una hora de fin posterior en el mismo dia", () => {
    expect(validarAsignacionPersonal(asignacionValida({ horaInicio: "07:00", horaFin: "13:00" })))
      .toEqual({});
  });

  it("rechaza una hora que no cumple el formato HH:MM", () => {
    expect(validarAsignacionPersonal(asignacionValida({ horaFin: "13" }))).toHaveProperty(
      "horaFin",
    );
  });
});

describe("validarAsignaciones", () => {
  it("no reporta nada cuando cada perfil aparece una sola vez", () => {
    expect(validarAsignaciones([{ perfil: "a" }, { perfil: "b" }, { perfil: "c" }])).toEqual({});
  });

  it("rechaza la misma persona dos veces en la misma jornada", () => {
    const errores = validarAsignaciones([{ perfil: "a" }, { perfil: "b" }, { perfil: "a" }]);

    expect(errores).toHaveProperty("perfil");
  });

  it("ignora las filas sin perfil elegido", () => {
    expect(validarAsignaciones([{ perfil: "a" }, { perfil: "" }, {}])).toEqual({});
  });
});

describe("transicionesDeJornadaDesde / esTransicionDeJornadaValida", () => {
  it("las 3 transiciones de la issue #171 son validas", () => {
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.PLANIFICADA, ESTADOS_JORNADA.EN_CURSO),
    ).toBe(true);
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.EN_CURSO, ESTADOS_JORNADA.FINALIZADA),
    ).toBe(true);
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.FINALIZADA, ESTADOS_JORNADA.EN_CURSO),
    ).toBe(true);
  });

  it("cancelada esta fuera de alcance: no admite ninguna transicion de entrada ni de salida", () => {
    expect(transicionesDeJornadaDesde(ESTADOS_JORNADA.CANCELADA)).toEqual([]);
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.PLANIFICADA, ESTADOS_JORNADA.CANCELADA),
    ).toBe(false);
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.CANCELADA, ESTADOS_JORNADA.EN_CURSO),
    ).toBe(false);
  });

  it("no se puede saltar directo de planificada a finalizada", () => {
    expect(
      esTransicionDeJornadaValida(ESTADOS_JORNADA.PLANIFICADA, ESTADOS_JORNADA.FINALIZADA),
    ).toBe(false);
  });

  it("el mapa declara los cuatro estados del enum, sin sobrar ninguno", () => {
    // Es la unica propiedad del mapa que no se puede comprobar desde las funciones que lo leen:
    // transicionesDeJornadaDesde() devuelve [] tanto para un estado terminal como para uno que
    // se olvidaron de declarar, y los dos casos se ven igual desde fuera. Si alguien agrega un
    // valor al enum rol de la migracion y no lo declara aqui, esta prueba lo dice.
    expect(Object.keys(TRANSICIONES_JORNADA).sort()).toEqual(
      Object.values(ESTADOS_JORNADA).sort(),
    );
  });

  it("ningun destino declarado cae fuera del enum", () => {
    for (const destinos of Object.values(TRANSICIONES_JORNADA)) {
      for (const destino of destinos) {
        expect(Object.values(ESTADOS_JORNADA)).toContain(destino);
      }
    }
  });
});

describe("validarCambioDeEstadoJornada", () => {
  it("acepta las 3 transiciones permitidas", () => {
    expect(
      validarCambioDeEstadoJornada(
        ESTADOS_JORNADA.PLANIFICADA,
        ESTADOS_JORNADA.EN_CURSO,
        ROLES.MEDICO,
      ),
    ).toEqual({});
    expect(
      validarCambioDeEstadoJornada(
        ESTADOS_JORNADA.EN_CURSO,
        ESTADOS_JORNADA.FINALIZADA,
        ROLES.MEDICO,
      ),
    ).toEqual({});
  });

  it("rechaza un estado que no existe en el enum", () => {
    const errores = validarCambioDeEstadoJornada(ESTADOS_JORNADA.PLANIFICADA, "en pausa");
    expect(errores).toHaveProperty("estado");
  });

  it("rechaza quedarse en el mismo estado", () => {
    const errores = validarCambioDeEstadoJornada(
      ESTADOS_JORNADA.EN_CURSO,
      ESTADOS_JORNADA.EN_CURSO,
    );
    expect(errores.estado).toContain("ya esta en ese estado");
  });

  it("rechaza el salto planificada -> finalizada", () => {
    const errores = validarCambioDeEstadoJornada(
      ESTADOS_JORNADA.PLANIFICADA,
      ESTADOS_JORNADA.FINALIZADA,
      ROLES.ADMINISTRADOR,
    );
    expect(errores).toHaveProperty("estado");
  });

  it("rechaza cualquier transicion que involucre cancelada", () => {
    expect(
      validarCambioDeEstadoJornada(
        ESTADOS_JORNADA.PLANIFICADA,
        ESTADOS_JORNADA.CANCELADA,
        ROLES.ADMINISTRADOR,
      ),
    ).toHaveProperty("estado");
    expect(
      validarCambioDeEstadoJornada(
        ESTADOS_JORNADA.CANCELADA,
        ESTADOS_JORNADA.PLANIFICADA,
        ROLES.ADMINISTRADOR,
      ),
    ).toHaveProperty("estado");
  });

  it("rechaza la reapertura (finalizada -> en curso) sin rol administrador", () => {
    const errores = validarCambioDeEstadoJornada(
      ESTADOS_JORNADA.FINALIZADA,
      ESTADOS_JORNADA.EN_CURSO,
      ROLES.MEDICO,
    );
    expect(errores.estado).toContain("administrador");
  });

  it("acepta la reapertura (finalizada -> en curso) con rol administrador", () => {
    expect(
      validarCambioDeEstadoJornada(
        ESTADOS_JORNADA.FINALIZADA,
        ESTADOS_JORNADA.EN_CURSO,
        ROLES.ADMINISTRADOR,
      ),
    ).toEqual({});
  });
});

describe("puedeRegistrarEnJornada", () => {
  it("solo la jornada en curso admite registro", () => {
    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.EN_CURSO)).toEqual({ puede: true, motivo: "" });
  });

  it("cubre los cuatro estados del enum, no solo tres", () => {
    // El criterio de aceptacion habla de tres estados, pero estado_jornada (00001) tiene cuatro.
    // Si el enum crece y esta prueba no se entera, el estado nuevo cae en el motivo generico y
    // se bloquea: esa es la respuesta segura, y aqui se deja fijada.
    const veredictos = Object.values(ESTADOS_JORNADA).map((estado) => [
      estado,
      puedeRegistrarEnJornada(estado).puede,
    ]);

    expect(veredictos).toEqual([
      [ESTADOS_JORNADA.PLANIFICADA, false],
      [ESTADOS_JORNADA.EN_CURSO, true],
      [ESTADOS_JORNADA.FINALIZADA, false],
      [ESTADOS_JORNADA.CANCELADA, false],
    ]);
  });

  it("cada motivo nombra el estado y dice como continuar", () => {
    // Criterio de aceptacion 2. Un "no se puede" a secas deja a quien esta en campo sin saber
    // si esperar, avisarle a alguien o cambiarse de jornada.
    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.PLANIFICADA).motivo).toMatch(/planificada/i);
    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.PLANIFICADA).motivo).toMatch(/inicie/i);

    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.FINALIZADA).motivo).toMatch(/finalizada/i);
    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.FINALIZADA).motivo).toMatch(/reabrir/i);

    expect(puedeRegistrarEnJornada(ESTADOS_JORNADA.CANCELADA).motivo).toMatch(/cancelada/i);
  });

  it("un estado desconocido o ausente bloquea, no deja pasar", () => {
    // Ante la duda se bloquea en el cliente y la ultima palabra la tiene el trigger. Al reves
    // -dejar pasar lo que no se reconoce- la persona llena el formulario y el servidor lo
    // rechaza al final.
    for (const valor of ["en pausa", "", null, undefined]) {
      expect(puedeRegistrarEnJornada(valor).puede).toBe(false);
      expect(puedeRegistrarEnJornada(valor).motivo).not.toBe("");
    }
  });

  it("nunca devuelve motivo vacio cuando bloquea", () => {
    // La pantalla pinta el motivo tal cual: quedarse sin texto seria un cartel en blanco.
    const bloqueados = Object.values(ESTADOS_JORNADA).filter(
      (estado) => estado !== ESTADOS_JORNADA.EN_CURSO,
    );

    for (const estado of bloqueados) {
      expect(puedeRegistrarEnJornada(estado).motivo.length).toBeGreaterThan(0);
    }
  });
});

describe("advertirChoqueDeHorario", () => {
  it("no advierte cuando la persona no esta en otra jornada el mismo dia", () => {
    const advertencia = advertirChoqueDeHorario({
      perfil: "p1",
      jornadaActualId: "j1",
      asignacionesDelDia: [
        { jornadaId: "j2", jornadaNombre: "Jornada en Peten", perfil: "p2" },
      ],
    });

    expect(advertencia).toBeNull();
  });

  it("advierte cuando la persona ya esta en otra jornada el mismo dia", () => {
    const advertencia = advertirChoqueDeHorario({
      perfil: "p1",
      jornadaActualId: "j1",
      asignacionesDelDia: [
        { jornadaId: "j2", jornadaNombre: "Jornada en Peten", perfil: "p1" },
      ],
    });

    expect(advertencia).toContain("otra jornada");
    expect(advertencia).toContain("Jornada en Peten");
  });

  it("no cuenta la propia jornada como choque", () => {
    const advertencia = advertirChoqueDeHorario({
      perfil: "p1",
      jornadaActualId: "j1",
      asignacionesDelDia: [
        { jornadaId: "j1", jornadaNombre: "La propia", perfil: "p1" },
      ],
    });

    expect(advertencia).toBeNull();
  });

  it("no advierte si no hay perfil elegido", () => {
    expect(advertirChoqueDeHorario({ perfil: "", jornadaActualId: "j1", asignacionesDelDia: [] }))
      .toBeNull();
  });
});

describe("advertirJornadaDuplicada", () => {
  it("no advierte si listarJornadas no devolvio ninguna fila", () => {
    expect(advertirJornadaDuplicada({ jornadas: [] })).toBeNull();
  });

  it("advierte con el nombre de la jornada existente", () => {
    const advertencia = advertirJornadaDuplicada({
      jornadas: [{ id: "j1", nombre: "Jornada en Solola" }],
    });

    expect(advertencia).toContain("Jornada en Solola");
  });

  it("junta los nombres si hay mas de una coincidencia", () => {
    const advertencia = advertirJornadaDuplicada({
      jornadas: [
        { id: "j1", nombre: "Jornada matutina" },
        { id: "j2", nombre: "Jornada vespertina" },
      ],
    });

    expect(advertencia).toContain("Jornada matutina");
    expect(advertencia).toContain("Jornada vespertina");
  });

  it("no cuenta la propia jornada como duplicado al editar", () => {
    const advertencia = advertirJornadaDuplicada({
      jornadas: [{ id: "j1", nombre: "La propia" }],
      jornadaActualId: "j1",
    });

    expect(advertencia).toBeNull();
  });

  it("en el alta (sin jornadaActualId) advierte contra cualquier fila que llegue", () => {
    const advertencia = advertirJornadaDuplicada({
      jornadas: [{ id: "j1", nombre: "Jornada existente" }],
    });

    expect(advertencia).not.toBeNull();
  });
});
