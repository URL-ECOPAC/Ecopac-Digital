import { datosDeRecetaImprimible, formatearFechaCorta } from "@ecopac/shared";
import DocumentoImprimible, { LineaDeFirma } from "./DocumentoImprimible";

function Dato({ etiqueta, valor }) {
  return (
    <p>
      <strong>{etiqueta}:</strong> {valor ?? "—"}
    </p>
  );
}

/**
 * Receta lista para imprimir (issue #865: usaba su propia paleta en RecetaImprimible.css,
 * previa a DocumentoImprimible/issue #840, y nunca se migro). Ahora reutiliza el mismo
 * envoltorio que constancia/turnos/reporte -- misma identidad de organizacion, mismos tokens de
 * color y tipografia, cero valores escritos a mano -- en vez de mantener su propio azul y su
 * propio "Ecopac Guatemala" (ENCABEZADO_DE_RECETA, packages/shared/pacientes/recetas.imprimible.js).
 *
 * Tamaño media-carta: es media hoja, no una hoja carta completa, y asi lo previo el propio
 * DocumentoImprimible.jsx desde que se escribio.
 */
export default function RecetaImprimible({ receta, paciente }) {
  const datos = datosDeRecetaImprimible({ receta, paciente });
  if (!datos) return null;

  return (
    <DocumentoImprimible
      documento={datos.documento}
      fecha={datos.fecha}
      tamanio="media-carta"
      pie={<LineaDeFirma rotulo={datos.medico ?? "Firma del médico"} />}
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

      <Dato etiqueta="Paciente" valor={datos.paciente.nombre} />
      <Dato etiqueta="Ficha" valor={datos.paciente.numeroFicha} />
      <Dato etiqueta="Edad" valor={datos.paciente.edad} />
      <Dato etiqueta="Sexo" valor={datos.paciente.sexo} />
      <Dato etiqueta="Comunidad" valor={datos.paciente.comunidad} />

      <Dato etiqueta="Médico" valor={datos.medico} />
      <Dato etiqueta="Jornada" valor={datos.jornada} />
      <Dato
        etiqueta="Fecha de jornada"
        valor={datos.fechaDeJornada ? formatearFechaCorta(datos.fechaDeJornada) : null}
      />

      <h3
        style={{
          fontSize: "var(--texto-sm)",
          fontWeight: "var(--peso-bold)",
          color: "var(--color-text)",
          margin: "10px 0 4px 0",
        }}
      >
        Medicamentos
      </h3>
      {datos.medicamentos.length === 0 ? (
        <p>Sin medicamentos.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: "20px" }}>
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

      {datos.indicacionesGenerales && (
        <>
          <h3
            style={{
              fontSize: "var(--texto-sm)",
              fontWeight: "var(--peso-bold)",
              color: "var(--color-text)",
              margin: "10px 0 4px 0",
            }}
          >
            Indicaciones generales
          </h3>
          <p>{datos.indicacionesGenerales}</p>
        </>
      )}
    </DocumentoImprimible>
  );
}
