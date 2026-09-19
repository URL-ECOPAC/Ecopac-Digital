import { Plus, X } from "lucide-react";

import { seccionesDePaciente, useRegistroPaciente } from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import CascadaDeComunidad from "../components/CascadaDeComunidad";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";

// Alta de un paciente.
//
// Mismo formulario, mismo agrupamiento y mismo control de comunidad que la edicion
// (ModalEdicionPaciente.jsx): las dos recorren seccionesDePaciente() con SeccionDeFormulario y
// sustituyen el campo "comunidad" por CascadaDeComunidad. Hasta la #840 esta pantalla recorria
// las secciones a mano para poder poner la cascada, y la edicion se quedo con una lista plana de
// todas las comunidades del pais.

export default function ModalAltaPaciente({ onClose, onRegistrado, rol }) {
  const {
    valores,
    errores,
    error,
    enviando,
    edad,
    advertenciaDuplicado,
    registrado,
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    registrar,
    reiniciar,
    catalogos,
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
  } = useRegistroPaciente({ rol });

  const cerrar = () => {
    if (registrado) onRegistrado?.(registrado);
    onClose?.();
  };

  const registrarOtro = () => {
    onRegistrado?.(registrado);
    reiniciar();
  };

  if (registrado) {
    return (
      <Modal visible onClose={cerrar} title="Paciente registrado">
        <p className="mb-1">Anota este número en la ficha de papel:</p>
        <p className="ec-numero-ficha">{registrado.expediente?.numeroFicha ?? "—"}</p>
        <p className="text-body-secondary">
          {[registrado.nombres, registrado.apellidos].filter(Boolean).join(" ")}
        </p>
        <div className="ec-form-pie">
          <SecondaryButton
            title="Registrar otro"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={registrarOtro}
          />
          <PrimaryButton title="Listo" onClick={cerrar} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal visible onClose={cerrar} title="Nuevo paciente" size="lg">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {advertenciaDuplicado && (
        <div className="alert alert-warning" role="alert">
          {advertenciaDuplicado}
        </div>
      )}

      {seccionesDePaciente().map((seccion) => (
        <SeccionDeFormulario
          key={seccion.id}
          titulo={seccion.titulo}
          descripcion={seccion.descripcion}
          acento="var(--accent-pacientes)"
          campos={seccion.campos}
          valores={valores}
          errores={errores}
          catalogos={catalogos}
          onChange={setCampo}
          disabled={enviando}
          dibujarCampo={(campo) => {
            if (campo.id === "comunidad") {
              return (
                <CascadaDeComunidad
                  label={campo.label}
                  comunidadId={valores.comunidad}
                  error={errores.comunidad}
                  catalogos={catalogos}
                  departamentoId={departamentoId}
                  municipioId={municipioId}
                  onDepartamento={setDepartamento}
                  onMunicipio={setMunicipio}
                  onComunidad={(valor) => setCampo("comunidad", valor)}
                  disabled={enviando}
                  puedeCrear={puedeCrearComunidad}
                  onCrear={registrarComunidad}
                  erroresAlta={erroresComunidad}
                  creando={creandoComunidad}
                />
              );
            }
            if (campo.id === "fechaNacimiento") {
              // La edad calculada, debajo de la fecha de nacimiento: confirma de un vistazo que
              // la fecha que se acaba de escribir es la correcta.
              return (
                <div>
                  <CampoDeFormulario
                    campo={campo}
                    valor={valores[campo.id]}
                    error={errores[campo.id]}
                    catalogos={catalogos}
                    disabled={enviando}
                    onChange={(valor) => setCampo(campo.id, valor)}
                  />
                  {edad && <p className="ec-campo-nota">Edad: {edad}</p>}
                </div>
              );
            }
            return undefined;
          }}
        />
      ))}

      <div className="ec-form-pie">
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          icon={<X size={16} aria-hidden="true" />}
          onClick={cerrar}
          disabled={enviando}
        />
        <PrimaryButton
          title="Registrar paciente"
          icon={<Plus size={16} aria-hidden="true" />}
          onClick={registrar}
          loading={enviando}
        />
      </div>
    </Modal>
  );
}
