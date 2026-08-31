import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { ESTADOS_DE_RESTAURACION, inicializarSupabase } from "@ecopac/shared";

import { almacenamientoMovil } from "./src/almacenamiento";
import { RegistroSinGuardarProvider } from "./src/contexto/RegistroSinGuardarProvider";
import { SesionProvider, useSesionCompartida } from "./src/contexto/SesionProvider";
import AppNavigator from "./src/navigation/AppNavigator";
import RestaurandoSesionScreen from "./src/screens/RestaurandoSesionScreen";

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
    <NavigationContainer>
      <AppNavigator haySesion={haySesion} />
    </NavigationContainer>
  );
}

// Componente principal App
export default function App() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <RegistroSinGuardarProvider>
          <Raiz />
        </RegistroSinGuardarProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}