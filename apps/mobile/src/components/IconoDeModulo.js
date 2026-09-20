import { Ionicons } from "@expo/vector-icons";

/**
 * El icono de un modulo, a partir del nombre que declara packages/shared/navegacion.js.
 *
 * POR QUE EXISTE (issue #700)
 *
 * La tab bar dibujaba cinco glifos sueltos escritos a mano: dos emoji -el de calendario y el de
 * caja-, el simbolo de casa "⌂", el engranaje "⚙" y, para Pacientes, "𐀔", que es un IDEOGRAMA
 * LINEAL B (U+10014).
 * Ese ultimo no es un icono: es un caracter de una escritura del segundo milenio antes de Cristo
 * que casi ninguna fuente de Android trae, asi que en el telefono se veia como un glifo roto.
 *
 * Mientras tanto `navegacion.js` ya declaraba un `icono` por modulo -"Home", "Users", "Calendar",
 * "Package"...- que **no consumia nadie**. Este componente le da uso: traduce ese vocabulario al
 * set de Ionicons que trae @expo/vector-icons.
 *
 * La traduccion vive aqui y no en shared porque elegir un set de iconos es una decision de la
 * plataforma, y shared no devuelve JSX (docs/ARQUITECTURA-FRONTEND.md). La web, que hoy dibuja sus
 * iconos como SVG en linea, puede mapear los mismos nombres a su manera sin tocar esto.
 */
const ICONOS = {
  Home: "home-outline",
  Users: "people-outline",
  HeartHandshake: "heart-circle-outline",
  Package: "cube-outline",
  DollarSign: "cash-outline",
  FolderKanban: "albums-outline",
  BarChart3: "bar-chart-outline",
  Calendar: "calendar-outline",
  UserCheck: "person-circle-outline",
  // Matriz de permisos por rol (issue #638): soloWeb, nunca aparece en la tab bar movil, pero
  // esta prueba exige traduccion para todo MODULOS[].icono sin excepcion (ver su propio
  // comentario mas abajo).
  ShieldCheck: "shield-checkmark-outline",
  // Bitacora de auditoria (issue #643): soloWeb, nunca aparece en la tab bar movil, pero esta
  // prueba exige traduccion para todo MODULOS[].icono sin excepcion (ver su propio comentario).
  History: "time-outline",
  // Ajustes no es un modulo de navegacion.js -no aparece en MODULOS- pero si es una tab.
  Settings: "settings-outline",
  // Tampoco es un modulo: la campana de notificaciones de la cabecera (issue #755).
  Bell: "notifications-outline",
};

/** El que se usa si llega un nombre sin traduccion, para no dejar la tab sin icono. */
const POR_DEFECTO = "ellipse-outline";

export function nombreDeIcono(nombre) {
  return ICONOS[nombre] ?? POR_DEFECTO;
}

export { ICONOS };

export default function IconoDeModulo({ nombre, color, size = 22 }) {
  return <Ionicons name={nombreDeIcono(nombre)} color={color} size={size} />;
}
