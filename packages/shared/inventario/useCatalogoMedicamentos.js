import { useState, useMemo, useCallback } from "react";

export const CATEGORIAS_PILLS = [
  "Todos",
  "Medicamentos",
  "Suministros",
  "Equipos",
  "Insumos",
  "Programas",
];

export function useCatalogoMedicamentos({ inventarioInicial = [], bodegas = [] } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");

  const inventarioFiltrado = useMemo(() => {
    const terminoBusqueda = busqueda.trim().toLowerCase();

    return (inventarioInicial || []).filter((item) => {
      if (!item) return false;
      const nombre = item.nombre?.toLowerCase() || "";
      const principioActivo = (item.principioActivo || item.principio_activo || "").toLowerCase();

      const coincideBusqueda =
        !terminoBusqueda ||
        nombre.includes(terminoBusqueda) ||
        principioActivo.includes(terminoBusqueda);

      const coincideCategoria =
        categoriaSeleccionada === "Todos" || item.categoria === categoriaSeleccionada;

      const bodegaId = item.bodegaId || item.bodega_id;
      const bodegaNombre = item.bodegaNombre || item.bodega_nombre;

      const coincideBodega =
        bodegaSeleccionada === "Todas" ||
        bodegaId === bodegaSeleccionada ||
        bodegaNombre === bodegaSeleccionada;

      return coincideBusqueda && coincideCategoria && coincideBodega;
    });
  }, [inventarioInicial, busqueda, categoriaSeleccionada, bodegaSeleccionada]);

  const hayFiltrosActivos =
    busqueda.trim() !== "" || categoriaSeleccionada !== "Todos" || bodegaSeleccionada !== "Todas";

  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setCategoriaSeleccionada("Todos");
    setBodegaSeleccionada("Todas");
  }, []);

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

// Exportación por defecto obligatoria para compatibilidad con Metro/Expo
export default useCatalogoMedicamentos;
