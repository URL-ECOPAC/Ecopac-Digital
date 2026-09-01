import { useState, useMemo, useCallback } from "react";

export const CATEGORIAS_PILLS = [
  "Todas",
  "Medicamentos",
  "Biológicos",
  "Insumos",
  "Dispositivos",
  "Diagnóstico",
  "EPP",
];

export const BODEGAS_PILLS = ["todas", "central", "norte", "sur"];

// Auxiliar para limpiar tildes, minúsculas y espacios
const normalizar = (texto) => {
  if (texto === null || texto === undefined) return "";
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export function useCatalogoMedicamentos({ inventarioInicial = [], bodegas = [] } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("todas");

  const inventarioFiltrado = useMemo(() => {
    const q = normalizar(busqueda);
    const catFiltro = normalizar(categoriaSeleccionada);
    const bodegaFiltro = normalizar(bodegaSeleccionada);

    return (inventarioInicial || []).filter((item) => {
      if (!item) return false;

      // ----------------------------------------------------------------------
      // EXTRACCIÓN CONFORME AL ESQUEMA ECOPAC DIGITAL
      // ----------------------------------------------------------------------
      
      // Nombre y especificaciones de la migración (nombre, concentracion, presentacion, marca)
      const nombre = normalizar(item.nombre || item.descripcion || item.nombre_producto);
      const concentracion = normalizar(item.concentracion);
      const marca = normalizar(item.marca);
      const codigo = normalizar(item.codigo || item.code || item.id);
      
      // Principios activos (Maneja arrays u objetos concatenados)
      let principioActivo = "";
      if (Array.isArray(item.principios_activos)) {
        principioActivo = item.principios_activos.map(p => typeof p === "object" ? p.nombre : p).join(" ");
      } else {
        principioActivo = item.principioActivo || item.principio_activo || item.principios_activos || "";
      }
      principioActivo = normalizar(principioActivo);

      // Lotes
      const lote = normalizar(item.lote || item.lote_serie || item.codigo_lote || item.lotes?.codigo);

      // Categoría (Si no viene definida en el registro, asume 'Medicamentos' por la migración SQL)
      const catItem = normalizar(
        typeof item.categoria === "object"
          ? item.categoria?.nombre
          : item.categoria || item.category || item.tipo || "Medicamentos"
      );

      // Bodega (Puede venir del JOIN entre existencias -> lotes -> bodega)
      const bodegaItem = normalizar(
        typeof item.bodega === "object"
          ? item.bodega?.nombre || item.bodega?.slug
          : item.bodega || item.bodegaNombre || item.bodega_nombre || item.bodega_id
      );

      // ----------------------------------------------------------------------
      // EVALUACIÓN DE FILTROS
      // ----------------------------------------------------------------------

      // 1. Buscador global (Código, Descripción/Nombre, Principio Activo, Lote, Marca)
      const coincideBusqueda =
        !q ||
        nombre.includes(q) ||
        concentracion.includes(q) ||
        marca.includes(q) ||
        principioActivo.includes(q) ||
        codigo.includes(q) ||
        lote.includes(q);

      // 2. Categoría
      const esCatTodas = !catFiltro || catFiltro === "todas" || catFiltro === "todos";
      const coincideCategoria =
        esCatTodas ||
        catItem === catFiltro ||
        catItem.includes(catFiltro) ||
        catFiltro.includes(catItem);

      // 3. Bodega (Central, Norte, Sur, etc.)
      const esBodegaTodas = !bodegaFiltro || bodegaFiltro === "todas" || bodegaFiltro === "todos";
      const coincideBodega =
        esBodegaTodas ||
        !bodegaItem || // Si el catálogo general aún no está asignado a lote, se mantiene visible
        bodegaItem === bodegaFiltro ||
        bodegaItem.includes(bodegaFiltro) ||
        bodegaFiltro.includes(bodegaItem);

      return coincideBusqueda && coincideCategoria && coincideBodega;
    });
  }, [inventarioInicial, busqueda, categoriaSeleccionada, bodegaSeleccionada]);

  const hayFiltrosActivos =
    busqueda.trim() !== "" ||
    (normalizar(categoriaSeleccionada) !== "todas" && normalizar(categoriaSeleccionada) !== "todos") ||
    (normalizar(bodegaSeleccionada) !== "todas" && normalizar(bodegaSeleccionada) !== "todos");

  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setCategoriaSeleccionada("Todas");
    setBodegaSeleccionada("todas");
  }, []);

  return {
    busqueda,
    setBusqueda,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    bodegaSeleccionada,
    setBodegaSeleccionada,
    categoriasPills: CATEGORIAS_PILLS,
    bodegasPills: BODEGAS_PILLS,
    bodegas,
    inventarioFiltrado,
    hayFiltrosActivos,
    limpiarFiltros,
  };
}

export default useCatalogoMedicamentos;