// Regresion de "Cannot access 'setCampo' before initialization" en useRegistroPaciente.
//
// ModalAltaPaciente.test.jsx, la prueba que ya existia, mockea useRegistroPaciente entero: le
// pasa un objeto con setCampo ya resuelto, asi que nunca ejecuta el cuerpo del hook y no podia
// ver el fallo. El error era de ORDEN DE DECLARACION dentro del hook -registrarComunidad
// capturaba un `const setCampo` declarado cuarenta lineas mas abajo-, y la zona muerta temporal
// solo se toca al evaluar el hook de verdad.
//
// Por eso esta prueba monta el modal con el hook REAL y mockea una capa mas abajo: los tres
// modulos de API que el hook llama en sus efectos. Es lo minimo para que montar no pegue a la
// red, y deja el cuerpo del hook intacto, que es lo que se quiere comprobar.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import ModalAltaPaciente from "./ModalAltaPaciente";

vi.mock("../../../../packages/shared/territorio/api.js", () => ({
  listarDepartamentos: vi.fn(async () => ({ departamentos: [], error: null })),
  listarMunicipios: vi.fn(async () => ({ municipios: [], error: null })),
  listarComunidades: vi.fn(async () => ({ comunidades: [], error: null })),
  obtenerComunidad: vi.fn(async () => ({ comunidad: null, error: null })),
  crearComunidad: vi.fn(async () => ({ comunidad: null, error: null })),
}));

vi.mock("../../../../packages/shared/pacientes/idiomas.api.js", () => ({
  listarIdiomas: vi.fn(async () => ({ idiomas: [], error: null })),
}));

vi.mock("../../../../packages/shared/pacientes/api.js", async (importarOriginal) => ({
  ...(await importarOriginal()),
  buscarPacientes: vi.fn(async () => ({ pacientes: [], error: null })),
  registrarPaciente: vi.fn(async () => ({ paciente: null, errores: {}, error: null })),
}));

afterEach(() => {
  cleanup();
});

describe("ModalAltaPaciente con el hook real", () => {
  it("monta sin reventar: setCampo se declara antes de registrarComunidad", () => {
    expect(() =>
      render(
        <ModalAltaPaciente onClose={vi.fn()} onRegistrado={vi.fn()} rol="voluntario general" />,
      ),
    ).not.toThrow();

    // Si el hook hubiera reventado, el modal no habria llegado a pintar ningun campo.
    expect(screen.getByLabelText("Nombres")).toBeInTheDocument();
  });
});
