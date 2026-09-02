import { useState } from "react";
import { useAlertasVencimiento } from "../../../../packages/shared/inventario/useAlertasVencimiento.js";

export default function PanelAlertasVencimiento({ lotes = [], bodegas = [] }) {
  const {
    porVencer,
    vencidas,
    cantidadPendientes,
    busqueda,
    setBusqueda,
    filtroBodega,
    setFiltroBodega,
    filtroCategoria,
    setFiltroCategoria,
    bodegasDisponibles,
    categoriasDisponibles,
    marcarComoAtendida,
    ESTADO_ALERTA,
  } = useAlertasVencimiento({ lotes, bodegas });

  const [alertaAtendiendo, setAlertaAtendiendo] = useState(null);
  const [accionTomada, setAccionTomada] = useState("");

  const handleAtender = (alerta) => {
    setAlertaAtendiendo(alerta);
    setAccionTomada("");
  };

  const confirmarAtender = async () => {
    if (!alertaAtendiendo) return;
    try {
      await marcarComoAtendida(alertaAtendiendo.id, accionTomada);
      setAlertaAtendiendo(null);
      setAccionTomada("");
    } catch (error) {
      alert(error.message || "No se pudo registrar la acción");
    }
  };

  const formatoFecha = (fecha) =>
    fecha ? new Date(fecha).toLocaleDateString("es-GT") : "—";

  const estiloFila = (dias) => {
    if (dias < 0) return { bg: "#fef2f2", borde: "#fecaca", texto: "#dc2626" };
    if (dias === 0) return { bg: "#fffbeb", borde: "#fde68a", texto: "#d97706" };
    return { bg: "#f0fdf4", borde: "#bbf7d0", texto: "#16a34a" };
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
      {/* Cabecera con contador */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Alertas de Vencimiento
          </h2>
          <p className="text-sm text-slate-500">
            Medicamentos próximos a caducar (próximos 30 días)
          </p>
        </div>
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
          <span className="font-bold text-amber-600 text-lg">{cantidadPendientes}</span>
          <span className="text-amber-600 text-sm ml-1">pendientes</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar medicamento o lote..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 min-w-64 px-4 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <select
          value={filtroBodega}
          onChange={(e) => setFiltroBodega(e.target.value)}
          className="px-4 py-2 rounded-full border border-slate-200 text-sm"
        >
          {bodegasDisponibles.map((b) => (
            <option key={b} value={b}>
              {b === "todas" ? "Todas las bodegas" : b}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-4 py-2 rounded-full border border-slate-200 text-sm"
        >
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {c === "todas" ? "Todas las categorías" : c}
            </option>
          ))}
        </select>
      </div>

      {/* ⏳ Sección: Por Vencer */}
      <div>
        <h3 className="font-bold text-amber-600 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Próximos a vencer ({porVencer.length})
        </h3>

        {porVencer.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">
            No hay lotes por vencer en los próximos 30 días 
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Medicamento</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Lote</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500">Cantidad</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500">Vencimiento</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-500">Días</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-500">Bodega</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-500">Acción</th>
                </tr>
              </thead>
              <tbody>
                {porVencer.map((alerta) => {
                  const estilo = estiloFila(alerta.diasRestantes);
                  return (
                    <tr key={alerta.id} style={{ backgroundColor: estilo.bg, borderBottom: `1px solid ${estilo.borde}` }}>
                      <td className="px-4 py-3 font-medium">{alerta.medicamento}</td>
                      <td className="px-4 py-3 text-slate-600">{alerta.lote}</td>
                      <td className="px-4 py-3 text-right font-bold">{alerta.cantidad}</td>
                      <td className="px-4 py-3">{formatoFecha(alerta.fechaVencimiento)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold" style={{ color: estilo.texto }}>
                          {alerta.diasRestantes === 0 ? "HOY" : `${alerta.diasRestantes}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{alerta.bodega}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleAtender(alerta)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold hover:bg-emerald-700 transition"
                        >
                          Atender
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ⚫ Sección: Vencidas */}
      <div>
        <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          Vencidos — Para dar de baja ({vencidas.length})
        </h3>

        {vencidas.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">
            No hay lotes vencidos 
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-red-100">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-red-600">Medicamento</th>
                  <th className="px-4 py-3 text-left font-semibold text-red-600">Lote</th>
                  <th className="px-4 py-3 text-right font-semibold text-red-600">Cantidad</th>
                  <th className="px-4 py-3 text-left font-semibold text-red-600">Vencimiento</th>
                  <th className="px-4 py-3 text-center font-semibold text-red-600">Días vencido</th>
                  <th className="px-4 py-3 text-center font-semibold text-red-600">Bodega</th>
                  <th className="px-4 py-3 text-center font-semibold text-red-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {vencidas.map((alerta) => (
                  <tr key={alerta.id} className="bg-red-50/50 border-b border-red-100">
                    <td className="px-4 py-3 font-medium text-red-700">{alerta.medicamento}</td>
                    <td className="px-4 py-3 text-red-600">{alerta.lote}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{alerta.cantidad}</td>
                    <td className="px-4 py-3 text-red-600">{formatoFecha(alerta.fechaVencimiento)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-red-600">
                        {Math.abs(alerta.diasRestantes)}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-red-500">{alerta.bodega}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleAtender(alerta)}
                        className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition"
                      >
                        Registrar Baja
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Registrar acción */}
      {alertaAtendiendo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-bold">Registrar Acción Tomada</h3>
            <p className="text-sm text-slate-500">
              <strong>{alertaAtendiendo.medicamento}</strong> — Lote {alertaAtendiendo.lote}
              <br />
              Vencimiento: {formatoFecha(alertaAtendiendo.fechaVencimiento)}
            </p>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Acción tomada <span className="text-red-500">*</span>
              </label>
              <textarea
                value={accionTomada}
                onChange={(e) => setAccionTomada(e.target.value)}
                placeholder="Ej: Despachado, devuelto, destruido, dado de baja..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setAlertaAtendiendo(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAtender}
                disabled={!accionTomada.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}