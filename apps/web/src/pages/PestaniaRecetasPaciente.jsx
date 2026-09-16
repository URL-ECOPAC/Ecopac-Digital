import { useEffect, useState } from "react";

import {
  anularReceta,
  describirMedicamento,
  describirPosologia,
  formatearFechaCorta,
  puedeAnularReceta,
  useRecetasPaciente,
} from "@ecopac/shared";

import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import RecetaImprimible from "./RecetaImprimible";

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
            {renglon.cantidadEntregada ? ` (entregadas: ${renglon.cantidadEntregada})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Receta({ receta, abierta, onAlternar, onImprimir, puedeAnular, onAnular }) {
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
    <Card style={{ marginBottom: "1rem", opacity: receta.anulada ? 0.75 : 1 }}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <strong>{receta.folio ?? "Sin folio"}</strong>
        <StatusChip status={receta.estado} />
        <span className="pac-fecha">{formatearFechaCorta(receta.createdAt)}</span>
        <button
          type="button"
          className="btn btn-link btn-sm ms-auto p-0"
          onClick={onAlternar}
          aria-expanded={abierta}
        >
          {abierta ? "Ocultar detalle" : "Ver detalle"}
        </button>
        <button type="button" className="btn btn-link btn-sm p-0" onClick={onImprimir}>
          Imprimir o guardar PDF
        </button>
        {puedeAnular && !receta.anulada && !anulando && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-danger"
            onClick={() => setAnulando(true)}
          >
            Anular
          </button>
        )}
      </div>

      <div className="pac-dato-mono mt-1">
        {[receta.jornada, receta.medico ? `Dr. ${receta.medico}` : null]
          .filter(Boolean)
          .join(" · ") || "Sin jornada ni medico registrados"}
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
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setAnulando(false);
                setErrorAnular(null);
              }}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={confirmarAnulacion}
              disabled={enviando || !motivo.trim()}
            >
              {enviando ? "Anulando..." : "Confirmar anulacion"}
            </button>
          </div>
        </div>
      )}

      {abierta && <Detalle receta={receta} />}
    </Card>
  );
}

export default function PestaniaRecetasPaciente({ paciente, rol, perfilId }) {
  const { recetas, conteo, cargando, error, recargar } = useRecetasPaciente(paciente?.id, { rol });
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [aImprimir, setAImprimir] = useState(null);

  const anular = async (recetaId, motivo) => {
    const respuesta = await anularReceta(recetaId, { motivo, anuladaPor: perfilId });
    if (!respuesta.error) await recargar();
    return respuesta;
  };

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

  const alternar = (id) =>
    setAbiertas((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  if (conteo.total === 0) {
    return <EmptyState message="Este paciente todavia no tiene recetas emitidas." />;
  }

  return (
    <div>
      <p className="text-body-secondary small">
        {conteo.total === 1 ? "1 receta" : `${conteo.total} recetas`}
        {conteo.anuladas > 0 &&
          ` · ${conteo.anuladas === 1 ? "1 anulada" : `${conteo.anuladas} anuladas`}`}
      </p>

      {recetas.map((receta) => (
        <Receta
          key={receta.id}
          receta={receta}
          abierta={abiertas.has(receta.id)}
          onAlternar={() => alternar(receta.id)}
          onImprimir={() => setAImprimir(receta)}
          puedeAnular={puedeAnularReceta(rol, receta, perfilId)}
          onAnular={anular}
        />
      ))}

      {aImprimir && <RecetaImprimible receta={aImprimir} paciente={paciente} />}
    </div>
  );
}
