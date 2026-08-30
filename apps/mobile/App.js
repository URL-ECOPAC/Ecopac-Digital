import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ESTADOS_DE_RESTAURACION, inicializarSupabase } from '@ecopac/shared';

import { almacenamientoMovil } from './src/almacenamiento';
import { SesionProvider, useSesionCompartida } from './src/contexto/SesionProvider';
import AppNavigator from './src/navigation/AppNavigator';
import RestaurandoSesionScreen from './src/screens/RestaurandoSesionScreen';
// 1. Simular import.meta.env para paquetes web (Vite) en entorno Expo/Metro
/* eslint-disable no-undef */
if (typeof globalThis.import === "undefined") {
  globalThis.import = { meta: { env: {} } };
} else if (!globalThis.import.meta?.env) {
  globalThis.import.meta = { env: {} };
}
/* eslint-enable no-undef */
// Mapear las variables EXPO_PUBLIC a import.meta.env
import.meta.env.VITE_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
import.meta.env.VITE_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
    'Supabase no se inicializo: la aplicacion arranca pero no habra datos.',
    error.message
  );
}

// 3. Componente interno Raiz
function Raiz() {
  const { estadoRestauracion, haySesion } = useSesionCompartida();

  return estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO ? (
    <RestaurandoSesionScreen />
  ) : (
    <AppNavigator haySesion={haySesion} />
  );
}

// 4. Componente principal App
export default function App() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <Raiz />
      </SesionProvider>
    </SafeAreaProvider>
  );
}