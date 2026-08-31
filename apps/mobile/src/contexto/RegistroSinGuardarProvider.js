import { createContext, useCallback, useContext, useRef } from "react";

/**
 * Registro cross-pantalla de formularios con cambios sin guardar (issue #110, criterio 2).
 *
 * POR QUE HACE FALTA. El boton de cerrar sesion vive en el tab Ajustes; el formulario que
 * puede tener algo sin guardar (por ejemplo Triaje) vive en otro tab hermano. React Navigation
 * no desmonta las pantallas al cambiar de tab (unmountOnBlur es false por defecto: verificado
 * en AppNavigator, ningun Tabs.Screen lo activa), asi que el estado del formulario sigue vivo,
 * pero Ajustes no tiene forma de leerlo directo -son subarboles hermanos, no hay props que
 * bajen de uno a otro-. Este contexto es el puente: una pantalla se anuncia sucia o limpia, y
 * quien va a cerrar sesion pregunta antes de hacerlo.
 *
 * CONTRATO IMPLICITO. Una pantalla de formulario que nunca llama a registrar()/desregistrar()
 * queda automaticamente fuera de la confirmacion: nada falla ni avisa, simplemente su estado
 * sin guardar no cuenta para hayAlgoSinGuardar(). Cada pantalla nueva con un formulario que
 * quiera participar tiene que registrarse explicitamente (ver TriajeScreen.js para el patron).
 *
 * No usa useState para el conjunto de pantallas sucias a proposito: registrar/desregistrar
 * pasa en cada tecla que se escribe en un formulario, y si eso disparara un render de todo lo
 * que cuelga de este proveedor (potencialmente la app entera) seria un re-render por caracter
 * tipeado en una pantalla que ni siquiera es Ajustes. hayAlgoSinGuardar() se consulta bajo
 * demanda -al tocar "Cerrar sesion"-, no de forma reactiva.
 */
const ContextoDeRegistroSinGuardar = createContext(null);

export function RegistroSinGuardarProvider({ children }) {
  const pantallasSucias = useRef(new Set());

  const registrar = useCallback((id) => {
    pantallasSucias.current.add(id);
  }, []);

  const desregistrar = useCallback((id) => {
    pantallasSucias.current.delete(id);
  }, []);

  const hayAlgoSinGuardar = useCallback(() => pantallasSucias.current.size > 0, []);

  // Objeto estable entre renders: registrar/desregistrar/hayAlgoSinGuardar ya son estables
  // (useCallback con [] de dependencias), asi que este ref evita recrear el value del
  // Provider -y con eso, re-renderizar a sus consumidores- en cada render de quien lo monta.
  const valor = useRef({ registrar, desregistrar, hayAlgoSinGuardar }).current;

  return (
    <ContextoDeRegistroSinGuardar.Provider value={valor}>
      {children}
    </ContextoDeRegistroSinGuardar.Provider>
  );
}

/** Registrar/desregistrar una pantalla de formulario, y consultar si hay algo sin guardar. */
export function useRegistroSinGuardar() {
  const contexto = useContext(ContextoDeRegistroSinGuardar);

  if (contexto === null) {
    throw new Error("useRegistroSinGuardar() se llamo fuera de <RegistroSinGuardarProvider>.");
  }

  return contexto;
}
