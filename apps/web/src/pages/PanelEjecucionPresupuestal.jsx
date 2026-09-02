import { useState } from "react";
import { Col, ProgressBar, Row } from "react-bootstrap";
import {
  formatearFechaCorta,
  formatearMoneda,
  useDetalleProyectoPresupuesto,
} from "@ecopac/shared";

import { Card, EmptyState, ErrorState, LoadingState, Modal } from "../components";

// Pestaña "Resumen" de PresupuestosPage.jsx (issue #301). Los datos, el calculo de porcentaje y
// la combinacion proyecto+presupuesto salen de useEjecucionPresupuestal()/
// useDetalleProyectoPresupuesto() (packages/shared/presupuestos/); este archivo solo dibuja.
//
// El detalle por jornada (criterio 3) se abre en un Modal en vez de navegar a una ruta propia:
// mismo patron que el resto de los modales de la app (ModalJornada.jsx), y evita declarar una
// ruta nueva que navegacion.js no tiene.
//
// La barra de progreso usa ProgressBar de react-bootstrap directamente, sin agregarla al
// catalogo de #280: es el mismo patron que ya usa JornadasPage.jsx para el cupo de pacientes
// atendidos, asi que no es una dependencia nueva.

/** Color de la barra segun el porcentaje ejecutado: normal, cerca del limite, o sobregirado. */
function variantePorPorcentaje(porcentaje) {
  if (porcentaje > 100) return "danger";
  if (porcentaje >= 90) return "warning";
  return "primary";
}

function TarjetaKpi({ label, valor, subtitulo }) {
  return (
    <Col sm={6} lg={3}>
      <Card style={{ height: "100%" }}>
        <div className="small text-uppercase fw-bold" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </div>
        <div className="fs-3 fw-bold" style={{ color: "var(--color-text)" }}>
          {formatearMoneda(valor)}
        </div>
        {subtitulo && (
          <div className="small" style={{ color: "var(--color-text-muted)" }}>
            {subtitulo}
          </div>
        )}
      </Card>
    </Col>
  );
}

function BarraDePresupuesto({ porcentaje }) {
  // Criterio 6 de #301: un proyecto/jornada sin presupuesto asignado se pinta en 0%, no se
  // esconde la barra. asignado === 0 ya resuelve calcularPorcentajeEjecutado() a 0 (shared),
  // asi que esta funcion solo necesita el porcentaje ya calculado.
  return (
    <div className="d-flex align-items-center gap-2">
      <ProgressBar
        now={Math.min(100, porcentaje)}
        variant={variantePorPorcentaje(porcentaje)}
        style={{ height: "8px", flex: "1 1 auto" }}
      />
      <span className="small fw-semibold" style={{ minWidth: "3.5rem", textAlign: "right" }}>
        {Math.round(porcentaje)}%
      </span>
    </div>
  );
}

function FilaDeJornada({ jornada }) {
  return (
    <div className="py-2 border-bottom">
      <div className="d-flex justify-content-between align-items-baseline gap-2">
        <span className="fw-semibold">{jornada.nombre}</span>
        <span className="small" style={{ color: "var(--color-text-muted)" }}>
          {formatearFechaCorta(jornada.fecha)}
        </span>
      </div>
      <div className="small mb-1" style={{ color: "var(--color-text-muted)" }}>
        {formatearMoneda(jornada.gastado)} de {formatearMoneda(jornada.asignado)}
      </div>
      <BarraDePresupuesto porcentaje={jornada.porcentaje} />
    </div>
  );
}

function DetalleProyectoModal({ proyecto, onClose }) {
  const { jornadas, cargando, error, recargar } = useDetalleProyectoPresupuesto(proyecto.id);

  return (
    <Modal visible onClose={onClose} title={proyecto.nombre}>
      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}
      {!error && cargando && <LoadingState />}
      {!error && !cargando && jornadas.length === 0 && (
        <EmptyState message="Este proyecto no tiene jornadas todavia." />
      )}
      {!error && !cargando && jornadas.length > 0 && (
        <div>
          {jornadas.map((jornada) => (
            <FilaDeJornada key={jornada.id} jornada={jornada} />
          ))}
        </div>
      )}
    </Modal>
  );
}

function TarjetaProyecto({ proyecto, onAbrir }) {
  return (
    <Card onClick={onAbrir}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <span className="fw-bold">{proyecto.nombre}</span>
        <span className="small" style={{ color: "var(--color-text-muted)" }}>
          {proyecto.responsable || "Sin responsable"}
        </span>
      </div>
      <div className="small mb-2" style={{ color: "var(--color-text-muted)" }}>
        {formatearMoneda(proyecto.gastado)} de {formatearMoneda(proyecto.asignado)}
      </div>
      <BarraDePresupuesto porcentaje={proyecto.porcentaje} />
    </Card>
  );
}

export default function PanelEjecucionPresupuestal({
  kpis,
  proyectos,
  cargando,
  error,
  onReintentar,
}) {
  const [proyectoAbierto, setProyectoAbierto] = useState(null);

  if (error) return <ErrorState message={error.mensaje} onRetry={onReintentar} />;
  if (cargando) return <LoadingState />;

  return (
    <div className="d-flex flex-column gap-4">
      <Row className="g-3">
        <TarjetaKpi label="Presupuesto total" valor={kpis.asignado} />
        <TarjetaKpi
          label="Gastado"
          valor={kpis.gastado}
          subtitulo={`${Math.round(kpis.porcentaje)}% ejecutado`}
        />
        <TarjetaKpi label="Disponible" valor={kpis.disponible} />
        <TarjetaKpi label="En aprobacion" valor={kpis.pendiente} />
      </Row>

      {proyectos.length === 0 ? (
        <EmptyState message="No hay proyectos registrados." />
      ) : (
        <div className="d-flex flex-column gap-3">
          {proyectos.map((proyecto) => (
            <TarjetaProyecto
              key={proyecto.id}
              proyecto={proyecto}
              onAbrir={() => setProyectoAbierto(proyecto)}
            />
          ))}
        </div>
      )}

      {proyectoAbierto && (
        <DetalleProyectoModal proyecto={proyectoAbierto} onClose={() => setProyectoAbierto(null)} />
      )}
    </div>
  );
}
