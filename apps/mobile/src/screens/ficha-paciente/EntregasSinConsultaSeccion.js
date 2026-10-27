import {
  COLUMNAS_ENTREGAS_SIN_CONSULTA,
  OPCIONES_ESTADO_MOVIMIENTO,
  useEntregasSinConsultaPaciente,
} from "@ecopac/shared";

import { Card, DataList, ErrorState } from "../../components";

/**
 * Lo que se le entrego o vendio al paciente sin pasar a consulta (issue #964, 00191). Espejo de
 * apps/web/src/pages/EntregasSinConsultaPaciente.jsx: sin ninguna entrega, no se dibuja.
 */
export default function EntregasSinConsultaSeccion({ pacienteId, rol }) {
  const { entregas, visible, cargando, error, recargar } = useEntregasSinConsultaPaciente(
    pacienteId,
    { rol },
  );

  if (!visible || (!cargando && !error && entregas.length === 0)) return null;

  return (
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
  );
}
