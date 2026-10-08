// Pruebas de las areas de atencion (issue #927, 00182): validaciones, opciones, permisos, el filtro
// del catalogo y las consultas. Datos inventados.

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

const { ROLES } = await import("../usuarios/roles.js");
const { validarAreaCatalogo, LARGO_MAXIMO_NOMBRE_DE_AREA } =
  await import("./areas.validaciones.js");
const { etiquetaDeArea, opcionesDeAreas, opcionesDeFiltroDeAreas } =
  await import("./areas.campos.js");
const { puedeGestionarCatalogoDeAreas, puedeVerCatalogoDeAreas, puedeAsignarAreasAPaciente } =
  await import("./areas.permisos.js");
const { filtrarAreas, hayFiltrosDeCatalogoAreas } = await import("./useCatalogoAreas.js");
const {
  aAreasDelPaciente,
  actualizarAreaCatalogo,
  crearAreaCatalogo,
  obtenerCatalogoDeAreas,
  sincronizarAreasDelPaciente,
} = await import("./areas.api.js");

const AREAS = [
  { id: "a-med", nombre: "Medicina General", descripcion: "Consulta general", esVigente: true },
  { id: "a-odo", nombre: "Odontologia", descripcion: null, esVigente: true },
  { id: "a-nut", nombre: "Nutrición", descripcion: "Retirada", esVigente: false },
];

/**
 * Doble de supabase-js: cada tabla devuelve su respuesta y se anotan las llamadas. La cadena es
 * "thenable", asi que cualquier paso final (order, maybeSingle, eq, in) resuelve igual.
 */
function crearCliente(respuestas = {}) {
  const llamadas = [];
  return {
    llamadas,
    from(tabla) {
      const respuesta = () => {
        const valor = respuestas[tabla];
        return Promise.resolve(typeof valor === "function" ? valor(llamadas) : valor);
      };
      const cadena = {};
      for (const paso of ["select", "insert", "update", "delete", "eq", "in", "order"]) {
        cadena[paso] = (...argumentos) => {
          llamadas.push({ tabla, paso, argumentos });
          return cadena;
        };
      }
      cadena.maybeSingle = respuesta;
      cadena.then = (alCumplir, alFallar) => respuesta().then(alCumplir, alFallar);
      return cadena;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("validarAreaCatalogo", () => {
  it("exige el nombre", () => {
    expect(validarAreaCatalogo({ nombre: "   " })).toEqual({
      nombre: "El nombre del área es requerido.",
    });
    expect(validarAreaCatalogo()).toHaveProperty("nombre");
  });

  it("limita el largo del nombre", () => {
    const largo = "x".repeat(LARGO_MAXIMO_NOMBRE_DE_AREA + 1);
    expect(validarAreaCatalogo({ nombre: largo }).nombre).toMatch(/no puede pasar de 100/);
  });

  it("un nombre valido no tiene errores", () => {
    expect(validarAreaCatalogo({ nombre: "Psicologia" })).toEqual({});
  });
});

describe("opciones de area", () => {
  it("una retirada se marca como inactiva", () => {
    expect(etiquetaDeArea(AREAS[2])).toBe("Nutrición (inactiva)");
    expect(etiquetaDeArea(AREAS[0])).toBe("Medicina General");
  });

  it("al elegir se ofrecen las vigentes y la retirada solo si ya estaba elegida", () => {
    expect(opcionesDeAreas(AREAS).map((opcion) => opcion.value)).toEqual(["a-med", "a-odo"]);
    expect(opcionesDeAreas(AREAS, ["a-nut"])).toEqual([
      { value: "a-med", label: "Medicina General" },
      { value: "a-odo", label: "Odontologia" },
      { value: "a-nut", label: "Nutrición (inactiva)" },
    ]);
    expect(opcionesDeAreas(null, null)).toEqual([]);
  });

  it("el filtro ofrece todas, las retiradas marcadas", () => {
    expect(opcionesDeFiltroDeAreas(AREAS).map((opcion) => opcion.label)).toEqual([
      "Medicina General",
      "Odontologia",
      "Nutrición (inactiva)",
    ]);
    expect(opcionesDeFiltroDeAreas(null)).toEqual([]);
  });
});

describe("permisos de areas", () => {
  it("todos ven el catalogo; solo la administradora lo mantiene", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerCatalogoDeAreas(rol)).toBe(true);
    }
    expect(puedeGestionarCatalogoDeAreas(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeGestionarCatalogoDeAreas(ROLES.MEDICO)).toBe(false);
    expect(puedeGestionarCatalogoDeAreas(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("asigna areas quien edita pacientes, no los consultivos", () => {
    expect(puedeAsignarAreasAPaciente(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeAsignarAreasAPaciente(ROLES.MEDICO)).toBe(true);
    expect(puedeAsignarAreasAPaciente(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });
});

describe("filtro del catalogo", () => {
  it("busca por nombre o descripcion sin distinguir acentos ni mayusculas", () => {
    expect(filtrarAreas(AREAS, "nutricion").map((area) => area.id)).toEqual(["a-nut"]);
    expect(filtrarAreas(AREAS, "GENERAL").map((area) => area.id)).toEqual(["a-med"]);
    expect(filtrarAreas(AREAS, "")).toBe(AREAS);
  });

  it("dice si hay busqueda", () => {
    expect(hayFiltrosDeCatalogoAreas({ busqueda: "  " })).toBe(false);
    expect(hayFiltrosDeCatalogoAreas({ busqueda: "odo" })).toBe(true);
    expect(hayFiltrosDeCatalogoAreas()).toBe(false);
  });
});

describe("aAreasDelPaciente", () => {
  it("aplana el embebido, ordena por nombre y descarta lo que RLS dejo en null", () => {
    expect(
      aAreasDelPaciente([
        { area: { id: "a-odo", nombre: "Odontologia", esVigente: true } },
        { area: null },
        { area: { id: "a-med", nombre: "Medicina General", descripcion: "x", esVigente: false } },
      ]),
    ).toEqual([
      { id: "a-med", nombre: "Medicina General", descripcion: "x", esVigente: false },
      { id: "a-odo", nombre: "Odontologia", descripcion: null, esVigente: true },
    ]);
    expect(aAreasDelPaciente(undefined)).toEqual([]);
  });
});

describe("catalogo de areas en la base", () => {
  it("trae el catalogo completo o solo las vigentes", async () => {
    dobles.cliente = crearCliente({ areas_atencion: { data: AREAS, error: null } });
    const { areas, error } = await obtenerCatalogoDeAreas({ soloVigentes: true });

    expect(error).toBeNull();
    expect(areas).toHaveLength(3);
    expect(dobles.cliente.llamadas).toContainEqual({
      tabla: "areas_atencion",
      paso: "eq",
      argumentos: ["es_vigente", true],
    });
  });

  it("un error de la base llega normalizado y con la lista vacia", async () => {
    dobles.cliente = crearCliente({ areas_atencion: { data: null, error: { code: "42501" } } });
    const { areas, error } = await obtenerCatalogoDeAreas();
    expect(areas).toEqual([]);
    expect(error.codigo).toBe("permiso_denegado");
  });

  it("crear valida antes de llamar a la base", async () => {
    const { area, errores } = await crearAreaCatalogo({ nombre: "" });
    expect(area).toBeNull();
    expect(errores).toHaveProperty("nombre");
  });

  it("crear guarda el nombre limpio y la descripcion vacia como null", async () => {
    dobles.cliente = crearCliente({
      areas_atencion: {
        data: { id: "a-new", nombre: "Nutricion", descripcion: null, esVigente: true },
        error: null,
      },
    });
    const { area, errores, error } = await crearAreaCatalogo({
      nombre: "  Nutricion ",
      descripcion: " ",
    });

    expect(error).toBeNull();
    expect(errores).toEqual({});
    expect(area.id).toBe("a-new");
    expect(dobles.cliente.llamadas).toContainEqual({
      tabla: "areas_atencion",
      paso: "insert",
      argumentos: [{ nombre: "Nutricion", descripcion: null }],
    });
  });

  it("un nombre repetido vuelve como error del campo", async () => {
    dobles.cliente = crearCliente({ areas_atencion: { data: null, error: { code: "23505" } } });
    const { errores, error } = await crearAreaCatalogo({ nombre: "Odontologia" });
    expect(error).toBeNull();
    expect(errores.nombre).toMatch(/Ya existe/);
  });

  it("si RLS no devuelve la fila, dice que solo la administracion mantiene el catalogo", async () => {
    dobles.cliente = crearCliente({ areas_atencion: { data: null, error: null } });
    const { error } = await actualizarAreaCatalogo("a-odo", { esVigente: false });
    expect(error.codigo).toBe("permiso_denegado");
  });

  it("actualizar pide el id y algun cambio", async () => {
    expect((await actualizarAreaCatalogo(null, { nombre: "x" })).error).not.toBeNull();
    expect((await actualizarAreaCatalogo("a-odo", {})).error).not.toBeNull();
    expect((await actualizarAreaCatalogo("a-odo", { nombre: " " })).errores).toHaveProperty(
      "nombre",
    );
  });

  it("actualizar manda solo lo que cambia", async () => {
    dobles.cliente = crearCliente({
      areas_atencion: {
        data: { id: "a-odo", nombre: "Odontologia", esVigente: false },
        error: null,
      },
    });
    const { area } = await actualizarAreaCatalogo("a-odo", { esVigente: false });
    expect(area.esVigente).toBe(false);
    expect(dobles.cliente.llamadas).toContainEqual({
      tabla: "areas_atencion",
      paso: "update",
      argumentos: [{ es_vigente: false }],
    });
  });
});

describe("sincronizarAreasDelPaciente", () => {
  it("agrega las que faltan y quita las que sobran, sin tocar las que se quedan", async () => {
    dobles.cliente = crearCliente({
      paciente_area: { data: [{ areaId: "a-med" }, { areaId: "a-nut" }], error: null },
    });

    const { error } = await sincronizarAreasDelPaciente("p-1", ["a-nut", "a-odo", "a-odo"]);

    expect(error).toBeNull();
    const llamadas = dobles.cliente.llamadas;
    expect(llamadas).toContainEqual({
      tabla: "paciente_area",
      paso: "in",
      argumentos: ["area_id", ["a-med"]],
    });
    expect(llamadas).toContainEqual({
      tabla: "paciente_area",
      paso: "insert",
      argumentos: [[{ paciente_id: "p-1", area_id: "a-odo" }]],
    });
  });

  it("sin cambios no escribe nada", async () => {
    dobles.cliente = crearCliente({ paciente_area: { data: [{ areaId: "a-med" }], error: null } });
    await sincronizarAreasDelPaciente("p-1", ["a-med"]);
    expect(dobles.cliente.llamadas.some((llamada) => llamada.paso === "insert")).toBe(false);
    expect(dobles.cliente.llamadas.some((llamada) => llamada.paso === "delete")).toBe(false);
  });

  it("sin paciente no consulta, y un rechazo de la base llega normalizado", async () => {
    expect((await sincronizarAreasDelPaciente(null, [])).error).not.toBeNull();

    dobles.cliente = crearCliente({ paciente_area: { data: null, error: { code: "42501" } } });
    const { error } = await sincronizarAreasDelPaciente("p-1", ["a-med"]);
    expect(error.codigo).toBe("permiso_denegado");
  });
});
