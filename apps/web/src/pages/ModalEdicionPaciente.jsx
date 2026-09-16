import { useState } from "react";
import { Save, X } from "lucide-react";

import { seccionesDePaciente, useEdicionPaciente } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";
import SecondaryButton from "../components/SecondaryButton";

// Edicion de los datos de un paciente.
//
// El formulario ya no es una columna de once controles a ancho completo, uno debajo de otro:
// eran once filas que obligaban a desplazar el modal entero, sin decir nada sobre que datos van
// juntos. Ahora va en secciones -identificacion, ubicacion y contacto, datos clinicos,
// responsable- y cada seccion en dos columnas, asi que "Nombres" y "Apellidos" quedan uno al
// lado del otro, como en la ficha de papel que se sigue usando en jornada.
//
// El agrupamiento sale de seccionesDePaciente() (packages/shared/pacientes/campos.js), no de
// aqui: que datos van juntos es una decision de negocio y la comparten las dos plataformas. El
// dibujo de cada campo lo resuelve SeccionDeFormulario a partir del descriptor, que es lo que
// quita de este archivo el `switch (campo.tipo)` que estaba copiado en diez modales.

export default function ModalEdicionPaciente({ paciente, onClose, onGuardado }) {
  const { valores, errores, error, enviando, hayCambios, setCampo, descartar, guardar, catalogos } =
    useEdicionPaciente(paciente);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  const intentarCerrar = () => {
    if (hayCambios && !enviando) {
      setConfirmandoSalida(true);
      return;
    }
    onClose?.();
  };

  const salirSinGuardar = () => {
    descartar();
    setConfirmandoSalida(false);
    onClose?.();
  };

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.paciente);
  };

  return (
    <>
      <Modal
        visible={!confirmandoSalida}
        onClose={intentarCerrar}
        title="Editar datos del paciente"
        size="lg"
      >
        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
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
          />
        ))}

        <div className="ec-form-pie">
          <SecondaryButton
            title="Cancelar"
            variant="neutra"
            icon={<X size={16} aria-hidden="true" />}
            onClick={intentarCerrar}
            disabled={enviando}
          />
          <PrimaryButton
            title="Guardar cambios"
            icon={<Save size={16} aria-hidden="true" />}
            onClick={guardarCambios}
            loading={enviando}
            disabled={!hayCambios}
          />
        </div>
      </Modal>

      <Modal
        visible={confirmandoSalida}
        onClose={() => setConfirmandoSalida(false)}
        title="Hay cambios sin guardar"
      >
        <p>Si salís ahora se pierden los cambios que hiciste en la ficha del paciente.</p>
        <div className="ec-form-pie">
          <SecondaryButton
            title="Seguir editando"
            variant="neutra"
            onClick={() => setConfirmandoSalida(false)}
          />
          <PrimaryButton title="Salir sin guardar" variant="danger" onClick={salirSinGuardar} />
        </div>
      </Modal>
    </>
  );
}
