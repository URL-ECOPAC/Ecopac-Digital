import { useNavigation, useRoute } from "@react-navigation/native";

import { permisosDeFicha } from "@ecopac/shared";

import { ErrorState, ScreenContainer } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";
import VisitasPacienteSeccion from "./ficha-paciente/VisitasPacienteSeccion";

/**
 * El historial clinico de un paciente a pantalla completa. Desde la #840 es la misma lista de
 * visitas que la pestana de la ficha -cada visita con sus signos, su consulta y su receta-, no la
 * linea de eventos sueltos que era antes.
 */
export default function HistorialPacienteScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;

  if (!permisosDeFicha(rol).puedeVerDatosClinicos) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Tu rol no puede ver el historial clínico." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <VisitasPacienteSeccion
        pacienteId={pacienteId}
        rol={rol}
        onAbrirConsulta={(visita) =>
          navigation.navigate(ROUTES.CONSULTA, { pacienteId, jornadaId: visita.jornadaId })
        }
      />
    </ScreenContainer>
  );
}
