// Pruebas de la consulta como unidad del historial (issue #840, bloque F).
//
// El hook no se monta (packages/shared corre vitest sin DOM): se prueban las funciones puras que
// deciden que se precarga, que cambio y que se escribe. Incluye las que vivian en
// useRegistroTriaje y useRegistroConsulta, retirados con esta issue.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import { CAMPOS_CONSULTA, CAMPOS_TRIAJE } from "./campos.js";
import { SECCIONES_CONSULTA, seccionesConCampos } from "./consultas.secciones.js";
import {
  aDatosDeConsulta,
  cambiosDeDiagnosticos,
  cambiosDeSignos,
  claveDeBorrador,
  hayBorradorConDatos,
  permisosDeConsulta,
  soloSignosCapturados,
  valoresDeConsulta,
  valoresDeSignos,
} from "./useConsulta.js";

const visita = {
  atencionId: "at-1",
  signos: { id: "tri-1", presionSistolica: 120, presionDiastolica: 80, glucosa: null },
  consulta: {
    id: "con-1",
    profesionalId: "med-1",
    motivoConsulta: "Dolor de cabeza",
    tratamiento: null,
    diagnosticos: [
      { id: "d-2", vinculoId: "v-2", esPrincipal: false },
      { id: "d-1", vinculoId: "v-1", esPrincipal: true },
    ],
  },
  recetas: [],
};

describe("un solo formulario para crear y editar (B1)", () => {
  it("los signos se precargan de la visita, con vacio para lo que no se midio", () => {
    const valores = valoresDeSignos(visita);

    expect(Object.keys(valores)).toEqual(CAMPOS_TRIAJE.map((campo) => campo.id));
    expect(valores.presionSistolica).toBe(120);
    expect(valores.glucosa).toBe("");
  });

  it("una visita nueva arranca con los mismos campos, vacios", () => {
    expect(Object.keys(valoresDeSignos(null))).toEqual(Object.keys(valoresDeSignos(visita)));
    expect(Object.keys(valoresDeConsulta(null))).toEqual(Object.keys(valoresDeConsulta(visita)));
  });

  it("la consulta precarga todos los campos de CAMPOS_CONSULTA, no un subconjunto", () => {
    expect(Object.keys(valoresDeConsulta(visita)).sort()).toEqual(
      CAMPOS_CONSULTA.map((campo) => campo.id).sort(),
    );
  });

  it("los diagnosticos van con el principal primero, que es como registrarConsulta lo decide", () => {
    expect(valoresDeConsulta(visita).diagnosticos).toEqual(["d-1", "d-2"]);
  });
});

describe("cambiosDeSignos", () => {
  it("solo manda lo que cambio, y un signo vaciado viaja para quedar en null", () => {
    const iniciales = valoresDeSignos(visita);
    expect(cambiosDeSignos({ ...iniciales, glucosa: 95 }, iniciales)).toEqual({ glucosa: 95 });
    expect(cambiosDeSignos({ ...iniciales }, iniciales)).toEqual({});
  });
});

describe("cambiosDeDiagnosticos", () => {
  it("agrega los nuevos y quita por vinculo los que ya no estan", () => {
    expect(cambiosDeDiagnosticos(["d-1", "d-9"], visita.consulta.diagnosticos)).toEqual({
      agregar: ["d-9"],
      quitar: ["v-2"],
    });
  });
});

describe("permisosDeConsulta", () => {
  it("un voluntario toma signos nuevos pero no los corrige ni registra la consulta", () => {
    expect(permisosDeConsulta(ROLES.VOLUNTARIO, null, "vol-1")).toEqual({
      signos: true,
      consulta: false,
      receta: false,
    });
    expect(permisosDeConsulta(ROLES.VOLUNTARIO, visita, "vol-1").signos).toBe(false);
  });

  it("un medico corrige su propia consulta y no la de otro", () => {
    expect(permisosDeConsulta(ROLES.MEDICO, visita, "med-1").consulta).toBe(true);
    expect(permisosDeConsulta(ROLES.MEDICO, visita, "med-2").consulta).toBe(false);
  });
});

describe("soloSignosCapturados", () => {
  it("deja fuera lo que no se pudo medir y conserva el cero", () => {
    expect(
      soloSignosCapturados({ presionSistolica: 120, glucosa: "", peso: null, talla: 0 }),
    ).toEqual({ presionSistolica: 120, talla: 0 });
    expect(soloSignosCapturados()).toEqual({});
  });
});

describe("borrador", () => {
  it("se separa por paciente y jornada: la atencion no existe todavia mientras se escribe", () => {
    expect(claveDeBorrador("p-1", "j-1")).not.toBe(claveDeBorrador("p-1", "j-2"));
  });

  it("un formulario recien abierto o con solo espacios no genera borrador", () => {
    expect(hayBorradorConDatos({ motivoConsulta: "", diagnosticos: [] })).toBe(false);
    expect(hayBorradorConDatos({ motivoConsulta: "   " })).toBe(false);
    expect(hayBorradorConDatos({ diagnosticos: ["d-1"] })).toBe(true);
  });
});

describe("seccionesConCampos", () => {
  it("cubre los campos de CAMPOS_CONSULTA sin repetir ninguno, y abre por el motivo", () => {
    const ids = seccionesConCampos().flatMap((seccion) => seccion.campos.map((campo) => campo.id));
    expect(new Set(ids).size).toBe(CAMPOS_CONSULTA.length);
    expect(SECCIONES_CONSULTA[0].campos[0]).toBe("motivoConsulta");
  });
});

describe("aDatosDeConsulta", () => {
  const contexto = { expedienteId: "exp-1", atencionId: "at-1", medicoId: "m-1", jornadaId: "j-1" };

  it("manda null en los opcionales y marca como principal solo el primer diagnostico", () => {
    const datos = aDatosDeConsulta(
      { motivoConsulta: "X", antecedentes: "", diagnosticos: ["d-1", "d-2"] },
      contexto,
    );
    expect(datos.antecedentes).toBeNull();
    expect(datos.diagnosticos.map((uno) => uno.esPrincipal)).toEqual([true, false]);
    expect(aDatosDeConsulta({ motivoConsulta: "X" }, contexto).diagnosticos).toEqual([]);
  });
});
