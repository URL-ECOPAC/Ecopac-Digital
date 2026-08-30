import React from "react";
import ReactDOM from "react-dom/client";
import { inicializarSupabase } from "@ecopac/shared";
import App from "./App";
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
