import { describe, expect, it } from "vitest";

import { TIPOS_DE_ACCION, rotuloSinSigno, tipoDeAccion, tipoDeAccionDeBoton } from "./acciones.js";

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

  it.each(["Desactivar", "Anular donación", "Rechazar", "Exportar CSV"])(
    "'%s' no tiene tipo",
    (rotulo) => {
      expect(tipoDeAccion(rotulo)).toBeNull();
    },
  );

  it("'Cancelar' es cancelar; 'Cancelar jornada' no, porque cambia un estado", () => {
    expect(tipoDeAccion("Cancelar")).toBe(TIPOS_DE_ACCION.CANCELAR);
    expect(tipoDeAccion("Cancelar jornada")).toBeNull();
  });

  it.each(["Guardar", "Guardar cambios", "Confirmar entrega"])("'%s' es guardado", (rotulo) => {
    expect(tipoDeAccion(rotulo)).toBe(TIPOS_DE_ACCION.GUARDADO);
  });
});

describe("tipoDeAccionDeBoton", () => {
  it("dentro de un formulario, un alta es la accion que lo guarda", () => {
    expect(tipoDeAccionDeBoton("Registrar donante", { enFormulario: true })).toBe(
      TIPOS_DE_ACCION.GUARDADO,
    );
  });

  it("fuera de un formulario, un alta sigue siendo el + que lo abre", () => {
    expect(tipoDeAccionDeBoton("Registrar donante")).toBe(TIPOS_DE_ACCION.ALTA);
  });

  it("los demas tipos no cambian por estar en un formulario", () => {
    expect(tipoDeAccionDeBoton("Cancelar", { enFormulario: true })).toBe(TIPOS_DE_ACCION.CANCELAR);
    expect(tipoDeAccionDeBoton("Eliminar", { enFormulario: true })).toBe(TIPOS_DE_ACCION.BORRADO);
  });

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
