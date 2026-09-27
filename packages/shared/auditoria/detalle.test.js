import { describe, expect, it } from "vitest";

import { diferenciaDeEvento, formatearValorDeAuditoria, nombreDeCampo } from "./detalle.js";

describe("nombreDeCampo", () => {
  it("convierte snake_case a palabras capitalizadas", () => {
    expect(nombreDeCampo("fecha_nacimiento")).toBe("Fecha Nacimiento");
  });

  it("una sola palabra se capitaliza igual", () => {
    expect(nombreDeCampo("nombres")).toBe("Nombres");
  });
});

describe("campos tecnicos", () => {
  it("id, created_at y updated_at no se muestran en ningun tipo de evento", () => {
    const tecnicos = {
      id: "x",
      created_at: "2026-09-18T04:22:59",
      updated_at: "2026-09-19T04:22:59",
    };

    const creacion = diferenciaDeEvento({
      valoresAnteriores: null,
      valoresNuevos: { ...tecnicos, nombres: "Ana" },
    });
    expect(creacion.campos.map((campo) => campo.clave)).toEqual(["nombres"]);

    // En una actualizacion updated_at cambia siempre: no puede aparecer como si fuera lo editado.
    const cambio = diferenciaDeEvento({
      valoresAnteriores: { ...tecnicos, nombres: "Ana" },
      valoresNuevos: { ...tecnicos, updated_at: "2026-09-20T00:00:00", nombres: "Ana" },
    });
    expect(cambio.campos).toEqual([]);
  });
});

describe("formatearValorDeAuditoria", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [true, "Sí"],
    [false, "No"],
    ["Juan", "Juan"],
    [43, "43"],
  ])("%s -> %s", (valor, esperado) => {
    expect(formatearValorDeAuditoria(valor)).toBe(esperado);
  });

  it("una columna DATE se muestra como fecha corta, sin correrse un dia", () => {
    expect(formatearValorDeAuditoria("2026-09-18")).toBe("18/09/2026");
  });

  it("una marca de tiempo se muestra con fecha y hora", () => {
    // Sin zona horaria para que la prueba no dependa de la zona de la maquina que la corre.
    expect(formatearValorDeAuditoria("2026-09-18T04:22:59.45233")).toBe("18/09/2026 04:22");
  });

  it("un texto que solo empieza con cifras no se toma por fecha", () => {
    expect(formatearValorDeAuditoria("2026-09")).toBe("2026-09");
  });

  it("un objeto anidado se muestra como JSON", () => {
    expect(formatearValorDeAuditoria({ a: 1 })).toBe('{"a":1}');
  });
});

describe("diferenciaDeEvento", () => {
  it("una insercion (sin valoresAnteriores) lista todos los campos de valoresNuevos", () => {
    const { tipo, campos } = diferenciaDeEvento({
      valoresAnteriores: null,
      valoresNuevos: { nombres: "Ana", activo: true },
    });

    expect(tipo).toBe("creacion");
    expect(campos).toEqual([
      { clave: "nombres", nombre: "Nombres", valor: "Ana" },
      { clave: "activo", nombre: "Activo", valor: "Sí" },
    ]);
  });

  it("una eliminacion (sin valoresNuevos) lista todos los campos de valoresAnteriores", () => {
    const { tipo, campos } = diferenciaDeEvento({
      valoresAnteriores: { nombres: "Ana" },
      valoresNuevos: null,
    });

    expect(tipo).toBe("eliminacion");
    expect(campos).toEqual([{ clave: "nombres", nombre: "Nombres", valor: "Ana" }]);
  });

  it("una actualizacion solo incluye los campos que cambiaron", () => {
    const { tipo, campos } = diferenciaDeEvento({
      valoresAnteriores: { nombres: "Juan", apellidos: "Perez", telefono: "1111" },
      valoresNuevos: { nombres: "Juan Carlos", apellidos: "Perez", telefono: "1111" },
    });

    expect(tipo).toBe("cambio");
    expect(campos).toEqual([
      { clave: "nombres", nombre: "Nombres", antes: "Juan", despues: "Juan Carlos" },
    ]);
  });

  it("una actualizacion sin cambios reales devuelve una lista vacia", () => {
    const { campos } = diferenciaDeEvento({
      valoresAnteriores: { nombres: "Juan" },
      valoresNuevos: { nombres: "Juan" },
    });

    expect(campos).toEqual([]);
  });

  it("un campo nuevo que no existia antes tambien cuenta como cambio", () => {
    const { campos } = diferenciaDeEvento({
      valoresAnteriores: { nombres: "Juan" },
      valoresNuevos: { nombres: "Juan", telefono: "2222" },
    });

    expect(campos).toEqual([
      { clave: "telefono", nombre: "Telefono", antes: "—", despues: "2222" },
    ]);
  });
});
