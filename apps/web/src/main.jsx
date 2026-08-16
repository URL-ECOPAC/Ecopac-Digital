import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { aplicarTokens } from './theme';

// Publica los tokens de diseno como custom properties antes del primer render, para que
// index.css y los componentes de react-bootstrap ya encuentren las variables resueltas.
aplicarTokens();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
