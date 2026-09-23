import { createPortal } from "react-dom";
import { datosDeRecetaImprimible, formatearFechaCorta } from "@ecopac/shared";
import "./RecetaImprimible.css"; //  Estilos externos

function Dato({ etiqueta, valor }) {
  return (
    <p className="receta-imprimible__dato">
      <span className="receta-imprimible__etiqueta">{etiqueta}:</span> {valor ?? "—"}
    </p>
  );
}

export default function RecetaImprimible({ receta, paciente }) {
  const datos = datosDeRecetaImprimible({ receta, paciente });
  if (!datos) return null;

  return createPortal(
    <article className="receta-imprimible">
      <header className="receta-imprimible__encabezado">
        {/* Logo — verifica que la ruta sea correcta en tu proyecto */}
        <img
          src="/logo-ecopac.png"
          alt="Logo Ecopac"
          className="receta-imprimible__logo"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div className="receta-imprimible__encabezado-texto">
          <h1 className="receta-imprimible__organizacion">{datos.organizacion}</h1>
          <p className="receta-imprimible__documento">{datos.documento}</p>
          {/* Folio eliminado — solo fecha */}
          <p className="receta-imprimible__fecha">
            {formatearFechaCorta(datos.fecha)}
          </p>
        </div>
      </header>

      {datos.anulada && (
        <p className="receta-imprimible__anulada">
          RECETA ANULADA
          {datos.anuladaEn ? ` el ${formatearFechaCorta(datos.anuladaEn)}` : ""}
          {datos.motivoAnulacion ? `: ${datos.motivoAnulacion}` : ""}
        </p>
      )}

      <section className="receta-imprimible__bloque">
        <Dato etiqueta="Paciente" valor={datos.paciente.nombre} />
        <Dato etiqueta="Ficha" valor={datos.paciente.numeroFicha} />
        <Dato etiqueta="Edad" valor={datos.paciente.edad} />
        <Dato etiqueta="Sexo" valor={datos.paciente.sexo} />
        <Dato etiqueta="Comunidad" valor={datos.paciente.comunidad} />
      </section>

      <section className="receta-imprimible__bloque">
        <Dato etiqueta="Médico" valor={datos.medico} />
        <Dato etiqueta="Jornada" valor={datos.jornada} />
        <Dato
          etiqueta="Fecha de jornada"
          valor={datos.fechaDeJornada ? formatearFechaCorta(datos.fechaDeJornada) : null}
        />
      </section>

      <section>
        <h2 className="receta-imprimible__titulo">Medicamentos</h2>
        {datos.medicamentos.length === 0 ? (
          <p>Sin medicamentos.</p>
        ) : (
          <ol className="receta-imprimible__medicamentos">
            {datos.medicamentos.map((medicamento) => (
              <li key={medicamento.id}>
                <strong>{medicamento.descripcion}</strong>
                {medicamento.posologia && <div>{medicamento.posologia}</div>}
                {medicamento.cantidadEntregada != null && (
                  <div>Cantidad entregada: {medicamento.cantidadEntregada}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {datos.indicacionesGenerales && (
        <section>
          <h2 className="receta-imprimible__titulo">Indicaciones generales</h2>
          <p>{datos.indicacionesGenerales}</p>
        </section>
      )}

      <footer className="receta-imprimible__firma">
        <span className="receta-imprimible__linea" />
        <p>{datos.medico ?? "Firma del médico"}</p>
      </footer>
    </article>,
    document.body
  );
}