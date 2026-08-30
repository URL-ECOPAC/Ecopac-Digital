import { useProyectosSociales } from "@ecopac/shared";
import { Button, Badge, Select, Input, Modal } from "@ecopac/ui";

export default function ProyectosSocialesPage({
  usuarioRol,
  proyectosIniciales,
  jornadasIniciales,
}) {
  const {
    proyectos,
    proyectoDetalle,
    jornadasProyecto,
    puedeEditar,
    filtrosState,
    setFiltrosState,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
  } = useProyectosSociales({ usuarioRol, proyectosIniciales, jornadasIniciales });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyectos Sociales</h1>
          <p className="text-sm text-gray-500">
            Gestión de proyectos, presupuestos y jornadas de campo
          </p>
        </div>
        {puedeEditar && <Button variant="primary">+ Nuevo Proyecto</Button>}
      </div>

      {/* Controles de Filtrado */}
      <div className="flex gap-4 bg-white p-4 rounded-md border shadow-sm">
        <div className="w-48">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Estado</label>
          <Select
            value={filtrosState.estado}
            onChange={(e) => setFiltrosState((prev) => ({ ...prev, estado: e.target.value }))}
          >
            <option value="">Todos los estados</option>
            <option value="Planificación">Planificación</option>
            <option value="En Ejecución">En Ejecución</option>
            <option value="Finalizado">Finalizado</option>
          </Select>
        </div>
        <div className="w-64">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Responsable</label>
          <Input
            placeholder="Filtrar por responsable..."
            value={filtrosState.responsable}
            onChange={(e) => setFiltrosState((prev) => ({ ...prev, responsable: e.target.value }))}
          />
        </div>
      </div>

      {/* Tabla de Proyectos */}
      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Responsable</th>
              <th className="p-3">Fechas</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Avance</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {proyectos.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setProyectoSeleccionadoId(p.id)}
              >
                <td className="p-3 font-medium text-gray-900">{p.nombre}</td>
                <td className="p-3 text-gray-600">{p.responsable}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {p.fecha_inicio} - {p.fecha_fin}
                </td>
                <td className="p-3">
                  <Badge variant={p.estado === "En Ejecución" ? "success" : "default"}>
                    {p.estado}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${p.porcentaje_avance || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-0.5 block">
                    {p.porcentaje_avance || 0}%
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setProyectoSeleccionadoId(p.id)}>
                    Ver Detalle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal / Panel de Detalle */}
      {proyectoDetalle && (
        <Modal
          isOpen={!!proyectoDetalle}
          onClose={() => setProyectoSeleccionadoId(null)}
          title={proyectoDetalle.nombre}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{proyectoDetalle.descripcion}</p>

            {/* Tabs de Detalle */}
            <div className="border-b flex gap-4 text-sm font-medium text-gray-500">
              {["resumen", "equipo", "jornadas", "insumos", "gastos"].map((tab) => (
                <button
                  key={tab}
                  className={`pb-2 capitalize ${tabActivo === tab ? "border-b-2 border-blue-600 text-blue-600 font-semibold" : ""}`}
                  onClick={() => setTabActivo(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Contenido según Tab Activo */}
            {tabActivo === "resumen" && (
              <div className="text-sm space-y-2">
                <p>
                  <strong>Responsable:</strong> {proyectoDetalle.responsable}
                </p>
                <p>
                  <strong>Presupuesto:</strong> Q {proyectoDetalle.presupuesto || "0.00"}
                </p>
                <p>
                  <strong>Avance actual:</strong> {proyectoDetalle.porcentaje_avance || 0}%
                </p>
              </div>
            )}

            {tabActivo === "jornadas" && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Jornadas Asociadas</h4>
                {jornadasProyecto.length > 0 ? (
                  <ul className="divide-y text-sm">
                    {jornadasProyecto.map((j) => (
                      <li key={j.id} className="py-2 flex justify-between">
                        <span>{j.nombre}</span>
                        <span className="text-gray-500">{j.fecha}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">
                    No hay jornadas asociadas a este proyecto.
                  </p>
                )}
              </div>
            )}

            {tabActivo === "gastos" && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                El tab Gastos depende del módulo de Presupuestos (#274), actualmente pendiente de
                asignación.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
