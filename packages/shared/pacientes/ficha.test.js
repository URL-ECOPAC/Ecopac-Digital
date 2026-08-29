import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import { CAMPOS_FICHA_PACIENTE } from "./columnas.js";
import { ESTADOS_CONDICION_CRONICA } from "./condiciones.campos.js";
import {
  cabeceraDePaciente,
  condicionesDestacadas,
  nombreCompletoDePaciente,
  permisosDeFicha,
  PESTANIA_FICHA_POR_DEFECTO,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  valoresDeFichaPaciente,
} from "./ficha.js";

const PACIENTE = {
  id: "p-1",
  nombres: "Maria",
  apellidos: "Chun Tzoc",
  fechaNacimiento: "1990-03-15",
  sexo: "femenino",
  dpi: "1234567890101",
  tipoSangre: "O+",
  idioma: "quiche",
  telefonoContacto: "50001111",
  nombreResponsable: "Juana Chun",
  parentescoResponsable: "madre",
  comunidad: { nombre: "Chuicutama" },
  expediente: { numeroFicha: "EXP-000042" },
  condicionesCronicas: [
    { id: "c-1", estado: ESTADOS_CONDICION_CRONICA.ACTIVA, condicion: { nombre: "Diabetes" } },
    { id: "c-2", estado: ESTADOS_CONDICION_CRONICA.RESUELTA, condicion: { nombre: "Anemia" } },
    { id: "c-3", estado: ESTADOS_CONDICION_CRONICA.CONTROLADA, condicion: { nombre: "Hipertension" } },
  ],
};

describe("pestaniasDeFicha", () => {
  it("da las cuatro pestanias a medico y administrador", () => {
    for (const rol of [ROLES.MEDICO, ROLES.ADMINISTRADOR]) {
      expect(pestaniasDeFicha(rol).map((p) => p.id)).toEqual([
        "generales",
        "historial",
        "signos",
        "recetas",
      ]);
    }
  });

  it("deja solo datos generales a los roles sin acceso clinico", () => {
    for (const rol of [ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR, undefined]) {
      expect(pestaniasDeFicha(rol).map((p) => p.id)).toEqual(["generales"]);
    }
  });
});

describe("resolverPestaniaDeFicha", () => {
  it("respeta una pestania visible para el rol", () => {
    expect(resolverPestaniaDeFicha("recetas", ROLES.MEDICO)).toBe("recetas");
  });

  it("cae a la de por defecto si la pestania no existe", () => {
    expect(resolverPestaniaDeFicha("inventada", ROLES.MEDICO)).toBe(PESTANIA_FICHA_POR_DEFECTO);
  });

  it("cae a la de por defecto si el rol no puede ver esa pestania", () => {
    expect(resolverPestaniaDeFicha("historial", ROLES.VOLUNTARIO)).toBe(
      PESTANIA_FICHA_POR_DEFECTO,
    );
  });
});

describe("condicionesDestacadas", () => {
  it("deja fuera las resueltas y las que no traen nombre", () => {
    expect(condicionesDestacadas(PACIENTE).map((c) => c.nombre)).toEqual([
      "Diabetes",
      "Hipertension",
    ]);
  });

  it("devuelve una lista vacia si el paciente no trae condiciones", () => {
    expect(condicionesDestacadas(null)).toEqual([]);
    expect(condicionesDestacadas({})).toEqual([]);
  });
});

describe("cabeceraDePaciente", () => {
  it("arma los cinco datos que pide la cabecera", () => {
    const cabecera = cabeceraDePaciente(PACIENTE);

    expect(cabecera.numeroFicha).toBe("EXP-000042");
    expect(cabecera.nombreCompleto).toBe("Maria Chun Tzoc");
    expect(cabecera.comunidad).toBe("Chuicutama");
    expect(cabecera.edad).toBeTruthy();
    expect(cabecera.condiciones).toHaveLength(2);
  });

  it("es null si no hay paciente", () => {
    expect(cabeceraDePaciente(null)).toBeNull();
  });

  it("no inventa datos cuando el paciente llega incompleto", () => {
    expect(cabeceraDePaciente({ id: "p-2" })).toEqual({
      numeroFicha: null,
      nombreCompleto: null,
      edad: null,
      comunidad: null,
      condiciones: [],
    });
  });
});

describe("valoresDeFichaPaciente", () => {
  it("cubre todos los ids que declara CAMPOS_FICHA_PACIENTE", () => {
    const valores = valoresDeFichaPaciente(PACIENTE);

    for (const campo of CAMPOS_FICHA_PACIENTE) {
      expect(valores).toHaveProperty(campo.id);
    }
  });

  it("traduce idioma y tipo de sangre a su etiqueta", () => {
    const valores = valoresDeFichaPaciente(PACIENTE);

    expect(valores.idioma).toBe("K'iche'");
    expect(valores.tipoSangre).toBe("O+");
  });

  it("deja el valor crudo si la opcion no esta en el catalogo", () => {
    expect(valoresDeFichaPaciente({ ...PACIENTE, idioma: "kaqchikel" }).idioma).toBe("kaqchikel");
  });

  it("devuelve un objeto vacio si no hay paciente", () => {
    expect(valoresDeFichaPaciente(null)).toEqual({});
  });
});

describe("permisosDeFicha", () => {
  it("solo medico y administrador editan y ven datos clinicos", () => {
    expect(permisosDeFicha(ROLES.MEDICO)).toEqual({
      puedeEditar: true,
      puedeVerDatosClinicos: true,
    });
    expect(permisosDeFicha(ROLES.ADMINISTRADOR)).toEqual({
      puedeEditar: true,
      puedeVerDatosClinicos: true,
    });
    expect(permisosDeFicha(ROLES.VOLUNTARIO)).toEqual({
      puedeEditar: false,
      puedeVerDatosClinicos: false,
    });
  });
});

describe("nombreCompletoDePaciente", () => {
  it("junta nombres y apellidos y tolera que falte uno", () => {
    expect(nombreCompletoDePaciente({ nombres: "Ana", apellidos: "Lopez" })).toBe("Ana Lopez");
    expect(nombreCompletoDePaciente({ nombres: "Ana" })).toBe("Ana");
    expect(nombreCompletoDePaciente({})).toBeNull();
  });
});
