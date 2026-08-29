import { useConstanciaDonacion } from "@ecopac/shared";
import { Button } from "@ecopac/ui";

export default function ConstanciaDonacionPage({ usuarioRol, donacion }) {
  const {
    tieneAccesoLectura,
    esValidaParaConstancia,
    correlativo,
    manejarImpresion,
  } = useConstanciaDonacion({
    usuarioRol,
    donacion,
    onImprimir: () => window.print(),
  });

  if (!tieneAccesoLectura) {
    return <div className="p-4 text-red-600">Acceso denegado: No tiene permisos para consultar este módulo.</div>;
  }

  if (!donacion) {
    return <div className="p-4 text-gray-500">No se ha seleccionado ninguna donación.</div>;
  }

  if (!esValidaParaConstancia) {
    return (
      <div className="p-6 max-w-2xl mx-auto border border-red-300 bg-red-50 text-red-700 rounded-md">
        <h2 className="text-lg font-bold mb-2">Constancia No Disponible</h2>
        <p>Esta donación se encuentra en estado <strong>ANULADA</strong>. Las donaciones anuladas no pueden generar una constancia de respaldo.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Botones de acción (Ocultos al imprimir) */}
      <div className="flex justify-end gap-3 mb-6 print:hidden">
        <Button variant="primary" onClick={manejarImpresion}>
          Imprimir / Descargar PDF
        </Button>
      </div>

      {/* Documento Imprimible */}
      <div className="bg-white p-8 border rounded-md shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Encabezado de la Organización */}
        <div className="border-b pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">Ecopac Digital</h1>
            <p className="text-sm text-gray-500">Comité Agrícola de Desarrollo Integral</p>
            <p className="text-xs text-gray-400">Guatemala · Registro de Aportes y Donaciones</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 font-mono text-sm font-bold rounded">
              {correlativo}
            </span>
            <p className="text-xs text-gray-500 mt-1">Fecha: {donacion.fecha}</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-center text-gray-800 mb-6 underline">
          CONSTANCIA DE DONACIÓN RECIBIDA
        </h2>

        {/* Datos del Donante */}
        <div className="mb-6 space-y-2 text-sm text-gray-700 bg-gray-50 p-4 rounded border print:bg-transparent">
          <p><strong>Donante:</strong> {donacion.donante_nombre}</p>
          <p><strong>Identificación / Teléfono:</strong> {donacion.donante_contacto || "N/A"}</p>
          <p><strong>Tipo de Aporte:</strong> <span className="capitalize">{donacion.tipo}</span></p>
          <p><strong>Proyecto Asignado:</strong> {donacion.proyecto_nombre || "Fondo General"}</p>
        </div>

        {/* Detalle de lo donado */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Detalle del Aporte</h3>
          <table className="w-full text-left text-sm border-collapse border">
            <thead>
              <tr className="bg-gray-100 border-b print:bg-transparent">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Concepto / Descripción</th>
                <th className="p-2 border text-right">Cantidad / Monto</th>
              </tr>
            </thead>
            <tbody>
              {donacion.detalles?.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="p-2 border text-center">{index + 1}</td>
                  <td className="p-2 border">{item.concepto}</td>
                  <td className="p-2 border text-right font-medium">
                    {donacion.tipo === "economica" ? `Q ${Number(item.monto).toFixed(2)}` : item.cantidad}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="3" className="p-2 text-center text-gray-500">Sin detalles especificantes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Firmas de Respaldo */}
        <div className="mt-16 pt-8 border-t grid grid-cols-2 gap-8 text-center text-xs text-gray-600">
          <div>
            <div className="border-b border-gray-400 mb-2 w-3/4 mx-auto font-mono"></div>
            <p className="font-semibold">Firma de Conformidad Donante</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-2 w-3/4 mx-auto font-mono"></div>
            <p className="font-semibold">Por Ecopac Digital (Administración)</p>
          </div>
        </div>
      </div>
    </div>
  );
}