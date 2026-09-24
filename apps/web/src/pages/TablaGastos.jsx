import { useMemo, useState } from "react";
import { COLUMNAS_GASTO, FILTROS_GASTO, puedeAprobarGasto } from "@ecopac/shared";
import { DataList, ErrorState, FilterBar, PrimaryButton } from "../components";
import ModalGasto from "./ModalGasto";

const FILTROS_SIN_BUSQUEDA = FILTROS_GASTO.filter((filtro) => filtro.id !== "busqueda");

export default function TablaGastos({
  gastos,
  catalogos,
  filtroEstado,
  cambiarFiltroEstado,
  cargando,
  error,
  recargar,
  puedeCrear,
  usuarioId,
  rol,
}) {
  const [filtrosAdicionales, setFiltrosAdicionales] = useState({});
  const [gastoEnEdicion, setGastoEnEdicion] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  //  Punto 3: Definir permisos según rol
  const puedeAprobar = puedeAprobarGasto(rol);
  const estadoInicialPorRol = puedeAprobar ? "aprobado" : "pendiente";

  const cambiarFiltro = (id, valor) => {
    if (id === "estado") {
      cambiarFiltroEstado(valor ?? "");
      return;
    }
    setFiltrosAdicionales((anteriores) => ({ ...anteriores, [id]: valor }));
  };

  const gastosFiltrados = useMemo(() => {
    return gastos.filter((gasto) => {
      if (filtrosAdicionales.categoria && gasto.categoria !== filtrosAdicionales.categoria) {
        return false;
      }
      if (filtrosAdicionales.proyecto_id && gasto.proyecto_id !== filtrosAdicionales.proyecto_id) {
        return false;
      }
      if (filtrosAdicionales.jornada_id && gasto.jornada_id !== filtrosAdicionales.jornada_id) {
        return false;
      }
      const rango = filtrosAdicionales.fecha;
      if (rango?.min && gasto.fecha < rango.min) return false;
      if (rango?.max && gasto.fecha > rango.max) return false;
      return true;
    });
  }, [gastos, filtrosAdicionales]);

  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  const valoresDeFiltro = { ...filtrosAdicionales, estado: filtroEstado || null };
  const hayFiltros =
    Boolean(filtroEstado) ||
    Object.values(filtrosAdicionales).some((valor) =>
      valor && typeof valor === "object" ? Boolean(valor.min || valor.max) : Boolean(valor)
    );

  const limpiarFiltros = () => {
    setFiltrosAdicionales({});
    cambiarFiltroEstado("");
  };

 // Punto 5: Asegurar que el estado se muestre en MAYÚSCULA
// COLUMNA_GASTO ya debería formatearlo, pero lo garantizamos aquí
const columnasConMayuscula = useMemo(() => {
  return COLUMNAS_GASTO.map((columna) => {
    if (columna.id === "estado") {
      return {
        ...columna,
        formatear: (fila) => {
          const valor = fila.estado;
          if (!valor) return "—";
          return (
            <span style={{ textTransform: "uppercase" }}>
              {String(valor)}
            </span>
          );
        },
      };
    }
    return columna;
  });
}, []);

//  Cualquier return condicional VA DESPUÉS del useMemo
if (!datos) return <EstadoVacio />;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-end">
        {puedeCrear && (
          <PrimaryButton title="Registrar gasto" onClick={() => setMostrarAlta(true)} />
        )}
      </div>

      <FilterBar
        campos={FILTROS_SIN_BUSQUEDA}
        valores={valoresDeFiltro}
        onChange={cambiarFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      <DataList
        columnas={columnasConMayuscula}
        datos={gastosFiltrados}
        cargando={cargando}
        vacio="No hay gastos que coincidan con estos filtros."
        catalogos={catalogos}
        onRowPress={(gasto) => setGastoEnEdicion(gasto)}
      />

      {mostrarAlta && (
        <ModalGasto
          usuarioId={usuarioId}
          rol={rol}
          estadoInicial={estadoInicialPorRol}
          onClose={() => setMostrarAlta(false)}
          onGuardado={() => {
            setMostrarAlta(false);
            recargar();
          }}
        />
      )}

      {gastoEnEdicion && (
        <ModalGasto
          key={gastoEnEdicion.id}
          gasto={gastoEnEdicion}
          usuarioId={usuarioId}
          rol={rol}
          onClose={() => setGastoEnEdicion(null)}
          onGuardado={() => {
            setGastoEnEdicion(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}