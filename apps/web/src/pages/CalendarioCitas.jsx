import {
  DIAS_DE_LA_SEMANA_AGENDA,
  etiquetaDeEstadoDeCita,
  horaEnGuatemala,
  textoDeCantidadDeCitas,
  VISTAS_AGENDA,
} from "@ecopac/shared";

import "./citas.css";

// El calendario de la agenda de citas (issue #927): el anio, el mes y el dia por horario. Los datos
// -los meses, las semanas, los horarios, las salas libres- los arma useAgendaCitas en shared; aqui
// solo se dibujan. El anio sirve para moverse: el dia con citas va marcado con su numero, y al
// tocarlo se abre el dia; al tocar el nombre de un mes, el mes.

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

export function CalendarioAnio({ meses, onAbrirMes, onAbrirDia }) {
  return (
    <div className="cit-anio" aria-label="Citas del año">
      {meses.map((mes) => (
        <section key={mes.fecha} className="cit-mini-mes">
          <button
            type="button"
            className="cit-mini-mes-titulo"
            onClick={() => onAbrirMes(mes.fecha)}
            aria-label={`Ver ${mes.nombre}${mes.activas ? `, ${textoDeCantidadDeCitas(mes.activas)}` : ""}`}
          >
            <span>{mes.nombre}</span>
            {mes.activas > 0 && <span className="cit-cantidad">{mes.activas}</span>}
          </button>
          <div className="cit-mini-mes-dias">
            {DIAS_DE_LA_SEMANA_AGENDA.map((dia) => (
              <span key={dia} className="cit-mini-cabecera" aria-hidden="true">
                {dia.charAt(0)}
              </span>
            ))}
            {mes.semanas.flat().map((dia) =>
              dia.delMes ? (
                <button
                  key={dia.fecha}
                  type="button"
                  className={`cit-mini-dia${dia.activas ? " cit-mini-dia--con-citas" : ""}${
                    dia.esHoy ? " cit-mini-dia--hoy" : ""
                  }`}
                  title={dia.activas ? textoDeCantidadDeCitas(dia.activas) : undefined}
                  aria-label={`${dia.dia} de ${mes.nombre}${
                    dia.activas ? `, ${textoDeCantidadDeCitas(dia.activas)}` : ""
                  }`}
                  onClick={() => onAbrirDia(dia.fecha)}
                >
                  {dia.dia}
                </button>
              ) : (
                <span key={dia.fecha} aria-hidden="true" />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CalendarioCitas({ agenda, onAbrirCita, onAgendarEn }) {
  if (agenda.vista === VISTAS_AGENDA.ANIO) {
    return (
      <CalendarioAnio
        meses={agenda.meses}
        onAbrirMes={(fecha) => agenda.irA(fecha, VISTAS_AGENDA.MES)}
        onAbrirDia={(fecha) => agenda.irA(fecha)}
      />
    );
  }
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
