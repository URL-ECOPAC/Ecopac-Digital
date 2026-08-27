import { useState, useMemo } from "react";

export const CATEGORIAS_PILLS = [
  "Todos",
  "Medicamentos",
  "Suministros",
  "Equipos",
  "Insumos",
  "Programas",
];

/**
 * Hook para la gestión del catálogo de medicamentos en la app móvil.
 */
export function useCatalogoMedicamentos({ inventarioInicial = [], bodegas = [] } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");

  // Filtrado reactivo por nombre/principio activo, categoría y bodega
  const inventarioFiltrado = useMemo(() => {
    return inventarioInicial.filter((item) => {
      const coincideBusqueda =
        !busqueda ||
        item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.principio_activo?.toLowerCase().includes(busqueda.toLowerCase());

      const coincideCategoria =
        categoriaSeleccionada === "Todos" ||
        item.categoria === categoriaSeleccionada;

      const coincideBodega =
        bodegaSeleccionada === "Todas" ||
        item.bodega_id === bodegaSeleccionada ||
        item.bodega_nombre === bodegaSeleccionada;

      return coincideBusqueda && coincideCategoria && coincideBodega;
    });
  }, [inventarioInicial, busqueda, categoriaSeleccionada, bodegaSeleccionada]);

  const hayFiltrosActivos =
    busqueda.trim() !== "" ||
    categoriaSeleccionada !== "Todos" ||
    bodegaSeleccionada !== "Todas";

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaSeleccionada("Todos");
    setBodegaSeleccionada("Todas");
  };

  return {
    busqueda,
    setBusqueda,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    bodegaSeleccionada,
    setBodegaSeleccionada,
    categoriasPills: CATEGORIAS_PILLS,
    bodegas,
    inventarioFiltrado,
    hayFiltrosActivos,
    limpiarFiltros,
  };
}