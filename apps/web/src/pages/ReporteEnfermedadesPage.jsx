import { useState } from "react";

import { useReporteEnfermedades, VISTAS_DE_ENFERMEDADES } from "@ecopac/shared";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import BotonesDeRango from "../components/BotonesDeRango";
import Card from "../components/Card";
import DataList from "../components/DataList";
import descargarCSV from "../components/descargarCSV";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import GraficaDeBarras from "../components/GraficaDeBarras";
import GraficaDeLineas from "../components/GraficaDeLineas";
import LoadingState from "../components/LoadingState";
import MultiSelector from "../components/MultiSelector";
import Paginacion from "../components/Paginacion";
import Selector from "../components/Selector";
import CabeceraDeReporte, { ContenedorDeReporte } from "./CabeceraDeReporte";
import ReporteImprimible from "./ReporteImprimible";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Reporte de enfermedades (issue #916).
//
// Cuenta diagnosticos del catalogo -nunca el texto libre de los sintomas- y responde preguntas
// como "hay mucho sarampion en esta comunidad" o "esta jornada tuvo mas casos respiratorios que la
// anterior". Todo llega agregado de la base (fn_reporte_enfermedades); esta pantalla solo dibuja
// lo que el hook le entrega, con la grafica arriba y la tabla con los mismos numeros debajo.

/** Titulo de la grafica y nombre del archivo de cada vista. */
const PRESENTACION_DE_VISTA = {
  [VISTAS_DE_ENFERMEDADES.RANKING]: {
    titulo: "Enfermedades más frecuentes",
    archivo: "enfermedades-mas-frecuentes.csv",
    vacio: "No hay diagnósticos registrados para los criterios aplicados.",
  },
  [VISTAS_DE_ENFERMEDADES.JORNADAS]: {
    titulo: "Enfermedades por jornada",
    archivo: "enfermedades-por-jornada.csv",
    vacio: "Ninguna jornada tiene diagnósticos para los criterios aplicados.",
  },
  [VISTAS_DE_ENFERMEDADES.COMUNIDADES]: {
    titulo: "Enfermedades por comunidad",
    archivo: "enfermedades-por-comunidad.csv",
    vacio: "Ninguna comunidad tiene diagnósticos para los criterios aplicados.",
  },
  [VISTAS_DE_ENFERMEDADES.EVOLUCION]: {
    titulo: "Evolución en el tiempo",
    archivo: "evolucion-de-enfermedad.csv",
    vacio: "No hay casos de esta enfermedad para los criterios aplicados.",
  },
};

export default function ReporteEnfermedadesPage({ incrustado = false }) {
  const { rol } = useSesionCompartida();
  const [imprimiendo, setImprimiendo] = useState(false);

  const {
    tieneAcceso,
    cargando,
    error,
    recargar,
    vista,
    setVista,
    opcionesDeVista,
    comunidadDe,
    setComunidadDe,
    opcionesDeComunidadDe,
    rotuloDeComunidad,
    conteo,
    setConteo,
    opcionesDeConteo,
    rotuloDeConteo,
    definicionDeFiltros,
    valores,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    presets,
    presetActivo,
    setPreset,
    catalogos,
    jornadasAComparar,
    setJornadasAComparar,
    comunidadesAComparar,
    setComunidadesAComparar,
    diagnosticoEvolucion,
    setDiagnosticoEvolucion,
    nombreDeEnfermedad,
    columnas,
    filas,
    filasCompletas,
    total,
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,
    grafica,
    gruposFueraDeGrafica,
    umbral,
    cifraProtegida,
  } = useReporteEnfermedades({ rol });

  if (!tieneAcceso) {
    return (
      <ContenedorDeReporte incrustado={incrustado}>
        <CabeceraDeReporte incrustado={incrustado} title="Enfermedades" />
        <ErrorState message="Solo administración y los roles consultivos consultan el reporte de enfermedades." />
      </ContenedorDeReporte>
    );
  }

  const presentacion = PRESENTACION_DE_VISTA[vista];
  const esEvolucion = vista === VISTAS_DE_ENFERMEDADES.EVOLUCION;
  const tituloDeGrafica =
    esEvolucion && nombreDeEnfermedad
      ? `${presentacion.titulo}: ${nombreDeEnfermedad}`
      : presentacion.titulo;

  const rotuloDePeriodo =
    valores.periodo?.min || valores.periodo?.max
      ? `${valores.periodo?.min ?? "inicio"} al ${valores.periodo?.max ?? "hoy"}`
      : "Todo el histórico";

  return (
    <ContenedorDeReporte incrustado={incrustado}>
      <CabeceraDeReporte
        incrustado={incrustado}
        title="Enfermedades"
        subtitle="Casos por diagnóstico del catálogo. Ninguna fila identifica a un paciente."
        actions={[
          {
            key: "csv",
            custom: (
              <BotonExportarCSV
                onClick={() => descargarCSV(columnas, filasCompletas, presentacion.archivo)}
                disabled={filasCompletas.length === 0}
              />
            ),
          },
          {
            key: "imprimir",
            custom: (
              <BotonImprimir
                onClick={() => setImprimiendo(true)}
                disabled={filasCompletas.length === 0}
              />
            ),
          },
        ]}
      />

      <section className="reporte-seccion">
        <BotonesDeRango
          etiqueta="Vista del reporte"
          opciones={opcionesDeVista}
          activo={vista}
          onElegir={setVista}
        />
      </section>

      <FilterBar
        campos={definicionDeFiltros}
        valores={valores}
        onChange={setFiltro}
        catalogos={catalogos}
        encabezado={
          <>
            <span className="ec-rotulo">Rango de fechas</span>
            <BotonesDeRango opciones={presets} activo={presetActivo} onElegir={setPreset} />
          </>
        }
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      >
        <div className="ec-filtro">
          <Selector
            label="Contar"
            value={conteo}
            options={opcionesDeConteo}
            onSelect={(valor) => valor && setConteo(valor)}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtro">
          <Selector
            label="Comunidad que cuenta"
            value={comunidadDe}
            options={opcionesDeComunidadDe}
            onSelect={(valor) => valor && setComunidadDe(valor)}
            style={{ marginBottom: 0 }}
          />
        </div>
      </FilterBar>

      {vista === VISTAS_DE_ENFERMEDADES.JORNADAS && (
        <Card className="reporte-seccion">
          <MultiSelector
            label="Jornadas a comparar"
            value={jornadasAComparar}
            options={catalogos.jornadas}
            onChange={setJornadasAComparar}
            placeholder="Agregar jornada..."
            style={{ marginBottom: 0 }}
          />
          <p className="ec-campo-nota reporte-nota">
            Sin elegir ninguna se comparan todas las jornadas del período y los filtros.
          </p>
        </Card>
      )}

      {vista === VISTAS_DE_ENFERMEDADES.COMUNIDADES && (
        <Card className="reporte-seccion">
          <MultiSelector
            label="Comunidades a comparar"
            value={comunidadesAComparar}
            options={catalogos.comunidades}
            onChange={setComunidadesAComparar}
            placeholder="Agregar comunidad..."
            style={{ marginBottom: 0 }}
          />
          <p className="ec-campo-nota reporte-nota">
            Sin elegir ninguna se comparan todas las comunidades con casos.
          </p>
        </Card>
      )}

      {esEvolucion && (
        <Card className="reporte-seccion">
          <Selector
            label="Enfermedad"
            value={diagnosticoEvolucion}
            options={catalogos.diagnosticos}
            onSelect={setDiagnosticoEvolucion}
            placeholder="La más frecuente del período"
            style={{ marginBottom: 0 }}
          />
        </Card>
      )}

      {/* Lo que el reporte esta contando, siempre a la vista: quien lee una cifra necesita saber si
          incluye diagnosticos secundarios y de que comunidad habla. */}
      <p className="ec-rotulo reporte-criterios">
        {rotuloDeConteo} · {rotuloDeComunidad}
      </p>
      <p className="ec-campo-nota reporte-nota">
        Para proteger la identidad de los pacientes, las cifras de 1 a {umbral - 1} casos se
        muestran como «{cifraProtegida}».
      </p>

      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}
      {!error && cargando && <LoadingState message="Calculando el reporte..." />}

      {!error && !cargando && (
        <>
          <Card className="reporte-seccion">
            {grafica.tipo === "lineas" ? (
              <GraficaDeLineas
                titulo={tituloDeGrafica}
                etiquetas={grafica.etiquetas}
                series={grafica.series}
                encabezadoDeEtiquetas="Mes"
                etiquetaDeNulo={cifraProtegida}
              />
            ) : (
              <GraficaDeBarras
                titulo={tituloDeGrafica}
                etiquetas={grafica.etiquetas}
                series={grafica.series}
                encabezadoDeEtiquetas="Enfermedad"
                etiquetaDeNulo={cifraProtegida}
              />
            )}
            {gruposFueraDeGrafica > 0 && (
              <p className="ec-campo-nota reporte-nota">
                La gráfica muestra los primeros {grafica.series.length}; los otros{" "}
                {gruposFueraDeGrafica} están en la tabla.
              </p>
            )}
          </Card>

          <section className="reporte-seccion">
            <p className="ec-rotulo reporte-conteo">
              {total} {total === 1 ? "renglón" : "renglones"}
            </p>

            <DataList
              columnas={columnas}
              datos={filas}
              ordenarPor={orden}
              onOrdenar={alternarOrden}
              vacio={
                <EmptyState
                  message={presentacion.vacio}
                  actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
                  onAction={hayFiltros ? limpiarFiltros : undefined}
                />
              }
            />

            <Paginacion pagina={numeroDePagina} totalPaginas={totalPaginas} onCambiar={irAPagina} />
          </section>
        </>
      )}

      {imprimiendo && (
        <ReporteImprimible
          titulo={`Enfermedades: ${tituloDeGrafica.toLowerCase()}`}
          periodo={rotuloDePeriodo}
          filtrosAplicados={criteriosParaPapel({
            valores,
            catalogos,
            rotuloDeConteo,
            rotuloDeComunidad,
            cifraProtegida,
          })}
          secciones={[{ columnas, filas: filasCompletas }]}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </ContenedorDeReporte>
  );
}

/** Los criterios del reporte, en texto, para que el papel diga que se conto y como. */
function criteriosParaPapel({
  valores,
  catalogos,
  rotuloDeConteo,
  rotuloDeComunidad,
  cifraProtegida,
}) {
  const etiqueta = (lista, valor) =>
    lista?.find((opcion) => opcion.value === valor)?.label ?? valor;

  return [
    { etiqueta: "Cuenta", valor: rotuloDeConteo },
    { etiqueta: "Comunidad", valor: rotuloDeComunidad },
    valores.departamento && {
      etiqueta: "Departamento",
      valor: etiqueta(catalogos.departamentos, valores.departamento),
    },
    valores.municipio && {
      etiqueta: "Municipio",
      valor: etiqueta(catalogos.municipios, valores.municipio),
    },
    valores.comunidad && {
      etiqueta: "Comunidad elegida",
      valor: etiqueta(catalogos.comunidades, valores.comunidad),
    },
    valores.proyecto && {
      etiqueta: "Proyecto",
      valor: etiqueta(catalogos.proyectos, valores.proyecto),
    },
    valores.jornada && {
      etiqueta: "Jornada",
      valor: etiqueta(catalogos.jornadas, valores.jornada),
    },
    { etiqueta: "Cifras protegidas", valor: `${cifraProtegida} casos` },
  ].filter(Boolean);
}
