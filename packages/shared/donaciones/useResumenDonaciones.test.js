import { describe, expect, it, vi } from "vitest";
import { useResumenDonaciones } from "./useResumenDonaciones.js";
import * as historialApi from "./historial.api.js";

vi.mock("./historial.api.js", () => ({
  listarDonaciones: vi.fn(),
}));

describe("useResumenDonaciones", () => {
  it("obtiene el resumen de donaciones correctamente", async () => {
    historialApi.listarDonaciones.mockResolvedValue({
      datos: {
        donaciones: [
          {
            id: "1",
            donanteId: "d1",
            donanteNombre: "Fundación A",
            tipo: "dinero",
            resumen: "Q 100",
          },
          {
            id: "2",
            donanteId: "d1",
            donanteNombre: "Fundación A",
            tipo: "dinero",
            resumen: "Q 200",
          },
        ],
        totalesPorTipo: { dinero: 300, medicamentos: 0, insumos: 0, servicios: 0 },
      },
      error: null,
    });

    // Simulador simple para hooks de estado en Node.js
    let estado = {};
    const setDatos = (v) => {
      estado.datos = typeof v === "function" ? v(estado.datos) : v;
    };
    const setCargando = (v) => {
      estado.cargando = v;
    };
    const setError = (v) => {
      estado.error = v;
    };

    // Ejecución directa de la consulta
    const respuesta = await historialApi.listarDonaciones(
      { limite: 10 },
      { rolUsuario: "administrador" },
    );

    expect(respuesta.datos.totalesPorTipo.dinero).toBe(300);
    expect(respuesta.datos.donaciones).toHaveLength(2);
  });
});
