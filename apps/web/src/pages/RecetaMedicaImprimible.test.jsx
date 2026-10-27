// Prueba del formato de receta medica (boton "Receta / PDF"): una receta con un medicamento, otra
// con varios y otra con datos incompletos. El formato de "Imprimir / PDF" no se toca.
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import RecetaImprimible from "./RecetaImprimible";
import RecetaMedicaImprimible from "./RecetaMedicaImprimible";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const PACIENTE = {
  nombres: "Paciente",
  apellidos: "De Prueba",
  fechaNacimiento: "1990-03-15",
  sexo: "Femenino",
  comunidad: { nombre: "Comunidad Ficticia" },
  expediente: { numeroFicha: "EXP-000042" },
};

const IBUPROFENO = {
  id: "d-1",
  medicamento: "Ibuprofeno",
  concentracion: "400 mg",
  presentacion: "Tableta",
  dosis: "1 tableta",
  frecuencia: "cada 8 horas",
  duracion: "3 dias",
  cantidadEntregada: 10,
};

const RECETA = {
  id: "r-1",
  folio: "REC-0001",
  estado: "emitida",
  anulada: false,
  medico: "Medico De Prueba",
  jornada: "Jornada de prueba",
  fechaDeJornada: "2026-05-10",
  createdAt: "2026-05-10T16:00:00Z",
  peso: 62.5,
  talla: 158,
  indicacionesGenerales: "Tomar con alimentos",
  detalle: [IBUPROFENO],
};

function textoDelPapel() {
  return document.querySelector(".doc-imprimible").textContent;
}

describe("RecetaMedicaImprimible", () => {
  it("con un medicamento: encabezado, datos del paciente, Rp: y pie con telefono", () => {
    render(<RecetaMedicaImprimible receta={RECETA} paciente={PACIENTE} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Receta médica");
    const texto = textoDelPapel();
    expect(texto).toContain("Paciente: Paciente De Prueba");
    expect(texto).toContain("Peso: 62.5 kg (137.8 lb)");
    expect(texto).toContain("Talla: 158 cm");
    expect(texto).toContain("Jornada: Jornada de prueba");
    expect(texto).not.toContain("Comunidad");
    expect(texto).not.toContain("Ficha");
    expect(texto).toContain("Rp:");
    expect(screen.getByText("1. Ibuprofeno 400 mg")).toBeInTheDocument();
    expect(screen.getByText("# 10 tabletas")).toBeInTheDocument();
    expect(screen.getByText("Uso: tomar 1 tableta cada 8 horas por 3 días.")).toBeInTheDocument();
    expect(screen.getByText("Indicaciones generales")).toBeInTheDocument();
    expect(screen.getByText("Tel.: 4237-5025")).toBeInTheDocument();
    expect(texto).not.toContain("Cantidad entregada");
  });

  it("con varios medicamentos los numera en orden", () => {
    render(
      <RecetaMedicaImprimible
        receta={{
          ...RECETA,
          detalle: [
            IBUPROFENO,
            { ...IBUPROFENO, id: "d-2", medicamento: "Acetaminofén", concentracion: "500 mg" },
          ],
        }}
        paciente={PACIENTE}
      />,
    );

    expect(screen.getByText("1. Ibuprofeno 400 mg")).toBeInTheDocument();
    expect(screen.getByText("2. Acetaminofén 500 mg")).toBeInTheDocument();
    expect(screen.getAllByText("# 10 tabletas")).toHaveLength(2);
  });

  it("con datos incompletos deja la raya para peso y talla y no muestra indicaciones", () => {
    render(
      <RecetaMedicaImprimible
        receta={{
          ...RECETA,
          peso: null,
          talla: null,
          indicacionesGenerales: null,
          detalle: [{ id: "d-1", medicamento: "Loratadina" }],
        }}
        paciente={PACIENTE}
      />,
    );

    const texto = textoDelPapel();
    expect(texto).toContain("Peso: ________");
    expect(texto).toContain("Talla: ________");
    expect(screen.queryByText("Indicaciones generales")).not.toBeInTheDocument();
    expect(screen.getByText("1. Loratadina")).toBeInTheDocument();
    expect(texto).not.toContain("Uso:");
    expect(texto).not.toContain("#");
  });

  it("una receta anulada sale marcada", () => {
    render(
      <RecetaMedicaImprimible
        receta={{ ...RECETA, anulada: true, motivoAnulacion: "Error de dosis" }}
        paciente={PACIENTE}
      />,
    );

    expect(screen.getByText(/RECETA ANULADA/)).toHaveTextContent("Error de dosis");
  });

  it("el formato de Imprimir / PDF sigue igual: comunidad, ficha y cantidad entregada", () => {
    render(<RecetaImprimible receta={RECETA} paciente={PACIENTE} />);

    const texto = textoDelPapel();
    expect(texto).toContain("Ficha: EXP-000042");
    expect(texto).toContain("Comunidad: Comunidad Ficticia");
    expect(texto).toContain("Cantidad entregada: 10");
    expect(texto).not.toContain("Rp:");
    expect(texto).not.toContain("Tel.:");
  });
});
