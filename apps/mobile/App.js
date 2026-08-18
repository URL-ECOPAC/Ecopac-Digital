import { SafeAreaProvider } from 'react-native-safe-area-context';
import { inicializarSupabase, useSesion } from '@ecopac/shared';

import { almacenamientoMovil } from './src/almacenamiento';
import AppNavigator from './src/navigation/AppNavigator';
import RestaurandoSesionScreen from './src/screens/RestaurandoSesionScreen';

// El cliente de Supabase se crea una sola vez, aqui, con AsyncStorage como almacenamiento.
// Va en el ambito del modulo y no dentro del componente: no debe rehacerse en cada render
// ni depender de que un efecto llegue a ejecutarse.
//
// Si falta configuracion no se tumba la aplicacion, igual que en la web: el error se
// registra y las pantallas sin datos siguen navegables.
try {
  inicializarSupabase({ almacenamiento: almacenamientoMovil });
} catch (error) {
  console.error(
    'Supabase no se inicializo: la aplicacion arranca pero no habra datos.',
    error.message
  );
}

export default function App() {
  const { estadoRestauracion, haySesion } = useSesion();

  return (
    <SafeAreaProvider>
      {estadoRestauracion === 'cargando' ? (
        <RestaurandoSesionScreen />
      ) : (
        <AppNavigator haySesion={haySesion} />
      )}
    </SafeAreaProvider>
  );
}
