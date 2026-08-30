import { createPortal } from "react-dom";

import { datosDeCuadroTurnosImprimible, formatearFechaCorta } from "@ecopac/shared";

// Version imprimible del cuadro de turnos (issue #185, criterio 4), para pegar en el lugar de la
// jornada. Mismo patron que RecetaImprimible.jsx (#131): datosDeCuadroTurnosImprimible() arma los
// datos en shared, este componente solo los dibuja dentro de un portal a document.body (fuera del
// arbol de la app, para que .app-shell{display:none} de index.css no se lo lleve por delante) y
// quien lo monta (DetalleJornadaPage.jsx) es quien llama a window.print().
//
// Contenido minimo aprobado: nombre, rol en la jornada, hora de inicio, hora de fin y
// responsabilidad. Nada de contacto (jornada.personal ni siquiera trae telefono o correo) ni de
// datos clinicos de la jornada.
export default function CuadroTurnosImprimible({ jornada }) {
  const datos = datosDeCuadroTurnosImprimible({ jornada });
  if (!datos) return null;

  return createPortal(
    <article className="turnos-imprimible">
      <header className="turnos-imprimible__encabezado">
        <h1 className="turnos-imprimible__organizacion">{datos.organizacion}</h1>
        <p className="turnos-imprimible__documento">{datos.documento}</p>
        <p className="turnos-imprimible__jornada">
          {datos.jornada} · {formatearFechaCorta(datos.fecha)}
          {datos.comunidad ? ` · ${datos.comunidad}` : ""}
        </p>
      </header>

      {datos.filas.length === 0 ? (
        <p>Todavia no hay personal asignado a esta jornada.</p>
      ) : (
        <table className="turnos-imprimible__tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Responsabilidad</th>
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((fila) => (
              <tr key={fila.id}>
                <td>{fila.nombre ?? "—"}</td>
                <td>{fila.rol}</td>
                <td>{fila.horaInicio ?? "—"}</td>
                <td>{fila.horaFin ?? "—"}</td>
                <td>{fila.responsabilidad ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>,
    document.body,
  );
}
