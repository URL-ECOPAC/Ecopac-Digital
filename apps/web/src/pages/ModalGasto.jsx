import { useState } from "react";
import {
  CAMPOS_GASTO,
  ESTADOS_DE_GASTO,
  TIPOS_DE_CAMPO,
  formatearFechaCorta,
  puedeEditarGasto,
  useFormularioGasto,
} from "@ecopac/shared";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import { Plus, X } from "lucide-react";
import DateField from "../components/DateField";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

//  Función mejorada: maneja todos los formatos
function extraerValor(valor) {
  if (!valor && valor !== 0) return "";
  if (typeof valor === "object" && valor !== null) {
    if (valor.value !== undefined) return String(valor.value);
    if (valor.id !== undefined) return String(valor.id);
  }
  return String(valor ?? "");
}

export default function ModalGasto({
  visible = true,
  gasto,
  usuarioId,
  rol,
  estadoInicial,
  jornadaId = null,
  onClose,
  onGuardado,
}) {
  const [altaDeCategoriaAbierta, setAltaDeCategoriaAbierta] = useState(false);
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState("");

  const {
    valores,
    errores,
    error,
    enviando,
    esEdicion,
    sucio,
    catalogos,
    esExcedente,
    mensajeExcedente,
    setCampo,
    enviar,
    puedeCrearCategoria,
    crearCategoria,
    creandoCategoria,
    errorCategoria,
    limpiarErrorCategoria,
    jornadaFija,
  } = useFormularioGasto({
    gasto,
    usuarioId,
    estadoInicial,
    rol,
    jornadaId,
  });

  // La categoria se guarda en el catalogo (00158) y queda elegida; si falla, el formulario de alta
  // sigue abierto con el error.
  const agregarCategoria = async () => {
    if (await crearCategoria(nombreNuevaCategoria)) {
      setAltaDeCategoriaAbierta(false);
      setNombreNuevaCategoria("");
    }
  };

  const cerrarAltaDeCategoria = () => {
    setAltaDeCategoriaAbierta(false);
    setNombreNuevaCategoria("");
    limpiarErrorCategoria();
  };

  const [pidiendoConfirmacionDeDescarte, setPidiendoConfirmacionDeDescarte] = useState(false);
  const gastoResuelto =
    esEdicion &&
    (gasto?.estado === ESTADOS_DE_GASTO.APROBADO || gasto?.estado === ESTADOS_DE_GASTO.RECHAZADO);
  const sinPermisoDeEdicion = esEdicion && !gastoResuelto && !puedeEditarGasto(rol, gasto?.estado);
  const bloqueadoPorPermisos = gastoResuelto || sinPermisoDeEdicion;
  const bloqueado = enviando || bloqueadoPorPermisos;
  const nombreDeQuienDecidio = catalogos.perfiles?.find(
    (perfil) => perfil.value === gasto?.aprobado_por,
  )?.label;
  // Quien lo registro: con el personal de campo registrando gastos que pasan por la aprobacion,
  // quien lo revisa tiene que ver de quien viene, no solo en la bandeja.
  const nombreDeQuienRegistro = catalogos.perfiles?.find(
    (perfil) => perfil.value === gasto?.registrado_por,
  )?.label;

  const pedirCierre = () => {
    if (sucio && !bloqueadoPorPermisos) {
      setPidiendoConfirmacionDeDescarte(true);
      return;
    }
    onClose?.();
  };

  const confirmarDescarte = () => {
    setPidiendoConfirmacionDeDescarte(false);
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.gasto);
      onClose?.();
    }
  };

  const textoEstado =
    !esEdicion && estadoInicial
      ? estadoInicial.toUpperCase() +
        (estadoInicial === "pendiente" ? " — pendiente de aprobación" : "")
      : null;

  return (
    <>
      <Modal
        visible={visible}
        onClose={pedirCierre}
        title={esEdicion ? "Editar gasto" : "Registrar gasto"}
      >
        {esEdicion && gasto?.registrado_por && (
          <p className="small mb-2" style={{ color: "var(--color-text-muted)" }}>
            Registrado por {nombreDeQuienRegistro || "una persona que ya no está en el directorio"}
            {gasto.created_at ? ` el ${formatearFechaCorta(gasto.created_at)}` : ""}.
          </p>
        )}

        {gastoResuelto && (
          <div className="alert alert-secondary" role="alert">
            <div>Este gasto ya esta {gasto.estado} y no se puede editar.</div>
            {nombreDeQuienDecidio && (
              <div className="mt-1">
                {gasto.estado === ESTADOS_DE_GASTO.APROBADO ? "Aprobado" : "Rechazado"} por{" "}
                {nombreDeQuienDecidio}
                {gasto.aprobado_en ? ` el ${formatearFechaCorta(gasto.aprobado_en)}` : ""}.
              </div>
            )}
            {gasto.estado === ESTADOS_DE_GASTO.RECHAZADO && gasto.motivo_rechazo && (
              <div className="mt-1">Motivo: {gasto.motivo_rechazo}</div>
            )}
          </div>
        )}

        {sinPermisoDeEdicion && (
          <div className="alert alert-secondary" role="alert">
            No tienes permiso para editar este gasto.
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
          </div>
        )}

        {errores.length > 0 && (
          <div className="alert alert-danger" role="alert">
            <ul className="mb-0 ps-3">
              {errores.map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          </div>
        )}

        {esExcedente && (
          <div className="alert alert-danger" role="alert">
            {mensajeExcedente}
          </div>
        )}

        {CAMPOS_GASTO.map((campo) => {
          if (campo.id === "categoria") {
            const opciones = catalogos.categorias;
            return (
              <div key={campo.id} className="mb-3">
                {/* Crear una opcion dentro de un formulario es una accion secundaria: boton en
                    contorno con "+" debajo del selector, el mismo de "Crear una comunidad"
                    (SelectorConAlta). El verde solido con icono de guardar es solo del boton que
                    guarda el formulario. */}
                {!altaDeCategoriaAbierta ? (
                  <>
                    <Selector
                      label={campo.label}
                      requerido={campo.validacion?.requerido}
                      value={valores[campo.id] || null}
                      options={opciones}
                      onSelect={(valor) => {
                        //  Garantizar texto plano SIEMPRE
                        const valorFinal = extraerValor(valor);
                        setCampo(campo.id, valorFinal);
                      }}
                      placeholder={opciones.length === 0 ? "Cargando..." : "Seleccionar"}
                      disabled={bloqueado || (campo.validacion?.requerido && opciones.length === 0)}
                    />
                    {!bloqueado && puedeCrearCategoria && (
                      <SecondaryButton
                        title="Crear categoría nueva"
                        size="sm"
                        icon={<Plus size={14} aria-hidden="true" />}
                        onClick={() => setAltaDeCategoriaAbierta(true)}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <TextField
                      label="Nueva categoría"
                      requerido
                      value={nombreNuevaCategoria}
                      onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                      placeholder="Escribe el nombre..."
                      error={errorCategoria?.mensaje}
                      disabled={creandoCategoria}
                      autoFocus
                    />
                    <div className="ec-acciones">
                      <PrimaryButton
                        title="Guardar"
                        size="sm"
                        onClick={agregarCategoria}
                        loading={creandoCategoria}
                        disabled={!nombreNuevaCategoria.trim()}
                      />
                      <SecondaryButton
                        title="Cancelar"
                        variant="neutra"
                        size="sm"
                        icon={<X size={14} aria-hidden="true" />}
                        onClick={cerrarAltaDeCategoria}
                        disabled={creandoCategoria}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                requerido={campo.validacion?.requerido}
                value={valores[campo.id] || null}
                options={opciones}
                onSelect={(valor) => {
                  const valorFinal = extraerValor(valor);
                  setCampo(campo.id, valorFinal);
                }}
                placeholder={opciones.length === 0 ? "Cargando..." : "Seleccionar"}
                disabled={
                  bloqueado ||
                  (campo.id === "jornada_id" && jornadaFija) ||
                  (campo.validacion?.requerido && opciones.length === 0)
                }
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.NUMERO) {
            return (
              <NumberField
                key={campo.id}
                label={campo.label}
                requerido={campo.validacion?.requerido}
                value={valores[campo.id] === "" ? null : Number(valores[campo.id])}
                min={campo.validacion?.minimo}
                step={0.01}
                onChange={(valor) => setCampo(campo.id, valor ?? "")}
                disabled={bloqueado}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                requerido={campo.validacion?.requerido}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor || "")}
                disabled={bloqueado}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              requerido={campo.validacion?.requerido}
              placeholder={campo.placeholder}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => setCampo(campo.id, evento.target.value)}
              disabled={bloqueado}
            />
          );
        })}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton
            title="Cancelar"
            onClick={pedirCierre}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          {!bloqueadoPorPermisos && (
            <PrimaryButton
              title={esEdicion ? "Guardar" : "Registrar"}
              onClick={guardar}
              loading={enviando}
            />
          )}
        </div>
      </Modal>

      {pidiendoConfirmacionDeDescarte && (
        <Modal
          visible
          onClose={() => setPidiendoConfirmacionDeDescarte(false)}
          title="Descartar cambios"
        >
          <div className="alert alert-warning" role="alert">
            Hay cambios sin guardar en este gasto. ¿Confirmas que quieres descartarlos?
          </div>
          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton
              title="Seguir editando"
              onClick={() => setPidiendoConfirmacionDeDescarte(false)}
            />
            <PrimaryButton title="Descartar cambios" onClick={confirmarDescarte} />
          </div>
        </Modal>
      )}
    </>
  );
}
