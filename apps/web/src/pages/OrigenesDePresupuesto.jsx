import { useState } from "react";
import { Plus } from "lucide-react";

import {
  COLUMNAS_ORIGEN_PRESUPUESTO,
  formatearMoneda,
  useOrigenesDePresupuesto,
} from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import { Card, DataList, ErrorState, PrimaryButton } from "../components";

// De donde viene el presupuesto de una jornada (issue #840, bloque D).
export default function OrigenesDePresupuesto({ jornadaId, proyectoId, rol, alCambiar }) {
  const {
    permisos,
    origenes,
    total,
    cargando,
    error,
    recargar,
    campos,
    catalogos,
    valores,
    setCampo,
    errores,
    errorAlGuardar,
    guardando,
    registrar,
    quitar,
    quitandoId,
  } = useOrigenesDePresupuesto({ jornadaId, proyectoId, rol, alCambiar });

  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <>
      <Card title={`Presupuesto: ${formatearMoneda(total) ?? formatearMoneda(0)}`}>
        <p className="text-body-secondary small mb-3">
          El presupuesto de la jornada es la suma de estos aportes. Para cambiarlo se registra o se
          quita un aporte; el total no se escribe a mano.
        </p>
        <DataList
          columnas={COLUMNAS_ORIGEN_PRESUPUESTO}
          datos={origenes}
          cargando={cargando}
          vacio="Esta jornada todavía no tiene presupuesto."
          accionSecundaria={
            permisos?.puedeGestionar
              ? {
                  label: "Quitar",
                  onClick: (fila) => {
                    if (quitandoId) return;
                    quitar(fila.id);
                  },
                }
              : undefined
          }
        />
      </Card>

      {permisos?.puedeGestionar && (
        <Card title="Registrar un aporte">
          {errorAlGuardar && (
            <div className="alert alert-danger" role="alert">
              {errorAlGuardar.mensaje}
            </div>
          )}
          <div className="ec-form-grid">
            {campos.map((campo) => {
              const esOrigen =
                campo.id === "origenId" ||
                campo.id === "origen" ||
                campo.id === "origenPresupuestoId";

              return (
                <div key={campo.id} className="d-flex flex-column">
                  {esOrigen && (
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="ec-rotulo small text-uppercase text-muted fw-bold">
                        {campo.label || "De dónde viene"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none small"
                        style={{ fontSize: "var(--texto-sm)" }}
                        onClick={() => setMostrarModalNuevo(true)}
                      >
                        + Crear opción
                      </button>
                    </div>
                  )}
                  <CampoDeFormulario
                    campo={esOrigen ? { ...campo, label: "" } : campo}
                    valor={valores[campo.id]}
                    error={errores[campo.id]}
                    catalogos={catalogos}
                    disabled={guardando}
                    onChange={(valor) => setCampo(campo.id, valor)}
                  />
                </div>
              );
            })}
          </div>
          {campos.some((campo) => campo.id === "donacionId") &&
            catalogos?.donacionesDisponibles?.length === 0 && (
              <p className="ec-campo-nota">
                No hay donaciones de dinero con saldo por asignar. Se registran en Donaciones.
              </p>
            )}
          <div className="ec-form-pie">
            <PrimaryButton
              title="Agregar aporte"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={registrar}
              loading={guardando}
            />
          </div>
        </Card>
      )}

      {mostrarModalNuevo && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          role="dialog"
          style={{ backgroundColor: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crear opción de origen</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar"
                  onClick={() => setMostrarModalNuevo(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label ec-rotulo">Nombre de la opción</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. Aporte Municipal"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setMostrarModalNuevo(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    setMostrarModalNuevo(false);
                    setNuevoNombre("");
                    if (typeof recargar === "function") recargar();
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
