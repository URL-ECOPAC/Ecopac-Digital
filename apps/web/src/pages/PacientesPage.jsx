import { useNavigate } from 'react-router-dom';

import { COLUMNAS_PACIENTE, FILTROS_PACIENTE, usePacientesListado } from '@ecopac/shared';

import DataList from '../components/DataList';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import FilterBar from '../components/FilterBar';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import SecondaryButton from '../components/SecondaryButton';

// Pantalla principal del modulo de pacientes (issue #124). Solo presentacion: los datos, los
// filtros, la paginacion, el calculo de la edad y los catalogos salen de usePacientesListado(),
// en packages/shared/pacientes/. Aqui no se valida, no se formatea y no se decide ningun
// permiso, que es lo que fija el contrato de reutilizacion de la issue.
//
// Quien puede entrar lo decide el guard de rutas (#52) desde App.jsx.
//
// El panel de filtros sigue el wireframe de gestion de pacientes (Entregable Semana 6, p. 62):
// busqueda, Lugar, Genero y Rango de edad. La condicion cronica es un quinto filtro que el
// wireframe no dibuja pero que pide el criterio 3.
//
// La fila ya navega a la ficha del paciente, que existe desde la #125. La accion de cabecera
// sigue sin ponerse: el formulario de registro es la #126 y su ruta todavia no esta en App.jsx,
// asi que enlazarla daria el mismo 404 que la #107 tuvo que limpiar.
//
// La version movil de esta misma pantalla es la #133 y consume el mismo hook con los mismos
// descriptores; lo unico que cambia es que DataList se dibuja como tarjetas.
export default function PacientesPage() {
  const navigate = useNavigate();
  const {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    total,
    hayMas,
    cargarMas,
    catalogos,
  } = usePacientesListado();

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Gestion de pacientes" />
        <ErrorState message={error.mensaje} />
      </ScreenContainer>
    );
  }

  const hayFiltrosActivos = Object.values(filtros).some(
    (valor) => valor !== null && valor !== undefined && valor !== '',
  );

  return (
    <ScreenContainer>
      <PageHeader
        title="Gestion de pacientes"
        subtitle={total === 1 ? '1 paciente' : `${total} pacientes`}
      />

      <FilterBar
        campos={FILTROS_PACIENTE}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_PACIENTE}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        onRowPress={(fila) => navigate(`/pacientes/${fila.id}`)}
        // El estado vacio sugiere registrar, que es lo que pide el criterio 4. Si hay filtros
        // puestos, lo que falta no es un paciente nuevo sino aflojar la busqueda.
        vacio={
          hayFiltrosActivos ? (
            <EmptyState
              message="Ningun paciente coincide con los filtros."
              actionLabel="Limpiar filtros"
              onAction={limpiarFiltros}
            />
          ) : (
            <EmptyState message="Todavia no hay pacientes registrados. Registra el primero para empezar." />
          )
        }
      />

      {/* "Cargar mas" en vez de paginas numeradas: la lista se recorre de arriba abajo y este
          patron funciona igual en la pantalla movil (#133), que consume el mismo hook. */}
      {hayMas && (
        <div className="d-flex justify-content-center mt-3">
          <SecondaryButton
            title={cargando ? 'Cargando...' : 'Cargar mas pacientes'}
            onClick={cargarMas}
            disabled={cargando}
          />
        </div>
      )}
    </ScreenContainer>
  );
}
