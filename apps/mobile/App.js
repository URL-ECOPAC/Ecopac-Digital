import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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

function codigoDeRecuperacion(url) {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("code");
  } catch {
    return null;
  }
}

// ✅ Inicializamos Supabase y guardamos si tuvo éxito
let supabaseListo = false;
try {
  inicializarSupabase({ almacenamiento: almacenamientoMovil });
  supabaseListo = true;
} catch (error) {
  console.error(
    "Supabase no se inicializo: la aplicacion arranca pero no habra datos.",
    error.message,
  );
}

function Raiz() {
  const { estadoRestauracion, haySesion } = useSesionCompartida();
  const [estaEnRecuperacion, setEstaEnRecuperacion] = useState(false);

  useEffect(() => {
    let codigoYaProcesado = null;
    async function manejarUrl(url) {
      const codigo = codigoDeRecuperacion(url);
      if (!codigo || codigo === codigoYaProcesado) return;
      codigoYaProcesado = codigo;
      setEstaEnRecuperacion(true);
      const { error } = await intercambiarSesionDeRecuperacion(codigo);
      if (error) {
        console.error("No se pudo canjear el enlace:", error.mensaje);
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

// ✅ Componente principal: NO renderiza nada hasta que Supabase esté listo
export default function App() {
  const [listo, setListo] = useState(supabaseListo);

  useEffect(() => {
    if (!listo) {
      try {
        inicializarSupabase({ almacenamiento: almacenamientoMovil });
        setListo(true);
      } catch {
        console.warn("Reintentando inicialización...");
      }
    }
  }, [listo]);

  // ⏳ Mientras no esté listo → no monta los Providers
  if (!listo) {
    return null;
  }

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