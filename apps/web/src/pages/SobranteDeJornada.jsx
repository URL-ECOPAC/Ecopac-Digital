import { DESTINOS_DE_SOBRANTE, formatearMoneda, useSobranteDeJornada } from "@ecopac/shared";

import { Card, ErrorState, LoadingState, PrimaryButton } from "../components";
import Selector from "../components/Selector";

// Sobrante del presupuesto de una jornada finalizada (00160), en la pestana Cierre. Por cada aporte
// al que le sobra dinero se elige devolverlo a su origen o pasarlo a otra jornada del proyecto.
export default function SobranteDeJornada({ jornada, rol, alLiquidar }) {
  const {
    visible,
    puedeLiquidar,
    cargando,
    error,
    filas,
    liquidados,
    totalSobrante,
    hayGastosPendientes,
    jornadasDestino,
    opcionesDeDestino,
    decisiones,
    errores,
    setDestino,
    setJornadaDestino,
    liquidar,
    liquidando,
    errorAlLiquidar,
    recargar,
  } = useSobranteDeJornada({ jornada, rol, onLiquidado: alLiquidar });

  if (!visible) return null;

  return (
    <Card title="Sobrante del presupuesto" className="mt-3">
      {cargando ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : (
        <div className="d-flex flex-column gap-3">
          {liquidados.length > 0 && (
            <ul className="list-unstyled small mb-0">
              {liquidados.map((fila) => (
                <li key={fila.origenId}>
                  Ya salió de la jornada: {formatearMoneda(fila.devuelto)} de {fila.etiqueta}
                  {fila.detalle ? ` (${fila.detalle})` : ""}.
                </li>
              ))}
            </ul>
          )}

          {filas.length === 0 ? (
            <p className="text-body-secondary small mb-0">
              {liquidados.length > 0
                ? "No queda sobrante por liquidar."
                : "La jornada gastó todo su presupuesto: no hay sobrante."}
            </p>
          ) : (
            <>
              <p className="mb-0">
                Sobran <strong>{formatearMoneda(totalSobrante)}</strong>. Elige qué hacer con lo que
                sobró de cada aporte.
              </p>

              {hayGastosPendientes && (
                <div className="alert alert-warning mb-0" role="alert">
                  Hay gastos pendientes de aprobar: el sobrante se liquida cuando se resuelvan.
                </div>
              )}

              {filas.map((fila) => {
                const decision = decisiones[fila.origenId];
                const destino = decision?.destino ?? DESTINOS_DE_SOBRANTE.DEVOLVER;
                return (
                  <div key={fila.origenId} className="ec-form-grid">
                    <div>
                      <div className="fw-semibold">{fila.etiqueta}</div>
                      {fila.detalle && (
                        <div className="small text-body-secondary">{fila.detalle}</div>
                      )}
                      <div className="small">
                        Sobran {formatearMoneda(fila.sobrante)} de{" "}
                        {formatearMoneda(fila.monto - fila.devuelto)}
                      </div>
                    </div>
                    <Selector
                      label="Qué hacer"
                      value={destino}
                      options={opcionesDeDestino(fila.origen)}
                      onSelect={(valor) =>
                        setDestino(fila.origenId, valor ?? DESTINOS_DE_SOBRANTE.DEVOLVER)
                      }
                      placeholder="Elegir"
                      disabled={!puedeLiquidar || liquidando}
                    />
                    {destino === DESTINOS_DE_SOBRANTE.TRASPASAR && (
                      <Selector
                        label="Jornada que lo recibe"
                        value={decision?.jornadaDestinoId ?? null}
                        options={jornadasDestino}
                        onSelect={(valor) => setJornadaDestino(fila.origenId, valor)}
                        error={errores[fila.origenId]}
                        disabled={!puedeLiquidar || liquidando}
                      />
                    )}
                  </div>
                );
              })}

              {errorAlLiquidar && (
                <div className="alert alert-danger mb-0" role="alert">
                  {errorAlLiquidar.mensaje}
                </div>
              )}

              {puedeLiquidar && (
                <div className="d-flex justify-content-end">
                  <PrimaryButton
                    title="Liquidar sobrante"
                    onClick={liquidar}
                    loading={liquidando}
                    disabled={hayGastosPendientes}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
