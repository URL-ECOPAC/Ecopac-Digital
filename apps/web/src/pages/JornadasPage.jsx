import { useEffect, useState } from "react";
import { ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";

import {
  COLUMNAS_JORNADA,
  ESTADOS_JORNADA,
  FILTROS_JORNADA,
  formatearFechaCorta,
  puedeEditarJornada,
  transicionesDeJornadaDesde,
  useJornadasKanban,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  FilterBar,
  KanbanBoard,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalJornada from "./ModalJornada";

export default function JornadasPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const {
    columnas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar,
    total,
    catalogos,
    puedeCrear,
    puedeEditar,
    puedeReabrir,
    moverJornada,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
    pedirCierreEnDetalle,
    descartarPedidoCierre,
  } = useJornadasKanban(rol);

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [jornadaEnEdicion, setJornadaEnEdicion] = useState(null);

  const filtrosDelTablero = (FILTROS_JORNADA || []).filter(
    (campo) => campo.id !== "busqueda" && campo.id !== "estado",
  );

  useEffect(() => {
    if (!pedirCierreEnDetalle) return;
    navigate(`/jornadas/${pedirCierreEnDetalle}`);
    descartarPedidoCierre();
  }, [pedirCierreEnDetalle, descartarPedidoCierre, navigate]);

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Jornadas" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  const handleLimpiarFiltros = () => {
    if (typeof limpiarFiltros === "function") {
      limpiarFiltros();
    } else if (filtros) {
      Object.keys(filtros).forEach((key) => {
        if (typeof setFiltro === "function") {
          setFiltro(key, "");
        }
      });
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Jornadas"
        subtitle={total === 1 ? "1 jornada" : `${total} jornadas`}
        actions={
          puedeCrear ? [{ label: "+ Nueva jornada", onClick: () => setMostrarAlta(true) }] : []
        }
      />

      <Card className="mb-4">
        <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap flex-md-nowrap">
          <div className="flex-grow-1">
            <FilterBar
              campos={filtrosDelTablero}
              valores={filtros || {}}
              onChange={setFiltro}
              catalogos={catalogos || {}}
            />
          </div>
          <div className="pb-1">
            <SecondaryButton title="Limpiar filtros" onClick={handleLimpiarFiltros} />
          </div>
        </div>
      </Card>

      {errorMovimiento && (
        <div
          className="alert alert-danger d-flex justify-content-between align-items-start gap-2"
          role="alert"
        >
          <span>{errorMovimiento.mensaje}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={descartarErrorMovimiento}
          />
        </div>
      )}

      {cargando ? (
        <LoadingState />
      ) : (
        <KanbanBoard
          columnas={columnas}
          onMover={moverJornada}
          mensajeVacio="Sin jornadas"
          columnaAtenuada={(id) => id === ESTADOS_JORNADA.CANCELADA}
          renderTarjeta={(tarjeta) => (
            <TarjetaJornada
              jornada={tarjeta}
              puedeEditar={puedeEditar}
              puedeReabrir={puedeReabrir}
              moviendo={moviendo}
              onEditar={
                puedeEditarJornada(rol, tarjeta.estado) ? () => setJornadaEnEdicion(tarjeta) : null
              }
              onMover={moverJornada}
              onVerDetalle={() => navigate(`/jornadas/${tarjeta.id}`)}
            />
          )}
        />
      )}

      {mostrarAlta && (
        <ModalJornada
          rol={rol}
          onClose={() => setMostrarAlta(false)}
          onGuardado={() => {
            setMostrarAlta(false);
            recargar();
          }}
        />
      )}

      {jornadaEnEdicion && (
        <ModalJornada
          key={jornadaEnEdicion.id}
          jornada={jornadaEnEdicion}
          rol={rol}
          onClose={() => setJornadaEnEdicion(null)}
          onGuardado={() => {
            setJornadaEnEdicion(null);
            recargar();
          }}
        />
      )}
    </ScreenContainer>
  );
}

const ETIQUETAS = Object.fromEntries(
  COLUMNAS_JORNADA.map((columna) => [columna.id, columna.label]),
);

function colorDeEstado(estado) {
  return `var(--estado-${String(estado).replace(/ /g, "-")}, var(--color-secondary))`;
}

function TarjetaJornada({
  jornada,
  puedeEditar,
  puedeReabrir,
  moviendo,
  onEditar,
  onMover,
  onVerDetalle,
}) {
  const tienePacientes = Object.prototype.hasOwnProperty.call(jornada, "pacientesAtendidos");
  const tieneCupo = typeof jornada.cupoEstimado === "number" && jornada.cupoEstimado > 0;
  const tieneProgreso = tienePacientes && tieneCupo;
  const porcentajeAtendido = tieneProgreso
    ? Math.min(100, Math.round((jornada.pacientesAtendidos / jornada.cupoEstimado) * 100))
    : 0;

  const esReapertura = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [destino] = transicionesDeJornadaDesde(jornada.estado);
  const puedeMover = (esReapertura ? puedeReabrir : puedeEditar) && Boolean(destino);

  return (
    <Card className="ec-jornada" style={{ "--ec-acento": colorDeEstado(jornada.estado) }}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <span className="ec-jornada-nombre">{jornada.nombre}</span>
        <StatusChip status={String(jornada.estado || "").toUpperCase()} />
      </div>

      <p className="ec-jornada-detalle">
        <MapPin size={14} aria-hidden="true" />
        <span>{jornada.comunidad || "Sin comunidad"}</span>
        <span aria-hidden="true">·</span>
        <CalendarDays size={14} aria-hidden="true" />
        <span>{formatearFechaCorta(jornada.fecha)}</span>
      </p>

      <p className="ec-jornada-detalle">
        <span className="ec-rotulo">{ETIQUETAS.responsable}</span>
        <span>{jornada.responsable || "Sin asignar"}</span>
      </p>

      <div className="mb-2">
        {tieneProgreso ? (
          <div className="d-flex align-items-center gap-2">
            <ProgressBar
              now={porcentajeAtendido}
              variant="primary"
              style={{ height: "6px", flex: "1 1 auto" }}
            />
            <span className="ec-jornada-detalle mb-0">
              {jornada.pacientesAtendidos}/{jornada.cupoEstimado}
            </span>
          </div>
        ) : (
          <p className="ec-jornada-detalle mb-0">
            <span className="ec-rotulo">{ETIQUETAS.pacientesAtendidos}</span>
            <span>{tienePacientes ? jornada.pacientesAtendidos : "—"}</span>
          </p>
        )}
      </div>

      <div className="ec-jornada-acciones">
        <div className="d-flex gap-2">
          <SecondaryButton
            title="Ver detalle"
            variant="neutra"
            size="sm"
            onClick={onVerDetalle}
            disabled={moviendo}
          />
          {puedeMover && esReapertura && (
            <SecondaryButton
              title="Atrás"
              variant="neutra"
              size="sm"
              icon={<ArrowLeft size={16} aria-hidden="true" />}
              onClick={() => onMover(jornada.id, jornada.estado, destino)}
              disabled={moviendo}
            />
          )}
        </div>
        <div className="d-flex gap-2">
          {onEditar && (
            <SecondaryButton title="Editar" size="sm" onClick={onEditar} disabled={moviendo} />
          )}
          {puedeMover && !esReapertura && (
            <PrimaryButton
              title={destino === ESTADOS_JORNADA.EN_CURSO ? "Iniciar" : "Avanzar"}
              size="sm"
              icon={<ArrowRight size={16} aria-hidden="true" />}
              onClick={() => onMover(jornada.id, jornada.estado, destino)}
              disabled={moviendo}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
