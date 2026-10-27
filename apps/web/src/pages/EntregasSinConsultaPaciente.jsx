import {
  COLUMNAS_ENTREGAS_SIN_CONSULTA,
  OPCIONES_ESTADO_MOVIMIENTO,
  useEntregasSinConsultaPaciente,
} from "@ecopac/shared";

import Card from "../components/Card";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";

// Lo que se le entrego o vendio al paciente sin pasar a consulta (issue #964, 00191): las salidas
// de Inventario con motivo "Entrega o venta a paciente". Lo de una consulta esta en su receta,
// dentro de la visita. Sin ninguna, la seccion no se dibuja: la mayoria de pacientes no tiene.
export default function EntregasSinConsultaPaciente({ pacienteId, rol }) {
  const { entregas, visible, cargando, error, recargar } = useEntregasSinConsultaPaciente(
    pacienteId,
    { rol },
  );

  if (!visible || (!cargando && !error && entregas.length === 0)) return null;

  return (
    <div className="mt-3">
      <Card
        title="Medicamentos entregados sin consulta"
        subtitle="Salidas de inventario a este paciente: compras o entregas sin pasar a consulta."
      >
        {error ? (
          <ErrorState message={error.mensaje} onRetry={recargar} />
        ) : (
          <DataList
            columnas={COLUMNAS_ENTREGAS_SIN_CONSULTA}
            datos={entregas}
            cargando={cargando}
            catalogos={{ estadosMovimiento: OPCIONES_ESTADO_MOVIMIENTO }}
          />
        )}
      </Card>
    </div>
  );
}
