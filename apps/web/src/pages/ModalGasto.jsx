import { useState, useMemo } from "react";
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
import { X } from "lucide-react";
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
  onClose,
  onGuardado,
}) {
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState("");
  const [categoriasTemporales, setCategoriasTemporales] = useState([]);

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
  } = useFormularioGasto({
    gasto,
    usuarioId,
    estadoInicial,
  });

  const categoriasDisponibles = useMemo(() => {
    const desdeHook = catalogos.categorias || [];
    const valoresExistentes = desdeHook.map(c => String(c.value ?? c));
    const soloNuevas = categoriasTemporales.filter(
      c => !valoresExistentes.includes(String(c.value))
    );
    return [...desdeHook, ...soloNuevas];
  }, [catalogos.categorias, categoriasTemporales]);

  //  Agregar categoría y forzar valor como texto plano
  const agregarCategoria = () => {
    const nombreLimpio = nombreNuevaCategoria?.trim();
    if (!nombreLimpio) return;

    const nuevaOpcion = { value: nombreLimpio, label: nombreLimpio };
    setCategoriasTemporales(anteriores => [...anteriores, nuevaOpcion]);
    
    //  Enviar SOLO el texto, NUNCA un objeto
    setCampo("categoria", nombreLimpio);
    
    setCreandoCategoria(false);
    setNombreNuevaCategoria("");
  };

  const [pidiendoConfirmacionDeDescarte, setPidiendoConfirmacionDeDescarte] = useState(false);
  const gastoResuelto =
    esEdicion &&
    (gasto?.estado === ESTADOS_DE_GASTO.APROBADO || gasto?.estado === ESTADOS_DE_GASTO.RECHAZADO);
  const sinPermisoDeEdicion = esEdicion && !gastoResuelto && !puedeEditarGasto(rol, gasto?.estado);
  const bloqueadoPorPermisos = gastoResuelto || sinPermisoDeEdicion;
  const bloqueado = enviando || bloqueadoPorPermisos;
  const nombreDeQuienDecidio = catalogos.perfiles?.find(
    (perfil) => perfil.value === gasto?.aprobado_por
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

  const textoEstado = !esEdicion && estadoInicial
    ? estadoInicial.toUpperCase() + (estadoInicial === "pendiente" ? " — pendiente de aprobación" : "")
    : null;

  return (
    <>
      <Modal
        visible={visible}
        onClose={pedirCierre}
        title={esEdicion ? "Editar gasto" : "Registrar gasto"}
      >
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
          <div className="alert alert-warning" role="alert">
            {mensajeExcedente}
          </div>
        )}

        {CAMPOS_GASTO.map((campo) => {
          if (campo.id === "categoria") {
            const opciones = categoriasDisponibles;
            return (
              <div key={campo.id} className="mb-3">
                {!creandoCategoria ? (
                  <div className="d-flex align-items-center gap-2">
                    <div className="flex-grow-1">
                      <Selector
                        label={campo.label}
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
                    </div>
                    {!bloqueado && (
                      <PrimaryButton
                        title="+ Crear categoría nueva"
                        onClick={() => setCreandoCategoria(true)}
                      >
                        + Crear categoría nueva
                      </PrimaryButton>
                    )}
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <div className="flex-grow-1">
                      <TextField
                        label="Nueva categoría"
                        value={nombreNuevaCategoria}
                        onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                        placeholder="Escribe el nombre..."
                        autoFocus
                      />
                    </div>
                    <PrimaryButton
                      title="Guardar"
                      onClick={agregarCategoria}
                    >
                      Guardar
                    </PrimaryButton>
                    <SecondaryButton
                      title="Cancelar"
                      onClick={() => {
                        setCreandoCategoria(false);
                        setNombreNuevaCategoria("");
                      }}
                    >
                      Cancelar
                    </SecondaryButton>
                  </div>
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
                value={valores[campo.id] || null}
                options={opciones}
                onSelect={(valor) => {
                  const valorFinal = extraerValor(valor);
                  setCampo(campo.id, valorFinal);
                }}
                placeholder={opciones.length === 0 ? "Cargando..." : "Seleccionar"}
                disabled={bloqueado || (campo.validacion?.requerido && opciones.length === 0)}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.NUMERO) {
            return (
              <NumberField
                key={campo.id}
                label={campo.label}
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