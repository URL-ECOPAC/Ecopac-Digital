// Prueba de IconoDeModulo (issue #700).
//
// Lo que fija es el contrato entre los dos lados: packages/shared/navegacion.js declara un `icono`
// por modulo y este componente lo traduce. Si alguien agrega un modulo con un nombre de icono
// nuevo y se olvida de mapearlo, la tab bar no falla -cae en el icono por defecto- y nadie se
// entera hasta verlo en el telefono. Esta prueba se entera antes.

import { MODULOS } from "@ecopac/shared";

import { ICONOS, nombreDeIcono } from "./IconoDeModulo";

it("cada modulo de navegacion.js tiene su icono traducido", () => {
  // Se acumulan y se comparan de una vez: asi el mensaje del fallo nombra el modulo y el icono
  // que falta. Jest no admite un segundo argumento en expect() para describir la asercion.
  const sinTraducir = MODULOS.filter((m) => !(m.icono in ICONOS)).map(
    (m) => `${m.id} -> ${m.icono}`,
  );

  expect(sinTraducir).toEqual([]);
});

it("la tab de Ajustes, que no es un modulo, tambien lo tiene", () => {
  expect(Object.keys(ICONOS)).toContain("Settings");
});

it("un nombre sin traducir no deja la tab sin icono", () => {
  expect(nombreDeIcono("NoExiste")).toBe("ellipse-outline");
});
