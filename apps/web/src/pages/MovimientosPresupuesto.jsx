import { useEjecucionPresupuestal } from "@ecopac/shared";

export default function MovimientosPresupuesto() {
  const { proyectos, gastos, cargando, error } = useEjecucionPresupuestal();

  if (cargando) return <p className="text-center p-4">Cargando movimientos...</p>;
  if (error) return <p className="text-center p-4 text-danger">Error al cargar movimientos.</p>;

  const totalAsignado = proyectos.reduce((sum, p) => sum + (p.montoAsignado || 0), 0);
  const totalGastado = gastos
    .filter(g => g.estado === "aprobado")
    .reduce((sum, g) => sum + (g.monto || 0), 0);
  const saldo = totalAsignado - totalGastado;

  return (
    <div className="p-3">
      <h3 className="h5 mb-3">Origen y destino de fondos</h3>

      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card p-3 h-100">
            <p className="text-muted small mb-1">Fondos asignados</p>
            <p className="h4 fw-bold text-primary">Q {totalAsignado.toFixed(2)}</p>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card p-3 h-100">
            <p className="text-muted small mb-1">Total gastado (aprobado)</p>
            <p className="h4 fw-bold text-danger">Q {totalGastado.toFixed(2)}</p>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card p-3 h-100">
            <p className="text-muted small mb-1">Saldo disponible</p>
            <p className={`h4 fw-bold ${saldo >= 0 ? "text-success" : "text-danger"}`}>
              Q {saldo.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <h4 className="h6 mb-2">Gastos por categoría</h4>
      <ul className="list-group mb-3">
        {Object.entries(
          gastos.reduce((agrupado, g) => {
            if (g.estado !== "aprobado") return agrupado;
            agrupado[g.categoria] = (agrupado[g.categoria] || 0) + (g.monto || 0);
            return agrupado;
          }, {})
        ).map(([cat, monto]) => (
          <li key={cat} className="list-group-item d-flex justify-content-between">
            <span>{cat}</span>
            <strong>Q {monto.toFixed(2)}</strong>
          </li>
        ))}
      </ul>

      <h4 className="h6 mb-2">Gastos pendientes de aprobación</h4>
      <ul className="list-group">
        {gastos.filter(g => g.estado === "pendiente").length === 0 ? (
          <li className="list-group-item text-muted">Sin gastos pendientes</li>
        ) : (
          gastos
            .filter(g => g.estado === "pendiente")
            .map(g => (
              <li key={g.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <strong>{g.concepto}</strong>
                  <span className="badge bg-secondary ms-2 text-uppercase">{g.estado}</span>
                  <p className="mb-0 small text-muted">{g.jornada?.nombre} · {g.fecha}</p>
                </div>
                <strong>Q {g.monto?.toFixed(2)}</strong>
              </li>
            ))
        )}
      </ul>
    </div>
  );
}