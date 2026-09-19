import { useState } from "react";
import { Pill, Save, X } from "lucide-react";

import {
  formatearFechaCorta,
  TIPOS_DE_CAMPO,
  useCapturaClinica,
  useConsulta,
} from "@ecopac/shared";

import { almacenamientoWeb } from "../almacenamiento";
import FormularioSignosVitales from "../components/FormularioSignosVitales";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import MultiSelector from "../components/MultiSelector";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import ModalGeneracionReceta from "./ModalGeneracionReceta";
import SelectorDeJornada from "./SelectorDeJornada";

// La consulta como unidad del historial (issue #840, bloque F).
//
// Un solo modal para "Nueva consulta" y para abrir una visita que ya existe: dentro se registran,
// o no, los signos vitales; se registra la consulta; y se registra, o no, la receta. Reemplaza a
// cuatro modales -tomar signos, registrar consulta, corregir triaje, corregir consulta- que
// pedian lo mismo con formularios distintos (regla B1).
//
// Todo lo que decide -que se precarga, que se puede cambiar, que se escribe al guardar- es
// useConsulta() en packages/shared. Aqui solo se dibuja.

function Seccion({ titulo, descripcion, children }) {
  return (
    <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-pacientes)" }}>
      <div className="ec-form-seccion-cabecera">
        <h3 className="ec-form-seccion-titulo">{titulo}</h3>
        {descripcion && <p className="ec-form-seccion-descripcion">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ModalConsulta({
  paciente,
  visita = null,
  rol,
  perfilId,
  onClose,
  onGuardada,
}) {
  // La jornada solo se elige para una consulta nueva: una visita existente ya tiene la suya.
  const captura = useCapturaClinica({ habilitado: !visita });
  const [recetando, setRecetando] = useState(false);

  const c = useConsulta({
    paciente,
    visita,
    jornadaId: captura.jornadaId,
    estadoDeJornada: visita ? undefined : captura.jornada?.estado,
    perfilId,
    rol,
    almacenamiento: almacenamientoWeb,
  });

  const guardar = async () => {
    const resultado = await c.guardar();
    if (resultado.ok) await onGuardada?.();
  };

  const titulo = c.esNueva
    ? "Nueva consulta"
    : `Consulta del ${formatearFechaCorta(c.visita?.fecha)}${c.visita?.jornada ? ` · ${c.visita.jornada}` : ""}`;

  if (recetando) {
    return (
      <ModalGeneracionReceta
        paciente={paciente}
        rol={rol}
        perfilId={perfilId}
        consultaFijada={c.receta.consultaId}
        onClose={() => setRecetando(false)}
        onGenerada={async () => {
          setRecetando(false);
          await onGuardada?.();
          onClose?.();
        }}
      />
    );
  }

  return (
    <Modal visible onClose={onClose} title={titulo} size="lg">
      {!visita && <SelectorDeJornada captura={captura} />}

      {c.esNueva && c.jornadaId && !c.bloqueo.puede && (
        <div className="alert alert-warning" role="status">
          {c.bloqueo.motivo}
        </div>
      )}

      {c.error && (
        <div className="alert alert-danger" role="alert">
          {c.error.mensaje}
        </div>
      )}

      {c.guardadaAlMenosUnaVez && !c.error && (
        <div className="alert alert-success" role="status">
          Consulta guardada.
        </div>
      )}

      <Seccion
        titulo="1. Signos vitales"
        descripcion={
          c.signosTomadosPor
            ? `Tomados por ${c.signosTomadosPor}. Opcionales: se registra lo que se pudo medir.`
            : "Opcionales: se registra lo que se pudo medir."
        }
      >
        {!c.permisos.signos && (
          <p className="ec-campo-nota">
            Tu rol no puede {c.visita?.signos ? "corregir" : "tomar"} los signos.
          </p>
        )}
        <FormularioSignosVitales
          campos={c.camposDeSignos}
          valores={c.signos}
          onChange={c.setSigno}
          errores={c.errores.signos}
          avisos={c.avisos}
          imc={c.imc}
          disabled={c.enviando || !c.permisos.signos}
        />
      </Seccion>

      <Seccion titulo="2. Consulta">
        {!c.permisos.consulta && (
          <p className="ec-campo-nota">
            {c.visita?.consulta
              ? "Solo quien registro la consulta, o la administracion, puede cambiarla."
              : "La consulta la registra el personal medico."}
          </p>
        )}
        {c.seccionesDeConsulta.map((seccion) => (
          <div key={seccion.id}>
            <p className="ec-rotulo mb-2">{seccion.titulo}</p>
            {seccion.campos.map((campo) =>
              campo.tipo === TIPOS_DE_CAMPO.MULTI_SELECT ? (
                <MultiSelector
                  key={campo.id}
                  label={campo.label}
                  value={c.consulta[campo.id] ?? []}
                  options={c.catalogos[campo.opcionesDesde] ?? []}
                  onChange={(elegidos) => c.setCampoDeConsulta(campo.id, elegidos)}
                  placeholder="Elegir un diagnóstico del catálogo"
                  placeholderLibre="O escribir uno que no esté en el catálogo"
                  onCrear={c.crearDiagnosticoNuevo ?? undefined}
                  error={c.errorDiagnostico?.mensaje}
                  disabled={c.enviando || !c.permisos.consulta}
                />
              ) : (
                <TextField
                  key={campo.id}
                  label={campo.validacion?.requerido ? `${campo.label} *` : campo.label}
                  as="textarea"
                  rows={campo.id === "motivoConsulta" ? 2 : 3}
                  value={c.consulta[campo.id] ?? ""}
                  onChange={(evento) => c.setCampoDeConsulta(campo.id, evento.target.value)}
                  error={c.errores.consulta[campo.id]}
                  disabled={c.enviando || !c.permisos.consulta}
                />
              ),
            )}
          </div>
        ))}
      </Seccion>

      <Seccion
        titulo="3. Receta"
        descripcion="Opcional. Se emite sobre la consulta guardada y descuenta del inventario."
      >
        {c.receta.existentes.length > 0 ? (
          <ul className="mb-0">
            {c.receta.existentes.map((receta) => (
              <li key={receta.id}>
                Receta {receta.folio ?? ""}
                {receta.anulada ? " (anulada)" : ""}: {receta.medicamentos.length}{" "}
                {receta.medicamentos.length === 1 ? "medicamento" : "medicamentos"}
              </li>
            ))}
          </ul>
        ) : c.receta.puedeAgregar ? (
          <SecondaryButton
            title="Agregar receta"
            icon={<Pill size={16} aria-hidden="true" />}
            onClick={() => setRecetando(true)}
            disabled={c.enviando || c.hayCambios}
          />
        ) : (
          <p className="ec-campo-nota mb-0">
            {c.permisos.receta
              ? "Primero guarda la consulta: la receta se emite sobre ella."
              : "La receta la emite el personal medico."}
          </p>
        )}
        {c.receta.puedeAgregar && c.hayCambios && c.receta.existentes.length === 0 && (
          <p className="ec-campo-nota">Guarda los cambios antes de emitir la receta.</p>
        )}
      </Seccion>

      {c.enviando && <LoadingState message="Guardando la consulta..." />}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
        {c.esNueva ? (
          <SecondaryButton
            title="Descartar borrador"
            variant="peligro"
            size="sm"
            onClick={c.descartarBorrador}
            disabled={c.enviando}
          />
        ) : (
          <span />
        )}
        <div className="ec-acciones">
          <SecondaryButton
            title={c.guardadaAlMenosUnaVez && !c.hayCambios ? "Cerrar" : "Cancelar"}
            variant="neutra"
            onClick={onClose}
            disabled={c.enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title="Guardar consulta"
            onClick={guardar}
            loading={c.enviando}
            disabled={!c.hayCambios}
            icon={<Save size={16} aria-hidden="true" />}
          />
        </div>
      </div>
    </Modal>
  );
}
