import {
  COLUMNAS_CITAS_DEL_PACIENTE,
  ESTADOS_CITA_PARA_CHIP,
  filaDeCita,
  useCitasDelPaciente,
} from "@ecopac/shared";

import Card from "../components/Card";
import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";

// Las citas del paciente en su ficha (issue #927): las proximas -creadas o en atencion- y las
// pasadas. Clic en una abre su detalle, con Atender si corresponde (FlujoDeCita, en la ficha).
// Va dentro de Datos generales y no como una pestana mas: la #840 dejo la ficha en dos pestanas
// porque en el ancho de un telefono no caben mas.

const CATALOGOS = { estadoCita: ESTADOS_CITA_PARA_CHIP };

function ListaDeCitas({ titulo, citas, vacio, onAbrir }) {
  return (
    <>
      <p className="pac-rotulo mb-2">{titulo}</p>
      <div className="ec-tabla mb-3">
        <DataList
          columnas={COLUMNAS_CITAS_DEL_PACIENTE}
          datos={citas.map(filaDeCita)}
          catalogos={CATALOGOS}
          // La fila trae los textos para dibujar ("Sin asignar"); se abre la cita tal cual.
          onRowPress={(fila) => onAbrir(citas.find((cita) => cita.id === fila.id) ?? fila)}
          vacio={<EmptyState message={vacio} />}
        />
      </div>
    </>
  );
}

export default function CitasDelPaciente({ pacienteId, rol, onAbrir }) {
  const { proximas, pasadas, cargando, error, recargar, permitido } = useCitasDelPaciente(
    pacienteId,
    { rol },
  );

  if (!permitido) return null;

  return (
    <Card title="Citas">
      {error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : cargando && proximas.length === 0 && pasadas.length === 0 ? null : (
        <>
          <ListaDeCitas
            titulo="Próximas"
            citas={proximas}
            vacio="No tiene citas pendientes."
            onAbrir={onAbrir}
          />
          <ListaDeCitas
            titulo="Pasadas"
            citas={pasadas}
            vacio="Todavía no tiene citas atendidas ni canceladas."
            onAbrir={onAbrir}
          />
        </>
      )}
    </Card>
  );
}
