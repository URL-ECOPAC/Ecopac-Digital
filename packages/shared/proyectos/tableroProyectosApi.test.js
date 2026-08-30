import { describe, it, expect } from "vitest";
import { ROLES } from "../usuarios/roles.js";
import { obtenerProyectosTablero, moverProyectoAEtapa } from "./tableroProyectosApi.js";

describe("API Tablero de Proyectos (#307)", () => {
  // Antes esta prueba pasaba el rol como "Junta Directiva", con iniciales en mayuscula. El enum
  // rol_usuario no tiene ese valor, asi que la guarda lo rechazaba por ser una cadena
  // desconocida y no por ser junta directiva: cualquier disparate habria pasado la prueba
  // igual, incluido el rol correcto mal escrito. Ahora los dos casos usan ROLES (issue #598).
  it("no deja a junta directiva mover una etapa", async () => {
    const res = await moverProyectoAEtapa(
      { proyectoId: "p1", nuevaEtapa: "en_ejecucion", usuarioRol: ROLES.JUNTA_DIRECTIVA },
      {},
    );

    expect(res.data).toBeNull();
    expect(res.error.message).toContain("administradora");
  });

  it("deja pasar a administrador por la guarda de rol", async () => {
    const res = await moverProyectoAEtapa(
      { proyectoId: "p1", nuevaEtapa: "en_ejecucion", usuarioRol: ROLES.ADMINISTRADOR },
      {},
    );

    // Con un cliente vacio la llamada falla mas adelante; lo que esta prueba fija es que el
    // fallo ya no sea el de permisos, que es lo que ocurria con el rol escrito a mano.
    expect(res.error?.message ?? "").not.toContain("administradora");
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
