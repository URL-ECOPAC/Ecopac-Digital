import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // <-- IMPORTANTE
import { ESTADOS_DE_RESTAURACION, inicializarSupabase } from "@ecopac/shared";

import { almacenamientoMovil } from "./src/almacenamiento";
import { JornadaActivaProvider } from "./src/contexto/JornadaActivaProvider";
import { RegistroSinGuardarProvider } from "./src/contexto/RegistroSinGuardarProvider";
import { SesionProvider, useSesionCompartida } from "./src/contexto/SesionProvider";
import AppNavigator from "./src/navigation/AppNavigator";
import RestaurandoSesionScreen from "./src/screens/RestaurandoSesionScreen";

// Inicialización de Supabase
try {
  inicializarSupabase({ almacenamiento: almacenamientoMovil });
} catch (error) {
  console.error(
    "Supabase no se inicializo: la aplicacion arranca pero no habra datos.",
    error.message,
  );
}

// Componente interno Raiz
function Raiz() {
  const { estadoRestauracion, haySesion } = useSesionCompartida();

  return estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO ? (
    <RestaurandoSesionScreen />
  ) : (
    <AppNavigator haySesion={haySesion} />
  );
}

// Componente principal App
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SesionProvider>
          <JornadaActivaProvider>
            <RegistroSinGuardarProvider>
              <Raiz />
            </RegistroSinGuardarProvider>
          </JornadaActivaProvider>
        </SesionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
