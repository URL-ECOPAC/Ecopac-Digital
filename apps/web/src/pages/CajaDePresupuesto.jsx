import { formatearMoneda, useCajaDePresupuesto } from "@ecopac/shared";

import { DataList, ErrorState, StatCard } from "../components";

// Pestana Caja de Presupuestos (00168): el sobrante de las jornadas que no vuelve a una donacion
// entra aqui al liquidarse, y sale cuando se asigna a otra jornada con origen "Caja".
export default function CajaDePresupuesto({ rol }) {
  const { saldo, movimientos, columnas, cargando, error, recargar } = useCajaDePresupuesto({
    rol,
  });

  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="ec-kpis">
        <StatCard
          label="En caja"
          value={cargando ? "—" : formatearMoneda(saldo ?? 0)}
          caption="Disponible para asignar a una jornada"
          accent="var(--accent-presupuestos)"
        />
      </div>
      <p className="text-muted small mb-0">
        Entra el sobrante de las jornadas que vino de fondos propios, de un aporte externo o sin
        clasificar: lo que vino de una donación vuelve a la donación. Sale al registrar un aporte
        con origen &quot;Caja&quot; en el presupuesto de una jornada.
      </p>
      <DataList
        columnas={columnas}
        datos={movimientos}
        cargando={cargando}
        vacio="La caja todavía no tiene movimientos."
      />
    </div>
  );
}
