// Boton "Mostrar/Ocultar" que se pasa como rightAdornment de AuthField en campos de contrasena.

export default function AuthPasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{
        fontSize: "var(--texto-xs)",
        fontWeight: "var(--peso-semibold)",
        color: "#16A34A",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        userSelect: "none",
      }}
    >
      {visible ? "Ocultar" : "Mostrar"}
    </button>
  );
}
