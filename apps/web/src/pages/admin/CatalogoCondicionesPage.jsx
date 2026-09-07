import { useState } from "react";
import { useCatalogoCondiciones } from "@ecopac/shared";
import { useAuth } from "../../context/AuthContext";
import CatalogoCondicionesModal from "../src/components/pacientes/CatalogoCondicionesModal";
import { Alert, Button, Spinner } from "react-bootstrap";

export default function CatalogoCondicionesPage() {
  const { usuario } = useAuth();
  const {
    condiciones,
    busqueda,
    setBusqueda,
    cargando,
    error,
    enviando,
    erroresForm,
    puedeGestionar,
    crear,
    editar,
    alternarVigencia,
  } = useCatalogoCondiciones({ rol: usuario?.rol });

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
    <div className="container-fluid p-4">
      {error && (
        <Alert variant="danger" dismissible className="mb-3">
          {error.mensaje || "Ocurrió un error al cargar el catálogo."}
        </Alert>
      )}

      {/* Encabezado Principal */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">Catálogo de condiciones</h2>
          <p className="text-muted mb-0">
            Condiciones crónicas disponibles para el expediente del paciente
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" className="px-3" onClick={() => window.history.back()}>
            Volver
          </Button>
          {puedeGestionar && (
            <Button variant="success" className="px-3" onClick={abrirCrear}>
              Nueva condición
            </Button>
          )}
        </div>
      </div>

      {/* Caja de Buscador */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <small className="text-uppercase fw-semibold text-muted d-block mb-1" style={{ fontSize: "0.75rem" }}>
            Buscar condición
          </small>
          <input
            type="text"
            className="form-control form-control-lg bg-light border-0"
            placeholder="Nombre de la condición"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Listado / Tabla */}
      {cargando ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
          <p className="mt-2 text-muted">Cargando condiciones...</p>
        </div>
      ) : (
        <div>
          <small className="text-uppercase fw-semibold text-muted d-block mb-2" style={{ fontSize: "0.75rem" }}>
            {condiciones.length} CONDICIONES
          </small>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted" style={{ fontSize: "0.8rem" }}>
                  <tr>
                    <th className="py-3 px-4">NOMBRE</th>
                    <th className="py-3 px-4 text-center" style={{ width: "120px" }}>ESTADO</th>
                    {puedeGestionar && <th className="py-3 px-4 text-end" style={{ width: "140px" }}>ACCIONES</th>}
                  </tr>
                </thead>
                <tbody>
                  {condiciones.length === 0 ? (
                    <tr>
                      <td colSpan={puedeGestionar ? 3 : 2} className="text-center py-4 text-muted">
                        No se encontraron condiciones registradas.
                      </td>
                    </tr>
                  ) : (
                    condiciones.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 px-4 fw-bold text-dark">{item.nombre}</td>
                        <td className="py-3 px-4 text-center">
                          {item.esVigente ? (
                            <span className="badge bg-success px-3 py-2 rounded-pill">Activo</span>
                          ) : (
                            <span className="badge bg-secondary px-3 py-2 rounded-pill">Inactivo</span>
                          )}
                        </td>
                        {puedeGestionar && (
                          <td className="py-3 px-4 text-end">
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
                                title={item.esVigente ? "Desactivar" : "Activar"}
                                onClick={() => alternarVigencia(item.id, item.esVigente)}
                                disabled={enviando}
                              >
                                <i className={`bi bi-${item.esVigente ? "eye-slash" : "check-lg"}`}></i>
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alta/Edición */}
      <CatalogoCondicionesModal
        show={modalAbierto}
        onHide={() => setModalAbierto(false)}
        condicion={condicionAEditar}
        onSubmit={handleGuardar}
        enviando={enviando}
        errores={erroresForm}
      />
    </div>
  );
}