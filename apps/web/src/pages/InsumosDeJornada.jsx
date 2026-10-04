import { useState } from "react";
import { Alert, Button } from "react-bootstrap";

import { formatearMoneda, puedeCargarBodegaDeJornada, useInsumosDeJornada } from "@ecopac/shared";

import { DataList, PrimaryButton, SecondaryButton, StatCard } from "../components";
import ContenidoDeBodega from "../components/ContenidoDeBodega";
import ModalCargaABodega from "./ModalCargaABodega";
import ModalDevolucionDeBodega from "./ModalDevolucionDeBodega";
import ModalInsumoPrevisto from "./ModalInsumoPrevisto";

// Pestana Insumos del detalle de una jornada. Desde la 00178 sus insumos son lo que hay en su bodega
// movil: se cargan aqui desde otra bodega ("Cargar a la bodega") y de ella salen las entregas de la
// jornada. Lo que se consumio esta en la pestana Consumo. Con la bodega principal (00181) no hay
// nada que cargar ni devolver: la pestana lo explica en lugar de mostrar la bodega.
//
// La lista de previstos (jornada_insumos, 00151) ya no se llena; si una jornada anterior la tiene,
// se sigue viendo debajo, con su total, y se puede corregir o quitar.
//
// `soloConsulta`: la jornada esta finalizada; nada se carga ni se corrige. Lo que sobra si se
// devuelve a una bodega fija ("Devolver a otra bodega", 00179): es justo cuando sobra.
export default function InsumosDeJornada({
  jornadaId,
  bodega = null,
  rol,
  soloConsulta = false,
  alCargar,
}) {
  const {
    puedeGestionar,
    usaBodegaPrincipal,
    columnas,
    campos,
    catalogos,
    insumos,
    resumen,
    existenciasDeBodega,
    valorDeBodega,
    cargando,
    error,
    errores,
    ocupado,
    guardar,
    quitar,
    recargarBodega,
  } = useInsumosDeJornada({
    jornadaId,
    bodegaId: bodega?.id ?? null,
    bodegaEsPrincipal: Boolean(bodega?.esPrincipal),
    rol,
  });

  const [insumoEnEdicion, setInsumoEnEdicion] = useState(null);
  const [insumoPorQuitar, setInsumoPorQuitar] = useState(null);
  const [cargandoABodega, setCargandoABodega] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [aviso, setAviso] = useState(null);
  const modifica = puedeGestionar && !soloConsulta;
  const puedeCargar = puedeCargarBodegaDeJornada(rol) && Boolean(bodega?.id) && !usaBodegaPrincipal;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ec-kpis">
        {!usaBodegaPrincipal && (
          <StatCard
            label="Valor en la bodega"
            value={bodega?.id ? formatearMoneda(valorDeBodega.valor) : "—"}
            caption={
              valorDeBodega.lotesSinCosto > 0
                ? `${valorDeBodega.lotesSinCosto} lote(s) sin costo no se suman`
                : `${valorDeBodega.unidades} unidades`
            }
            accent="var(--accent-inventario)"
          />
        )}
        {insumos.length > 0 && (
          <StatCard
            label="Previsto (estimado)"
            value={formatearMoneda(resumen.totalEstimado)}
            caption="Planificado antes de cargar la bodega"
            accent="var(--accent-jornadas)"
          />
        )}
      </div>

      {(error || aviso) && (
        <Alert variant="danger" className="mb-0 py-2 px-3 small">
          {error ? `No se pudieron actualizar los insumos: ${error.mensaje}` : aviso}
        </Alert>
      )}

      {usaBodegaPrincipal && (
        <section className="d-flex flex-column gap-2">
          <h3 className="ec-seccion-titulo mb-0">Bodega principal: {bodega.nombre}</h3>
          <Alert variant="info" className="mb-0 py-2 px-3 small">
            Esta jornada entrega directo de la bodega principal: no hay nada que cargar ni que
            devolver. Lo que se entregue en sus recetas aparece en la pestaña Consumo, con su valor.
          </Alert>
        </section>
      )}

      {!usaBodegaPrincipal && bodega?.id && (
        <section className="d-flex flex-column gap-2">
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
            <div>
              <h3 className="ec-seccion-titulo mb-0">Bodega móvil: {bodega.nombre}</h3>
              <p className="text-muted small mb-0">
                Si la jornada tiene una bodega asignada, su inventario pasa a ser parte de los
                insumos de la jornada. De ella salen los medicamentos que se recetan aquí.
              </p>
            </div>
            {puedeCargar && (
              <div className="d-flex flex-wrap gap-2">
                <SecondaryButton
                  title="Devolver a otra bodega"
                  onClick={() => setDevolviendo(true)}
                  disabled={existenciasDeBodega.contenido.length === 0}
                />
                <PrimaryButton
                  title="Cargar a la bodega"
                  onClick={() => setCargandoABodega(true)}
                  disabled={soloConsulta}
                />
              </div>
            )}
          </div>
          <ContenidoDeBodega
            contenido={existenciasDeBodega.contenido}
            cargando={existenciasDeBodega.cargando}
            error={existenciasDeBodega.error}
            vacio="La bodega móvil todavía no tiene existencias. Cárgala desde otra bodega."
            conValor
          />
        </section>
      )}

      {!bodega?.id && (
        <Alert variant="warning" className="mb-0 py-2 px-3 small">
          Esta jornada no tiene bodega móvil. Asígnale una con &laquo;Editar jornada&raquo; para
          cargarle insumos.
        </Alert>
      )}

      {insumos.length > 0 && (
        <section className="d-flex flex-column gap-2 mt-2">
          <h3 className="ec-seccion-titulo mb-0">Previstos</h3>
          <p className="text-muted small mb-0">
            Lo que se planificó antes de que los insumos se cargaran a la bodega. No descuenta
            existencias del inventario.
          </p>

          {insumoPorQuitar && (
            <Alert variant="warning" className="mb-0 py-2 px-3 small">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span>¿Quitar {insumoPorQuitar.articuloNombre} de los previstos?</span>
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
            vacio={null}
            onRowPress={modifica ? setInsumoEnEdicion : undefined}
            accionSecundaria={
              modifica ? { label: "Quitar", onClick: setInsumoPorQuitar } : undefined
            }
          />

          {resumen.sinCosto > 0 && (
            <p className="mb-0 text-end text-muted small">
              {resumen.sinCosto} previsto(s) sin costo estimado
            </p>
          )}
        </section>
      )}

      {insumoEnEdicion && (
        <ModalInsumoPrevisto
          visible
          insumo={insumoEnEdicion}
          campos={campos}
          catalogos={catalogos}
          errores={errores}
          onClose={() => setInsumoEnEdicion(null)}
          onGuardar={guardar}
        />
      )}

      {devolviendo && (
        <ModalDevolucionDeBodega
          visible
          jornadaId={jornadaId}
          bodega={bodega}
          contenido={existenciasDeBodega.contenido}
          rol={rol}
          onClose={() => setDevolviendo(false)}
          onDevuelto={() => {
            recargarBodega();
            alCargar?.();
          }}
        />
      )}

      {cargandoABodega && (
        <ModalCargaABodega
          visible
          jornadaId={jornadaId}
          bodega={bodega}
          rol={rol}
          onClose={() => setCargandoABodega(false)}
          onCargado={() => {
            recargarBodega();
            alCargar?.();
          }}
        />
      )}
    </div>
  );
}
