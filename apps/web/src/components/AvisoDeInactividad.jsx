import { Modal as ModalBootstrap } from "react-bootstrap";
import { Clock } from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Aviso de cierre de sesion por inactividad, con cuenta regresiva.
 *
 * No se puede cerrar con Escape ni tocando fuera (`backdrop="static"`): lo unico que apaga el aviso
 * es una decision -seguir conectado o salir ya-. Un aviso que se descarta con un roce dejaria la
 * sesion abierta sin que nadie lo haya leido, que es justo lo que este aviso tiene que evitar en
 * una laptop olvidada en una jornada.
 */
export default function AvisoDeInactividad({ visible, segundosRestantes, onSeguir, onSalir }) {
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");

  return (
    <ModalBootstrap
      show={visible}
      onHide={onSeguir}
      backdrop="static"
      keyboard={false}
      centered
      aria-labelledby="aviso-inactividad-titulo"
    >
      <ModalBootstrap.Header>
        <ModalBootstrap.Title
          as="h2"
          className="h5 d-flex align-items-center gap-2"
          id="aviso-inactividad-titulo"
        >
          <Clock size={20} aria-hidden="true" />
          Tu sesión está por cerrarse
        </ModalBootstrap.Title>
      </ModalBootstrap.Header>
      <ModalBootstrap.Body>
        <p className="mb-2">
          No hubo actividad en un buen rato. Por seguridad, la sesión se cerrará sola para que nadie
          pueda ver expedientes desde este equipo.
        </p>
        <p className="ec-numero-ficha text-center mb-0" role="timer" aria-live="polite">
          {minutos}:{segundos}
        </p>
      </ModalBootstrap.Body>
      <ModalBootstrap.Footer>
        <SecondaryButton title="Cerrar sesión ahora" variant="neutra" onClick={onSalir} />
        <PrimaryButton title="Seguir conectado" onClick={onSeguir} />
      </ModalBootstrap.Footer>
    </ModalBootstrap>
  );
}
