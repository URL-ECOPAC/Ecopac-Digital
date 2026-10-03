import {
  DIAS_DE_LA_SEMANA_AGENDA,
  etiquetaDeEstadoDeCita,
  horaEnGuatemala,
  VISTAS_AGENDA,
} from "@ecopac/shared";

import "./citas.css";

// El calendario de la agenda de citas (issue #927): el mes y el dia por horario. Los datos -las
// semanas, los horarios, las salas libres- los arma useAgendaCitas en shared; aqui solo se dibujan.

/** Citas por dia que caben en la celda del mes antes de "+N mas". */
const CITAS_VISIBLES_POR_DIA = 3;

function variableDeEstado(estado) {
  return `var(--estado-${String(estado).replace(/ /g, "-")}, var(--color-secondary))`;
}

function CitaEnCalendario({ cita, conArea = false, onAbrir }) {
  const titulo = [
    horaEnGuatemala(cita.iniciaEn),
    cita.paciente,
    cita.area,
    cita.clinica,
    etiquetaDeEstadoDeCita(cita.estado),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      className={`cit-cita${cita.estado === "cancelada" ? " cit-cita--cancelada" : ""}`}
      style={{ "--cit-estado": variableDeEstado(cita.estado) }}
      title={titulo}
      aria-label={titulo}
      onClick={() => onAbrir(cita)}
    >
      <span className="cit-cita-hora">{horaEnGuatemala(cita.iniciaEn)}</span>
      {cita.paciente}
      {conArea && cita.area ? ` · ${cita.area}` : ""}
    </button>
  );
}

export function CalendarioMes({ semanas, onAbrirCita, onAbrirDia }) {
  return (
    <div className="cit-mes" role="grid" aria-label="Citas del mes">
      {DIAS_DE_LA_SEMANA_AGENDA.map((dia) => (
        <div key={dia} className="cit-mes-cabecera" role="columnheader">
          {dia}
        </div>
      ))}
      {semanas.flat().map((dia) => {
        const ocultas = dia.citas.length - CITAS_VISIBLES_POR_DIA;
        return (
          <div
            key={dia.fecha}
            role="gridcell"
            className={`cit-dia${dia.delMes ? "" : " cit-dia--fuera"}${dia.esHoy ? " cit-dia--hoy" : ""}`}
          >
            <button
              type="button"
              className="cit-dia-numero"
              onClick={() => onAbrirDia(dia.fecha)}
              aria-label={`Ver el ${dia.dia}${
                dia.citas.length === 1
                  ? ", 1 cita"
                  : dia.citas.length
                    ? `, ${dia.citas.length} citas`
                    : ""
              }`}
            >
              {dia.dia}
            </button>
            {dia.citas.slice(0, CITAS_VISIBLES_POR_DIA).map((cita) => (
              <CitaEnCalendario key={cita.id} cita={cita} onAbrir={onAbrirCita} />
            ))}
            {ocultas > 0 && (
              <button type="button" className="cit-mas" onClick={() => onAbrirDia(dia.fecha)}>
                +{ocultas} más
              </button>
            )}
            {dia.citas.length > 0 && (
              <span className="cit-mas d-md-none">
                {dia.citas.length === 1 ? "1 cita" : `${dia.citas.length} citas`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AgendaDelDia({ horarios, clinica, puedeAgendar, onAbrirCita, onAgendarEn }) {
  return (
    <div className="cit-horarios" aria-label="Citas del día por horario">
      {horarios.map((horario) => (
        <div key={horario.hora} className="cit-horario">
          <div className="cit-horario-hora">
            {horario.hora}
            {horario.salasLibres !== null && (
              <span
                className={`cit-salas${horario.salasLibres === 0 ? " cit-salas--llena" : ""}`}
                title={clinica ? `Salas libres en ${clinica.nombre}` : undefined}
              >
                {horario.salasLibres === 1 ? "1 sala libre" : `${horario.salasLibres} salas libres`}
              </span>
            )}
          </div>
          <div className="cit-horario-citas">
            {horario.citas.map((cita) => (
              <CitaEnCalendario key={cita.id} cita={cita} conArea onAbrir={onAbrirCita} />
            ))}
            {puedeAgendar && (
              <button
                type="button"
                className="cit-horario-vacio"
                aria-label={`Agendar a las ${horario.hora}`}
                onClick={() => onAgendarEn(horario.hora)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CalendarioCitas({ agenda, onAbrirCita, onAgendarEn }) {
  if (agenda.vista === VISTAS_AGENDA.MES) {
    return (
      <CalendarioMes
        semanas={agenda.semanas}
        onAbrirCita={onAbrirCita}
        onAbrirDia={(fecha) => agenda.irA(fecha)}
      />
    );
  }
  return (
    <AgendaDelDia
      horarios={agenda.horarios}
      clinica={agenda.clinicaFiltrada}
      puedeAgendar={agenda.puedeAgendar}
      onAbrirCita={onAbrirCita}
      onAgendarEn={onAgendarEn}
    />
  );
}
