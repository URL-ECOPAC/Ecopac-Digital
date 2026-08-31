import { useRegistroIngreso } from "../../../../packages/shared/inventario/useRegistroIngreso.js";

export default function ModalRegistroIngreso({
  abierto,
  onCerrar,
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

  const handleCerrar = () => {
    resetFormulario();
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Registrar Ingreso de Medicamentos
            </h2>
            <p className="text-xs text-gray-500">Issue #156 - RF-15 / RF-04</p>
          </div>
          <button
            onClick={handleCerrar}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl p-1"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Banner crítico de estado PENDIENTE */}
          <div className="p-3.5 bg-amber-50 border-l-4 border-amber-500 text-amber-800 rounded text-xs leading-relaxed">
            <strong>⚠️ Advertencia:</strong> Este movimiento se registrará en estado{" "}
            <strong>PENDIENTE</strong> y los lotes ingresados quedarán como{" "}
            <strong>provisionales</strong>. <u>No afectarán el stock de inventario</u> hasta su confirmación.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">
              {error}
            </div>
          )}

          {resumenGuardado ? (
            /* Pantalla de Resumen tras guardar */
            <div className="p-5 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-bold text-base">
                <span>✅</span>
                <span>Ingreso registrado con éxito (Pendiente)</span>
              </div>
              <div className="text-xs text-green-900 space-y-1 bg-white p-3 rounded border border-green-100">
                <p><strong>Folio:</strong> {resumenGuardado.id}</p>
                <p><strong>Origen:</strong> {resumenGuardado.origen.toUpperCase()}</p>
                <p><strong>Registrado por:</strong> {resumenGuardado.registrado_por}</p>
                <p><strong>Total de Ítems:</strong> {resumenGuardado.items.length}</p>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={resetFormulario}
                  className="px-4 py-2 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-800"
                >
                  + Registrar Otro Ingreso
                </button>
              </div>
            </div>
          ) : (
            /* Formulario Principal */
            <div className="space-y-5">
              {/* Selección de Origen */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Origen del Ingreso *
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="origen"
                      value="compra"
                      checked={origen === "compra"}
                      onChange={() => setOrigen("compra")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    Compra
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="origen"
                      value="donacion"
                      checked={origen === "donacion"}
                      onChange={() => setOrigen("donacion")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    Donación
                  </label>
                </div>
              </div>

              {/* Campos dinámicos según Origen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {origen === "compra" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Proveedor *
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Ej. Distribuidora Farmacéutica"
                      value={proveedor}
                      onChange={(e) => setProveedor(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Vincular Donación Existente *
                    </label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    No. Factura / Comprobante
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ej. FAC-1029"
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                  />
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Agregar Medicamentos */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase">
                  Agregar Medicamentos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-1">Medicamento *</label>
                    <select
                      className="w-full border rounded p-1.5 text-xs bg-white"
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

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">No. Lote *</label>
                    <input
                      type="text"
                      placeholder="LOT-123"
                      className="w-full border rounded p-1.5 text-xs"
                      value={itemActual.numero_lote}
                      onChange={(e) =>
                        setItemActual({ ...itemActual, numero_lote: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Bodega *</label>
                    <select
                      className="w-full border rounded p-1.5 text-xs bg-white"
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

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Cantidad *</label>
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full border rounded p-1.5 text-xs"
                      value={itemActual.cantidad}
                      onChange={(e) =>
                        setItemActual({ ...itemActual, cantidad: e.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[10px] text-gray-500 mb-1">Fecha Vencimiento</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="w-full border rounded p-1.5 text-xs"
                        value={itemActual.fecha_vencimiento}
                        onChange={(e) =>
                          setItemActual({ ...itemActual, fecha_vencimiento: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={agregarItem}
                        className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs hover:bg-gray-900 shrink-0"
                      >
                        + Añadir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Medicamentos Agregados */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Medicamento ID</th>
                      <th className="p-2.5">Lote</th>
                      <th className="p-2.5">Bodega</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5">Cantidad</th>
                      <th className="p-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-400">
                          No se han agregado medicamentos a la lista.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-2.5 font-medium text-gray-800">{item.medicamento_id}</td>
                          <td className="p-2.5">{item.numero_lote}</td>
                          <td className="p-2.5">{item.bodega_id}</td>
                          <td className="p-2.5">{item.fecha_vencimiento || "N/A"}</td>
                          <td className="p-2.5 font-bold">{item.cantidad}</td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => eliminarItem(item.id)}
                              className="text-red-600 hover:text-red-800 font-semibold"
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
        <div className="px-6 py-3 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={handleCerrar}
            className="px-4 py-2 border rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {resumenGuardado ? "Cerrar" : "Cancelar"}
          </button>
          {!resumenGuardado && (
            <button
              onClick={() => guardarMovimiento(usuarioActual)}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
            >
              Guardar Movimiento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}