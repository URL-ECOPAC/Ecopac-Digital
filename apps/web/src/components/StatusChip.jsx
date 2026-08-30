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
 */

/** Misma transformacion que usa theme.js: las claves del enum llevan espacios. */
function variableDeEstado(status) {
  return `--estado-${String(status).replace(/ /g, "-")}`;
}

export default function StatusChip({ status, label }) {
  if (status === null || status === undefined || status === "") return null;

  // React no pinta booleanos: sin esto, un estado que llega como true (la columna 'estado' de
  // COLUMNAS_USUARIO lee el campo 'activo') dejaria la celda en blanco sin avisar de nada.
  const texto = label ?? String(status);

  return (
    <span
      className="badge rounded-pill"
      style={{
        backgroundColor: `var(${variableDeEstado(status)}, var(--color-secondary))`,
        color: "var(--color-surface)",
      }}
    >
      {texto}
    </span>
  );
}
