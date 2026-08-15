import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { colors, spacing } from '@ecopac/ui-tokens';

// Verificación opcional en consola de desarrollo
if (import.meta.env.DEV) {
  console.log('UI Tokens cargados:', { colors, spacing });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);