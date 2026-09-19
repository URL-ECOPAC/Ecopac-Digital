import { useState } from "react";
import { Dropdown } from "react-bootstrap";
import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useBuzonNotificaciones, useContadorNotificaciones } from "@ecopac/shared";

import ErrorState from "./ErrorState";
import ItemNotificacion from "./ItemNotificacion";
import "./notificaciones.css";

// Campana de la cabecera (issue #755). Al pulsarla se abre una ventana emergente con las
// notificaciones mas recientes, sin salir de la pantalla en la que se esta trabajando; desde ahi
// se abre una notificacion (se marca como leida y lleva a donde se resuelve) o se pasa a la
// ventana dedicada (/notificaciones), que es donde se filtra.
//
// El contador es el de no leidas de todo el buzon, en warning: pide atencion pero no bloquea nada
// (docs/DISENO.md). La lista solo se pide mientras la ventana esta abierta.

const RECIENTES = 6;

function ContenidoEmergente({ perfilId, onCerrar }) {
  const navigate = useNavigate();
  const { notificaciones, noLeidas, cargando, error, errorAccion, recargar, abrir, marcarTodas } =
    useBuzonNotificaciones({ perfilId });

  const alAbrir = async (notificacion) => {
    const marcada = await abrir(notificacion);
    if (!marcada) return;
    onCerrar();
    navigate(notificacion.enlace);
  };

  let lista;
  if (cargando && notificaciones.length === 0) {
    lista = <p className="notificaciones-emergente-vacio">Cargando...</p>;
  } else if (error) {
    lista = <ErrorState message={error.mensaje} onRetry={recargar} />;
  } else if (notificaciones.length === 0) {
    lista = <p className="notificaciones-emergente-vacio">No tienes notificaciones.</p>;
  } else {
    lista = (
      <ul className="notificacion-lista">
        {notificaciones.slice(0, RECIENTES).map((notificacion) => (
          <ItemNotificacion
            key={notificacion.id}
            notificacion={notificacion}
            onAbrir={alAbrir}
            compacto
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="notificaciones-emergente-cabecera">
        <p className="notificaciones-emergente-titulo">
          Notificaciones{noLeidas > 0 ? ` · ${noLeidas} sin leer` : ""}
        </p>
        {noLeidas > 0 && (
          <button type="button" className="notificaciones-emergente-accion" onClick={marcarTodas}>
            Marcar todas como leídas
          </button>
        )}
      </div>
      {errorAccion && <ErrorState message={errorAccion.mensaje} />}
      <div className="notificaciones-emergente-lista">{lista}</div>
      <div className="notificaciones-emergente-pie">
        <Link to="/notificaciones" onClick={onCerrar}>
          Ver todas las notificaciones
        </Link>
      </div>
    </>
  );
}

export default function CampanaNotificaciones({ perfilId }) {
  const [abierta, setAbierta] = useState(false);
  const { cantidad } = useContadorNotificaciones({ perfilId });

  return (
    <Dropdown align="end" show={abierta} onToggle={(siguiente) => setAbierta(siguiente)}>
      <Dropdown.Toggle
        as="button"
        type="button"
        bsPrefix="app-buzon"
        aria-label={
          cantidad > 0
            ? `Notificaciones: ${cantidad} sin leer`
            : "Notificaciones: sin notificaciones nuevas"
        }
        title="Notificaciones"
      >
        <Bell size={18} aria-hidden="true" />
        {cantidad > 0 && (
          <span className="app-buzon__contador" aria-hidden="true">
            {cantidad > 99 ? "99+" : cantidad}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu className="notificaciones-emergente">
        {abierta && <ContenidoEmergente perfilId={perfilId} onCerrar={() => setAbierta(false)} />}
      </Dropdown.Menu>
    </Dropdown>
  );
}
