// Prueba de la decision pura de useProyectosSociales.js (issue #840).
//
// El hook no se monta: packages/shared corre vitest en entorno "node", sin DOM, mismo criterio
// que useRegistroDonacion.test.js y useEjecucionPresupuestal.test.js. La decision que esta
// prueba vigila -- si el formulario de un proyecto se puede guardar -- vive en
// validacionDeProyecto(), exportada aparte justamente para poder probarla.
//
// QUE DEFECTO IMPIDE QUE VUELVA
//
// El hook leia `resultado.esValido` y `resultado.errores` de validarProyecto(), que devuelve un
// objeto plano `{ campo: mensaje }` y ninguna de esas dos claves. Las dos lecturas daban
// undefined, asi que la validacion fallaba SIEMPRE: el boton "Crear proyecto" no creaba nada y
// tampoco mostraba ningun error. Con esta prueba, un proyecto valido que no pueda guardarse pone
// el modulo en rojo.

import { describe, expect, it } from "vitest";

import { validacionDeProyecto } from "./useProyectosSociales.js";

const PROYECTO_VALIDO = {
  nombre: "Proyecto de agua segura",
  descripcion: "Acceso a agua potable en tres comunidades",
  fechaInicio: "2026-09-17",
  fechaFin: "2026-10-17",
  responsableId: "perfil-1",
};

describe("validacionDeProyecto", () => {
  it("un proyecto valido se puede guardar y no reporta ningun error", () => {
    expect(validacionDeProyecto(PROYECTO_VALIDO)).toEqual({ ok: true, errores: {} });
  });

  // El caso exacto del defecto: solo el nombre, que es lo unico obligatorio. Antes tampoco se
  // guardaba.
  it("con lo minimo obligatorio tambien se puede guardar", () => {
    expect(validacionDeProyecto({ nombre: "Jornada de salud visual" }).ok).toBe(true);
  });

  it("sin nombre no se puede guardar, y lo dice debajo del campo", () => {
    const resultado = validacionDeProyecto({ nombre: "" });

    expect(resultado.ok).toBe(false);
    expect(resultado.errores.nombre).toBeTypeOf("string");
  });

  // Que el error llegue con su mensaje es la mitad del arreglo: el defecto original dejaba el
  // formulario mudo, que es lo que hacia imposible adivinar que pasaba.
  it("una fecha de fin anterior a la de inicio se rechaza con mensaje", () => {
    const resultado = validacionDeProyecto({
      ...PROYECTO_VALIDO,
      fechaInicio: "2026-10-17",
      fechaFin: "2026-09-17",
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.errores.fechaFin).toBeTypeOf("string");
  });

  it("nunca devuelve el sobre { esValido } que el hook creia recibir", () => {
    const resultado = validacionDeProyecto({});

    expect(resultado).not.toHaveProperty("esValido");
    expect(resultado.errores).not.toHaveProperty("errores");
  });
});
