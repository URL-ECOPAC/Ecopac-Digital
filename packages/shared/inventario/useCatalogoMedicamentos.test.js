import { describe, it, expect } from "vitest";

const mockInventario = [
  {
    id: "1",
    nombre: "Paracetamol",
    principio_activo: "Acetaminofén",
    categoria: "Medicamentos",
    bodega_nombre: "Central",
  },
  {
    id: "2",
    nombre: "Jeringa 5ml",
    principio_activo: "N/A",
    categoria: "Suministros",
    bodega_nombre: "Norte",
  },
  {
    id: "3",
    nombre: "Ibuprofeno",
    principio_activo: "Ibuprofeno",
    categoria: "Medicamentos",
    bodega_nombre: "Central",
  },
];

function filtrarInventario(
  inventario,
  { busqueda = "", categoria = "Todos", bodega = "Todas" } = {},
) {
  return inventario.filter((item) => {
    const coincideBusqueda =
      !busqueda ||
      item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.principio_activo?.toLowerCase().includes(busqueda.toLowerCase());

    const coincideCategoria = categoria === "Todos" || item.categoria === categoria;

    const coincideBodega =
      bodega === "Todas" || item.bodega_id === bodega || item.bodega_nombre === bodega;

    return coincideBusqueda && coincideCategoria && coincideBodega;
  });
}

describe("Lógica de filtrado de Catálogo de Medicamentos (#269)", () => {
  it("filtra por búsqueda en nombre y principio activo", () => {
    const resNombre = filtrarInventario(mockInventario, { busqueda: "Paracetamol" });
    expect(resNombre).toHaveLength(1);
    expect(resNombre[0].nombre).toBe("Paracetamol");

    const resPrincipio = filtrarInventario(mockInventario, { busqueda: "Acetaminofén" });
    expect(resPrincipio).toHaveLength(1);
    expect(resPrincipio[0].nombre).toBe("Paracetamol");
  });

  it("filtra por categoría seleccionada", () => {
    const res = filtrarInventario(mockInventario, { categoria: "Suministros" });
    expect(res).toHaveLength(1);
    expect(res[0].nombre).toBe("Jeringa 5ml");
  });

  it("filtra por bodega seleccionada", () => {
    const res = filtrarInventario(mockInventario, { bodega: "Central" });
    expect(res).toHaveLength(2);
  });
});
