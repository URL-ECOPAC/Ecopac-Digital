import { organizacion } from "@ecopac/ui-tokens";
import { datosDeRecetaMedica, formatearFechaCorta } from "@ecopac/shared";
import DocumentoImprimible, { LineaDeFirma } from "./DocumentoImprimible";

// Un dato que puede faltar: sin valor deja la raya para llenarlo a mano, como en la receta de papel.
function Dato({ etiqueta, valor }) {
  return (
    <p>
      <strong>{etiqueta}:</strong> {valor ?? "________"}
    </p>
  );
}

// Varios datos en un mismo renglon, como en la receta de papel: media carta no da para uno por
// linea. Si un valor largo no cabe, el renglon se parte solo.
function Renglon({ children }) {
  return <div style={{ display: "flex", flexWrap: "wrap", columnGap: "16px" }}>{children}</div>;
}

const TITULO_DE_SECCION = {
  fontSize: "var(--texto-sm)",
  fontWeight: "var(--peso-bold)",
  color: "var(--color-text)",
  margin: "10px 0 4px 0",
};

/**
 * Receta en el formato de la receta medica escrita: "Rp:" y cada medicamento numerado con su
 * cantidad ("# 10 tabletas") y su uso en una frase. Es el boton "Receta / PDF"; el formato de
 * "Imprimir / PDF" sigue en RecetaImprimible.jsx, sin cambios.
 *
 * Mismo envoltorio y misma media carta que RecetaImprimible: logo, organizacion y fecha salen de
 * DocumentoImprimible.
 */
export default function RecetaMedicaImprimible({ receta, paciente }) {
  const datos = datosDeRecetaMedica({ receta, paciente });
  if (!datos) return null;

  return (
    <DocumentoImprimible
      documento={datos.documento}
      fecha={datos.fecha}
      tamanio="media-carta"
      pie={
        <div style={{ flex: 1 }}>
          <LineaDeFirma rotulo={datos.medico ?? "Firma del médico"} />
          <p className="doc-imprimible__rotulo-firma" style={{ textAlign: "center" }}>
            Tel.: {organizacion.telefono}
          </p>
        </div>
      }
    >
      {datos.anulada && (
        <p
          style={{
            textAlign: "center",
            fontWeight: "var(--peso-bold)",
            color: "var(--color-danger)",
            border: "1px solid var(--color-danger)",
            borderRadius: "6px",
            padding: "6px",
            margin: "0 0 10px 0",
          }}
        >
          RECETA ANULADA
          {datos.anuladaEn ? ` el ${formatearFechaCorta(datos.anuladaEn)}` : ""}
          {datos.motivoAnulacion ? `: ${datos.motivoAnulacion}` : ""}
        </p>
      )}

      <Renglon>
        <Dato etiqueta="Paciente" valor={datos.paciente.nombre} />
        <Dato etiqueta="Fecha" valor={datos.fecha ? formatearFechaCorta(datos.fecha) : null} />
      </Renglon>
      <Renglon>
        <Dato etiqueta="Edad" valor={datos.paciente.edad} />
        <Dato etiqueta="Sexo" valor={datos.paciente.sexo} />
        <Dato etiqueta="Peso" valor={datos.paciente.peso} />
        <Dato etiqueta="Talla" valor={datos.paciente.talla} />
      </Renglon>
      <Renglon>
        <Dato etiqueta="Médico" valor={datos.medico} />
      </Renglon>
      <Renglon>
        <Dato etiqueta="Jornada" valor={datos.jornada} />
        <Dato
          etiqueta="Fecha de jornada"
          valor={datos.fechaDeJornada ? formatearFechaCorta(datos.fechaDeJornada) : null}
        />
      </Renglon>

      <h3 style={TITULO_DE_SECCION}>Rp:</h3>
      {datos.medicamentos.length === 0 ? (
        <p>Sin medicamentos.</p>
      ) : (
        datos.medicamentos.map((medicamento) => (
          <div key={medicamento.id} style={{ margin: "0 0 8px 0", breakInside: "avoid" }}>
            <p>
              <strong>
                {medicamento.numero}. {medicamento.titulo}
              </strong>
            </p>
            {medicamento.cantidad && <p style={{ paddingLeft: "16px" }}>{medicamento.cantidad}</p>}
            {medicamento.uso && <p style={{ paddingLeft: "16px" }}>Uso: {medicamento.uso}</p>}
          </div>
        ))
      )}

      {datos.indicacionesGenerales && (
        <>
          <h3 style={TITULO_DE_SECCION}>Indicaciones generales</h3>
          <p>{datos.indicacionesGenerales}</p>
        </>
      )}
    </DocumentoImprimible>
  );
}
