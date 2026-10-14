import { ESTADOS_DE_GASTO, formatearMoneda, useEjecucionPresupuestal } from "@ecopac/shared";

import StatusChip from "../components/StatusChip";

// Pestana "Movimientos" de Presupuestos: a que se fue el dinero aprobado y que esta esperando
// aprobacion.
//
// Tenia arriba tres tarjetas -fondos asignados, total gastado, saldo- que no cuadraban: el
// asignado leia `montoAsignado` de cada proyecto, un campo que la consulta nunca trajo, asi que
// valia 0 y el saldo salia negativo con el primer gasto. El presupuesto se asigna por jornada (la
// suma de sus aportes, 00135), no aqui; la comparacion asignado/ejecutado ya esta en "Resumen",
// por proyecto. Se retiraron.
export default function MovimientosPresupuesto() {
  const { gastos, cargando, error } = useEjecucionPresupuestal();

  if (cargando) return <p className="text-center p-4">Cargando movimientos...</p>;
  if (error) return <p className="text-center p-4 text-danger">Error al cargar movimientos.</p>;

  const aprobados = gastos.filter((gasto) => gasto.estado === ESTADOS_DE_GASTO.APROBADO);
  const pendientes = gastos.filter((gasto) => gasto.estado === ESTADOS_DE_GASTO.PENDIENTE);
  const porCategoria = Object.entries(
    aprobados.reduce((agrupado, gasto) => {
      agrupado[gasto.categoria] = (agrupado[gasto.categoria] || 0) + (Number(gasto.monto) || 0);
      return agrupado;
    }, {}),
  );

  return (
    <div className="p-3">
      <h3 className="h6 mb-2">Gastos aprobados por categoría</h3>
      <ul className="list-group mb-4">
        {porCategoria.length === 0 ? (
          <li className="list-group-item text-muted">Todavía no hay gastos aprobados.</li>
        ) : (
          porCategoria.map(([categoria, monto]) => (
            <li key={categoria} className="list-group-item d-flex justify-content-between">
              <span>{categoria}</span>
              <strong>{formatearMoneda(monto)}</strong>
            </li>
          ))
        )}
      </ul>

      <h3 className="h6 mb-2">Gastos pendientes de aprobación</h3>
      <ul className="list-group">
        {pendientes.length === 0 ? (
          <li className="list-group-item text-muted">Sin gastos pendientes</li>
        ) : (
          pendientes.map((gasto) => (
            <li
              key={gasto.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div>
                <strong>{gasto.concepto}</strong>
                <span className="ms-2">
                  <StatusChip status={gasto.estado} />
                </span>
                <p className="mb-0 small text-muted">
                  {[gasto.jornada?.nombre, gasto.fecha].filter(Boolean).join(" · ")}
                </p>
              </div>
              <strong>{formatearMoneda(gasto.monto)}</strong>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
