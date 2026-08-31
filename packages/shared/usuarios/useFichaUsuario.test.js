// Pruebas de useFichaUsuario. No se monta el hook: packages/shared corre vitest con environment
// "node", sin DOM. Por eso lo que se prueba es combinarFichaUsuario(), la funcion exportada que
// arma el estado final -- mismo criterio que combinarPaciente() en pacientes/usePaciente.test.js.

import { describe, expect, it } from "vitest";

import { combinarFichaUsuario } from "./useFichaUsuario.js";

describe("combinarFichaUsuario", () => {
  it("agrega las especialidades al perfil y conserva el historial", () => {
    const respuestaPerfil = { perfil: { id: "u1", nombres: "Ana" }, error: null };
    const respuestaEspecialidades = { especialidades: ["Oftalmologia"], error: null };
    const respuestaHistorial = {
      jornadas: [{ id: "j1", nombre: "Jornada en Solola" }],
      error: null,
    };

    const { perfil, historial, error, errorHistorial } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(error).toBeNull();
    expect(errorHistorial).toBeNull();
    expect(perfil).toEqual({ id: "u1", nombres: "Ana", especialidades: ["Oftalmologia"] });
    expect(historial).toEqual([{ id: "j1", nombre: "Jornada en Solola" }]);
  });

  it("un perfil sin especialidades queda con un arreglo vacio, no undefined", () => {
    const respuestaPerfil = { perfil: { id: "u1" }, error: null };
    const respuestaEspecialidades = { especialidades: [], error: null };
    const respuestaHistorial = { jornadas: [], error: null };

    const { perfil } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(perfil.especialidades).toEqual([]);
  });

  it("un fallo cargando las especialidades no bloquea el perfil: quedan en vacio, sin marcar error", () => {
    const respuestaPerfil = { perfil: { id: "u1" }, error: null };
    const respuestaEspecialidades = { especialidades: [], error: { codigo: "desconocido" } };
    const respuestaHistorial = { jornadas: [], error: null };

    const { perfil, error } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(error).toBeNull();
    expect(perfil.especialidades).toEqual([]);
  });

  it("un perfil que no existe (o que RLS esconde) deja perfil e historial vacios, con el error del perfil", () => {
    const respuestaPerfil = { perfil: null, error: null };
    const respuestaEspecialidades = { especialidades: [], error: null };
    const respuestaHistorial = { jornadas: [{ id: "j1" }], error: null };

    const { perfil, historial, error } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(perfil).toBeNull();
    expect(historial).toEqual([]);
    expect(error).toBeNull();
  });

  it("un fallo de servidor leyendo el perfil se propaga en error", () => {
    const respuestaPerfil = { perfil: null, error: { codigo: "desconocido" } };
    const respuestaEspecialidades = { especialidades: [], error: null };
    const respuestaHistorial = { jornadas: [], error: null };

    const { perfil, error } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(perfil).toBeNull();
    expect(error).toEqual({ codigo: "desconocido" });
  });

  it("un fallo cargando el historial no vacia el perfil: se distingue en errorHistorial, historial queda en []", () => {
    const respuestaPerfil = { perfil: { id: "u1" }, error: null };
    const respuestaEspecialidades = { especialidades: [], error: null };
    const respuestaHistorial = { jornadas: [], error: { codigo: "desconocido" } };

    const { perfil, historial, error, errorHistorial } = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );

    expect(error).toBeNull();
    expect(perfil).not.toBeNull();
    expect(historial).toEqual([]);
    expect(errorHistorial).toEqual({ codigo: "desconocido" });
  });
});
