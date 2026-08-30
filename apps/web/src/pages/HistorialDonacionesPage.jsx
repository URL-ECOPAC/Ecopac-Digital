import { useHistorialDonaciones } from "@ecopac/shared";
import { Button, Input, Select, Card, Modal, Table } from "@ecopac/ui";

export default function HistorialDonacionesPage({
  usuarioRol,
  donacionesIniciales = [],
  proyectosOptions = [],
}) {
  const { tieneAccesoLectura, donaciones, totalesPorTipo, filtros, modalDetalle } =
    useHistorialDonaciones({ usuarioRol, donacionesIniciales });

  if (!tieneAccesoLectura) {
    return (
      <div className="p-4 text-red-600">
        Acceso denegado: No tiene permisos para consultar este módulo.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Historial de Donaciones Recibidas</h1>

      {/* Totales por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800">Total Económico</p>
          <p className="text-2xl font-bold text-blue-900">
            Q {totalesPorTipo.economica.toFixed(2)}
          </p>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <p className="text-sm font-medium text-green-800">Total Medicamentos</p>
          <p className="text-2xl font-bold text-green-900">
            {totalesPorTipo.medicamentos} unidades
          </p>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <p className="text-sm font-medium text-purple-800">Total Insumos / Bienes</p>
          <p className="text-2xl font-bold text-purple-900">{totalesPorTipo.insumos} ítems</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card title="Filtros de Búsqueda">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Buscar por donante..."
            value={filtros.filtroDonante}
            onChange={(e) => filtros.setFiltroDonante(e.target.value)}
          />

          <Select
            value={filtros.filtroTipo}
            onChange={(e) => filtros.setFiltroTipo(e.target.value)}
            options={[
              { label: "Todos los tipos", value: "" },
              { label: "Económica", value: "economica" },
              { label: "Medicamentos", value: "medicamentos" },
              { label: "Insumos", value: "insumos" },
            ]}
          />

          <Select
            value={filtros.filtroProyecto}
            onChange={(e) => filtros.setFiltroProyecto(e.target.value)}
            options={[{ label: "Todos los proyectos", value: "" }, ...proyectosOptions]}
          />

          <Input
            type="date"
            placeholder="Desde"
            value={filtros.fechaInicio}
            onChange={(e) => filtros.setFechaInicio(e.target.value)}
          />

          <Input
            type="date"
            placeholder="Hasta"
            value={filtros.fechaFin}
            onChange={(e) => filtros.setFechaFin(e.target.value)}
          />
        </div>

        <div className="flex justify-end mt-3">
          <Button variant="secondary" size="sm" onClick={filtros.limpiarFiltros}>
            Limpiar Filtros
          </Button>
        </div>
      </Card>

      {/* Tabla de Historial */}
      <Card title="Listado de Donaciones">
        <Table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
              <th className="p-3">Fecha</th>
              <th className="p-3">Donante</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Resumen Detalle</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {donaciones.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No se encontraron registros de donaciones con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              donaciones.map((d) => {
                const esAnulada = d.estado === "anulada";
                return (
                  <tr
                    key={d.id}
                    className={`border-b text-sm ${esAnulada ? "bg-red-50 text-gray-400 line-through" : "hover:bg-gray-50"}`}
                  >
                    <td className="p-3">{d.fecha}</td>
                    <td className="p-3 font-medium">{d.donante_nombre}</td>
                    <td className="p-3 capitalize">{d.tipo}</td>
                    <td className="p-3">{d.resumen || "-"}</td>
                    <td className="p-3 no-underline">
                      {esAnulada ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
                          Anulada
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right no-underline">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => modalDetalle.abrirDetalle(d)}
                      >
                        Ver Detalle
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* Modal de Detalle Completo */}
      {modalDetalle.modalDetalleAbierto && modalDetalle.donacionSeleccionada && (
        <Modal
          title={`Detalle de Donación #${modalDetalle.donacionSeleccionada.id}`}
          isOpen={modalDetalle.modalDetalleAbierto}
          onClose={modalDetalle.cerrarDetalle}
        >
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <strong>Donante:</strong> {modalDetalle.donacionSeleccionada.donante_nombre}
            </p>
            <p>
              <strong>Tipo:</strong> {modalDetalle.donacionSeleccionada.tipo}
            </p>
            <p>
              <strong>Fecha:</strong> {modalDetalle.donacionSeleccionada.fecha}
            </p>
            <p>
              <strong>Estado:</strong> {modalDetalle.donacionSeleccionada.estado}
            </p>

            {modalDetalle.donacionSeleccionada.estado === "anulada" && (
              <div className="p-3 bg-red-100 text-red-800 rounded-md">
                <p>
                  <strong>Motivo de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.motivo_anulacion || "No informado"}
                </p>
                <p>
                  <strong>Anulada por:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anulada_por || "-"}
                </p>
                <p>
                  <strong>Fecha de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anulada_en || "-"}
                </p>
              </div>
            )}

            <div className="border-t pt-2 mt-2">
              <h4 className="font-semibold mb-2">Renglones del Detalle:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {modalDetalle.donacionSeleccionada.detalles?.map((item, i) => (
                  <li key={i}>
                    {item.concepto} - Cantidad/Monto: {item.cantidad || item.monto}
                  </li>
                )) || <li>Sin detalles registrados</li>}
              </ul>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={modalDetalle.cerrarDetalle}>
              Cerrar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
