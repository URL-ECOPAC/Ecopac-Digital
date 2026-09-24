import { useKardexMovimientos } from "@ecopac/shared";
import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";

// Descriptores de columnas
const COLUMNAS_KARDEX = [
  {
    id: "fecha",
    label: "Fecha",
    tipo: "fecha_hora",
  },
  {
    id: "tipo",
    label: "Tipo",
    tipo: "texto",
    // ✅ Sin inyección HTML: texto directo
    formatear: (fila) => {
      const etiquetas = { ingreso: "Ingreso", salida: "Salida" };
      return etiquetas[fila.tipo] || fila.tipo; // Muestra el valor tal cual si no está
    },
  },
  {
    id: "cantidad",
    label: "Cantidad",
    tipo: "numero",
  },
  {
    id: "motivo",
    label: "Motivo",
    tipo: "texto",
  },
  {
    id: "bodega_nombre",
    label: "Bodega",
    tipo: "texto",
  },
  {
    id: "registrado_por_nombre",
    label: "Registrado por",
    tipo: "texto",
  },
  {
    id: "estado",
    label: "Estado",
    tipo: "texto",
    formatear: (fila) => {
      const etiquetas = {
        pendiente: "Pendiente",
        aprobado: "Aprobado",
        rechazado: "Rechazado",
      };
      const texto = etiquetas[fila.estado] || fila.estado; // ✅ Valor original si no está
      // ✅ Solo mostrar (automático) cuando corresponda
      const automatico = fila.aprobacion_automatica ? " (automático)" : "";
      return `${texto}${automatico}`;
    },
  },
  {
    id: "aprobado_por_nombre",
    label: "Aprobado por",
    tipo: "texto",
    formatear: (fila) => fila.aprobado_por_nombre || "Pendiente",
  },
];

export default function KardexMovimientosPage({ loteId }) {
  const { movimientos, cargando, error, filtros, setFiltros } = useKardexMovimientos({ loteId });

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Kárdex de movimientos" />
        <ErrorState mensaje={error.mensaje} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader title="Kárdex de movimientos" />
      <FilterBar
        campos={[
          { id: "fechaDesde", etiqueta: "Fecha desde", tipo: "fecha" },
          { id: "fechaHasta", etiqueta: "Fecha hasta", tipo: "fecha" },
          {
            id: "tipoMovimiento",
            etiqueta: "Tipo",
            tipo: "seleccion",
            opciones: [
              { valor: "todos", etiqueta: "Todos" },
              { valor: "ingreso", etiqueta: "Ingreso" },
              { valor: "salida", etiqueta: "Salida" },
            ],
          },
        ]}
        valores={filtros}
        alCambiar={setFiltros}
      />
      {cargando ? (
        <LoadingState mensaje="Cargando movimientos…" />
      ) : (
        <DataList
          columnas={COLUMNAS_KARDEX}
          datos={movimientos}
          vacio={<EmptyState mensaje="No hay movimientos registrados para este lote." />}
        />
      )}
    </ScreenContainer>
  );
}
