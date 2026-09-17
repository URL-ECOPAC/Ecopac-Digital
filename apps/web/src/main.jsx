import React from "react";
import ReactDOM from "react-dom/client";
import { inicializarSupabase, reportarError } from "@ecopac/shared";
import App from "./App";
import LimiteDeError from "./components/LimiteDeError";
import "./index.css";
import { almacenamientoWeb } from "./almacenamiento";
import { aplicarTokens } from "./theme";

// Publica los tokens de diseno como custom properties antes del primer render, para que
// index.css y los componentes de react-bootstrap ya encuentren las variables resueltas.
aplicarTokens();

// El cliente de Supabase se crea una sola vez, aqui, con el almacenamiento de esta
// plataforma. A partir de este punto cualquier modulo de shared puede pedirlo con
// obtenerSupabase() sin saber que corre en un navegador.
//
// Si falta configuracion no se tumba la aplicacion: el esqueleto tiene que seguir
// levantando sin credenciales de Supabase, como promete docs/QUICKSTART.md. El error se
// registra tal cual porque ya nombra la variable que falta y el archivo donde definirla.
try {
  inicializarSupabase({ almacenamiento: almacenamientoWeb });
} catch (error) {
  console.error(
    "Supabase no se inicializo: la aplicacion arranca pero no habra datos.",
    error.message,
  );
}

// Errores que no pasan por ningun `catch` ni por el limite de error de React: una excepcion en un
// manejador de eventos o en un setTimeout, y una promesa rechazada que nadie espero (issue #762).
// Antes solo llegaban a la consola del navegador de quien estuviera usando la pantalla. Pasan por
// reportarError(), que quita los datos de paciente antes de enviarlos a ningun sitio.
window.addEventListener("error", (evento) => {
  reportarError(evento.error ?? evento.message, {
    origen: "error-global",
    ruta: window.location.pathname,
  });
});

window.addEventListener("unhandledrejection", (evento) => {
  reportarError(evento.reason, {
    origen: "promesa-sin-capturar",
    ruta: window.location.pathname,
  });
});

// El limite exterior cubre lo que queda fuera del de MainLayout: el propio layout, el login y el
// enrutador. Sin rutas a mano, "Volver al inicio" recarga la raiz.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LimiteDeError
      ruta={window.location.pathname}
      onVolverAlInicio={() => window.location.assign("/")}
    >
      <App />
    </LimiteDeError>
  </React.StrictMode>,
);
