import { SafeAreaProvider } from "react-native-safe-area-context";
import { ESTADOS_DE_RESTAURACION, inicializarSupabase } from "@ecopac/shared";

import { almacenamientoMovil } from "./src/almacenamiento";
import { RegistroSinGuardarProvider } from "./src/contexto/RegistroSinGuardarProvider";
import { SesionProvider, useSesionCompartida } from "./src/contexto/SesionProvider";
import AppNavigator from "./src/navigation/AppNavigator";
import RestaurandoSesionScreen from "./src/screens/RestaurandoSesionScreen";
// Aqui vivia un intento de simular `import.meta.env` para reutilizar la lectura de entorno
// de Vite. No podia funcionar y ademas tumbaba la app entera al arrancar: `import.meta` es
// sintaxis, no una propiedad de globalThis, asi que asignar `globalThis.import` no la crea,
// y Hermes evaluaba `import.meta.env.VITE_SUPABASE_URL = ...` contra undefined. El error era
// "[runtime not ready]: TypeError: Cannot set property 'VITE_SUPABASE_URL' of undefined" y
// aparecia antes de dibujar la primera pantalla.
//
// No hace falta nada en su lugar: packages/shared/entorno/fuente.native.js ya lee
// process.env.EXPO_PUBLIC_* escrito completo, que es lo unico que Metro sabe reemplazar al
// empaquetar. La regla del repositorio sigue siendo que nadie mas lea una variable de entorno
// por su cuenta: se pide por obtenerEntorno().

// El cliente de Supabase se crea una sola vez, aqui, con AsyncStorage como almacenamiento.
// Va en el ambito del modulo y no dentro del componente: no debe rehacerse en cada render
// ni depender de que un efecto llegue a ejecutarse.
//
// Si falta configuracion no se tumba la aplicacion, igual que en la web: el error se
// registra y las pantallas sin datos siguen navegables.
// Inicialización de Supabase con URL y AnonKey pasadas explícitamente
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
    <SafeAreaProvider>
      <SesionProvider>
        <RegistroSinGuardarProvider>
          <Raiz />
        </RegistroSinGuardarProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
