import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ESTADOS_DE_RESTAURACION, inicializarSupabase } from '@ecopac/shared';

import { almacenamientoMovil } from './src/almacenamiento';
import { RegistroSinGuardarProvider } from './src/contexto/RegistroSinGuardarProvider';
import { SesionProvider, useSesionCompartida } from './src/contexto/SesionProvider';
import AppNavigator from './src/navigation/AppNavigator';
import RestaurandoSesionScreen from './src/screens/RestaurandoSesionScreen';

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