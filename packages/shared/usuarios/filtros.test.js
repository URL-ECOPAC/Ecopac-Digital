import { describe, expect, it } from "vitest";

import { ESTADOS_USUARIO } from "./campos.js";
import { FILTROS_USUARIO, FILTROS_USUARIO_VACIOS, hayFiltrosDeUsuario } from "./filtros.js";

describe("hayFiltrosDeUsuario (issue #864)", () => {
  it("sin filtros puestos devuelve false", () => {
    expect(hayFiltrosDeUsuario(FILTROS_USUARIO_VACIOS)).toBe(false);
  });

  it("una busqueda de solo espacios no cuenta como filtro", () => {
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, busqueda: "   " })).toBe(false);
  });

  it("detecta cada uno de los cuatro filtros por separado", () => {
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, busqueda: "ana" })).toBe(true);
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, rol: "medico" })).toBe(true);
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, estado: true })).toBe(true);
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, especialidad: "Pediatria" })).toBe(
      true,
    );
  });

  // La razon de ser de esta funcion: el valor del filtro de estado es el booleano de
  // perfiles.activo, asi que filtrar por "Inactivo" es `estado: false`. Con el
  // `Boolean(filtros.estado)` que usa hayFiltrosDeNotificaciones -- donde todos los valores son
  // cadenas -- el boton "Limpiar filtros" se quedaria deshabilitado justo cuando hay un filtro.
  it("filtrar por Inactivo (estado false) SI es tener un filtro puesto", () => {
    const inactivo = ESTADOS_USUARIO.find((estado) => estado.clave === "inactivo");
    expect(inactivo.value).toBe(false);
    expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, estado: inactivo.value })).toBe(true);
  });

  it("no revienta si le llega un objeto vacio o nada", () => {
    expect(hayFiltrosDeUsuario({})).toBe(false);
    expect(hayFiltrosDeUsuario()).toBe(false);
  });

  it("cubre todos los filtros que declara FILTROS_USUARIO", () => {
    // Si alguien agrega un filtro nuevo al descriptor y se olvida de esta funcion, el boton
    // quedaria deshabilitado con ese filtro puesto. Esta prueba falla y lo recuerda.
    for (const campo of FILTROS_USUARIO) {
      const valor = campo.id === "busqueda" ? "algo" : "un-valor";
      expect(hayFiltrosDeUsuario({ ...FILTROS_USUARIO_VACIOS, [campo.id]: valor })).toBe(true);
    }
  });
});
