/**
 * Contenedor de pantalla. Envuelve toda pantalla de la app.
 *
 * Espejo de apps/mobile/src/components/ScreenContainer.js. En movil ademas evita que el
 * teclado tape los campos enfocados (KeyboardAvoidingView); en web el navegador ya lo
 * resuelve solo, asi que aqui es un contenedor con padding y nada mas.
 *
 * `scrollable` existe para mantener la misma firma en las dos plataformas: en web el scroll
 * del documento es el del navegador, y `false` solo sirve para pantallas con scroll interno
 * propio, como un tablero kanban.
 */
export default function ScreenContainer({
  children,
  scrollable = true,
  style,
  contentContainerStyle,
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-background)",
        height: scrollable ? undefined : "100%",
        overflow: scrollable ? undefined : "hidden",
        ...style,
      }}
    >
      <div style={{ padding: "var(--spacing-md)", ...contentContainerStyle }}>{children}</div>
    </div>
  );
}
