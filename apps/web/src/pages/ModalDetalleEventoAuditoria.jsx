import { Table } from "react-bootstrap";

import { diferenciaDeEvento, formatearFechaConHora } from "@ecopac/shared";

import Modal from "../components/Modal";

// Detalle de un evento de la bitacora de auditoria (issue #643). No hay tipo de columna para
// JSON en DataList (ver auditoria/columnas.js), asi que el detalle se resuelve aparte, en un
// modal, mismo patron que el "Ver Detalle" de HistorialDonacionesPage.jsx.
//
// diferenciaDeEvento() (auditoria/detalle.js) arma un diff legible en vez de mostrar el JSON
// crudo de valoresAnteriores/valoresNuevos: para una creacion o eliminacion lista los campos del
// registro, y para una actualizacion solo los campos que de verdad cambiaron -- releer veinte
// columnas iguales no es lo que alguien revisando la bitacora quiere ver primero.
//
// La tabla va envuelta en overflow-x: auto, mismo patron que DataList.jsx usa para la tabla
// principal: valores largos (UUID de fila, timestamps con zona horaria) no caben en una pantalla
// angosta, y sin este envoltorio quedaban cortados fuera del modal en vez de a la vista con
// scroll horizontal propio.
function TablaDeCampos({ tipo, campos }) {
  if (campos.length === 0) {
    return <p className="text-muted mb-0">No se detectaron cambios en los campos.</p>;
  }

  return (
    <div className="ec-tabla" style={{ overflowX: "auto" }}>
      <Table size="sm" className="mb-0 align-middle">
        <thead>
          <tr>
            <th>Campo</th>
            {tipo === "cambio" ? (
              <>
                <th>Antes</th>
                <th>Después</th>
              </>
            ) : (
              <th>Valor</th>
            )}
          </tr>
        </thead>
        <tbody>
          {campos.map((campo) => (
            <tr key={campo.clave}>
              <td className="text-nowrap">{campo.nombre}</td>
              {tipo === "cambio" ? (
                <>
                  <td className="text-muted text-nowrap">{campo.antes}</td>
                  <td className="text-nowrap">{campo.despues}</td>
                </>
              ) : (
                <td className="text-nowrap">{campo.valor}</td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

const TITULO_POR_TIPO = {
  creacion: "Datos del registro creado",
  eliminacion: "Datos del registro eliminado",
  cambio: "Campos que cambiaron",
};

export default function ModalDetalleEventoAuditoria({ evento, onClose }) {
  if (!evento) return null;

  const { tipo, campos } = diferenciaDeEvento(evento);

  return (
    <Modal visible onClose={onClose} title="Detalle del evento" size="lg">
      <p className="mb-1">
        <strong>{evento.tablaAfectada}</strong> · {evento.realizadoPorNombre} ·{" "}
        {formatearFechaConHora(evento.realizadoEn)}
      </p>
      <p className="pac-rotulo mb-3">
        Registro afectado: <span className="text-body">{evento.filaId}</span>
      </p>
      <p className="pac-rotulo mb-2">{TITULO_POR_TIPO[tipo]}</p>
      <TablaDeCampos tipo={tipo} campos={campos} />
    </Modal>
  );
}
