import { beforeEach, describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { actualizarProyecto, crearProyecto } = await import("./api.js");
const { vacioANull } = await import("./normalizacion.js");

function doble(respuesta) {
  const llamadas = [];
  const resolver = () => Promise.resolve(respuesta);
  const cadena = {
    select: () => cadena,
    insert(valores) {
      llamadas.push({ paso: "insert", valores });
      return cadena;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return cadena;
    },
    eq: () => cadena,
    single: resolver,
    maybeSingle: resolver,
  };
  return { llamadas, cliente: { from: () => cadena } };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("vacioANull", () => {
  it("convierte cadenas vacias o de espacios en null y deja pasar lo demas", () => {
    expect(vacioANull("")).toBeNull();
    expect(vacioANull("   ")).toBeNull();
    expect(vacioANull("2026-09-01")).toBe("2026-09-01");
    expect(vacioANull(null)).toBeNull();
    expect(vacioANull(undefined)).toBeUndefined();
    expect(vacioANull(0)).toBe(0);
  });
});

describe("proyectos sin fechas", () => {
  const desdeElFormulario = {
    nombre: "Agua limpia",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    responsableId: "",
  };

  it("actualizarProyecto envia null y no cadenas vacias en fechas, descripcion y responsable", async () => {
    const { cliente, llamadas } = doble({ data: { id: "p-1" }, error: null });
    dobles.cliente = cliente;

    await actualizarProyecto("p-1", desdeElFormulario);

    expect(llamadas[0].valores).toEqual({
      nombre: "Agua limpia",
      descripcion: null,
      fecha_inicio: null,
      fecha_fin: null,
      responsable_id: null,
    });
  });

  it("crearProyecto hace lo mismo", async () => {
    const { cliente, llamadas } = doble({ data: { id: "p-1" }, error: null });
    dobles.cliente = cliente;

    await crearProyecto(desdeElFormulario);

    expect(llamadas[0].valores.fecha_inicio).toBeNull();
    expect(llamadas[0].valores.fecha_fin).toBeNull();
  });

  it("un update parcial no manda las fechas que no se tocaron", async () => {
    const { cliente, llamadas } = doble({ data: { id: "p-1" }, error: null });
    dobles.cliente = cliente;

    await actualizarProyecto("p-1", { nombre: "Nuevo nombre" });

    expect(llamadas[0].valores).toEqual({ nombre: "Nuevo nombre" });
  });
});
