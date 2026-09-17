import { useLocation, useNavigate } from "react-router-dom";
import { Form, Table } from "react-bootstrap";
import {
  ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO,
  useExportarPDF,
  useReporteMedicamentosPorVencer,
} from "@ecopac/shared";
import DashboardMetricasPage from "./DashboardMetricasPage";
import ReporteInventarioPage from "./ReporteInventarioPage";
import ReportePacientesPage from "./ReportePacientesPage";
import BotonExportarPDF from "../components/BotonExportarPDF";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader, { AccionesDeCabecera } from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import Tabs from "../components/Tabs";
import "./reportes.css";

// Hub de reportes.
//
// CADA PESTANA ES UNA RUTA. "Pacientes atendidos" era un boton con aspecto de pestana que
// navegaba a otra pagina -ReportePacientesPage, con su propia cabecera y SIN las pestanas-, asi
// que desde ahi no habia forma de volver a las otras dos salvo el boton "atras" del navegador.
// Ahora las cuatro pestanas viven aqui y cada una tiene su direccion: el boton "atras" sigue
// funcionando, una pestana se puede enlazar, y la fila de pestanas no desaparece nunca.
//
// "Inventario actual" (/reportes/inventario-actual) era una ruta sin ningun enlace que llevara a
// ella: el reporte existia y nadie podia abrirlo sin escribir la direccion a mano.
const PESTANAS = [
  { id: "dashboard", label: "Dashboard de impacto", ruta: "/reportes" },
  {
    id: "vencimientos",
    label: "Medicamentos por vencer",
    ruta: "/reportes/medicamentos-por-vencer",
  },
  { id: "pacientes", label: "Pacientes atendidos", ruta: "/reportes/pacientes-atendidos" },
  { id: "inventario", label: "Inventario actual", ruta: "/reportes/inventario-actual" },
];

/** La pestana que corresponde a una ruta. `/reportes` y `/reportes/dashboard` son el panel. */
function pestanaDeRuta(pathname = "") {
  const encontrada = PESTANAS.find(
    (pestana) => pestana.id !== "dashboard" && pathname.startsWith(pestana.ruta),
  );
  return encontrada?.id ?? "dashboard";
}

export default function ReportesPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pestanaActiva = pestanaDeRuta(pathname);

  const cambiarPestana = (id) => {
    const destino = PESTANAS.find((pestana) => pestana.id === id);
    if (destino && destino.id !== pestanaActiva) navigate(destino.ruta);
  };

  return (
    <ScreenContainer>
      <PageHeader
        title="Reportes e impacto"
        subtitle="Métricas, estadísticas y volumen de atención"
      />

      <Tabs tabs={PESTANAS} activo={pestanaActiva} onChange={cambiarPestana}>
        {pestanaActiva === "dashboard" && <DashboardMetricasPage />}
        {pestanaActiva === "vencimientos" && <PestanaMedicamentosPorVencer />}
        {pestanaActiva === "pacientes" && <ReportePacientesPage incrustado />}
        {pestanaActiva === "inventario" && <ReporteInventarioPage incrustado />}
      </Tabs>
    </ScreenContainer>
  );
}

function PestanaMedicamentosPorVencer() {
  const {
    cargando,
    error,
    filas,
    totalUnidadesEnRiesgo,
    horizonteDias,
    setHorizonteDias,
    comunidadId,
    setComunidadId,
    bodegaId,
    setBodegaId,
    horizontesDisponibles,
    listaComunidades,
    listaBodegas,
    valoresEspeciales,
    recargar,
  } = useReporteMedicamentosPorVencer();

  // Exportacion PDF (issue #216).
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Medicamentos Próximos a Vencer",
    periodo: `Próximos ${horizonteDias} días`,
  });

  return (
    <>
      <div className="reporte-barra">
        <p className="ec-cabecera-subtitulo m-0">
          Lotes que vencen dentro del horizonte elegido, del más urgente al menos urgente.
        </p>
        <AccionesDeCabecera
          actions={[{ custom: <BotonExportarPDF onClick={exportar} generando={generando} /> }]}
        />
      </div>

      {/* Filtros: fuera del contenido del PDF. Eran tres <select> y un boton con estilos en
          linea (#cbd5e1, #475569, #f1f5f9); ahora son los campos del sistema. */}
      <Card className="mb-3">
        <div className="reporte-filtros">
          <Form.Group controlId="vencimientos-horizonte">
            <Form.Label>Horizonte de días</Form.Label>
            <Form.Select
              value={horizonteDias}
              onChange={(e) => setHorizonteDias(Number(e.target.value))}
            >
              {horizontesDisponibles.map((opt) => (
                <option key={opt.valor} value={opt.valor}>
                  {opt.etiqueta}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="vencimientos-comunidad">
            <Form.Label>Comunidad</Form.Label>
            <Form.Select value={comunidadId} onChange={(e) => setComunidadId(e.target.value)}>
              <option value={valoresEspeciales.TODAS}>Todas las comunidades</option>
              {listaComunidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="vencimientos-bodega">
            <Form.Label>Bodega</Form.Label>
            <Form.Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}>
              <option value={valoresEspeciales.TODAS}>Todas las bodegas</option>
              {listaBodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="reporte-filtros-accion">
            <AccionesDeCabecera
              actions={[{ label: "Actualizar", onClick: recargar, variant: "neutra" }]}
            />
          </div>
        </div>
      </Card>

      <div id="contenido-reporte-pdf">
        <div className="alert alert-warning mb-3">
          <span>
            <strong>{totalUnidadesEnRiesgo.toLocaleString("es-GT")}</strong> unidades en riesgo de
            vencimiento
          </span>
        </div>

        {cargando ? (
          <LoadingState message="Cargando lotes próximos a vencer..." />
        ) : error ? (
          <ErrorState
            message={`Error al cargar: ${error.mensaje || "Desconocido"}`}
            onRetry={recargar}
          />
        ) : filas.length === 0 ? (
          <EmptyState message={`Ningún lote vence en los próximos ${horizonteDias} días`} />
        ) : (
          <div className="ec-tabla">
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th className="text-end">Días restantes</th>
                  <th className="text-end">Cantidad</th>
                  <th>Bodega</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id}>
                    <td>
                      {/* El nivel sale de enums.js y el color de statusColors, via StatusChip
                          (issue #700). */}
                      <StatusChip
                        status={fila.alerta}
                        label={ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO[fila.alerta]}
                      />
                    </td>
                    <td>{fila.medicamento}</td>
                    <td className="ec-mono">{fila.lote}</td>
                    <td>{fila.fechaVencimiento}</td>
                    <td className="text-end">
                      <strong>{fila.diasRestantes}</strong>
                    </td>
                    <td className="text-end fw-semibold">
                      {fila.cantidad.toLocaleString("es-GT")}
                    </td>
                    <td>{fila.bodega || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
