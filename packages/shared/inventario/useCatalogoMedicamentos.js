<<<<<<< HEAD
import { useState, useMemo } from "react";
=======
import { useState, useMemo, useCallback } from "react";
>>>>>>> origin/develop

export const CATEGORIAS_PILLS = [
  "Todos",
  "Medicamentos",
  "Suministros",
  "Equipos",
  "Insumos",
  "Programas",
];

<<<<<<< HEAD
/**
 * Hook para la gestión del catálogo de medicamentos en la app móvil.
 */
=======
>>>>>>> origin/develop
export function useCatalogoMedicamentos({ inventarioInicial = [], bodegas = [] } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("Todas");

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/develop

      return coincideBusqueda && coincideCategoria && coincideBodega;
    });
  }, [inventarioInicial, busqueda, categoriaSeleccionada, bodegaSeleccionada]);

  const hayFiltrosActivos =
<<<<<<< HEAD
    busqueda.trim() !== "" ||
    categoriaSeleccionada !== "Todos" ||
    bodegaSeleccionada !== "Todas";

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaSeleccionada("Todos");
    setBodegaSeleccionada("Todas");
  };
=======
    busqueda.trim() !== "" || categoriaSeleccionada !== "Todos" || bodegaSeleccionada !== "Todas";

  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setCategoriaSeleccionada("Todos");
    setBodegaSeleccionada("Todas");
  }, []);
>>>>>>> origin/develop

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
<<<<<<< HEAD
}
=======
}

// Exportación por defecto obligatoria para compatibilidad con Metro/Expo
export default useCatalogoMedicamentos;
>>>>>>> origin/develop
