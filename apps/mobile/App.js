import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  ESTADOS_DE_RESTAURACION,
  inicializarSupabase,
  intercambiarSesionDeRecuperacion,
  puedeUsarAppMovil,
  reportarError,
} from "@ecopac/shared";
import { almacenamientoMovil } from "./src/almacenamiento";
import AvisoSinConexion from "./src/components/AvisoSinConexion";
import LimiteDeError from "./src/components/LimiteDeError";
import { useEnLinea } from "./src/useEnLinea";
import { JornadaActivaProvider } from "./src/contexto/JornadaActivaProvider";
import { RegistroSinGuardarProvider } from "./src/contexto/RegistroSinGuardarProvider";
import { SesionProvider, useSesionCompartida } from "./src/contexto/SesionProvider";
import AppNavigator from "./src/navigation/AppNavigator";
import AppSoloParaCampoScreen from "./src/screens/AppSoloParaCampoScreen";
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

// Inicializamos Supabase y guardamos si tuvo éxito
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

// Errores que no pasan por ningun `catch` ni por el limite de error de React: una excepcion en un
// manejador de eventos o en un temporizador (issue #762). Espejo del `window.addEventListener
// ("error")` de apps/web/src/main.jsx. Se reporta y despues se le pasa al manejador que ya estaba,
// que es el que muestra la pantalla roja en desarrollo y decide si un error fatal cierra la app:
// esto agrega un registro, no cambia el comportamiento.
const manejadorAnterior = globalThis.ErrorUtils?.getGlobalHandler?.();
globalThis.ErrorUtils?.setGlobalHandler?.((error, esFatal) => {
  reportarError(error, { origen: esFatal ? "error-global-fatal" : "error-global" });
  manejadorAnterior?.(error, esFatal);
});

function Raiz() {
  const { estadoRestauracion, haySesion, perfil } = useSesionCompartida();
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

  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return <RestaurandoSesionScreen />;
  }

  if (haySesion && perfil?.rol && !puedeUsarAppMovil(perfil.rol)) {
    return <AppSoloParaCampoScreen />;
  }

  return <AppNavigator haySesion={haySesion} />;
}

// Componente principal: NO renderiza nada hasta que Supabase esté listo
export default function App() {
  const [listo, setListo] = useState(supabaseListo);
  const enLinea = useEnLinea();

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

  // Mientras no esté listo → no monta los Providers
  if (!listo) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SesionProvider>
          <JornadaActivaProvider>
            <RegistroSinGuardarProvider>
              <AvisoSinConexion enLinea={enLinea} />
              <LimiteDeError>
                <Raiz />
              </LimiteDeError>
            </RegistroSinGuardarProvider>
          </JornadaActivaProvider>
        </SesionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
