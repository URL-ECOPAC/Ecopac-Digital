import { createPortal } from "react-dom";
import { datosDeCuadroTurnosImprimible, formatearFechaCorta } from "@ecopac/shared";

/**
 * Convierte un texto a formato título (primera letra de cada palabra en mayúscula).
 */
function formatearRolTitulo(rol) {
  if (!rol) return "—";
  return rol
    .toLowerCase()
    .split(" ")
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

export default function CuadroTurnosImprimible({ jornada }) {
  const datos = datosDeCuadroTurnosImprimible({ jornada });
  if (!datos) return null;

  return createPortal(
    <article className="turnos-imprimible">
      <header className="turnos-imprimible__encabezado">
        {/* Issue #863: Logotipo incluido en el diseño del reporte impreso */}
        <div className="turnos-imprimible__logo-contenedor mb-2">
          <img 
            src="/logo-ecopac.png" 
            alt="Logo Ecopac Digital" 
            className="turnos-imprimible__logo" 
            style={{ maxHeight: "40px", objectFit: "contain" }}
          />
        </div>
        <h1 className="turnos-imprimible__organizacion">{datos.organizacion}</h1>
        <p className="turnos-imprimible__documento">{datos.documento}</p>
        <p className="turnos-imprimible__jornada">
          {datos.jornada} · {formatearFechaCorta(datos.fecha)}
          {datos.comunidad ? ` · ${datos.comunidad}` : ""}
        </p>
      </header>

      {datos.filas.length === 0 ? (
        <p>Todavía no hay personal asignado a esta jornada.</p>
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
                {/* Issue #863: El rol se muestra con formato título */}
                <td>{formatearRolTitulo(fila.rol)}</td>
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