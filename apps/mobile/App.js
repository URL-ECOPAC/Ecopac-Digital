import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // <-- IMPORTANTE
import {
  ESTADOS_DE_RESTAURACION,
  inicializarSupabase,
  intercambiarSesionDeRecuperacion,
} from "@ecopac/shared";

import { almacenamientoMovil } from "./src/almacenamiento";
import { JornadaActivaProvider } from "./src/contexto/JornadaActivaProvider";
import { RegistroSinGuardarProvider } from "./src/contexto/RegistroSinGuardarProvider";
import { SesionProvider, useSesionCompartida } from "./src/contexto/SesionProvider";
import AppNavigator from "./src/navigation/AppNavigator";
import NuevaContrasenaScreen from "./src/screens/NuevaContrasenaScreen";
import RestaurandoSesionScreen from "./src/screens/RestaurandoSesionScreen";

/**
 * Extrae el parametro `code` de un deep link de recuperacion (ecopac://recuperar?code=...).
 * exchangeCodeForSession() de supabase-js recibe solo el codigo, nunca la URL completa.
 */
function codigoDeRecuperacion(url) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("code");
  } catch {
    return null;
  }
}

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
  const [estaEnRecuperacion, setEstaEnRecuperacion] = useState(false);

  // Captura el enlace de recuperacion de contrasena (issue #644): en el navegador Supabase Auth
  // lo resuelve solo leyendo el fragmento de la URL, pero esa deteccion es exclusiva del
  // navegador (detectSessionInUrl en false para movil, ver packages/shared/api/cliente.js), asi
  // que aqui se captura el deep link a mano y se canjea el codigo por una sesion real.
  //
  // codigoYaProcesado evita canjear el mismo codigo dos veces: getInitialURL() y el listener
  // "url" pueden disparar los dos para el mismo enlace (por ejemplo si la app ya estaba abierta
  // y Linking reporta el ultimo intent recibido como "inicial" tambien), y un codigo PKCE es de
  // un solo uso -el segundo canje falla y, sin esta guarda, el error quedaba silencioso: la
  // pantalla de nueva contrasena se mostraba igual pero sin sesion real detras
  // ("Auth session missing!" al intentar guardar).
  useEffect(() => {
    let codigoYaProcesado = null;

    async function manejarUrl(url) {
      const codigo = codigoDeRecuperacion(url);
      if (!codigo || codigo === codigoYaProcesado) return;
      codigoYaProcesado = codigo;

      setEstaEnRecuperacion(true);
      const { error } = await intercambiarSesionDeRecuperacion(codigo);
      if (error) {
        console.error("No se pudo canjear el enlace de recuperacion:", error.mensaje);
        setEstaEnRecuperacion(false);
      }
    }

    Linking.getInitialURL().then(manejarUrl);
    const suscripcion = Linking.addEventListener("url", ({ url }) => manejarUrl(url));
    return () => suscripcion.remove();
  }, []);

  if (estaEnRecuperacion) {
    return <NuevaContrasenaScreen alTerminar={() => setEstaEnRecuperacion(false)} />;
  }

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
