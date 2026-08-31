import { beforeEach, describe, expect, it, vi } from "vitest";

import { obtenerSupabase } from "../api/cliente.js";
import { CAMPOS_DONANTE } from "./campos.js";
import { actualizarDonante, registrarDonante } from "./donantes.api.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

const COLUMNAS_REALES = [
  "id",
  "nombre",
  "tipo",
  "contacto",
  "telefono",
  "email",
  "direccion",
  "activo",
  "created_at",
  "updated_at",
];

describe("las columnas que escribe el alta de donantes (#509)", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "DON-1" }, error: null }),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("no manda ninguna columna que la tabla no tenga", async () => {
    await registrarDonante(
      { tipo: "persona", nombre: "Prueba", telefono: "55555555" },
      { rolUsuario: "administrador" },
    );

    const [fila] = mockSupabase.insert.mock.calls[0];
    for (const clave of Object.keys(fila)) {
      expect(COLUMNAS_REALES).toContain(clave);
    }
  });

  it("no manda documento_identidad, que nunca existio en el esquema", async () => {
    await registrarDonante(
      { tipo: "persona", nombre: "Prueba", documento_identidad: "1234567890101" },
      { rolUsuario: "administrador" },
    );

    const [fila] = mockSupabase.insert.mock.calls[0];
    expect(fila).not.toHaveProperty("documento_identidad");
  });

  it("si escribe contacto, que el formulario pide y antes se perdia", async () => {
    await registrarDonante(
      { tipo: "organizacion", nombre: "Farmacia X", contacto: "Ana Lopez" },
      { rolUsuario: "administrador" },
    );

    const [fila] = mockSupabase.insert.mock.calls[0];
    expect(fila.contacto).toBe("Ana Lopez");
  });

  it("cada campo del descriptor tiene columna donde caer", async () => {
    const valores = Object.fromEntries(CAMPOS_DONANTE.map((campo) => [campo.id, "x"]));
    await registrarDonante(
      { ...valores, tipo: "persona", nombre: "Prueba" },
      { rolUsuario: "administrador" },
    );

    const [fila] = mockSupabase.insert.mock.calls[0];
    for (const campo of CAMPOS_DONANTE) {
      expect(fila).toHaveProperty(campo.id);
    }
  });

  it("la edicion tampoco deja pasar una columna inventada", async () => {
    await actualizarDonante(
      "DON-1",
      { nombre: "Nuevo", documento_identidad: "123", loQueSea: true },
      { rolUsuario: "administrador" },
    );

    const [cambios] = mockSupabase.update.mock.calls[0];
    expect(cambios).toEqual({ nombre: "Nuevo" });
  });

  it("la baja logica sigue funcionando por la misma via", async () => {
    await actualizarDonante("DON-1", { activo: false }, { rolUsuario: "administrador" });

    const [cambios] = mockSupabase.update.mock.calls[0];
    expect(cambios).toEqual({ activo: false });
  });
});
