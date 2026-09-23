import { useEffect, useState } from "react";
import { Ban, EyeOff, Printer } from "lucide-react";

import {
  describirMedicamento,
  describirEntrega,
  describirPosologia,
  formatearFechaCorta,
} from "@ecopac/shared";

import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";

// Una receta con su detalle, su impresion y su anulacion.
//
// Vivia dentro de PestaniaRecetasPaciente.jsx, la pestana hermana del historial que la #840
// retira: ahora cada receta se ve dentro de la visita a la que pertenece. Se extrae sin cambiar
// lo que hace para que imprimir y anular sigan exactamente igual.

function Detalle({ receta }) {
  if (receta.detalle.length === 0) {
    return <p className="text-body-secondary mb-0 mt-2">La receta no tiene medicamentos.</p>;
  }

  return (
    <div className="mt-2">
      {receta.indicacionesGenerales && (
        <p className="mb-2">
          <span className="pac-rotulo">Indicaciones generales </span>
          {receta.indicacionesGenerales}
        </p>
      )}
      <ul className="mb-0">
        {receta.detalle.map((renglon) => (
          <li key={renglon.id}>
            <strong>{describirMedicamento(renglon)}</strong>
            {describirPosologia(renglon) && ` — ${describirPosologia(renglon)}`}
            {describirEntrega(renglon).texto && ` (${describirEntrega(renglon).texto})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TarjetaReceta({ receta, onImprimir, puedeAnular, onAnular }) {
  const [abierta, setAbierta] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorAnular, setErrorAnular] = useState(null);

  const confirmarAnulacion = async () => {
    setEnviando(true);
    setErrorAnular(null);
    const { error } = await onAnular(receta.id, motivo);
    setEnviando(false);

    if (error) {
      setErrorAnular(error.mensaje);
      return;
    }
    setAnulando(false);
    setMotivo("");
  };

  return (
    <div className="pac-receta" style={{ opacity: receta.anulada ? 0.75 : 1 }}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <strong>{receta.folio ?? "Sin folio"}</strong>
        <StatusChip status={receta.estado} uppercase/>
        <span className="pac-fecha">{formatearFechaCorta(receta.createdAt)}</span>
        <div className="d-flex flex-wrap gap-2 ms-auto">
          <SecondaryButton
            title={abierta ? "Ocultar detalle" : "Ver detalle"}
            variant="neutra"
            size="sm"
            icon={abierta ? <EyeOff size={16} aria-hidden="true" /> : undefined}
            onClick={() => setAbierta((valor) => !valor)}
            aria-expanded={abierta}
          />
          <SecondaryButton
            title="Imprimir o guardar PDF"
            variant="neutra"
            size="sm"
            icon={<Printer size={16} aria-hidden="true" />}
            onClick={() => onImprimir(receta)}
          />
          {puedeAnular && !receta.anulada && !anulando && (
            <SecondaryButton
              title="Anular"
              variant="peligro"
              size="sm"
              icon={<Ban size={16} aria-hidden="true" />}
              onClick={() => setAnulando(true)}
            />
          )}
        </div>
      </div>

      {receta.anulada && (
        <div className="alert alert-warning mt-2 mb-0 py-2">
          <strong>Receta anulada</strong>
          {receta.anuladaPorNombre && ` por ${receta.anuladaPorNombre}`}
          {receta.anuladaEn && ` el ${formatearFechaCorta(receta.anuladaEn)}`}
          {receta.motivoAnulacion ? `: ${receta.motivoAnulacion}` : ". No se registro el motivo."}
        </div>
      )}

      {anulando && (
        <div className="mt-2 p-2 border rounded">
          {errorAnular && (
            <div className="alert alert-danger py-1 px-2 mb-2" role="alert">
              {errorAnular}
            </div>
          )}
          <label className="form-label small mb-1" htmlFor={`motivo-anulacion-${receta.id}`}>
            Motivo de la anulacion
          </label>
          <textarea
            id={`motivo-anulacion-${receta.id}`}
            className="form-control form-control-sm mb-2"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={enviando}
          />
          <div className="d-flex gap-2 justify-content-end">
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              size="sm"
              onClick={() => {
                setAnulando(false);
                setErrorAnular(null);
              }}
              disabled={enviando}
            />
            <SecondaryButton
              title={enviando ? "Anulando..." : "Confirmar anulacion"}
              variant="peligro"
              size="sm"
              onClick={confirmarAnulacion}
              disabled={enviando || !motivo.trim()}
            />
          </div>
        </div>
      )}

      {abierta && <Detalle receta={receta} />}
    </div>
  );
}

/**
 * Imprime una receta: la monta en su portal imprimible y abre el dialogo del navegador. Vivia en
 * PestaniaRecetasPaciente.jsx; se extrae con la tarjeta.
 *
 * @returns {{ aImprimir: object|null, imprimir: (receta: object) => void }}
 */
export function useImpresionDeReceta() {
  const [aImprimir, setAImprimir] = useState(null);

  useEffect(() => {
    if (!aImprimir) return undefined;

    const limpiar = () => setAImprimir(null);
    window.addEventListener("afterprint", limpiar);
    const cuadro = window.requestAnimationFrame(() => window.print());

    return () => {
      window.removeEventListener("afterprint", limpiar);
      window.cancelAnimationFrame(cuadro);
    };
  }, [aImprimir]);

  return { aImprimir, imprimir: setAImprimir };
}
