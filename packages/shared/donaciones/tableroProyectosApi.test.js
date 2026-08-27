import { describe, it, expect } from "vitest";
import {
  obtenerProyectosTablero,
  moverProyectoAEtapa,
} from "./tableroProyectosApi.js";

describe("API Tablero de Proyectos (#307)", () => {
  it("restringe mover etapa solo a Administrador", async () => {
    const res = await moverProyectoAEtapa(
      { proyectoId: "p1", nuevaEtapa: "en_ejecucion", usuarioRol: "Junta Directiva" },
      {}
    );

    expect(res.data).toBeNull();
    expect(res.error.message).toContain("Solo Administrador");
  });

  it("agrupa los proyectos por etapa ordenados por orden_columna con su conteo", async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [
              { id: "1", etapa: "planificacion", orden_columna: 1 },
              { id: "2", etapa: "planificacion", orden_columna: 2 },
              { id: "3", etapa: "en_ejecucion", orden_columna: 1 },
            ],
            error: null,
          }),
        }),
      }),
    };

    const res = await obtenerProyectosTablero(mockClient);
    expect(res.data.planificacion.total).toBe(2);
    expect(res.data.en_ejecucion.total).toBe(1);
    expect(res.data.planificacion.proyectos[0].id).toBe("1");
  });
});