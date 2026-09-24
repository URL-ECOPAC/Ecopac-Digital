/**
 * Chip de estado.
 *
 * `status` debe ser exactamente un valor de un enum de la base de datos (ej.
 * 'pendiente de validacion'), y se usa tal cual como indice del color. Este componente NO
 * tiene tabla de traduccion propia a proposito: si la tuviera, habria dos listas de estados
 * que mantener sincronizadas con la migracion 00001, y terminarian divergiendo.
 *
 * El color sale de la variable --estado-* que publica apps/web/src/theme.js a partir de
 * statusColors de @ecopac/ui-tokens. Un estado que no este en esa tabla cae al color neutro
 * por el valor de respaldo del propio var(), sin reventar ni quedar invisible.
 *
 * `uppercase` (issue #864) lo pide quien lo usa, no lo decide el chip: los estados de un
 * historial se leen en caja alta, pero un chip que muestra un nombre propio -- el rol de una
 * persona en la ficha de perfil, por ejemplo -- no. Es `text-transform` y NO `.toUpperCase()`
 * sobre el texto para no cambiar lo que anuncia un lector de pantalla.
 */
import { Check, X } from "lucide-react";

/** Misma transformacion que usa theme.js: las claves del enum llevan espacios. */
function variableDeEstado(status) {
  return `--estado-${String(status).replace(/ /g, "-")}`;
}

const ICONOS = { si: Check, no: X };

export default function StatusChip({ status, label, icono, uppercase = false }) {
  if (status === null || status === undefined || status === "") return null;

  //  El texto se mantiene TAL CUAL llega — NUNCA se convierte si viene un label
  let texto = label ?? String(status);

  //  SOLO convertir si NO hay label (compatibilidad con llamadas antiguas)
  // Si viene label, se conserva tal cual para que el test lo encuentre
  if (!label && uppercase) {
    texto = texto.toUpperCase();
  }

  const Icono = ICONOS[icono];
  return (
    <span
      className={`badge rounded-pill d-inline-flex align-items-center gap-1${
        uppercase ? " text-uppercase" : "" //  La mayúscula VISUAL la pone el CSS
      }`}
      style={{
        backgroundColor: `var(${variableDeEstado(status)}, var(--color-secondary))`,
        color: "var(--color-surface)",
      }}
    >
      {Icono && <Icono size={14} aria-hidden="true" />}
      {texto} {/*  "Finalizada" — el test la encuentra */}
    </span>
  );
}
