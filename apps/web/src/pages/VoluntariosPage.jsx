import { useNavigate } from 'react-router-dom';
import {
  COLUMNAS_USUARIO,
  FILTROS_USUARIO,
  useUsuariosListado,
} from '@ecopac/shared';

import DataList from '../components/DataList';
import ErrorState from '../components/ErrorState';
import FilterBar from '../components/FilterBar';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import SecondaryButton from '../components/SecondaryButton';

// Pantalla de personal (issue #105). Solo presentacion: los datos, los filtros, la paginacion
// y los catalogos salen de useUsuariosListado(), en packages/shared/usuarios/. Aqui no se
// valida, no se formatea y no se decide ningun permiso, que es el criterio 7 de la issue.
//
// Quien puede entrar lo decide el guard de rutas (#52) desde App.jsx, no este componente.
//
// La version movil de esta misma pantalla es la #272 y consume este mismo hook con los mismos
// descriptores; lo unico que cambia es que DataList se dibuja como tarjetas.
export default function VoluntariosPage() {
  const navigate = useNavigate();
  const {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar,
    pagina,
    paginas,
    total,
    hayPaginaAnterior,
    hayPaginaSiguiente,
    irAPaginaAnterior,
    irAPaginaSiguiente,
    catalogos,
  } = useUsuariosListado();

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Voluntarios y medicos" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Voluntarios y medicos"
        subtitle={total === 1 ? '1 persona' : `${total} personas`}
      />

      <FilterBar
        campos={FILTROS_USUARIO}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_USUARIO}
        datos={filas}
        cargando={cargando}
        catalogos={catalogos}
        vacio="No hay personal que coincida con los filtros."
        onRowPress={(fila) => navigate(`/voluntarios/${fila.id}`)}
      />

      {/* La paginacion solo estorba cuando hay una sola pagina. */}
      {paginas > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <SecondaryButton
            title="Anterior"
            onClick={irAPaginaAnterior}
            disabled={!hayPaginaAnterior}
          />
          <span style={{ color: 'var(--color-textMuted)' }}>
            Pagina {pagina} de {paginas}
          </span>
          <SecondaryButton
            title="Siguiente"
            onClick={irAPaginaSiguiente}
            disabled={!hayPaginaSiguiente}
          />
        </div>
      )}

      {total === 0 && !cargando && (
        <div className="mt-3">
          <SecondaryButton title="Limpiar filtros" onClick={limpiarFiltros} />
        </div>
      )}
    </ScreenContainer>
  );
}
