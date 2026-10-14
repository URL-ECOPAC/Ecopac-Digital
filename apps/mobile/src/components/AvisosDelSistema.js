/* global require */
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { colors } from "@ecopac/ui-tokens";
import {
  avisosDelSistema,
  listarNotificaciones,
  marcaMasReciente,
  notificacionesNuevasDesde,
} from "@ecopac/shared";

// Notificaciones del sistema del telefono (issue #755). No dibuja nada: cuando el contador de no
// leidas sube, pide la lista, se queda con las que llegaron despues de la ultima conocida y las
// muestra como notificacion del sistema. Tocar una abre la ventana de notificaciones.
//
// SON LOCALES, NO PUSH
//
// Las genera la propia app mientras esta abierta o recien pasada a segundo plano. Un push con la
// app cerrada exige un development build, credenciales de Firebase y el envio desde la Edge
// Function: Expo Go en Android no admite push remoto desde el SDK 53. Queda para otra issue.
//
// Lo que ya estaba en el buzon al abrir la app no se avisa: la primera carga solo fija la marca.
//
// NI SIQUIERA SE IMPORTA EN EXPO GO SOBRE ANDROID
//
// La documentacion de expo-notifications dice que las notificaciones locales funcionan en Expo Go.
// En el SDK 57 no es asi: al cargarse, el modulo registra el escucha de tokens de push, y en Expo
// Go sobre Android eso lanza (warnOfExpoGoPushUsage) y tumba la app entera antes de dibujar nada.
// Se comprobo en un telefono real al probar la #755. Por eso el modulo se carga con require()
// dentro de la funcion -Metro no lo evalua hasta que se llama- y solo fuera de ese caso: en Expo Go sobre Android la app funciona igual, sin avisos del
// sistema; en un development build o en una build de tienda, con ellos.

const CANAL_ANDROID = "notificaciones";

export const AVISOS_DISPONIBLES = !(Platform.OS === "android" && isRunningInExpoGo());

let modulo = null;
async function notificaciones() {
  if (!AVISOS_DISPONIBLES) return null;
  if (!modulo) {
    modulo = require("expo-notifications");
    modulo.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return modulo;
}

async function prepararPermisos() {
  const Notifications = await notificaciones();
  if (!Notifications) return false;
  // Android 8+ necesita el canal ANTES de pedir el permiso, o el sistema no muestra el dialogo.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: "Notificaciones de Ecopac Digital",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.primary,
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.status === "granted";
}

/**
 * @param {{ perfilId?: string, cantidad: number, onAbrir: () => void, onVolverAlFrente: () => void }} props
 */
export default function AvisosDelSistema({ perfilId, cantidad, onAbrir, onVolverAlFrente }) {
  const marca = useRef(undefined);
  const permitido = useRef(false);
  const cantidadAnterior = useRef(null);

  useEffect(() => {
    let vigente = true;
    prepararPermisos()
      .then((ok) => {
        if (vigente) permitido.current = ok;
      })
      .catch(() => {
        permitido.current = false;
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Primera carga: la marca es la notificacion mas reciente que ya existe, sin avisar de nada.
  useEffect(() => {
    if (!perfilId) return;
    let vigente = true;
    listarNotificaciones(perfilId).then((respuesta) => {
      if (vigente && !respuesta.error) marca.current = marcaMasReciente(respuesta.notificaciones);
    });
    return () => {
      vigente = false;
    };
  }, [perfilId]);

  useEffect(() => {
    const anterior = cantidadAnterior.current;
    cantidadAnterior.current = cantidad;
    if (anterior === null || cantidad <= anterior || !perfilId) return;
    if (marca.current === undefined) return;

    listarNotificaciones(perfilId).then(async (respuesta) => {
      if (respuesta.error) return;
      const Notifications = await notificaciones();
      const nuevas = notificacionesNuevasDesde(respuesta.notificaciones, marca.current);
      // Sin marca (el buzon estaba vacio al abrir) todo lo que haya ahora es nuevo.
      const aAvisar =
        marca.current === null ? respuesta.notificaciones.filter((n) => !n.leida) : nuevas;
      marca.current = marcaMasReciente(respuesta.notificaciones) ?? marca.current;
      if (!permitido.current || !Notifications) return;

      for (const aviso of avisosDelSistema(aAvisar)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: aviso.titulo, body: aviso.cuerpo },
          trigger: Platform.OS === "android" ? { channelId: CANAL_ANDROID } : null,
        });
      }
    });
  }, [cantidad, perfilId]);

  // Tocar la notificacion del sistema abre la ventana de notificaciones.
  useEffect(() => {
    let suscripcion = null;
    let vigente = true;
    notificaciones().then((Notifications) => {
      if (!vigente || !Notifications) return;
      suscripcion = Notifications.addNotificationResponseReceivedListener(() => onAbrir());
    });
    return () => {
      vigente = false;
      suscripcion?.remove();
    };
  }, [onAbrir]);

  // Al volver al frente se cuenta de nuevo, sin esperar al siguiente minuto del contador.
  useEffect(() => {
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") onVolverAlFrente();
    });
    return () => suscripcion.remove();
  }, [onVolverAlFrente]);

  return null;
}
