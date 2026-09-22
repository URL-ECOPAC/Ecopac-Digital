// Boton de mostrar/ocultar que se pasa como rightAdornment de AuthField en campos de contrasena.
//
// ISSUE #864: era el texto "Mostrar"/"Ocultar". Pasa al icono de ojo, que es lo que la issue
// pide y lo que ya usa PasswordField en las pantallas de adentro; asi el gesto es el mismo en
// todo el sistema. El texto no se pierde: viaja en `aria-label`, que es lo que lee un lector de
// pantalla, y el estado va en `aria-pressed`.
//
// El color tambien cambia: decia "#16A34A" escrito a mano -- un verde de Tailwind que no es
// ninguno de los cuatro del logo -- y pasa a var(--color-primary). Es un cambio de color
// deliberado, asi que la linea base de scripts/paleta-linea-base.json se recaptura con
// `npm run verificar:paleta -- --capturar` y el diff queda como registro.

import { Eye, EyeOff } from "lucide-react";

export default function AuthPasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
      style={{
        alignItems: "center",
        color: visible ? "var(--color-primary)" : "var(--color-text-muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
        display: "flex",
        padding: "4px",
        userSelect: "none",
      }}
    >
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  );
}
