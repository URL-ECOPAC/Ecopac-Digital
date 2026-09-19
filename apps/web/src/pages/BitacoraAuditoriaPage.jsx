import { useState } from "react";

import {
  COLUMNAS_BITACORA_AUDITORIA,
  FILTROS_BITACORA_AUDITORIA,
  useBitacoraAuditoria,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import ModalDetalleEventoAuditoria from "./ModalDetalleEventoAuditoria";

// Pantalla de la bitacora de auditoria (issue #643): quien cambio que y cuando en las tablas
// sensibles del sistema. Mismo esqueleto que CatalogoDiagnosticosPage.jsx (PageHeader +
// FilterBar + DataList), con el pie de paginacion real de ColaboradoresPage.jsx -- esta tabla si
// puede crecer sin limite, y no se puede traer entera.
//
// Quien puede entrar lo decide el guard de rutas (App.jsx) con rolesDelModulo("bitacora-auditoria"),
// que hoy es solo ROLES.ADMINISTRADOR: no hace falta un chequeo de permisos aparte dentro de la
// pantalla, como si hace CatalogoDiagnosticosPage con su /pacientes de roles mas amplios.
export default function BitacoraAuditoriaPage() {
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);

  const {
    filas,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar,
    pagina,
    paginas,
    hayPaginaAnterior,
    hayPaginaSiguiente,
    irAPaginaAnterior,
    irAPaginaSiguiente,
    catalogos,
  } = useBitacoraAuditoria();

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title="Bitácora de auditoría" />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  const hayFiltros = Boolean(
    filtros.usuarioId || filtros.tablaAfectada || filtros.fecha?.min || filtros.fecha?.max,
  );

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Bitácora de auditoría"
          subtitle="Quién cambió qué y cuándo en los datos sensibles del sistema"
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_BITACORA_AUDITORIA}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
            onLimpiar={limpiarFiltros}
            hayFiltros={hayFiltros}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 evento" : `${total} eventos`}</p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_BITACORA_AUDITORIA}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            accionSecundaria={{ label: "Ver detalle", onClick: setEventoSeleccionado }}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ningún evento coincide con la búsqueda."
                  actionLabel="Limpiar filtros"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavía no hay eventos registrados." />
              )
            }
          />
        </div>

        {paginas > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <SecondaryButton
              title="Anterior"
              onClick={irAPaginaAnterior}
              disabled={!hayPaginaAnterior}
            />
            <span style={{ color: "var(--color-text-muted)" }}>
              Pagina {pagina} de {paginas}
            </span>
            <SecondaryButton
              title="Siguiente"
              onClick={irAPaginaSiguiente}
              disabled={!hayPaginaSiguiente}
            />
          </div>
        )}

        {eventoSeleccionado && (
          <ModalDetalleEventoAuditoria
            evento={eventoSeleccionado}
            onClose={() => setEventoSeleccionado(null)}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
