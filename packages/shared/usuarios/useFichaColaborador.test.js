// Pruebas de la logica pura de la ficha de personal por id.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM. Mismo
// criterio que useUsuariosListado.test.js con armarFilas().

import { describe, expect, it } from "vitest";

import { armarFichaColaborador } from "./useFichaColaborador.js";

describe("armarFichaColaborador", () => {
  it("agrega el nombre completo y conserva el resto del perfil", () => {
    const perfil = { id: "p1", nombres: "Ana", apellidos: "Lopez", rol: "medico", activo: true };

    const ficha = armarFichaColaborador(perfil, ["Pediatria"]);

    expect(ficha.nombreCompleto).toBe("Ana Lopez");
    expect(ficha.especialidades).toEqual(["Pediatria"]);
    expect(ficha.id).toBe("p1");
    expect(ficha.rol).toBe("medico");
    expect(ficha.activo).toBe(true);
  });

  it("sin especialidades queda en un arreglo vacio, no en undefined", () => {
    const perfil = { id: "p1", nombres: "Ana", apellidos: "Lopez" };

    expect(armarFichaColaborador(perfil).especialidades).toEqual([]);
  });

  it("un perfil ausente (no existe o RLS lo escondio) devuelve null", () => {
    expect(armarFichaColaborador(null, ["Pediatria"])).toBeNull();
    expect(armarFichaColaborador(undefined)).toBeNull();
  });
});
