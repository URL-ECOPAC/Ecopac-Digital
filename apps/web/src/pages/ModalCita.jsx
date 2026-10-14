import { useState } from "react";
import { Save, X } from "lucide-react";

import { puedeRegistrarPaciente, useFormularioCita } from "@ecopac/shared";

import CampoDeFormulario, { ocupaFilaCompleta } from "../components/CampoDeFormulario";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import SelectorConAlta from "../components/SelectorConAlta";
import ModalAltaPaciente from "./ModalAltaPaciente";
import SelectorDePacienteCita from "./SelectorDePacienteCita";

// Alta y edicion de una cita (issue #927). Todo lo que decide -opciones, reglas que encadenan
// campos, el espejo de cupo y traslapes, que se puede cambiar- es useFormularioCita() en shared.
//
// El paciente se busca con el buscador de siempre; si no esta registrado, se abre el alta de
// paciente en lugar de este modal (como ModalConsulta con la receta) y se vuelve con el elegido:
// el hook sigue montado y no se pierde lo escrito. La clinica tiene alta en linea con una sala.

function Seccion({ titulo, children }) {
  return (
    <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-pacientes)" }}>
      <div className="ec-form-seccion-cabecera">
        <h3 className="ec-form-seccion-titulo">{titulo}</h3>
      </div>
      {children}
    </section>
  );
}

export default function ModalCita({ rol, cita = null, inicial = {}, onClose, onGuardada }) {
  const f = useFormularioCita({ rol, cita, inicial });
  const [registrando, setRegistrando] = useState(false);

  const guardar = async () => {
    const resultado = await f.guardar();
    if (resultado.ok) await onGuardada?.(resultado.cita);
  };

  if (registrando) {
    return (
      <ModalAltaPaciente
        rol={rol}
        onClose={() => setRegistrando(false)}
        onRegistrado={(registrado) => {
          if (!registrado?.id) return;
          f.setPaciente({
            id: registrado.id,
            nombre: [registrado.nombres, registrado.apellidos].filter(Boolean).join(" "),
            numeroFicha: registrado.expediente?.numeroFicha ?? null,
          });
        }}
      />
    );
  }

  const soloNotas = !f.esNueva && !f.edicion.agenda;
  const campo = (id) => f.campos.find((uno) => uno.id === id);
  const deshabilitado = (id) => f.enviando || (soloNotas && id !== "notas");

  const dibujar = (id) => {
    const descriptor = campo(id);
    if (id === "clinicaId") {
      return (
        <SelectorConAlta
          key={id}
          label={descriptor.label}
          requerido
          value={f.valores.clinicaId}
          options={f.catalogos.clinicas}
          onSelect={(valor) => f.setValor("clinicaId", valor)}
          placeholder="Elegir una clínica"
          error={f.errores.clinicaId}
          disabled={deshabilitado(id)}
          puedeCrear={f.altaDeClinica.puedeCrear && !soloNotas}
          etiquetaAlta="Crear una clínica"
          labelNuevo="Nombre de la clínica (se crea con 1 sala)"
          onCrear={f.altaDeClinica.crear}
          erroresAlta={f.altaDeClinica.errores}
          creando={f.altaDeClinica.creando}
        />
      );
    }
    return (
      // La celda de la cuadricula es este div: el ancho completo del campo va aqui.
      <div key={id} style={ocupaFilaCompleta(descriptor) ? { gridColumn: "1 / -1" } : undefined}>
        <CampoDeFormulario
          campo={descriptor}
          valor={f.valores[id]}
          onChange={(valor) => f.setValor(id, valor)}
          error={f.errores[id]}
          catalogos={f.catalogos}
          disabled={deshabilitado(id)}
        />
        {!f.errores[id] && f.avisos[id] && (
          <p className="ec-aviso-alarma" role="status">
            {f.avisos[id]}
          </p>
        )}
        {descriptor.ayuda && !f.errores[id] && !f.avisos[id] && (
          <p className="ec-campo-nota">{descriptor.ayuda}</p>
        )}
      </div>
    );
  };

  return (
    <Modal
      visible
      onClose={onClose}
      title={f.esNueva ? "Agendar cita" : soloNotas ? "Notas de la cita" : "Editar cita"}
      size="lg"
    >
      {soloNotas && (
        <p className="ec-campo-nota">
          La cita ya no está creada: solo se pueden cambiar sus notas.
        </p>
      )}

      {f.error && (
        <div className="alert alert-danger" role="alert">
          {f.error.mensaje}
        </div>
      )}

      <SelectorDePacienteCita
        paciente={f.paciente}
        onElegir={f.setPaciente}
        fijo={f.pacienteFijo}
        error={f.errores.pacienteId}
        disabled={f.enviando}
        puedeRegistrar={puedeRegistrarPaciente(rol)}
        onRegistrar={() => setRegistrando(true)}
      />

      <Seccion titulo="Dónde y con quién">
        <div className="ec-form-grid">
          {["jornadaId", "clinicaId", "areaId", "profesionalId"].map(dibujar)}
        </div>
      </Seccion>

      <Seccion titulo="Cuándo">
        <div className="ec-form-grid">{["fecha", "horaInicio", "horaFin"].map(dibujar)}</div>
      </Seccion>

      <Seccion titulo="Notas">
        <div className="ec-form-grid">{["notas"].map(dibujar)}</div>
      </Seccion>

      <div className="ec-form-pie">
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          onClick={onClose}
          disabled={f.enviando}
          icon={<X size={16} aria-hidden="true" />}
        />
        <PrimaryButton
          title={f.esNueva ? "Agendar cita" : "Guardar cambios"}
          onClick={guardar}
          loading={f.enviando}
          icon={<Save size={16} aria-hidden="true" />}
        />
      </div>
    </Modal>
  );
}
