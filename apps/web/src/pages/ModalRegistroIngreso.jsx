import { useRegistroIngreso } from "../../../../packages/shared/inventario/useRegistroIngreso.js";

export default function ModalRegistroIngreso({
  abierto,
  onClose,
  onCerrar, // Soporte para ambas convenciones de nombre
  onExito,  // Callback para notificar al padre tras guardar
  catalogos = { medicamentos: [], bodegas: [], donaciones: [] },
  usuarioActual,
}) {
  const {
    origen,
    setOrigen,
    donacionId,
    setDonacionId,
    proveedor,
    setProveedor,
    numeroComprobante,
    setNumeroComprobante,
    items,
    itemActual,
    setItemActual,
    agregarItem,
    eliminarItem,
    guardarMovimiento,
    resumenGuardado,
    resetFormulario,
    error,
  } = useRegistroIngreso({
    donacionesDisponibles: catalogos?.donaciones || [],
  });

  if (!abierto) return null;

  // Garantiza que se llame la función de cierre correcta sin importar cuál prop envió el padre
  const handleCerrarModal = () => {
    resetFormulario();
    if (onCerrar) onCerrar();
    if (onClose) onClose();
  };

  const handleGuardar = async () => {
    const exito = await guardarMovimiento(usuarioActual);
    // Si la operación fue exitosa y existe callback de éxito, notifica al padre
    if (exito && onExito) {
      onExito(exito);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          
          {/* Cabecera del Modal */}
          <div className="modal-header bg-light border-bottom-0 px-4 pt-4 pb-2">
            <div>
              <h5 className="modal-title fw-bold text-dark">
                Registrar Ingreso de Medicamentos
              </h5>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={handleCerrarModal}
              aria-label="Close"
            ></button>
          </div>

          {/* Cuerpo del Modal */}
          <div className="modal-body px-4 py-3">
            {/* Banner crítico de estado PENDIENTE */}
            <div
              className="alert border-0 rounded-3 text-dark mb-3 p-3"
              style={{ backgroundColor: "#FFF3CD", fontSize: "12px", lineHeight: "1.5" }}
            >
              <strong>⚠️ Advertencia:</strong> Este movimiento se registrará en estado{" "}
              <strong>PENDIENTE</strong> y los lotes ingresados quedarán como{" "}
              <strong>provisionales</strong>. <u>No afectarán el stock de inventario</u> hasta su confirmación.
            </div>

            {error && (
              <div className="alert alert-danger border-0 rounded-3 text-sm p-3 mb-3" style={{ fontSize: "12px" }}>
                {error}
              </div>
            )}

            {resumenGuardado ? (
              /* Pantalla de Resumen tras guardar */
              <div className="card border-success bg-success-subtle rounded-3 p-3">
                <div className="d-flex align-items-center gap-2 text-success font-bold mb-2">
                  <span>✅</span>
                  <span className="fw-bold">Ingreso registrado con éxito (Pendiente)</span>
                </div>
                <div className="bg-white p-3 rounded border text-secondary" style={{ fontSize: "12px" }}>
                  <p className="mb-1"><strong>Folio:</strong> {resumenGuardado.id}</p>
                  <p className="mb-1"><strong>Origen:</strong> {resumenGuardado.origen?.toUpperCase()}</p>
                  <p className="mb-1"><strong>Registrado por:</strong> {resumenGuardado.registrado_por}</p>
                  <p className="mb-0"><strong>Total de Ítems:</strong> {resumenGuardado.items?.length}</p>
                </div>
                <div className="d-flex justify-content-end pt-3">
                  <button
                    onClick={resetFormulario}
                    className="btn btn-sm text-white px-3"
                    style={{ backgroundColor: "#009963" }}
                  >
                    + Registrar Otro Ingreso
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario Principal */
              <div className="d-flex flex-column gap-3">
                {/* Selección de Origen */}
                <div>
                  <label className="form-label fw-bold text-secondary uppercase mb-2" style={{ fontSize: "11px" }}>
                    Origen del Ingreso *
                  </label>
                  <div className="d-flex gap-4">
                    <div className="form-check">
                      <input
                        type="radio"
                        id="origenCompra"
                        name="origen"
                        className="form-check-input"
                        value="compra"
                        checked={origen === "compra"}
                        onChange={() => setOrigen("compra")}
                      />
                      <label className="form-check-label text-dark" style={{ fontSize: "14px" }} htmlFor="origenCompra">
                        Compra
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        type="radio"
                        id="origenDonacion"
                        name="origen"
                        className="form-check-input"
                        value="donacion"
                        checked={origen === "donacion"}
                        onChange={() => setOrigen("donacion")}
                      />
                      <label className="form-check-label text-dark" style={{ fontSize: "14px" }} htmlFor="origenDonacion">
                        Donación
                      </label>
                    </div>
                  </div>
                </div>

                {/* Campos dinámicos según Origen */}
                <div className="row g-3">
                  {origen === "compra" ? (
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                        Proveedor *
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-3"
                        placeholder="Ej. Distribuidora Farmacéutica"
                        value={proveedor}
                        onChange={(e) => setProveedor(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                        Vincular Donación Existente *
                      </label>
                      <select
                        className="form-select form-select-sm rounded-3"
                        value={donacionId}
                        onChange={(e) => setDonacionId(e.target.value)}
                      >
                        <option value="">-- Seleccionar Donación --</option>
                        {(catalogos?.donaciones || []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.donante} ({d.fecha || "Sin fecha"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary" style={{ fontSize: "12px" }}>
                      No. Factura / Comprobante
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-3"
                      placeholder="Ej. FAC-1029"
                      value={numeroComprobante}
                      onChange={(e) => setNumeroComprobante(e.target.value)}
                    />
                  </div>
                </div>

                <hr className="my-2 text-muted opacity-25" />

                {/* Agregar Medicamentos */}
                <div>
                  <h6 className="fw-bold text-secondary uppercase mb-2" style={{ fontSize: "11px" }}>
                    Agregar Medicamentos
                  </h6>
                  <div className="card border-0 bg-light p-3 rounded-3 mb-3">
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-muted mb-1" style={{ fontSize: "11px" }}>
                          Medicamento *
                        </label>
                        <select
                          className="form-select form-select-sm rounded-2"
                          value={itemActual.medicamento_id}
                          onChange={(e) =>
                            setItemActual({ ...itemActual, medicamento_id: e.target.value })
                          }
                        >
                          <option value="">Seleccionar...</option>
                          {(catalogos?.medicamentos || []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre} ({m.concentracion})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-3">
                        <label className="form-label text-muted mb-1" style={{ fontSize: "11px" }}>
                          No. Lote *
                        </label>
                        <input
                          type="text"
                          placeholder="LOT-123"
                          className="form-control form-control-sm rounded-2"
                          value={itemActual.numero_lote}
                          onChange={(e) =>
                            setItemActual({ ...itemActual, numero_lote: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label text-muted mb-1" style={{ fontSize: "11px" }}>
                          Bodega *
                        </label>
                        <select
                          className="form-select form-select-sm rounded-2"
                          value={itemActual.bodega_id}
                          onChange={(e) =>
                            setItemActual({ ...itemActual, bodega_id: e.target.value })
                          }
                        >
                          <option value="">Bodega...</option>
                          {(catalogos?.bodegas || []).map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label text-muted mb-1" style={{ fontSize: "11px" }}>
                          Cantidad *
                        </label>
                        <input
                          type="number"
                          placeholder="100"
                          className="form-control form-control-sm rounded-2"
                          value={itemActual.cantidad}
                          onChange={(e) =>
                            setItemActual({ ...itemActual, cantidad: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-md-8">
                        <label className="form-label text-muted mb-1" style={{ fontSize: "11px" }}>
                          Fecha Vencimiento
                        </label>
                        <div className="d-flex gap-2">
                          <input
                            type="date"
                            className="form-control form-control-sm rounded-2"
                            value={itemActual.fecha_vencimiento}
                            onChange={(e) =>
                              setItemActual({ ...itemActual, fecha_vencimiento: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={agregarItem}
                            className="btn btn-dark btn-sm rounded-2 px-3 text-nowrap"
                          >
                            + Añadir
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Medicamentos Agregados */}
                <div className="table-responsive border rounded-3 overflow-hidden">
                  <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: "12px" }}>
                    <thead className="table-light text-secondary text-uppercase" style={{ fontSize: "11px" }}>
                      <tr>
                        <th className="py-2 px-3">Medicamento ID</th>
                        <th className="py-2 px-3">Lote</th>
                        <th className="py-2 px-3">Bodega</th>
                        <th className="py-2 px-3">Vencimiento</th>
                        <th className="py-2 px-3">Cantidad</th>
                        <th className="py-2 px-3 text-end">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-4 text-center text-muted">
                            No se han agregado medicamentos a la lista.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 fw-semibold text-dark">{item.medicamento_id}</td>
                            <td className="px-3">{item.numero_lote}</td>
                            <td className="px-3">{item.bodega_id}</td>
                            <td className="px-3">{item.fecha_vencimiento || "N/A"}</td>
                            <td className="px-3 fw-bold">{item.cantidad}</td>
                            <td className="px-3 text-end">
                              <button
                                type="button"
                                onClick={() => eliminarItem(item.id)}
                                className="btn btn-link btn-sm text-danger text-decoration-none p-0 fw-bold"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Pie del Modal */}
          <div className="modal-footer bg-light border-top-0 px-4 py-3">
            <button
              type="button"
              onClick={handleCerrarModal}
              className="btn btn-outline-secondary btn-sm rounded-3 px-3"
            >
              {resumenGuardado ? "Cerrar" : "Cancelar"}
            </button>
            {!resumenGuardado && (
              <button
                type="button"
                onClick={handleGuardar}
                className="btn btn-sm text-white rounded-3 px-4 fw-semibold"
                style={{ backgroundColor: "#009963" }}
              >
                Guardar Movimiento
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}