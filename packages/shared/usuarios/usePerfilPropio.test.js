// Pruebas de la logica pura de la pantalla de perfil propio (issue #102).
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (mismo
// motivo que useUsuariosListado.test.js). Por eso camposDePerfilPropio(), valoresInicialesDePerfil() y
// datosParaGuardarPerfil() son funciones exportadas y no codigo suelto dentro del hook.
//
// Ningun dato real: los nombres son inventados.

import { describe, expect, it } from "vitest";

import { ROLES } from "./roles.js";
import {
  camposDePerfilPropio,
  datosParaGuardarPerfil,
  valoresInicialesDePerfil,
} from "./usePerfilPropio.js";

describe("camposDePerfilPropio", () => {
  it("para un rol no administrador: mismo orden que CAMPOS_USUARIO, rol no editable", () => {
    const campos = camposDePerfilPropio(false);

    expect(campos.map((campo) => campo.id)).toEqual([
      "nombres",
      "apellidos",
      "email",
      "telefono",
      "rol",
      "especialidades",
    ]);

    const porId = Object.fromEntries(campos.map((campo) => [campo.id, campo]));
    expect(porId.nombres.editable).toBe(true);
    expect(porId.apellidos.editable).toBe(true);
    expect(porId.telefono.editable).toBe(true);
    expect(porId.rol.editable).toBe(false);
    expect(porId.email.editable).toBe(false);
    expect(porId.especialidades.editable).toBe(false);
  });

  it("para un administrador: el rol pasa a editable, el resto no cambia", () => {
    const campos = camposDePerfilPropio(true);
    const porId = Object.fromEntries(campos.map((campo) => [campo.id, campo]));

    expect(porId.rol.editable).toBe(true);
    expect(porId.email.editable).toBe(false);
    expect(porId.especialidades.editable).toBe(false);
  });

  it("las etiquetas y el tipo salen de CAMPOS_USUARIO, no se inventan aqui", () => {
    const [nombres] = camposDePerfilPropio(false);

    expect(nombres.label).toBe("Nombres");
    expect(nombres.tipo).toBe("texto");
  });
});

describe("valoresInicialesDePerfil", () => {
  it("copia los campos editables del perfil", () => {
    const valores = valoresInicialesDePerfil({
      nombres: "Ana",
      apellidos: "Perez",
      telefono: "5512-3456",
      rol: ROLES.MEDICO,
      email: "ana@ejemplo.org",
    });

    expect(valores).toEqual({
      nombres: "Ana",
      apellidos: "Perez",
      email: "ana@ejemplo.org",
      telefono: "5512-3456",
      rol: ROLES.MEDICO,
    });
  });

  it("sin perfil, todo queda en blanco sin reventar", () => {
    expect(valoresInicialesDePerfil(null)).toEqual({
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
      rol: null,
    });
  });
});

describe("datosParaGuardarPerfil", () => {
  const valores = {
    nombres: "Ana",
    apellidos: "Perez",
    telefono: "5512-3456",
    rol: ROLES.ADMINISTRADOR,
  };

  it("un administrador manda tambien el rol", () => {
    expect(datosParaGuardarPerfil(valores, true)).toEqual(valores);
  });

  it("quien no es administrador no manda el rol, aunque este en valores", () => {
    expect(datosParaGuardarPerfil(valores, false)).toEqual({
      nombres: "Ana",
      apellidos: "Perez",
      telefono: "5512-3456",
    });
  });
});
