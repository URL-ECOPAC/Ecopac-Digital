import { useState } from "react";
import { Alert, Button } from "react-bootstrap";

import { formatearMoneda, useInsumosDeJornada } from "@ecopac/shared";

import { DataList, PrimaryButton } from "../components";
import ModalInsumoPrevisto from "./ModalInsumoPrevisto";

// Pestana Insumos del detalle de una jornada (00151): lo previsto para la jornada, con alta,
// correccion y baja para quien la administra. El proyecto de la jornada solo los muestra.
export default function InsumosDeJornada({ jornadaId, rol }) {
  const {
    puedeGestionar,
    columnas,
    campos,
    catalogos,
    insumos,
    resumen,
    cargando,
    error,
    errores,
    ocupado,
    guardar,
    quitar,
  } = useInsumosDeJornada({ jornadaId, rol });

  const [insumoEnEdicion, setInsumoEnEdicion] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [insumoPorQuitar, setInsumoPorQuitar] = useState(null);
  const [aviso, setAviso] = useState(null);

  return (
    <div className="d-flex flex-column gap-3">
      <p className="text-muted small mb-0">
        Lo previsto para esta jornada. No descuenta existencias del inventario; su proyecto lo
        muestra junto con el de sus otras jornadas.
      </p>

      {(error || aviso) && (
        <Alert variant="danger" className="mb-0 py-2 px-3 small">
          {error ? `No se pudieron actualizar los insumos: ${error.mensaje}` : aviso}
        </Alert>
      )}

      {puedeGestionar && (
        <div className="d-flex justify-content-end">
          <PrimaryButton
            title="Agregar insumo"
            onClick={() => {
              setInsumoEnEdicion(null);
              setFormularioAbierto(true);
            }}
          />
        </div>
      )}

      {insumoPorQuitar && (
        <Alert variant="warning" className="mb-0 py-2 px-3 small">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>¿Quitar {insumoPorQuitar.articuloNombre} de la jornada?</span>
            <span className="d-flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={ocupado}
                onClick={async () => {
                  const { ok, error: fallo } = await quitar(insumoPorQuitar.id);
                  setAviso(ok || fallo ? null : "No se pudo quitar el insumo.");
                  setInsumoPorQuitar(null);
                }}
              >
                Confirmar
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setInsumoPorQuitar(null)}
              >
                Cancelar
              </Button>
            </span>
          </div>
        </Alert>
      )}

      <DataList
        columnas={columnas}
        datos={insumos}
        cargando={cargando}
        vacio="Esta jornada todavía no tiene insumos previstos."
        onRowPress={
          puedeGestionar
            ? (insumo) => {
                setInsumoEnEdicion(insumo);
                setFormularioAbierto(true);
              }
            : undefined
        }
        accionSecundaria={
          puedeGestionar ? { label: "Quitar", onClick: setInsumoPorQuitar } : undefined
        }
      />

      {insumos.length > 0 && (
        <p className="mb-0 text-end">
          <strong>Total estimado:</strong> {formatearMoneda(resumen.totalEstimado)}
          {resumen.sinCosto > 0 && (
            <span className="text-muted small ms-2">({resumen.sinCosto} sin costo estimado)</span>
          )}
        </p>
      )}

      {formularioAbierto && (
        <ModalInsumoPrevisto
          visible
          insumo={insumoEnEdicion}
          campos={campos}
          catalogos={catalogos}
          errores={errores}
          onClose={() => setFormularioAbierto(false)}
          onGuardar={guardar}
        />
      )}
    </div>
  );
}
