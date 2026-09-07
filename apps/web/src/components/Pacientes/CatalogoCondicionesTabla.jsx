import { useState } from "react";
import { Table, Button, Badge, Form, InputGroup, Card, Spinner } from "react-bootstrap";
import CatalogoCondicionesModal from "./CatalogoCondicionesModal";

export default function CatalogoCondicionesTabla({
  condiciones,
  busqueda,
  setBusqueda,
  cargando,
  enviando,
  erroresForm,
  puedeGestionar,
  crear,
  editar,
  alternarVigencia,
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [condicionAEditar, setCondicionAEditar] = useState(null);

  const abrirCrear = () => {
    setCondicionAEditar(null);
    setModalAbierto(true);
  };

  const abrirEditar = (condicion) => {
    setCondicionAEditar(condicion);
    setModalAbierto(true);
  };

  const handleGuardar = async (nombre) => {
    if (condicionAEditar) {
      return editar(condicionAEditar.id, { nombre });
    }
    return crear(nombre);
  };

  return (
    <Card className="shadow-sm border-0">
      <Card.Header className="bg-white py-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <h5 className="m-0 fw-bold text-dark">Catálogo de Condiciones Crónicas</h5>
          {puedeGestionar && (
            <Button variant="primary" onClick={abrirCrear} size="sm">
              <i className="bi bi-plus-lg me-1"></i> Nueva Condición
            </Button>
          )}
        </div>
      </Card.Header>

      <Card.Body>
        <div className="mb-3">
          <InputGroup>
            <InputGroup.Text className="bg-light">
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Buscar condición por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <Button variant="outline-secondary" onClick={() => setBusqueda("")}>
                Limpiar
              </Button>
            )}
          </InputGroup>
        </div>

        {cargando ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando condiciones...</p>
          </div>
        ) : condiciones.length === 0 ? (
          <div className="text-center py-4 text-muted">
            {busqueda
              ? "No se encontraron condiciones que coincidan con la búsqueda."
              : "No hay condiciones registradas en el catálogo."}
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover align="middle" className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: "120px" }}>Estado</th>
                  {puedeGestionar && (
                    <th style={{ width: "160px" }} className="text-end">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {condiciones.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-medium">{item.nombre}</td>
                    <td>
                      {item.esVigente ? (
                        <Badge
                          bg="success-subtle"
                          className="text-success border border-success-subtle"
                        >
                          Vigente
                        </Badge>
                      ) : (
                        <Badge
                          bg="secondary-subtle"
                          className="text-secondary border border-secondary-subtle"
                        >
                          No Vigente
                        </Badge>
                      )}
                    </td>
                    {puedeGestionar && (
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            title="Editar nombre"
                            onClick={() => abrirEditar(item)}
                            disabled={enviando}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            variant={item.esVigente ? "outline-danger" : "outline-success"}
                            size="sm"
                            title={item.esVigente ? "Desactivar condición" : "Activar condición"}
                            onClick={() => alternarVigencia(item.id, item.esVigente)}
                            disabled={enviando}
                          >
                            <i className={`bi bi-${item.esVigente ? "eye-slash" : "check-lg"}`}></i>
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>

      <CatalogoCondicionesModal
        show={modalAbierto}
        onHide={() => setModalAbierto(false)}
        condicion={condicionAEditar}
        onSubmit={handleGuardar}
        enviando={enviando}
        errores={erroresForm}
      />
    </Card>
  );
}
