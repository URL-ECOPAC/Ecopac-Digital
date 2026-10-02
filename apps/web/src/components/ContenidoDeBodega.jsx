import { Badge, Spinner, Table } from "react-bootstrap";
import { formatearFechaCorta, formatearMoneda } from "@ecopac/shared";

import ErrorState from "./ErrorState";

/**
 * Lo que hay en una o varias bodegas, lote por lote (listarContenidoDeBodegas(), issue #911).
 *
 * Lo usan "Ver contenido" de Bodegas y la pestana Insumos de la jornada y del proyecto, que suman
 * lo que hay en la bodega de botiquin. `mostrarBodega` agrega la columna cuando la lista junta
 * varias bodegas. `conValor` agrega el costo unitario del lote y lo que vale lo que queda (00178):
 * solo donde el rol ve dinero, como las pestanas Insumos.
 */
export default function ContenidoDeBodega({
  contenido = [],
  cargando = false,
  error = null,
  vacio = "Esta bodega no tiene existencias.",
  mostrarBodega = false,
  conValor = false,
}) {
  if (cargando) {
    return (
      <p className="text-muted small text-center py-3 mb-0">
        <Spinner animation="border" size="sm" className="me-2" />
        Cargando existencias...
      </p>
    );
  }

  if (error) return <ErrorState message={error} />;

  if (contenido.length === 0) {
    return <p className="text-muted small text-center py-3 mb-0">{vacio}</p>;
  }

  const total = contenido.reduce((suma, fila) => suma + fila.cantidadDisponible, 0);
  const valorTotal = contenido.reduce((suma, fila) => suma + (fila.valor ?? 0), 0);
  const sinCosto = contenido.filter((fila) => fila.valor === null).length;

  return (
    <div className="ec-tabla">
      <Table size="sm" responsive className="mb-0 align-middle">
        <thead>
          <tr>
            <th>Artículo</th>
            {mostrarBodega && <th>Bodega</th>}
            <th>Lote</th>
            <th>Vence</th>
            <th className="text-end">Cantidad</th>
            {conValor && <th className="text-end">Costo unitario</th>}
            {conValor && <th className="text-end">Valor</th>}
          </tr>
        </thead>
        <tbody>
          {contenido.map((fila) => (
            <tr key={`${fila.loteId}|${fila.bodegaId}`}>
              <td>{fila.articulo}</td>
              {mostrarBodega && <td>{fila.bodega ?? "—"}</td>}
              <td>{fila.numeroLote ?? "—"}</td>
              <td>
                {fila.fechaVencimiento ? formatearFechaCorta(fila.fechaVencimiento) : "No vence"}
                {fila.vencido && (
                  <Badge bg="danger" className="ms-2">
                    Vencido
                  </Badge>
                )}
              </td>
              <td className="text-end">{fila.cantidadDisponible}</td>
              {conValor && (
                <td className="text-end">
                  {fila.costoUnitario === null ? "—" : formatearMoneda(fila.costoUnitario)}
                </td>
              )}
              {conValor && (
                <td className="text-end">
                  {fila.valor === null ? "Sin costo" : formatearMoneda(fila.valor)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={mostrarBodega ? 4 : 3}>Total</th>
            <th className="text-end">{total}</th>
            {conValor && <th />}
            {conValor && (
              <th className="text-end">
                {formatearMoneda(Math.round(valorTotal * 100) / 100)}
                {sinCosto > 0 && (
                  <span className="d-block small fw-normal text-muted">
                    {sinCosto === 1 ? "1 lote sin costo" : `${sinCosto} lotes sin costo`}
                  </span>
                )}
              </th>
            )}
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}
