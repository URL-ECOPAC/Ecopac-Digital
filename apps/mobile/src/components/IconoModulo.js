// Cada icono se importa de su propio archivo (lucide-react-native/icons/<nombre-en-kebab>) y no
// del paquete completo: ese barril re-exporta los mas de 1500 iconos de la libreria, y
// construirlo entero en cada archivo de prueba (jest no comparte el registro de modulos entre
// test files) fue lo que disparo los tiempos de la suite movil de segundos a mas de un minuto
// por archivo. El nombre de archivo es el nombre canonico del icono en kebab-case, que no
// siempre coincide con el alias que usa MODULOS[].icono (navegacion.js): "Home" es un alias de
// "House", y "BarChart3" lo es de "ChartColumn".
import Calendar from "lucide-react-native/icons/calendar";
import BarChart3 from "lucide-react-native/icons/chart-column";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import FolderKanban from "lucide-react-native/icons/folder-kanban";
import HeartHandshake from "lucide-react-native/icons/heart-handshake";
import Home from "lucide-react-native/icons/house";
import Package from "lucide-react-native/icons/package";
import UserCheck from "lucide-react-native/icons/user-check";
import Users from "lucide-react-native/icons/users";

// Espejo de apps/web/src/components/IconoModulo.jsx: los mismos nueve nombres de
// MODULOS[].icono (navegacion.js), mapeados a mano al componente real de lucide-react-native.
const ICONOS = {
  Home,
  Users,
  HeartHandshake,
  Package,
  DollarSign,
  FolderKanban,
  BarChart3,
  Calendar,
  UserCheck,
};

/**
 * Icono de un modulo por su nombre (issue #756). Mismo hueco que en web: MODULOS[].icono ya
 * declaraba nombres identicos a los de lucide, pero ninguna pantalla movil los leia -la de
 * inicio pintaba solo un punto de color por modulo (cardDot en InicioScreen.js).
 */
export default function IconoModulo({ nombre, size = 20, color, ...props }) {
  const Icono = ICONOS[nombre];
  if (!Icono) return null;
  return <Icono size={size} color={color} {...props} />;
}
