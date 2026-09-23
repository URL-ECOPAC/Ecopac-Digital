// Prueba de HomePage (issue #757, criterio 3: cada tarjeta de modulo debe llevar texto).
// @vitest-environment jsdom
//
// A diferencia de ReportesPage.test.jsx y DashboardMetricasPage.test.jsx, aqui NO se mockea
// usePanelDeInicio ni MODULOS: se monta con los modulos reales de packages/shared/navegacion.js,
// mockeando solo la sesion de fuera (issue #757, decision cerrada). Es la unica forma de que
// esta prueba proteja el contrato real entre HomePage.jsx y la forma de MODULOS -si alguien
// vuelve a leer modulo.etiqueta (que no existe, criterio 1) en vez de modulo.nombre, las
// tarjetas quedan sin texto y estas aserciones fallan-. Mockear el hook devolviendo un nombre a
// mano no detectaria esa regresion.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import { ROLES } from "@ecopac/shared";

import HomePage from "./HomePage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockSesion = { perfil: { rol: ROLES.ADMINISTRADOR, nombres: "Ana" } };

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

function pantalla() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("administrador: cada tarjeta de modulo muestra su nombre", () => {
    mockSesion.perfil = { rol: ROLES.ADMINISTRADOR, nombres: "Ana" };
    pantalla();

    for (const nombre of [
      "Pacientes",
      "Donaciones",
      "Inventario",
      "Presupuestos",
      "Proyectos",
      "Reportes",
      "Jornadas",
      "Colaboradores",
    ]) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
  });

  it("medico: solo ve las tarjetas de su rol, todas con texto", () => {
    mockSesion.perfil = { rol: ROLES.MEDICO, nombres: "Luis" };
    pantalla();

    expect(screen.getByText("Pacientes")).toBeInTheDocument();
    expect(screen.getByText("Inventario")).toBeInTheDocument();
    expect(screen.getByText("Jornadas")).toBeInTheDocument();

    expect(screen.queryByText("Donaciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Colaboradores")).not.toBeInTheDocument();
  });

  // Guarda directa del defecto del criterio 1: si HomePage.jsx vuelve a leer un campo que
  // MODULOS no tiene (etiqueta, icono...), esta tarjeta se renderiza vacia y esta prueba lo
  // nota sin tener que enumerar cada nombre de modulo a mano.
  it("ninguna tarjeta de modulo queda sin texto", () => {
    mockSesion.perfil = { rol: ROLES.ADMINISTRADOR, nombres: "Ana" };
    pantalla();

    const tarjetas = document.querySelectorAll(".inicio-acceso-etiqueta");
    expect(tarjetas.length).toBeGreaterThan(0);
    tarjetas.forEach((tarjeta) => {
      expect(tarjeta.textContent.trim()).not.toBe("");
    });
  });

  it("el saludo usa el nombre de pila de la sesion", () => {
    mockSesion.perfil = { rol: ROLES.ADMINISTRADOR, nombres: "Ana" };
    pantalla();

    expect(screen.getByText("Hola, Ana")).toBeInTheDocument();
  });

  // ISSUE #864. La 00141 le retiro a los dos roles consultivos la lectura de `jornadas`, pero el
  // cliente les seguia dibujando la seccion: la consulta salia, RLS la devolvia vacia, y acababan
  // leyendo "No hay ninguna jornada en curso ahora mismo" -- que es falso. Las hay; lo que pasa es
  // que no son suyas.
  it.each([ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR])(
    "%s no ve la seccion de jornadas, porque la base no le da ninguna",
    (rol) => {
      mockSesion.perfil = { rol, nombres: "Carmen" };
      pantalla();

      expect(screen.queryByText("Jornadas en curso")).not.toBeInTheDocument();
      expect(screen.queryByText(/No hay ninguna jornada en curso/)).not.toBeInTheDocument();
    },
  );

  it.each([ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO])(
    "%s si tiene el modulo Jornadas, asi que la seccion sigue ahi",
    (rol) => {
      mockSesion.perfil = { rol, nombres: "Luis" };
      pantalla();

      expect(screen.getByText("Jornadas en curso")).toBeInTheDocument();
    },
  );
});
