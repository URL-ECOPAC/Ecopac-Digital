import {
  BarChart3,
  Calendar,
  DollarSign,
  FolderKanban,
  HeartHandshake,
  History,
  Home,
  Package,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

// Los diez nombres de MODULOS[].icono (navegacion.js) mapeados a su componente real. Se listan
// a mano -en vez de un `import * as Icons` sobre todo el paquete- porque son un conjunto fijo, y
// evita que el bundle arrastre iconos que el sistema no usa.
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
  ShieldCheck,
  History,
};

/**
 * Icono de un modulo por su nombre (issue #756). MODULOS[].icono ya declaraba nombres identicos
 * a los de lucide-react ("Home", "Package", ...), pero hasta esta issue ningun componente los
 * leia: la pagina de inicio y el menu lateral se dibujaban con solo el nombre del modulo.
 */
export default function IconoModulo({ nombre, ...props }) {
  const Icono = ICONOS[nombre];
  if (!Icono) return null;
  return <Icono aria-hidden="true" {...props} />;
}
