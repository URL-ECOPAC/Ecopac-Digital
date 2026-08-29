import { describe, expect, it } from "vitest";

import { COLUMNAS_PACIENTE_CRONICO } from "./condiciones.columnas.js";
import {
  FILTROS_PACIENTE_CRONICO,
  FILTROS_PACIENTE_CRONICO_VACIOS,
} from "./condiciones.filtros.js";
import { permisosDeCondiciones } from "./useCondicionesPaciente.js";
import { hayFiltrosDeCronicos } from "./usePacientesCronicos.js";
import { ROLES } from "../usuarios/roles.js";

describe("permisosDeCondiciones", () => {
  it("medico y administrador pueden registrar y editar", () => {
    for (const rol of [ROLES.MEDICO, ROLES.ADMINISTRADOR]) {
      const permisos = permisosDeCondiciones(rol);
      expect(permisos.puedeVer).toBe(true);
      expect(permisos.puedeRegistrar).toBe(true);
      expect(permisos.puedeEditar).toBe(true);
    }
  });

  it("solo el administrador puede borrar el registro, no el medico", () => {
    expect(permisosDeCondiciones(ROLES.ADMINISTRADOR).puedeQuitar).toBe(true);
    expect(permisosDeCondiciones(ROLES.MEDICO).puedeQuitar).toBe(false);
  });

  it("un voluntario no modifica condiciones", () => {
    const permisos = permisosDeCondiciones(ROLES.VOLUNTARIO);
    expect(permisos.puedeRegistrar).toBe(false);
    expect(permisos.puedeEditar).toBe(false);
    expect(permisos.puedeQuitar).toBe(false);
  });

  it("un rol desconocido no puede nada", () => {
    const permisos = permisosDeCondiciones(undefined);
    expect(permisos.puedeRegistrar).toBe(false);
    expect(permisos.puedeEditar).toBe(false);
    expect(permisos.puedeQuitar).toBe(false);
  });
});

describe("hayFiltrosDeCronicos", () => {
  it("es falso con los filtros vacios", () => {
    expect(hayFiltrosDeCronicos(FILTROS_PACIENTE_CRONICO_VACIOS)).toBe(false);
    expect(hayFiltrosDeCronicos({})).toBe(false);
  });

  it("es verdadero con cualquiera de los tres puesto", () => {
    for (const clave of Object.keys(FILTROS_PACIENTE_CRONICO_VACIOS)) {
      expect(hayFiltrosDeCronicos({ ...FILTROS_PACIENTE_CRONICO_VACIOS, [clave]: "x" })).toBe(true);
    }
  });
});

describe("descriptores de la vista de cronicos", () => {
  it("cada filtro tiene contraparte en el estado vacio", () => {
    for (const filtro of FILTROS_PACIENTE_CRONICO) {
      expect(FILTROS_PACIENTE_CRONICO_VACIOS).toHaveProperty(filtro.id);
    }
  });

  it("los filtros cubren comunidad y condicion, que es lo que pide el criterio 3", () => {
    const ids = FILTROS_PACIENTE_CRONICO.map((filtro) => filtro.id);
    expect(ids).toContain("comunidad");
    expect(ids).toContain("condicion");
  });

  it("las columnas muestran a quien pertenece cada condicion", () => {
    const ids = COLUMNAS_PACIENTE_CRONICO.map((columna) => columna.id);
    expect(ids).toContain("nombreCompleto");
    expect(ids).toContain("comunidad");
    expect(ids).toContain("condicion");
  });
});
