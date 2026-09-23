import { createPortal } from "react-dom";
import { datosDeRecetaImprimible, formatearFechaCorta } from "@ecopac/shared";

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
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          body > *:not(.receta-imprimible) {
            display: none !important;
          }
          .receta-imprimible {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
          }
        }
        .receta-imprimible {
          font-family: system-ui, sans-serif;
          color: #000;
          background: #fff;
        }
        .receta-imprimible__encabezado {
          text-align: center;
          margin-bottom: 20px;
        }
        .receta-imprimible__organizacion {
          font-size: 18pt;
          font-weight: bold;
          margin: 0 0 4px 0;
        }
        .receta-imprimible__documento {
          font-size: 11pt;
          color: #555;
          margin: 4px 0;
        }
        .receta-imprimible__folio {
          font-size: 10pt;
          color: #555;
          margin: 4px 0;
        }
        .receta-imprimible__anulada {
          text-align: center;
          font-size: 13pt;
          font-weight: bold;
          color: #b00;
          border: 2px solid #b00;
          padding: 8px;
          margin: 12px 0;
        }
        .receta-imprimible__bloque {
          margin-bottom: 12px;
        }
        .receta-imprimible__dato {
          margin: 4px 0;
          font-size: 11pt;
        }
        .receta-imprimible__etiqueta {
          display: inline-block;
          min-width: 100px;
          font-weight: bold;
        }
        .receta-imprimible__titulo {
          font-size: 11pt;
          font-weight: bold;
          margin: 15px 0 4px 0;
          border-bottom: 1px solid #ddd;
          padding-bottom: 2px;
        }
        .receta-imprimible__medicamentos {
          padding-left: 24px;
          margin: 0;
        }
        .receta-imprimible__medicamentos li {
          margin-bottom: 6px;
          font-size: 10pt;
        }
        .receta-imprimible__firma {
          margin-top: 60px;
          text-align: center;
        }
        .receta-imprimible__linea {
          display: block;
          border-bottom: 1px solid #000;
          width: 150px;
          margin: 0 auto 8px auto;
        }
        .receta-imprimible__firma p {
          margin: 0;
          font-size: 10pt;
        }
      `}</style>

      <article className="receta-imprimible">
        <header className="receta-imprimible__encabezado">
          <h1 className="receta-imprimible__organizacion">{datos.organizacion}</h1>
          <p className="receta-imprimible__documento">{datos.documento}</p>
          <p className="receta-imprimible__folio">
            Folio {datos.folio ?? "sin folio"} · {formatearFechaCorta(datos.fecha)}
          </p>
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
      </article>
    </>,
    document.body
  );
}