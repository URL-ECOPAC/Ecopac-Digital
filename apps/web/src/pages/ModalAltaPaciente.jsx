import { Plus, X } from "lucide-react";

import { seccionesDePaciente, useRegistroPaciente } from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import SelectorConAlta from "../components/SelectorConAlta";

// Alta de un paciente.
//
// Mismo formulario y mismo agrupamiento que la edicion (seccionesDePaciente(), en
// packages/shared/pacientes/campos.js): las dos pantallas capturan los mismos once campos, y que
// se vieran distinto era solo consecuencia de que cada una los dibujaba por su cuenta.
//
// Lo unico propio de esta pantalla es la cascada de comunidad -departamento, municipio,
// comunidad, con la opcion de crear una que no existe todavia-, que reemplaza al campo
// "comunidad" dentro de su seccion. Es la razon por la que este archivo recorre las secciones a
// mano en vez de usar SeccionDeFormulario como hace la edicion.

/** La cascada territorial, en el lugar que ocuparia el campo "comunidad". */
function CampoDeComunidad({
  campo,
  valores,
  errores,
  catalogos,
  departamentoId,
  municipioId,
  setCampo,
  setDepartamento,
  setMunicipio,
  enviando,
  puedeCrearComunidad,
  registrarComunidad,
  erroresComunidad,
  creandoComunidad,
}) {
  // Departamento y municipio en una fila; comunidad y "Crear una comunidad" en la siguiente, lado
  // a lado. Antes los tres selectores iban en la misma fila y el boton debajo, solo, a todo el
  // ancho: la accion quedaba lejos del campo al que se refiere.
  //
  // El par "comunidad + crear una que falta" ya no se escribe aqui: es SelectorConAlta, el mismo
  // control que ahora usan el alta de jornada y los catalogos clinicos (issue #834).
  return (
    <div className="ec-form-grid--ancho ec-form-subgrid">
      <Selector
        label="Departamento"
        value={departamentoId}
        options={catalogos.departamentos}
        onSelect={setDepartamento}
        placeholder="Selecciona un departamento"
        disabled={enviando || catalogos.departamentos.length === 0}
      />
      <Selector
        label="Municipio"
        value={municipioId}
        options={catalogos.municipios}
        onSelect={setMunicipio}
        placeholder="Selecciona un municipio"
        disabled={enviando || !departamentoId || catalogos.municipios.length === 0}
      />
      <SelectorConAlta
        label={campo.label}
        value={valores.comunidad || null}
        options={catalogos.comunidades}
        onSelect={(valor) => setCampo("comunidad", valor)}
        placeholder="Selecciona una comunidad"
        error={errores.comunidad}
        disabled={enviando || !municipioId}
        puedeCrear={puedeCrearComunidad}
        habilitadoParaCrear={Boolean(municipioId)}
        etiquetaAlta="Crear una comunidad"
        labelNuevo="Nombre de la comunidad nueva"
        onCrear={registrarComunidad}
        erroresAlta={erroresComunidad}
        creando={creandoComunidad}
      />
    </div>
  );
}

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
        <section
          className="ec-form-seccion"
          key={seccion.id}
          style={{ "--ec-acento": "var(--accent-pacientes)" }}
        >
          <div className="ec-form-seccion-cabecera">
            <h3 className="ec-form-seccion-titulo">{seccion.titulo}</h3>
            {seccion.descripcion && (
              <p className="ec-form-seccion-descripcion">{seccion.descripcion}</p>
            )}
          </div>

          <div className="ec-form-grid">
            {seccion.campos.map((campo) => {
              if (campo.id === "comunidad") {
                return (
                  <CampoDeComunidad
                    key={campo.id}
                    campo={campo}
                    valores={valores}
                    errores={errores}
                    catalogos={catalogos}
                    departamentoId={departamentoId}
                    municipioId={municipioId}
                    setCampo={setCampo}
                    setDepartamento={setDepartamento}
                    setMunicipio={setMunicipio}
                    enviando={enviando}
                    puedeCrearComunidad={puedeCrearComunidad}
                    registrarComunidad={registrarComunidad}
                    erroresComunidad={erroresComunidad}
                    creandoComunidad={creandoComunidad}
                  />
                );
              }

              return (
                <div key={campo.id}>
                  <CampoDeFormulario
                    campo={campo}
                    valor={valores[campo.id]}
                    error={errores[campo.id]}
                    catalogos={catalogos}
                    disabled={enviando}
                    onChange={(valor) => setCampo(campo.id, valor)}
                  />
                  {/* La edad calculada, debajo de la fecha de nacimiento: confirma de un
                    vistazo que la fecha que se acaba de escribir es la correcta. */}
                  {campo.id === "fechaNacimiento" && edad && (
                    <p className="ec-campo-nota">Edad: {edad}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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
