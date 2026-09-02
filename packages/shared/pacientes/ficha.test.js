import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import { CAMPOS_FICHA_PACIENTE } from "./columnas.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import {
  cabeceraDePaciente,
  condicionesDestacadas,
  nombreCompletoDePaciente,
  permisosDeFicha,
  PESTANIA_FICHA_POR_DEFECTO,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  resumenDeUltimaAtencion,
  textoDeCampoDeFicha,
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
    {
      id: "c-3",
      estado: ESTADOS_CONDICION_CRONICA.CONTROLADA,
      condicion: { nombre: "Hipertension" },
    },
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
    expect(resolverPestaniaDeFicha("historial", ROLES.VOLUNTARIO)).toBe(PESTANIA_FICHA_POR_DEFECTO);
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

  // El idioma dejo de traducirse contra una lista en el codigo: desde la 00110 es un catalogo
  // en la base y el nombre llega embebido en la consulta (issue #663).
  it("muestra el nombre del idioma que trae el catalogo embebido", () => {
    const valores = valoresDeFichaPaciente({
      ...PACIENTE,
      catalogoIdioma: { nombre: "K'iche'" },
    });

    expect(valores.idioma).toBe("K'iche'");
  });

  it("sin el embebido cae al codigo crudo en vez de dejar la celda vacia", () => {
    expect(valoresDeFichaPaciente(PACIENTE).idioma).toBe("quiche");
  });

  it("traduce el tipo de sangre a su etiqueta", () => {
    expect(valoresDeFichaPaciente(PACIENTE).tipoSangre).toBe("O+");
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

describe("resumenDeUltimaAtencion", () => {
  it("saca fecha, jornada y diagnostico de una consulta", () => {
    const resumen = resumenDeUltimaAtencion({
      ultimaAtencion: {
        tipo: "consulta",
        fecha: "2026-05-10T15:30:00Z",
        jornada: "Jornada Chuicutama",
        comunidad: "Chuicutama",
        profesional: "Luis Perez",
        diagnosticoPrincipal: { nombre: "Hipertension" },
      },
    });

    expect(resumen.fecha).toBe("2026-05-10T15:30:00Z");
    expect(resumen.jornada).toBe("Jornada Chuicutama");
    expect(resumen.diagnostico).toBe("Hipertension");
  });

  it("deja el diagnostico en null cuando el evento no lo lleva", () => {
    const resumen = resumenDeUltimaAtencion({
      ultimaAtencion: { tipo: "receta", fecha: "2026-05-10T15:40:00Z", folio: "REC-1" },
    });

    expect(resumen.tipo).toBe("receta");
    expect(resumen.diagnostico).toBeNull();
  });

  it("cae a la fecha de la jornada si el evento no trae la suya", () => {
    const resumen = resumenDeUltimaAtencion({
      ultimaAtencion: { tipo: "triaje", fechaDeJornada: "2026-03-01" },
    });

    expect(resumen.fecha).toBe("2026-03-01");
  });

  it("es null si el paciente no tiene atenciones", () => {
    expect(resumenDeUltimaAtencion({ id: "p-1" })).toBeNull();
    expect(resumenDeUltimaAtencion(null)).toBeNull();
  });
});

// El formateador subio desde FichaPacientePage.jsx cuando la ficha movil (#658) necesito el
// mismo texto: dos copias de la misma regla de presentacion se desincronizan en cuanto una
// cambie, y la regla de la arquitectura es que las apps no formatean.
describe("textoDeCampoDeFicha", () => {
  const CAMPO_TEXTO = { id: "dpi", tipo: "texto" };
  const CAMPO_FECHA = { id: "fechaNacimiento", tipo: "fecha" };

  it("devuelve el valor tal cual para un campo de texto", () => {
    expect(textoDeCampoDeFicha(CAMPO_TEXTO, { dpi: "1234567890101" })).toBe("1234567890101");
  });

  it("un campo sin dato se ve como un hueco, no como una celda vacia", () => {
    expect(textoDeCampoDeFicha(CAMPO_TEXTO, { dpi: null })).toBe("—");
    expect(textoDeCampoDeFicha(CAMPO_TEXTO, { dpi: undefined })).toBe("—");
    expect(textoDeCampoDeFicha(CAMPO_TEXTO, { dpi: "" })).toBe("—");
  });

  it("una fecha se formatea y no se muestra en ISO", () => {
    const texto = textoDeCampoDeFicha(CAMPO_FECHA, { fechaNacimiento: "1990-05-10" });
    expect(texto).not.toBe("1990-05-10");
    expect(texto).not.toBe("—");
  });

  it("sin valores no revienta", () => {
    expect(textoDeCampoDeFicha(CAMPO_TEXTO)).toBe("—");
    expect(textoDeCampoDeFicha(undefined, {})).toBe("—");
  });

  it("un numero se convierte a texto, para que React no lo descarte", () => {
    expect(textoDeCampoDeFicha({ id: "edad" }, { edad: 0 })).toBe("0");
  });
});
