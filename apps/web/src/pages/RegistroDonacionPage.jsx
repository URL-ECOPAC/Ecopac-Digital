import { useRegistroDonacion } from "@ecopac/shared";
import { Button, Input, Select, Card, Modal } from "@ecopac/ui";

export default function RegistroDonacionPage({
  client,
  usuarioRol,
  donantesOptions = [],
  proyectosOptions = [],
}) {
  const {
    permisos,
    tipoDonacion,
    setTipoDonacion,
    donanteId,
    setDonanteId,
    proyectoId,
    setProyectoId,
    fecha,
    setFecha,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    modalNuevoDonante,
    setModalNuevoDonante,
    ofrecerIngresoInventario,
    setOfrecerIngresoInventario,
    resumenRegistro,
    guardando,
    guardarDonacion,
  } = useRegistroDonacion({ client, usuarioRol });

  if (!permisos.tieneAccesoLectura) {
    return (
      <div className="p-4 text-red-600">
        Acceso denegado: No tiene permisos para consultar este módulo.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Registro de Donación</h1>

      {!permisos.puedeEscribir && (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md">
          Modo de solo lectura: Únicamente el rol Administrador puede registrar donaciones.
        </div>
      )}

      <Card title="Información General">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Donación</label>
            <Select
              disabled={!permisos.puedeEscribir}
              value={tipoDonacion}
              onChange={(e) => setTipoDonacion(e.target.value)}
              options={[
                { label: "Económica", value: "economica" },
                { label: "Medicamentos", value: "medicamentos" },
                { label: "Insumos / Bienes", value: "insumos" },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <Input
              type="date"
              disabled={!permisos.puedeEscribir}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">Donante</label>
              {permisos.puedeEscribir && (
                <button
                  type="button"
                  onClick={() => setModalNuevoDonante(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Nuevo Donante
                </button>
              )}
            </div>
            <Select
              disabled={!permisos.puedeEscribir}
              value={donanteId}
              onChange={(e) => setDonanteId(e.target.value)}
              options={donantesOptions}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Proyecto Asociado</label>
            <Select
              disabled={!permisos.puedeEscribir}
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              options={proyectosOptions}
            />
          </div>
        </div>
      </Card>

      <Card title="Detalle de la Donación">
        {detalles.map((item) => (
          <div key={item.id} className="flex gap-4 items-center mb-3">
            {tipoDonacion === "economica" && (
              <>
                <Input
                  placeholder="Concepto / Observación"
                  disabled={!permisos.puedeEscribir}
                  value={item.concepto}
                  onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Monto"
                  disabled={!permisos.puedeEscribir}
                  value={item.monto}
                  onChange={(e) => actualizarRenglon(item.id, "monto", e.target.value)}
                />
              </>
            )}

            {tipoDonacion === "medicamentos" && (
              <>
                <Input
                  placeholder="Nombre de Medicamento / Lote"
                  disabled={!permisos.puedeEscribir}
                  value={item.concepto}
                  onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Cantidad"
                  disabled={!permisos.puedeEscribir}
                  value={item.cantidad}
                  onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                />
              </>
            )}

            {tipoDonacion === "insumos" && (
              <>
                <Input
                  placeholder="Descripción del insumo"
                  disabled={!permisos.puedeEscribir}
                  value={item.concepto}
                  onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Cantidad"
                  disabled={!permisos.puedeEscribir}
                  value={item.cantidad}
                  onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                />
              </>
            )}

            {permisos.puedeEscribir && detalles.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => quitarRenglon(item.id)}>
                X
              </Button>
            )}
          </div>
        ))}

        {permisos.puedeEscribir && (
          <Button variant="secondary" onClick={agregarRenglon} className="mt-2">
            + Agregar Renglón
          </Button>
        )}
      </Card>

      {permisos.puedeEscribir && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={guardarDonacion} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar Donación"}
          </Button>
        </div>
      )}

      {/* Resumen al guardar */}
      {resumenRegistro && (
        <Card title="Resumen del Registro">
          <p>
            <strong>Tipo:</strong> {resumenRegistro.tipo}
          </p>
          <p>
            <strong>Fecha:</strong> {resumenRegistro.fecha}
          </p>
          <p>
            <strong>Renglones registrados:</strong> {resumenRegistro.detalles.length}
          </p>
        </Card>
      )}

      {/* Modal / Alerta para ingreso a inventario de medicamentos */}
      {ofrecerIngresoInventario && (
        <Modal
          title="Ingreso a Inventario"
          isOpen={ofrecerIngresoInventario}
          onClose={() => setOfrecerIngresoInventario(false)}
        >
          <p className="mb-4">
            Se ha registrado una donación de medicamentos. ¿Desea generar automáticamente el
            registro de ingreso en el módulo de Inventario?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOfrecerIngresoInventario(false)}>
              No, omitir
            </Button>
            <Button variant="primary" onClick={() => setOfrecerIngresoInventario(false)}>
              Sí, ingresar a Inventario
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal rápido para nuevo donante */}
      {modalNuevoDonante && (
        <Modal
          title="Registrar Nuevo Donante"
          isOpen={modalNuevoDonante}
          onClose={() => setModalNuevoDonante(false)}
        >
          <p className="text-sm text-gray-600 mb-4">
            Registro rápido de donante sin salir del formulario.
          </p>
          <Input placeholder="Nombre del Donante" className="mb-3" />
          <Button variant="primary" onClick={() => setModalNuevoDonante(false)}>
            Guardar y Seleccionar
          </Button>
        </Modal>
      )}
    </div>
  );
}
