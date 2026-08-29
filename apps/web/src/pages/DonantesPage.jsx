import { useDonantesPage } from "@ecopac/shared";
import { Button, Table, Input, Select, Card } from "@ecopac/ui"; 

export default function DonantesPage({ client, usuarioRol }) {
  const {
    permisos,
    cargando,
    error,
    columnas,
    donantes,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    donanteSeleccionado,
    abrirAlta,
    abrirEdicion,
    verFicha,
  } = useDonantesPage({ client, usuarioRol });

  if (!permisos.tieneAccesoLectura) {
    return <div className="p-4 text-red-600">Acceso denegado: No cuenta con permisos para ver donantes.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Administración de Donantes</h1>
        {permisos.puedeEscribir && (
          <Button onClick={abrirAlta} variant="primary">
            + Nuevo Donante
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          options={[
            { label: "Todos los tipos", value: "todos" },
            { label: "Individual", value: "individual" },
            { label: "Empresa", value: "empresa" },
            { label: "Organización", value: "organizacion" },
          ]}
        />
      </div>

      {cargando ? (
        <p>Cargando donantes...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <Table
          columns={columnas}
          data={donantes}
          onRowClick={(row) => verFicha(row.id)}
          renderActions={(row) =>
            permisos.puedeEscribir && (
              <Button size="sm" onClick={() => abrirEdicion(row)}>
                Editar
              </Button>
            )
          }
        />
      )}

      {donanteSeleccionado && !modalAbierto && (
        <Card title={`Ficha: ${donanteSeleccionado.nombre}`}>
          <p><strong>Tipo:</strong> {donanteSeleccionado.tipo}</p>
          <p><strong>Contacto:</strong> {donanteSeleccionado.contacto}</p>
          <h3 className="mt-4 font-semibold">Histórico de Aportes</h3>
          <ul>
            {(donanteSeleccionado.donaciones || []).map((donacion) => (
              <li key={donacion.id}>
                {donacion.fecha} - {donacion.monto ? `$${donacion.monto}` : donacion.descripcion}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}