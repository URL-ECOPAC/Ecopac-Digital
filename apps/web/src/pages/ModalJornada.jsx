import { CAMPOS_FORMULARIO_JORNADA, TIPOS_DE_CAMPO, useFormularioJornada } from "@ecopac/shared";
import NumberField from "../components/NumberField";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SelectorConAlta from "../components/SelectorConAlta";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import { X } from "lucide-react";

// Modal de alta y edicion de jornada (issue #179), montado desde JornadasPage.jsx con estado
// local: no tiene ruta propia, mismo patron que ModalAltaUsuario.jsx/ModalEdicionUsuario.jsx
// (#106/#107). A diferencia de esas dos, aca es un solo componente para las dos operaciones
// (revision del plan, PLAN.md seccion 7, decision 4): `jornada` ausente es alta, `jornada` con
// datos es edicion. El estado, la validacion, la cascada de comunidad y la llamada al servidor
// van en useFormularioJornada(), no aca: este componente solo dibuja lo que el hook le entrega.
//
// Etiquetas, tipos y orden de los campos salen de CAMPOS_FORMULARIO_JORNADA (los cinco campos
// que #179 confirmo -nombre, fecha, comunidad, responsable, proyecto- mas cupoEstimado y
// botiquinBodega, agregados por la auditoria campo-a-vista de la issue #756), no de literales
// propios.
//
// El campo `comunidad` es especial: en vez de un solo Selector, son tres en cascada
// (departamento -> municipio -> comunidad, criterio 2). Los dos primeros no son campos del
// formulario -- jornadas no guarda departamento ni municipio -- asi que no aparecen en
// CAMPOS_FORMULARIO_JORNADA; solo acotan las opciones del Selector real de comunidad.
const TIPO_DE_INPUT = {
  texto: "text",
};

export default function ModalJornada({ visible = true, jornada, rol, onClose, onGuardado }) {
  const {
    valores,
    errores,
    error,
    enviando,
    cargando,
    esEdicion,
    catalogos,
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    setCampo,
    advertenciaDuplicado,
    enviar,
    cancelar,
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
  } = useFormularioJornada({ jornada, rol });

  // Deshabilita el formulario mientras se envia Y mientras se carga la jornada completa para
  // editar (obtenerJornada(), ver useFormularioJornada.js). En el alta `cargando` siempre es
  // false, no hay nada que pedir antes de mostrar el formulario vacio.
  const bloqueado = enviando || cargando;

  const cerrar = () => {
    cancelar();
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.jornada);
      onClose?.();
    }
  };

  // Un campo del descriptor, con el control que le toca.
  const dibujarCampo = (campo) => {
    if (campo.id === "comunidad") {
      return (
        <div key="comunidad-cascada" className="ec-form-grid--ancho ec-form-grid">
          <Selector
            label="Departamento"
            value={departamentoId}
            options={catalogos.departamentos}
            onSelect={setDepartamento}
            placeholder="Selecciona un departamento"
            disabled={bloqueado}
          />
          <Selector
            label="Municipio"
            value={municipioId}
            options={catalogos.municipios}
            onSelect={setMunicipio}
            placeholder="Selecciona un municipio"
            disabled={bloqueado || !departamentoId || catalogos.municipios.length === 0}
          />
          {/* La comunidad de una jornada nueva muchas veces todavia no existe en el catalogo
              (issue #838): se crea aqui mismo, con el mismo control que el alta de paciente. */}
          <SelectorConAlta
            label={campo.label}
            value={valores.comunidad || null}
            options={catalogos.comunidades}
            onSelect={(valor) => setCampo("comunidad", valor)}
            placeholder="Selecciona una comunidad"
            disabled={bloqueado || !municipioId}
            error={errores.comunidad}
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

    if (campo.tipo === TIPOS_DE_CAMPO.NUMERO) {
      return (
        <NumberField
          key={campo.id}
          label={campo.label}
          value={valores[campo.id] ?? null}
          min={campo.validacion?.min}
          onChange={(valor) => setCampo(campo.id, valor)}
          error={errores[campo.id]}
          disabled={bloqueado}
        />
      );
    }

    if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
      return (
        <DateField
          key={campo.id}
          label={campo.label}
          value={valores[campo.id] || null}
          onChange={(valor) => setCampo(campo.id, valor)}
          error={errores[campo.id]}
          disabled={bloqueado}
        />
      );
    }

    if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
      const opciones = catalogos[campo.opcionesDesde] ?? [];
      return (
        <Selector
          key={campo.id}
          label={campo.label}
          value={valores[campo.id] || null}
          options={opciones}
          onSelect={(valor) => setCampo(campo.id, valor)}
          placeholder={opciones.length === 0 ? "Cargando..." : "Seleccionar"}
          disabled={bloqueado || opciones.length === 0}
          error={errores[campo.id]}
        />
      );
    }

    return (
      <TextField
        key={campo.id}
        label={campo.label}
        type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
        maxLength={campo.validacion?.maxLongitud}
        value={valores[campo.id] ?? ""}
        onChange={(evento) => setCampo(campo.id, evento.target.value)}
        error={errores[campo.id]}
        disabled={bloqueado}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      onClose={cerrar}
      title={esEdicion ? "Editar jornada" : "Nueva jornada"}
      size="lg"
    >
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

      {/* Dos secciones en dos columnas, como el alta de paciente y la de colaborador: antes eran
          nueve campos a ancho completo uno debajo de otro, en un modal angosto que habia que
          desplazar entero. */}
      <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-jornadas)" }}>
        <div className="ec-form-seccion-cabecera">
          <h3 className="ec-form-seccion-titulo">Datos de la jornada</h3>
          <p className="ec-form-seccion-descripcion">Que es, cuando y quien la organiza.</p>
        </div>
        <div className="ec-form-grid">
          {CAMPOS_FORMULARIO_JORNADA.filter((campo) => campo.id !== "comunidad").map(dibujarCampo)}
        </div>
      </section>

      <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-jornadas)" }}>
        <div className="ec-form-seccion-cabecera">
          <h3 className="ec-form-seccion-titulo">Lugar</h3>
          <p className="ec-form-seccion-descripcion">La comunidad donde se atiende.</p>
        </div>
        {CAMPOS_FORMULARIO_JORNADA.filter((campo) => campo.id === "comunidad").map(dibujarCampo)}
      </section>

      <div className="ec-form-pie">
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          onClick={cerrar}
          disabled={enviando}
          icon={<X size={16} aria-hidden="true" />}
        />
        <PrimaryButton
          title={esEdicion ? "Guardar" : "Crear"}
          onClick={guardar}
          disabled={cargando}
          loading={enviando}
        />
      </div>
    </Modal>
  );
}
