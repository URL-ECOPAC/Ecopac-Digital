import { describe, expect, it } from "vitest";

import { TIPOS_DE_ACCION, rotuloSinSigno, tipoDeAccion } from "./acciones.js";

describe("tipoDeAccion", () => {
  it.each([
    "Nuevo paciente",
    "Nueva jornada",
    "Crear una comunidad",
    "Agregar hito",
    "Añadir",
    "Registrar gasto",
    "+ Nuevo Proyecto",
    "+Registrar Otro Ingreso",
  ])("'%s' es un alta", (rotulo) => {
    expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.ALTA);
  });

  it.each(["Eliminar", "Borrar", "Quitar renglón"])("'%s' es un borrado", (rotulo) => {
    expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.BORRADO);
  });

  it.each(["Volver", "Volver a donaciones", "Regresar", "Atrás"])(
    "'%s' es un retorno",
    (rotulo) => {
      expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.RETORNO);
    },
  );

  it.each(["Editar", "Editar paciente", "Corregir triaje", "Modificar turno"])(
    "'%s' es una edicion",
    (rotulo) => {
      expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.EDICION);
    },
  );

  it.each(["Ver detalle", "Ver ficha", "Detalle del lote", "Abrir jornada"])(
    "'%s' es un detalle",
    (rotulo) => {
      expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.DETALLE);
    },
  );

  it.each(["Desactivar", "Anular donación", "Rechazar", "Exportar CSV", "Guardar"])(
    "'%s' no tiene tipo",
    (rotulo) => {
      expect(tipoDeAccion(rotulo)).toBeNull();
    },
  );

  it("mira el verbo inicial, no una palabra que lo contenga", () => {
    expect(tipoDeAccion("Registrarse")).toBeNull();
    expect(tipoDeAccion("Verificar")).toBeNull();
    expect(tipoDeAccion("Editorial")).toBeNull();
  });

  it("lo que no es texto no tiene tipo", () => {
    expect(tipoDeAccion(undefined)).toBeNull();
    expect(tipoDeAccion(42)).toBeNull();
  });
});

describe("rotuloSinSigno", () => {
  it("quita el + escrito a mano", () => {
    expect(rotuloSinSigno("+ Nuevo Proyecto")).toBe("Nuevo Proyecto");
  });

  it("deja igual un rotulo sin signo y lo que no es texto", () => {
    expect(rotuloSinSigno("Nuevo paciente")).toBe("Nuevo paciente");
    expect(rotuloSinSigno(null)).toBeNull();
  });
});
