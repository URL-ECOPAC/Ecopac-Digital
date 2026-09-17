import { TIPOS_DE_CAMPO, useCapturaClinica, useRegistroConsulta } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";

import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import MultiSelector from "../components/MultiSelector";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import { almacenamientoWeb } from "../almacenamiento";
import SelectorDeJornada from "./SelectorDeJornada";
import { Save, X } from "lucide-react";

// Registro de una consulta medica desde la ficha del paciente, en web.
//
// Igual que el triaje: el hook, los campos y el guardado son los mismos que usa ConsultaScreen
// en movil (useRegistroConsulta, CAMPOS_CONSULTA, seccionesConCampos), y este archivo solo los
// dibuja. Las cuatro secciones -motivo, exploracion, diagnostico, seguimiento- salen de
// consultas.secciones.js, no de aqui: un formulario de ocho campos seguidos no se lee, y como el
// agrupamiento es una decision de negocio vive en shared y lo comparten las dos plataformas.
//
// El borrador automatico tambien se hereda: useRegistroConsulta guarda lo escrito cada 800 ms en
// el almacenamiento que se le pase. En movil es AsyncStorage; aqui es el adaptador de
// localStorage de la web. Una consulta a medio escribir sobrevive a un cierre accidental de la
// pestana, que en jornada -con la bateria justa y la conexion intermitente- pasa.

export default function ModalRegistroConsulta({ paciente, perfilId, onClose, onGuardada }) {
  const captura = useCapturaClinica();
  const { rol } = useSesionCompartida();

  const {
    secciones,
    valores,
    error,
    enviando,
    preparando,
    signos,
    bloqueo,
    setCampo,
    descartarBorrador,
    guardar,
    catalogos,
    crearDiagnosticoNuevo,
    errorDiagnostico,
  } = useRegistroConsulta({
    pacienteId: paciente?.id,
    expedienteId: paciente?.expediente?.id,
    jornadaId: captura.jornadaId,
    estadoDeJornada: captura.jornada?.estado,
    perfilId,
    almacenamiento: almacenamientoWeb,
    rol,
  });

  const guardarConsulta = async () => {
    const resultado = await guardar();
    if (resultado.ok) {
      await onGuardada?.(resultado.consulta);
      onClose?.();
    }
  };

  const listoParaGuardar = Boolean(captura.jornadaId) && bloqueo.puede && !preparando;

  return (
    <Modal visible onClose={onClose} title="Registrar consulta medica" size="lg">
      <SelectorDeJornada captura={captura} />

      {/* El bloqueo llega de puedeRegistrarEnJornada() (jornadas/validaciones.js): una jornada
        planificada o ya cerrada no acepta registros. No se oculta el formulario -ver lo que se
        iba a escribir ayuda a entender el aviso- pero si se desactiva el guardado. */}
      {captura.jornadaId && !bloqueo.puede && (
        <div className="alert alert-warning" role="status">
          {bloqueo.motivo}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {preparando && captura.jornadaId && <LoadingState message="Abriendo la atencion..." />}

      {/* Los signos del dia, si ya se tomo el triaje en esta misma atencion. Es contexto, no un
        campo: el medico necesita verlos mientras escribe, no volver a capturarlos. */}
      {signos && (
        <div className="alert alert-info" role="status">
          <span className="ec-rotulo">Signos de hoy</span>
          {[
            signos.presionSistolica && signos.presionDiastolica
              ? `Presion ${signos.presionSistolica}/${signos.presionDiastolica} mmHg`
              : null,
            signos.frecuenciaCardiaca ? `FC ${signos.frecuenciaCardiaca} lpm` : null,
            signos.temperatura ? `T ${signos.temperatura} °C` : null,
            signos.glucosa ? `Glucosa ${signos.glucosa} mg/dL` : null,
            signos.imc ? `IMC ${signos.imc}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {secciones.map((seccion) => (
        <section
          className="ec-form-seccion"
          key={seccion.id}
          style={{ "--ec-acento": "var(--accent-pacientes)" }}
        >
          <div className="ec-form-seccion-cabecera">
            <h3 className="ec-form-seccion-titulo">{seccion.titulo}</h3>
          </div>

          {seccion.campos.map((campo) => {
            if (campo.tipo === TIPOS_DE_CAMPO.MULTI_SELECT) {
              return (
                // Con crearDiagnosticoNuevo (solo quien puede mantener el catalogo), un
                // diagnostico que no esta se crea aqui mismo y queda elegido.
                <MultiSelector
                  key={campo.id}
                  label={campo.label}
                  value={valores[campo.id] ?? []}
                  options={catalogos[campo.opcionesDesde] ?? []}
                  onChange={(elegidos) => setCampo(campo.id, elegidos)}
                  placeholder="Elegir un diagnostico del catalogo"
                  placeholderLibre="O escribir uno que no este en el catalogo"
                  onCrear={crearDiagnosticoNuevo ?? undefined}
                  error={errorDiagnostico?.mensaje}
                  disabled={enviando}
                />
              );
            }

            return (
              <TextField
                key={campo.id}
                label={campo.label}
                as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
                rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
                value={valores[campo.id] ?? ""}
                onChange={(evento) => setCampo(campo.id, evento.target.value)}
                disabled={enviando}
              />
            );
          })}
        </section>
      ))}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
        <SecondaryButton
          title="Descartar borrador"
          variant="peligro"
          size="sm"
          onClick={descartarBorrador}
          disabled={enviando}
        />
        <div className="ec-acciones">
          <SecondaryButton
            title="Cancelar"
            variant="neutra"
            onClick={onClose}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title="Guardar consulta"
            onClick={guardarConsulta}
            loading={enviando}
            disabled={!listoParaGuardar}
            icon={<Save size={16} aria-hidden="true" />}
          />
        </div>
      </div>
    </Modal>
  );
}
