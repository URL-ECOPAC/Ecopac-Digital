// Pruebas de las reglas de negocio de los proyectos sociales.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion.
//
// Ningun dato real: los proyectos y las personas son inventados.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  ESTADOS_PROYECTO,
  esTransicionDeProyectoValida,
  LONGITUD_MAXIMA_NOMBRE_PROYECTO,
  TODOS_LOS_ESTADOS_PROYECTO,
  TRANSICIONES_PROYECTO,
  transicionesDeProyectoDesde,
  validarCambioDeEstadoProyecto,
  validarProyecto,
} from "./validaciones.js";
import {
  permisosDeProyectos,
  puedeAdministrarProyectos,
  puedeVerProyectos,
} from "./permisos.js";

/** Proyecto valido minimo, para que cada prueba altere solo el campo que le interesa. */
function proyectoValido(cambios = {}) {
  return {
    nombre: "Jornadas de salud en Solola",
    descripcion: "Cuatro jornadas medicas en el altiplano",
    fechaInicio: "2026-01-15",
    fechaFin: "2026-06-30",
    estado: ESTADOS_PROYECTO.PLANIFICADO,
    ...cambios,
  };
}

describe("validarProyecto", () => {
  it("no reporta nada cuando el proyecto esta completo", () => {
    expect(validarProyecto(proyectoValido())).toEqual({});
  });

  it("exige el nombre", () => {
    expect(validarProyecto(proyectoValido({ nombre: "" }))).toHaveProperty("nombre");
    expect(validarProyecto(proyectoValido({ nombre: "   " }))).toHaveProperty("nombre");
  });

  it("aplica el limite del VARCHAR(150) de la tabla", () => {
    const justo = "a".repeat(LONGITUD_MAXIMA_NOMBRE_PROYECTO);
    const unoDeMas = "a".repeat(LONGITUD_MAXIMA_NOMBRE_PROYECTO + 1);

    expect(validarProyecto(proyectoValido({ nombre: justo }))).toEqual({});
    expect(validarProyecto(proyectoValido({ nombre: unoDeMas }))).toHaveProperty("nombre");
  });

  it("rechaza una fecha de fin anterior a la de inicio", () => {
    const errores = validarProyecto(
      proyectoValido({ fechaInicio: "2026-06-30", fechaFin: "2026-01-15" }),
    );

    expect(errores).toHaveProperty("fechaFin");
  });

  it("acepta que un proyecto empiece y termine el mismo dia", () => {
    // Con new Date() en vez de aFechaLocal() esto podria fallar por el desfase de zona horaria.
    expect(validarProyecto(proyectoValido({ fechaInicio: "2026-03-10", fechaFin: "2026-03-10" })))
      .toEqual({});
  });

  it("las dos fechas son opcionales", () => {
    expect(validarProyecto(proyectoValido({ fechaInicio: null, fechaFin: null }))).toEqual({});
  });

  it("rechaza un estado que el enum estado_proyecto no tiene", () => {
    expect(validarProyecto(proyectoValido({ estado: "pausado" }))).toHaveProperty("estado");
  });

  it("acepta todos los estados del enum", () => {
    for (const estado of TODOS_LOS_ESTADOS_PROYECTO) {
      expect(validarProyecto(proyectoValido({ estado }))).toEqual({});
    }
  });

  it("espeja el CHECK del porcentaje de avance", () => {
    expect(validarProyecto(proyectoValido({ porcentajeAvance: 0 }))).toEqual({});
    expect(validarProyecto(proyectoValido({ porcentajeAvance: 100 }))).toEqual({});
    expect(validarProyecto(proyectoValido({ porcentajeAvance: -1 }))).toHaveProperty(
      "porcentajeAvance",
    );
    expect(validarProyecto(proyectoValido({ porcentajeAvance: 101 }))).toHaveProperty(
      "porcentajeAvance",
    );
    expect(validarProyecto(proyectoValido({ porcentajeAvance: 12.5 }))).toHaveProperty(
      "porcentajeAvance",
    );
  });
});

describe("transiciones de estado", () => {
  // Espejo del trigger tr_validar_transicion_estado_proyecto (migracion 00029). Si esta prueba
  // se cae, o cambio el trigger o cambio la tabla en JS: las dos tienen que decir lo mismo.

  it("permite exactamente las cuatro transiciones del trigger", () => {
    expect(esTransicionDeProyectoValida("planificado", "en curso")).toBe(true);
    expect(esTransicionDeProyectoValida("en curso", "finalizado")).toBe(true);
    expect(esTransicionDeProyectoValida("planificado", "cancelado")).toBe(true);
    expect(esTransicionDeProyectoValida("en curso", "cancelado")).toBe(true);
  });

  it("no deja saltarse en curso ni retroceder", () => {
    expect(esTransicionDeProyectoValida("planificado", "finalizado")).toBe(false);
    expect(esTransicionDeProyectoValida("en curso", "planificado")).toBe(false);
  });

  it("finalizado y cancelado son terminales", () => {
    expect(transicionesDeProyectoDesde("finalizado")).toEqual([]);
    expect(transicionesDeProyectoDesde("cancelado")).toEqual([]);
  });

  it("un estado desconocido no ofrece ninguna transicion", () => {
    expect(transicionesDeProyectoDesde("pausado")).toEqual([]);
  });

  it("el mapa declara los cuatro estados del enum, sin sobrar ninguno", () => {
    // No se puede comprobar desde transicionesDeProyectoDesde(): devuelve [] igual para un
    // estado terminal que para uno que se olvidaron de declarar. Los dos casos de arriba
    // -"finalizado y cancelado son terminales" y "un estado desconocido"- pasarian identicos si
    // el mapa se quedara vacio.
    expect(Object.keys(TRANSICIONES_PROYECTO).sort()).toEqual([...TODOS_LOS_ESTADOS_PROYECTO].sort());
  });

  it("ningun destino declarado cae fuera del enum", () => {
    for (const destinos of Object.values(TRANSICIONES_PROYECTO)) {
      for (const destino of destinos) {
        expect(TODOS_LOS_ESTADOS_PROYECTO).toContain(destino);
      }
    }
  });
});

describe("validarCambioDeEstadoProyecto", () => {
  it("acepta una transicion legal", () => {
    expect(validarCambioDeEstadoProyecto("planificado", "en curso")).toEqual({});
  });

  it("dice a que estados si se puede pasar", () => {
    const { estado } = validarCambioDeEstadoProyecto("planificado", "finalizado");

    expect(estado).toContain("en curso");
    expect(estado).toContain("cancelado");
  });

  it("explica que un proyecto terminal ya no cambia", () => {
    expect(validarCambioDeEstadoProyecto("finalizado", "en curso").estado).toContain(
      "ya no cambia",
    );
  });

  it("avisa si el proyecto ya esta en ese estado", () => {
    expect(validarCambioDeEstadoProyecto("en curso", "en curso")).toHaveProperty("estado");
  });

  it("rechaza un estado que no es del enum", () => {
    expect(validarCambioDeEstadoProyecto("planificado", "pausado")).toHaveProperty("estado");
  });
});

describe("permisos", () => {
  it("solo Administrador administra, como exige la politica de proyectos (00039)", () => {
    expect(puedeAdministrarProyectos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("administrador y los dos roles consultivos ven proyectos; medico y voluntario no, espejo de la 00080", () => {
    expect(puedeVerProyectos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerProyectos(ROLES.SOCIO_FUNDADOR)).toBe(true);

    expect(puedeVerProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeVerProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeProyectos("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las tres por separado", () => {
    expect(permisosDeProyectos(ROLES.MEDICO)).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });
  });
});
