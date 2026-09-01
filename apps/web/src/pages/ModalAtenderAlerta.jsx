import { useState } from "react";

export function ModalAtenderAlerta({ alerta, onClose, onResolver, errorValidacion }) {
  const [accion, setAccion] = useState("descartado");

  if (!alerta) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onResolver(alerta.id, accion);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Atender Alerta de Caducidad</h3>

        <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1 text-gray-700">
          <p>
            <span className="font-semibold">Lote:</span> {alerta.numero_lote || alerta.lote_numero}
          </p>
          <p>
            <span className="font-semibold">Medicamento:</span>{" "}
            {alerta.medicamento?.nombre || alerta.medicamentoNombre}
          </p>
          <p>
            <span className="font-semibold">Cantidad Afectada:</span>{" "}
            {alerta.cantidad_afectada || alerta.stockTotal} u.
          </p>
        </div>

        {errorValidacion && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {errorValidacion}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Acción a realizar *
            </label>
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              className="w-full border p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="donado">Donado</option>
              <option value="reubicado">Reubicado</option>
              <option value="descartado">Descartado / Merma</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              Marcar Atendida
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
