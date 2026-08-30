import { useSeguimientoProyecto } from "@ecopac/shared/proyectos";

export default function SeguimientoProyectoPage({
  proyectoInicial,
  hitosIniciales = [],
  bitacoraInicial = [],
  jornadasIniciales = [],
  usuarioActual = "Usuario Actual",
  onVolver,
}) {
  const {
    proyecto,
    hitos,
    bitacora,
    indicadoresJornadas,
    nuevoPorcentaje,
    setNuevoPorcentaje,
    nuevaNota,
    setNuevaNota,
    errorAccion,
    cargando,
    guardarSeguimiento,
    cambiarEstadoHito,
  } = useSeguimientoProyecto({
    proyectoInicial,
    hitosIniciales,
    bitacoraInicial,
    jornadasIniciales,
    usuarioActual,
  });

  if (!proyecto) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No se seleccionó ningún proyecto para el seguimiento.</p>
        {onVolver && (
          <button
            onClick={onVolver}
            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium"
          >
            Volver
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-4">
        <div>
          {onVolver && (
            <button
              onClick={onVolver}
              className="mb-2 text-sm text-indigo-600 hover:underline flex items-center gap-1"
            >
              ← Volver al listado
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{proyecto.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">{proyecto.descripcion || "Sin descripción disponible."}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            {proyecto.estado || "En progreso"}
          </span>
        </div>
      </div>

      {/* Indicadores Agregados de Jornadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Jornadas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{indicadoresJornadas.totalJornadas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase">Jornadas Completadas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{indicadoresJornadas.completadas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase">Presupuesto Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            Q{indicadoresJornadas.presupuestoTotal.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase">Beneficiarios Alcanzados</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{indicadoresJornadas.beneficiariosTotales}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Avance y Bitácora */}
        <div className="lg:col-span-2 space-y-6">
          {/* Formulario de Actualización de Avance */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Actualizar Avance y Bitácora</h2>
            {errorAccion && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                {errorAccion}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Porcentaje de avance (%)</label>
                  <span className="text-sm font-bold text-indigo-600">{nuevoPorcentaje}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={nuevoPorcentaje}
                  onChange={(e) => setNuevoPorcentaje(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota de seguimiento</label>
                <textarea
                  rows="3"
                  value={nuevaNota}
                  onChange={(e) => setNuevaNota(e.target.value)}
                  placeholder="Escribe los detalles o avances alcanzados..."
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={guardarSeguimiento}
                  disabled={cargando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm transition-colors disabled:opacity-50"
                >
                  {cargando ? "Guardando..." : "Guardar Actualización"}
                </button>
              </div>
            </div>
          </div>

          {/* Historial de Bitácora */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Bitácora de Notas</h2>
            {bitacora.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center py-4">No hay notas de seguimiento registradas.</p>
            ) : (
              <div className="space-y-4">
                {bitacora.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-sm text-gray-800">{item.nota}</p>
                    <div className="mt-2 flex flex-wrap justify-between text-xs text-gray-500 border-t border-gray-200 pt-2">
                      <span>
                        Registrado por: <strong>{item.registradoPor || usuarioActual}</strong>
                      </span>
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recientemente"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Hitos */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Hitos del Proyecto</h2>
            {hitos.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center py-4">No hay hitos asignados a este proyecto.</p>
            ) : (
              <div className="space-y-3">
                {hitos.map((hito) => (
                  <div
                    key={hito.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      hito.esVencido
                        ? "bg-red-50 border-red-300"
                        : hito.esCumplido
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={hito.esCumplido}
                        onChange={(e) => cambiarEstadoHito(hito.id, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            hito.esCumplido ? "line-through text-gray-500" : "text-gray-900"
                          }`}
                        >
                          {hito.nombre}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Previsto: {hito.fechaPrevista || "Sin fecha"}
                        </p>
                        {hito.esVencido && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">
                            ¡Vencido!
                          </span>
                        )}
                        {hito.esCumplido && hito.fechaReal && (
                          <p className="text-xs text-green-700 mt-1">Cumplido el: {hito.fechaReal}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}