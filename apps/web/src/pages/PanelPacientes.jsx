import { FILTROS_PACIENTE } from "@ecopac/shared";

import EmptyState from "../components/EmptyState";
import FilterBar from "../components/FilterBar";
import SecondaryButton from "../components/SecondaryButton";
import ListaPacientes from "./ListaPacientes";

/**
 * Los filtros y la lista de pacientes, con el detalle a la derecha.
 *
 * POR QUE EXISTE
 *
 * PacientesPage y FichaPacientePage dibujaban el mismo maestro-detalle por separado, y solo la
 * primera pintaba la barra de filtros. El efecto era que **al elegir un paciente los filtros
 * desaparecian**: la ruta cambia de /pacientes a /pacientes/:id, monta otro componente, y ese
 * otro no los tenia. Quien acababa de filtrar por comunidad y sexo para encontrar a alguien
 * perdia de vista -y perdia la posibilidad de ajustar- el filtro con el que estaba trabajando,
 * justo en el momento en que mas lo necesita: comparando varios expedientes de la misma
 * comunidad, uno tras otro.
 *
 * Los filtros siguen vivos en las dos rutas porque los dos las pantallas llaman a
 * usePacientesListado() y le pasan el resultado a este componente; lo que se comparte es el
 * dibujo, no el estado. Que el estado se reinicie al navegar es la consecuencia conocida de que
 * sean dos rutas, y se resuelve aparte (los filtros no viajan en la URL todavia).
 *
 * `children` es el panel de la derecha: el marcador de "elige un paciente" en el listado, la
 * ficha completa en la pantalla de detalle.
 */
export default function PanelPacientes({
  listado,
  activoId,
  onSeleccionar,
  onRegistrar,
  puedeRegistrar = false,
  children,
}) {
  const {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    total,
    hayMas,
    cargarMas,
    catalogos,
  } = listado;

  return (
    <>
      <FilterBar
        campos={FILTROS_PACIENTE}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      <div className="pac-maestro-detalle">
        <div>
          <ListaPacientes
            filas={filas}
            total={total}
            cargando={cargando}
            activoId={activoId}
            onSeleccionar={onSeleccionar}
            // El estado vacio sugiere registrar, que es lo que pide el criterio 4 de la #124.
            // Si hay filtros puestos, lo que falta no es un paciente nuevo sino aflojar la
            // busqueda.
            vacio={
              error ? undefined : hayFiltros ? (
                <EmptyState
                  message="Ningun paciente coincide con los filtros."
                  actionLabel="Limpiar filtros"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState
                  message="Todavia no hay pacientes registrados."
                  actionLabel={puedeRegistrar ? "Registrar el primero" : undefined}
                  onAction={puedeRegistrar ? onRegistrar : undefined}
                />
              )
            }
          />

          {/* "Cargar mas" en vez de paginas numeradas: la lista se recorre de arriba abajo y
            este patron funciona igual en la pantalla movil (#133), que usa el mismo hook. */}
          {hayMas && (
            <div className="d-flex justify-content-center mt-3">
              <SecondaryButton
                title="Cargar más pacientes"
                onClick={cargarMas}
                loading={cargando}
                block
              />
            </div>
          )}
        </div>

        <div>{children}</div>
      </div>
    </>
  );
}
