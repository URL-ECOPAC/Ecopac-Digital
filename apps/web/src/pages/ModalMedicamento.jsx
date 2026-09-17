import { ETIQUETAS_PRESENTACION, PRESENTACIONES_DE_MEDICAMENTO } from "@ecopac/shared";
import { Form } from "react-bootstrap";
import { Plus, Save, X } from "lucide-react";

import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

// Alta y edicion de un medicamento del catalogo.
//
// Era un <div> de posicion fija dibujado a mano: etiquetas en negrita de otro gris, campos con
// radio de 12px, botones en pastilla y un verde (#059669) que no es el de la marca, y no se cerraba
// al tocar fuera. Ahora es el Modal del catalogo con los campos y botones de todos los demas
// formularios; el contrato de props no cambia.
const OPCIONES_PRESENTACION = Object.values(PRESENTACIONES_DE_MEDICAMENTO).map((valor) => ({
  value: valor,
  label: ETIQUETAS_PRESENTACION[valor],
}));

export default function ModalMedicamento({
  isOpen,
  onClose,
  modoEdicion,
  formData,
  setFormData,
  onSubmit,
  principiosActivos = [],
  onCrearPrincipioActivo,
  onAlternarActivo,
  advertenciaDuplicado,
  // Fallo al guardar, ya como texto apto para pantalla (normalizarError()).
  error,
  cargando,
}) {
  const setCampo = (nombre, valor) => setFormData((prev) => ({ ...prev, [nombre]: valor }));

  const enviar = (evento) => {
    evento.preventDefault();
    onSubmit();
  };

  const opcionesPrincipio = (Array.isArray(principiosActivos) ? principiosActivos : []).map(
    (principio) => ({ value: String(principio.id), label: principio.nombre }),
  );

  return (
    <Modal
      visible={Boolean(isOpen)}
      onClose={onClose}
      title={modoEdicion ? "Editar medicamento" : "Nuevo medicamento"}
      size="lg"
    >
      {advertenciaDuplicado && (
        <div className="alert alert-warning" role="alert">
          <strong>Medicamento duplicado:</strong> ya existe un registro con el mismo nombre,
          concentracion, presentacion y marca.
        </div>
      )}

      {error && <ErrorState message={error} />}

      <form onSubmit={enviar} noValidate>
        <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-inventario)" }}>
          <div className="ec-form-seccion-cabecera">
            <h3 className="ec-form-seccion-titulo">Datos generales</h3>
            <p className="ec-form-seccion-descripcion">
              Como se identifica el medicamento en el catalogo.
            </p>
          </div>

          <div className="ec-form-grid">
            <TextField
              label="Nombre comercial *"
              placeholder="Ej. Dolo Neurobion, Amoxicilina"
              value={formData.nombre || ""}
              onChange={(e) => setCampo("nombre", e.target.value)}
              disabled={cargando}
            />

            <div>
              <Selector
                label="Principio activo *"
                value={formData.principio_activo_id ? String(formData.principio_activo_id) : null}
                options={opcionesPrincipio}
                onSelect={(valor) => setCampo("principio_activo_id", valor ?? "")}
                placeholder="Selecciona un principio activo"
                disabled={modoEdicion || cargando}
                style={{ marginBottom: "var(--spacing-xs)" }}
              />
              {modoEdicion ? (
                <p className="form-text mt-0 mb-3">
                  El principio activo no se puede cambiar desde aqui.
                </p>
              ) : (
                onCrearPrincipioActivo && (
                  <div className="mb-3">
                    <SecondaryButton
                      title="Crear un principio activo"
                      size="sm"
                      icon={<Plus size={14} aria-hidden="true" />}
                      onClick={onCrearPrincipioActivo}
                      disabled={cargando}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-inventario)" }}>
          <div className="ec-form-seccion-cabecera">
            <h3 className="ec-form-seccion-titulo">Especificaciones</h3>
            <p className="ec-form-seccion-descripcion">
              Concentracion, presentacion y fabricante, que juntos no se pueden repetir.
            </p>
          </div>

          <div className="ec-form-grid">
            <TextField
              label="Concentracion *"
              placeholder="Ej. 500 mg"
              value={formData.concentracion || ""}
              onChange={(e) => setCampo("concentracion", e.target.value)}
              disabled={cargando}
            />
            <Selector
              label="Presentacion *"
              value={formData.presentacion || null}
              options={OPCIONES_PRESENTACION}
              onSelect={(valor) => setCampo("presentacion", valor ?? "")}
              placeholder="Selecciona una presentacion"
              disabled={cargando}
            />
            <TextField
              label="Marca / laboratorio *"
              placeholder="Ej. Bayer"
              value={formData.marca || ""}
              onChange={(e) => setCampo("marca", e.target.value)}
              disabled={cargando}
            />
            <TextField
              label="Forma farmaceutica"
              placeholder="Ej. Solido oral"
              value={formData.formaFarmaceutica || ""}
              onChange={(e) => setCampo("formaFarmaceutica", e.target.value)}
              disabled={cargando}
            />
            <Form.Check
              className="ec-form-grid--ancho mb-3"
              id="medicamento-es-pediatrico"
              type="switch"
              label="Es de uso pediatrico"
              checked={Boolean(formData.esPediatrico)}
              onChange={(e) => setCampo("esPediatrico", e.target.checked)}
              disabled={cargando}
            />
          </div>
        </section>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <div>
            {modoEdicion && onAlternarActivo && (
              <SecondaryButton
                title={formData.activo ? "Desactivar" : "Reactivar"}
                variant={formData.activo ? "peligro" : "outline"}
                onClick={onAlternarActivo}
                disabled={cargando}
              />
            )}
          </div>
          <div className="ec-acciones">
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              onClick={onClose}
              disabled={cargando}
              icon={<X size={16} aria-hidden="true" />}
            />
            <PrimaryButton
              type="submit"
              title="Guardar"
              loading={cargando}
              icon={<Save size={16} aria-hidden="true" />}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
