// Pruebas de la logica pura de la asignacion de personal a una jornada (issue #182).
//
// Los hooks en si no se montan: packages/shared corre vitest con environment "node", sin DOM,
// mismo motivo que useFormularioJornada.test.js/useDesactivacionUsuario.test.js. Por eso
// estaYaAsignado(), excluirYaAsignados(), armarFilaDeResultado(), calcularLimiteDeBusqueda(),
// armarResultadosDeBusqueda(), contarPersonalPorRol() y mensajeDeErrorDeAsignacion() se exportan
// aparte del hook.
//
// CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL se prueba en campos.test.js y puedeVerRosterCompleto() en
// permisos.test.js: ambos se movieron a esos archivos en la revision (son un descriptor y una
// regla de permisos, no logica de este hook), y sus pruebas los siguieron.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  armarFilaDeResultado,
  armarResultadosDeBusqueda,
  calcularLimiteDeBusqueda,
  contarPersonalPorRol,
  estaYaAsignado,
  excluirYaAsignados,
  LIMITE_BUSQUEDA_PERSONAL,
  mensajeDeErrorDeAsignacion,
} from "./useAsignacionPersonal.js";

describe("estaYaAsignado", () => {
  it("true si el perfil ya esta en la lista de personal", () => {
    const personal = [{ perfilId: "perfil-1" }, { perfilId: "perfil-2" }];
    expect(estaYaAsignado("perfil-1", personal)).toBe(true);
  });

  it("false si el perfil no esta en la lista", () => {
    const personal = [{ perfilId: "perfil-2" }];
    expect(estaYaAsignado("perfil-1", personal)).toBe(false);
  });

  it("false con personal vacio o ausente", () => {
    expect(estaYaAsignado("perfil-1", [])).toBe(false);
    expect(estaYaAsignado("perfil-1", undefined)).toBe(false);
  });
});

describe("excluirYaAsignados", () => {
  it("quita de los resultados a quien ya esta asignado", () => {
    const usuarios = [{ id: "perfil-1" }, { id: "perfil-2" }, { id: "perfil-3" }];
    const personal = [{ perfilId: "perfil-2" }];

    expect(excluirYaAsignados(usuarios, personal).map((u) => u.id)).toEqual([
      "perfil-1",
      "perfil-3",
    ]);
  });

  it("sin personal asignado, deja pasar todos los resultados", () => {
    const usuarios = [{ id: "perfil-1" }, { id: "perfil-2" }];
    expect(excluirYaAsignados(usuarios, [])).toHaveLength(2);
  });
});

describe("armarFilaDeResultado", () => {
  it("arma nombre completo y etiqueta de rol legible", () => {
    const usuario = { id: "perfil-1", nombres: "Ana", apellidos: "Lopez", rol: ROLES.VOLUNTARIO };
    expect(armarFilaDeResultado(usuario)).toEqual({
      id: "perfil-1",
      nombreCompleto: "Ana Lopez",
      rolEtiqueta: "Voluntario",
      rol: ROLES.VOLUNTARIO,
    });
  });
});

describe("calcularLimiteDeBusqueda", () => {
  it("sin nadie asignado, pide exactamente LIMITE_BUSQUEDA_PERSONAL", () => {
    expect(calcularLimiteDeBusqueda([])).toBe(LIMITE_BUSQUEDA_PERSONAL);
    expect(calcularLimiteDeBusqueda(undefined)).toBe(LIMITE_BUSQUEDA_PERSONAL);
  });

  it("suma la cantidad de personal ya asignado, para que excluirlos despues no vacie el cupo", () => {
    const personal = [{ perfilId: "p1" }, { perfilId: "p2" }, { perfilId: "p3" }];
    expect(calcularLimiteDeBusqueda(personal)).toBe(LIMITE_BUSQUEDA_PERSONAL + 3);
  });
});

describe("armarResultadosDeBusqueda", () => {
  // Reproduce el bug encontrado en la revision: los primeros LIMITE_BUSQUEDA_PERSONAL resultados
  // crudos son justo los que ya estan asignados a esta jornada. Con el `limite` viejo (sin sumar
  // personal.length) esto dejaba `resultados` vacio aunque existiera gente sin asignar mas atras
  // en el orden alfabetico; con calcularLimiteDeBusqueda() de por medio, el resultado crudo que le
  // llega a esta funcion ya trae esas filas de mas.
  it("no vacia la lista cuando los primeros resultados ya estan todos asignados", () => {
    const personal = [{ perfilId: "asignado-1" }, { perfilId: "asignado-2" }];
    // Simula lo que devolveria listarUsuarios() con limite = LIMITE_BUSQUEDA_PERSONAL + 2: los
    // dos primeros ya asignados, mas LIMITE_BUSQUEDA_PERSONAL sin asignar detras.
    const usuarios = [
      { id: "asignado-1", nombres: "Ya", apellidos: "Asignado1", rol: ROLES.MEDICO },
      { id: "asignado-2", nombres: "Ya", apellidos: "Asignado2", rol: ROLES.MEDICO },
      ...Array.from({ length: LIMITE_BUSQUEDA_PERSONAL }, (_, i) => ({
        id: `libre-${i}`,
        nombres: "Libre",
        apellidos: String(i),
        rol: ROLES.VOLUNTARIO,
      })),
    ];

    const { resultados } = armarResultadosDeBusqueda(usuarios, personal);

    expect(resultados).toHaveLength(LIMITE_BUSQUEDA_PERSONAL);
    expect(resultados.some((fila) => fila.id === "asignado-1")).toBe(false);
    expect(resultados.some((fila) => fila.id === "asignado-2")).toBe(false);
  });

  it("recorta a LIMITE_BUSQUEDA_PERSONAL aunque sobrevivan mas tras filtrar", () => {
    const usuarios = Array.from({ length: LIMITE_BUSQUEDA_PERSONAL + 5 }, (_, i) => ({
      id: `perfil-${i}`,
      nombres: "Persona",
      apellidos: String(i),
      rol: ROLES.VOLUNTARIO,
    }));

    const { resultados, truncado } = armarResultadosDeBusqueda(usuarios, []);

    expect(resultados).toHaveLength(LIMITE_BUSQUEDA_PERSONAL);
    expect(truncado).toBe(true);
  });

  it("truncado=true cuando el crudo llega exactamente al limite pedido, aunque filtrado quede corto", () => {
    const personal = [{ perfilId: "p1" }, { perfilId: "p2" }];
    // limite pedido = LIMITE_BUSQUEDA_PERSONAL + 2; el crudo llega exactamente a ese numero, asi
    // que puede haber mas coincidencias en la base que ni se pidieron.
    const usuarios = Array.from({ length: LIMITE_BUSQUEDA_PERSONAL + 2 }, (_, i) => ({
      id: `perfil-${i}`,
      nombres: "Persona",
      apellidos: String(i),
      rol: ROLES.VOLUNTARIO,
    }));

    const { truncado } = armarResultadosDeBusqueda(usuarios, personal);
    expect(truncado).toBe(true);
  });

  it("truncado=false cuando el crudo trae menos de lo pedido y quedan pocos tras filtrar", () => {
    const personal = [{ perfilId: "p1" }];
    const usuarios = [
      { id: "p1", nombres: "Asignado", apellidos: "Ya", rol: ROLES.MEDICO },
      { id: "p2", nombres: "Libre", apellidos: "Uno", rol: ROLES.VOLUNTARIO },
    ];

    const { resultados, truncado } = armarResultadosDeBusqueda(usuarios, personal);
    expect(resultados).toHaveLength(1);
    expect(truncado).toBe(false);
  });
});

describe("contarPersonalPorRol", () => {
  it("cuenta por rolEnJornada, no por el rol de cuenta del perfil", () => {
    const personal = [
      { rolEnJornada: ROLES.MEDICO },
      { rolEnJornada: ROLES.MEDICO },
      { rolEnJornada: ROLES.VOLUNTARIO },
    ];

    expect(contarPersonalPorRol(personal)).toEqual([
      { rol: ROLES.MEDICO, etiqueta: "Medico", cantidad: 2 },
      { rol: ROLES.VOLUNTARIO, etiqueta: "Voluntario", cantidad: 1 },
    ]);
  });

  it("no incluye roles sin nadie asignado", () => {
    const personal = [{ rolEnJornada: ROLES.MEDICO }];
    const conteo = contarPersonalPorRol(personal);
    expect(conteo).toHaveLength(1);
    expect(conteo[0].rol).toBe(ROLES.MEDICO);
  });

  it("lista vacia o ausente da un conteo vacio", () => {
    expect(contarPersonalPorRol([])).toEqual([]);
    expect(contarPersonalPorRol(undefined)).toEqual([]);
  });
});

describe("mensajeDeErrorDeAsignacion", () => {
  it("reemplaza el mensaje generico de unicidad por uno especifico de esta pantalla", () => {
    expect(mensajeDeErrorDeAsignacion({ codigo: "unicidad", mensaje: "Ese registro ya existe." })).toBe(
      "Esta persona ya esta asignada a esta jornada.",
    );
  });

  it("deja pasar tal cual cualquier otro codigo", () => {
    expect(mensajeDeErrorDeAsignacion({ codigo: "check", mensaje: "Alguno de los datos..." })).toBe(
      "Alguno de los datos...",
    );
  });

  it("null sin error", () => {
    expect(mensajeDeErrorDeAsignacion(null)).toBeNull();
  });
});
