import { exportarFilasACSV, fechaLocalISO, useDashboardMetricas } from "@ecopac/shared";
import { Form } from "react-bootstrap";
import StatCard from "../components/StatCard";
import { AccionesDeCabecera } from "../components/PageHeader";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Tarjeta de indicador con meta. Es StatCard -la tarjeta de indicador de todo el sistema- con la
// barra de avance hacia la meta como pie. Antes era su propia tarjeta con cinco hexadecimales en
// linea, un radio de 16px y una escala de letra que no se parecia a la de inventario, donaciones
// ni presupuestos.
const TarjetaMetrica = ({ etiqueta, valor, meta, acento }) => {
  const progreso = meta ? Math.min((Number(valor) / Number(meta)) * 100, 100) : 0;
  return (
    <StatCard
      label={etiqueta}
      value={valor}
      accent={acento}
      caption={
        meta ? (
          <span className="reporte-meta">
            <span className="reporte-meta-barra" aria-hidden="true">
              <span style={{ width: `${progreso}%` }} />
            </span>
            meta: {Number(meta).toLocaleString("es-GT")}
          </span>
        ) : undefined
      }
    />
  );
};

export default function DashboardMetricasPage() {
  const { rol } = useSesionCompartida();
  const {
    tieneAcceso,
    cargando,
    error,
    indicadores,
    seriePrincipal = [], // Asegura arreglo
    serieComparacion = [], // Asegura arreglo
    calcularVariacion,
    rangosDisponibles,
    rangoSeleccionado,
    setRangoSeleccionado,
    agrupamientosDisponibles,
    agruparPor,
    setAgruparPor,
    metrica,
    setMetrica,
    comunidadId,
    setComunidadId,
    modoComparacion,
    setModoComparacion,
    comunidadCompararId,
    setComunidadCompararId,
    listaComunidades = [],
    valoresEspeciales: { TODAS, NINGUNA },
  } = useDashboardMetricas({ rol });

  // Función de exportación CSV
  const exportarCSV = () => {
    if (!seriePrincipal || seriePrincipal.length === 0) return;
    const columnas = [
      { id: "etiqueta", label: agruparPor },
      { id: "valor", label: "Valor principal" },
      { id: "comparado", label: "Valor comparado" },
      { id: "variacion", label: "Variacion %" },
    ];
    const filas = seriePrincipal.map((fila, i) => {
      const comp = serieComparacion?.[i];
      const varPc = comp ? calcularVariacion(fila.valor, comp.valor) : null;
      return {
        etiqueta: fila.etiqueta,
        valor: fila.valor,
        comparado: comp?.valor ?? "-",
        variacion: varPc !== null ? `${varPc >= 0 ? "+" : ""}${varPc.toFixed(1)}%` : "-",
      };
    });
    const blob = new Blob([exportarFilasACSV(filas, columnas)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `panel-impacto-${fechaLocalISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Guardas de acceso
  if (!tieneAcceso)
    return (
      <div className="alert alert-danger">
        Solo administracion y los roles consultivos consultan los indicadores de impacto.
      </div>
    );

  if (cargando)
    return <p className="text-center py-5 m-0 ec-cabecera-subtitulo">Cargando métricas...</p>;

  if (error) return <div className="alert alert-danger">Error al cargar: {error.mensaje}</div>;

  // Datos de gráfica
  const tieneComparacion = serieComparacion.length > 0;
  const valorMaximo =
    seriePrincipal.length > 0 ? Math.max(...seriePrincipal.map((i) => i.valor), 1) : 1;

  return (
    <div>
      {/* Descripcion del panel y "Exportar CSV" en una sola fila. El boton vivia solo en una fila
          entera, dentro de un contenedor con 24px de relleno y 100vh de alto minimo, debajo de las
          pestanas: de ahi el hueco tan grande entre las pestanas y los filtros. */}
      <div className="reporte-barra">
        <p className="ec-cabecera-subtitulo m-0">
          Volumen de atención por periodo y comunidad, con comparación opcional.
        </p>
        <AccionesDeCabecera
          actions={[
            {
              label: "Exportar CSV",
              onClick: exportarCSV,
              variant: "secondary",
              disabled: seriePrincipal.length === 0,
            },
          ]}
        />
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="card-body">
          <span className="form-label d-block">Rango de fechas</span>
          <div className="ec-acciones mb-3">
            {rangosDisponibles.map((r) => (
              <button
                key={r.valor}
                type="button"
                onClick={() => setRangoSeleccionado(r.valor)}
                aria-pressed={rangoSeleccionado === r.valor}
                className={`btn btn-sm ${
                  rangoSeleccionado === r.valor ? "btn-primary" : "btn-outline-secondary"
                }`}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>

          <div className="reporte-filtros">
            <Form.Group controlId="impacto-agrupar">
              <Form.Label>Agrupar por</Form.Label>
              <Form.Select value={agruparPor} onChange={(e) => setAgruparPor(e.target.value)}>
                {agrupamientosDisponibles.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.etiqueta}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group controlId="impacto-comunidad">
              <Form.Label>Comunidad</Form.Label>
              <Form.Select value={comunidadId} onChange={(e) => setComunidadId(e.target.value)}>
                <option value={TODAS}>Todas las comunidades</option>
                {listaComunidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group controlId="impacto-comparar">
              <Form.Label>Comparar con</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Check
                  type="checkbox"
                  aria-label="Activar la comparación"
                  checked={modoComparacion}
                  onChange={(e) => setModoComparacion(e.target.checked)}
                />
                <Form.Select
                  aria-label="Comunidad con la que comparar"
                  value={comunidadCompararId}
                  onChange={(e) => setComunidadCompararId(e.target.value)}
                  disabled={!modoComparacion}
                >
                  <option value={NINGUNA}>— Ninguna —</option>
                  {listaComunidades.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </Form.Group>
          </div>
        </div>
      </div>

      {/* Tarjetas de indicador */}
      <div className="ec-kpis">
        <TarjetaMetrica
          etiqueta="Pacientes Atendidos"
          valor={indicadores?.pacientesAtendidos || 0}
          meta="3000"
          acento="var(--color-primary)"
        />
        <TarjetaMetrica
          etiqueta="Consultas Realizadas"
          valor={indicadores?.consultasRealizadas || 0}
          acento="var(--accent-pacientes)"
        />
        <TarjetaMetrica
          etiqueta="Comunidades Beneficiadas"
          valor={indicadores?.comunidadesBeneficiadas || 0}
          meta="50"
          acento="var(--color-info)"
        />
        <TarjetaMetrica
          etiqueta="Tratamientos Entregados"
          valor={indicadores?.tratamientosEntregados || 0}
          meta="1500"
          acento="var(--color-warning)"
        />
        <TarjetaMetrica
          etiqueta="Medicamentos Utilizados"
          valor={indicadores?.medicamentosUtilizados || 0}
          meta="5000"
          acento="var(--color-danger)"
        />
      </div>

      {/* Grafica de evolucion */}
      <div
        className={
          tieneComparacion ? "reporte-graficas reporte-graficas--doble" : "reporte-graficas"
        }
      >
        <div className="card">
          <div className="card-body">
            <h2 className="ec-seccion-titulo">Pacientes atendidos por {agruparPor}</h2>
            <div className="reporte-barras">
              {seriePrincipal.map((item, i) => {
                const alto = valorMaximo > 0 ? Math.max((item.valor / valorMaximo) * 100, 8) : 4;
                return (
                  <div key={i} className="reporte-barras-grupo">
                    <div className="reporte-barras-par">
                      <div
                        className="reporte-barra-valor"
                        style={{ height: `${alto}%`, width: tieneComparacion ? "45%" : "80%" }}
                        title={`Valor: ${item.valor}`}
                      />
                      {serieComparacion?.[i] && (
                        <div
                          className="reporte-barra-valor reporte-barra-valor--comparacion"
                          style={{
                            height: `${Math.max((serieComparacion[i].valor / valorMaximo) * 100, 4)}%`,
                            width: "45%",
                          }}
                          title={`Comparación: ${serieComparacion[i].valor}`}
                        />
                      )}
                    </div>
                    <span className="reporte-barras-etiqueta">{item.etiqueta}</span>
                  </div>
                );
              })}
            </div>

            {tieneComparacion && (
              <div className="reporte-leyenda">
                <span className="reporte-leyenda-item">
                  <span className="reporte-leyenda-muestra" aria-hidden="true" />
                  Selección actual
                </span>
                <span className="reporte-leyenda-item">
                  <span
                    className="reporte-leyenda-muestra reporte-leyenda-muestra--comparacion"
                    aria-hidden="true"
                  />
                  Comparación
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Panel de variacion porcentual */}
        {tieneComparacion && (
          <div className="card">
            <div className="card-body">
              <h2 className="ec-seccion-titulo">Variación porcentual</h2>
              <div className="d-flex flex-column gap-2">
                {seriePrincipal.map((item, i) => {
                  const comp = serieComparacion?.[i];
                  if (!comp) return null;
                  const varPc = calcularVariacion(item.valor, comp.valor);
                  if (varPc === null) return null;
                  return (
                    <div
                      key={i}
                      className={`reporte-variacion ${
                        varPc >= 0 ? "reporte-variacion--sube" : "reporte-variacion--baja"
                      }`}
                    >
                      <span>{item.etiqueta}</span>
                      <strong>
                        {varPc >= 0 ? "↑" : "↓"} {Math.abs(varPc).toFixed(1)}%
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
