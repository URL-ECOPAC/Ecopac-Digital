import { Alert } from "react-bootstrap";

import { formatearMoneda, useConsumoDeJornada } from "@ecopac/shared";

import { DataList, StatCard } from "../components";

// Pestana Consumo del detalle de una jornada (00178): lote por lote, lo que se cargo a su bodega
// movil, lo que se entrego en sus recetas, lo que se devolvio (00179) y lo que sigue en la bodega,
// con su valor. Con la bodega principal (00181) solo hay entregas. El calculo y los totales viven
// en useConsumoDeJornada(); aqui solo se dibuja.
export default function ConsumoDeJornada({ jornadaId, rol, usaBodegaPrincipal = false }) {
  const { columnas, consumo, resumen, cargando, error } = useConsumoDeJornada({
    jornadaId,
    rol,
    usaBodegaPrincipal,
  });

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ec-kpis">
        {!usaBodegaPrincipal && (
          <StatCard
            label="Cargado a la bodega"
            value={formatearMoneda(resumen.valorCargado)}
            caption="Lo que se trasladó para esta jornada"
            accent="var(--accent-inventario)"
          />
        )}
        <StatCard
          label="Entregado"
          value={formatearMoneda(resumen.valorEntregado)}
          caption={`${resumen.unidadesEntregadas} unidades en recetas`}
          accent="var(--color-success)"
        />
        {!usaBodegaPrincipal && (
          <>
            <StatCard
              label="Devuelto"
              value={formatearMoneda(resumen.valorDevuelto)}
              caption="Regresó a una bodega fija"
              accent="var(--accent-presupuestos)"
            />
            <StatCard
              label="Queda en la bodega"
              value={formatearMoneda(resumen.valorEnBodega)}
              caption="Disponible para entregar o devolver"
              accent="var(--accent-jornadas)"
            />
          </>
        )}
      </div>

      <p className="text-muted small mb-0">
        Entregado es lo que salió en las recetas emitidas de esta jornada, con la cantidad corregida
        si se ajustó; una receta anulada no cuenta.
        {usaBodegaPrincipal &&
          " Esta jornada entrega de la bodega principal: no hay carga ni devolución."}
        {resumen.lotesSinCosto > 0 &&
          ` ${resumen.lotesSinCosto} lote(s) no tienen costo registrado y no se suman a los valores.`}
      </p>

      {error && (
        <Alert variant="danger" className="mb-0 py-2 px-3 small">
          No se pudo cargar el consumo: {error.mensaje}
        </Alert>
      )}

      <DataList
        columnas={columnas}
        datos={consumo.map((fila) => ({ ...fila, id: fila.loteId }))}
        cargando={cargando}
        vacio={
          usaBodegaPrincipal
            ? "Esta jornada todavía no ha entregado insumos en sus recetas."
            : "Esta jornada todavía no tiene insumos cargados ni entregados."
        }
      />
    </div>
  );
}
