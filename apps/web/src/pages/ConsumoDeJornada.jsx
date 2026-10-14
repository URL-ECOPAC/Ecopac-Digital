import { Alert } from "react-bootstrap";

import { formatearMoneda, useConsumoDeJornada } from "@ecopac/shared";

import { DataList, StatCard } from "../components";

// Pestana Consumo del detalle de una jornada (00178): lote por lote, lo que se cargo a su bodega
// movil, lo que se entrego en sus recetas, lo que espera aprobacion, lo que se devolvio (00179) y lo
// que le queda a la jornada (00186), con su valor. Con la bodega principal (00181) solo hay
// entregas. El calculo y los totales viven en useConsumoDeJornada(); aqui solo se dibuja.
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
              label="Le queda a la jornada"
              value={formatearMoneda(resumen.valorQueda)}
              caption="Cargado menos entregado y devuelto"
              accent="var(--accent-jornadas)"
            />
          </>
        )}
      </div>

      <p className="text-muted small mb-0">
        Entregado es lo que salió en las recetas emitidas de esta jornada, con la cantidad corregida
        si se ajustó; una receta anulada no cuenta.
        {resumen.unidadesPendientes > 0 &&
          ` ${resumen.unidadesPendientes} unidad(es) entregadas esperan que administración apruebe su salida: ya no se pueden recetar a nadie más.`}
        {!usaBodegaPrincipal &&
          resumen.unidadesDeOtros > 0 &&
          ` En la bodega hay además ${resumen.unidadesDeOtros} unidad(es) que no son de esta jornada (sobrante de otra jornada o lo que entró sin jornada).`}
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
