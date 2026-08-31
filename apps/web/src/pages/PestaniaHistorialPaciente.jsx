import { useState } from "react";

import {
  ETIQUETAS_TIPO_DE_EVENTO,
  FILTROS_HISTORIAL,
  formatearFechaConHora,
  formatearFechaCorta,
  OPCIONES_TIPO_DE_EVENTO,
  TIPOS_DE_EVENTO,
  useHistorialPaciente,
} from "@ecopac/shared";

import Card from "../components/Card";
import DateField from "../components/DateField";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import StatusChip from "../components/StatusChip";

function Signos({ signos }) {
  const renglones = [
    signos.presionSistolica && signos.presionDiastolica
      ? ["Presion", `${signos.presionSistolica}/${signos.presionDiastolica} mmHg`]
      : null,
    signos.frecuenciaCardiaca ? ["Frecuencia cardiaca", `${signos.frecuenciaCardiaca} lpm`] : null,
    signos.glucosa ? ["Glucosa", `${signos.glucosa} mg/dL`] : null,
    signos.peso ? ["Peso", `${signos.peso} kg`] : null,
    signos.talla ? ["Talla", `${signos.talla} cm`] : null,
    signos.temperatura ? ["Temperatura", `${signos.temperatura} °C`] : null,
    signos.imc ? ["IMC", signos.imc] : null,
  ].filter(Boolean);

  if (renglones.length === 0) return <p className="text-body-secondary mb-0">Sin mediciones.</p>;

  return (
    <dl className="row mb-0">
      {renglones.map(([etiqueta, valor]) => (
        <div className="col-sm-4 mb-2" key={etiqueta}>
          <dt className="text-body-secondary fw-normal small">{etiqueta}</dt>
          <dd className="mb-0">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetalleConsulta({ evento }) {
  const campos = [
    ["Motivo de consulta", evento.motivoConsulta],
    ["Tratamiento", evento.tratamiento],
    ["Plan de seguimiento", evento.planSeguimiento],
  ].filter(([, valor]) => valor);

  return (
    <div className="mt-2">
      {evento.diagnosticos?.length > 0 && (
        <p className="mb-2">
          <span className="text-body-secondary">Diagnosticos: </span>
          {evento.diagnosticos
            .map((diagnostico) =>
              [diagnostico.codigo, diagnostico.nombre].filter(Boolean).join(" "),
            )
            .join(", ")}
        </p>
      )}
      {campos.map(([etiqueta, valor]) => (
        <p className="mb-2" key={etiqueta}>
          <span className="text-body-secondary">{etiqueta}: </span>
          {valor}
        </p>
      ))}
      {campos.length === 0 && evento.diagnosticos?.length === 0 && (
        <p className="text-body-secondary mb-0">La consulta no registro detalle.</p>
      )}
    </div>
  );
}

function DetalleReceta({ evento }) {
  if (!evento.medicamentos?.length) {
    return <p className="text-body-secondary mb-0 mt-2">La receta no tiene medicamentos.</p>;
  }

  return (
    <ul className="mb-0 mt-2">
      {evento.medicamentos.map((renglon, indice) => (
        <li key={`${evento.id}-${indice}`}>
          {[renglon.medicamento, renglon.concentracion, renglon.presentacion]
            .filter(Boolean)
            .join(" ")}
          {renglon.dosis ? ` — ${renglon.dosis}` : ""}
          {renglon.frecuencia ? `, ${renglon.frecuencia}` : ""}
          {renglon.duracion ? `, ${renglon.duracion}` : ""}
          {renglon.cantidadEntregada ? ` (${renglon.cantidadEntregada})` : ""}
        </li>
      ))}
    </ul>
  );
}

function Evento({ evento, expandido, onAlternar }) {
  const expandible =
    evento.tipo === TIPOS_DE_EVENTO.CONSULTA || evento.tipo === TIPOS_DE_EVENTO.RECETA;

  return (
    <li className="border-top py-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <strong>{ETIQUETAS_TIPO_DE_EVENTO[evento.tipo] ?? evento.tipo}</strong>
        <span className="text-body-secondary small">{formatearFechaConHora(evento.fecha)}</span>
        {evento.profesional && <span className="small">· {evento.profesional}</span>}
        {evento.tipo === TIPOS_DE_EVENTO.RECETA && evento.folio && (
          <span className="small text-body-secondary">· folio {evento.folio}</span>
        )}
        {evento.anulada && <StatusChip status="anulada" label="Anulada" />}
        {expandible && (
          <button
            type="button"
            className="btn btn-link btn-sm ms-auto p-0"
            onClick={onAlternar}
            aria-expanded={expandido}
          >
            {expandido ? "Ocultar detalle" : "Ver detalle"}
          </button>
        )}
      </div>

      {evento.tipo === TIPOS_DE_EVENTO.CONSULTA && evento.diagnosticoPrincipal && (
        <p className="mb-0 mt-1">{evento.diagnosticoPrincipal.nombre}</p>
      )}

      {evento.tipo === TIPOS_DE_EVENTO.TRIAJE && (
        <div className="mt-2">
          <Signos signos={evento.signos ?? {}} />
        </div>
      )}

      {expandido && evento.tipo === TIPOS_DE_EVENTO.CONSULTA && <DetalleConsulta evento={evento} />}
      {expandido && evento.tipo === TIPOS_DE_EVENTO.RECETA && <DetalleReceta evento={evento} />}
    </li>
  );
}

export default function PestaniaHistorialPaciente({ pacienteId, rol }) {
  const {
    grupos,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
  } = useHistorialPaciente(pacienteId, { rol });
  const [expandidos, setExpandidos] = useState(() => new Set());

  const alternar = (id) =>
    setExpandidos((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const [desde, hasta, tipo] = FILTROS_HISTORIAL;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <DateField
          label={desde.label}
          value={filtros.desde || null}
          onChange={(valor) => setFiltro("desde", valor)}
          maxDate={filtros.hasta || undefined}
        />
        <DateField
          label={hasta.label}
          value={filtros.hasta || null}
          onChange={(valor) => setFiltro("hasta", valor)}
          minDate={filtros.desde || undefined}
        />
        <Selector
          label={tipo.label}
          value={filtros.tipo || null}
          options={OPCIONES_TIPO_DE_EVENTO}
          onSelect={(valor) => setFiltro("tipo", valor)}
          placeholder="Todos"
        />
        {hayFiltros && <SecondaryButton title="Limpiar" onClick={limpiarFiltros} />}
      </div>

      {cargando && <LoadingState />}
      {!cargando && error && <ErrorState message={error.mensaje} onRetry={recargar} />}

      {!cargando && !error && total === 0 && (
        <EmptyState
          message={
            hayFiltros
              ? "Ningun evento del historial coincide con los filtros."
              : "Este paciente todavia no tiene atenciones registradas."
          }
          actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
          onAction={hayFiltros ? limpiarFiltros : undefined}
        />
      )}

      {!cargando &&
        !error &&
        grupos.map((grupo) => (
          <Card key={grupo.clave} style={{ marginBottom: "1rem" }}>
            <div className="mb-1">
              <strong>{grupo.jornada ?? "Atencion sin jornada"}</strong>
              {grupo.comunidad && <span className="text-body-secondary"> · {grupo.comunidad}</span>}
            </div>
            <div className="text-body-secondary small">{formatearFechaCorta(grupo.fecha)}</div>

            <ul className="list-unstyled mb-0 mt-2">
              {grupo.eventos.map((evento) => (
                <Evento
                  key={`${evento.tipo}-${evento.id}`}
                  evento={evento}
                  expandido={expandidos.has(`${evento.tipo}-${evento.id}`)}
                  onAlternar={() => alternar(`${evento.tipo}-${evento.id}`)}
                />
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
