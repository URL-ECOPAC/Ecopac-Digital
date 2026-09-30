// Prueba de datosDeCuadroTurnosImprimible: una fila sin perfil embebido no rompe la impresion.

import { describe, expect, it } from "vitest";

import { datosDeCuadroTurnosImprimible } from "./turnos.imprimible.js";

describe("datosDeCuadroTurnosImprimible", () => {
  it("una fila cuyo perfil llego en null queda sin nombre, sin lanzar", () => {
    const datos = datosDeCuadroTurnosImprimible({
      jornada: {
        nombre: "Jornada de prueba",
        fecha: "2026-10-01",
        personal: [
          { id: "f1", perfil: null, rolEnJornada: "medico", horaInicio: "08:00", horaFin: "12:00" },
          {
            id: "f2",
            perfil: { nombres: "Ana", apellidos: "Prueba" },
            rolEnJornada: "voluntario general",
            horaInicio: "07:00",
            horaFin: "11:00",
          },
        ],
      },
    });

    expect(datos.filas.map((fila) => fila.nombre)).toEqual(["Ana Prueba", null]);
  });
});
