import { useState } from "react";
import {
  CAMPOS_GASTO,
  ESTADOS_DE_GASTO,
  TIPOS_DE_CAMPO,
  puedeEditarGasto,
  useFormularioGasto,
} from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import DateField from "../components/DateField";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

// Modal de alta y edicion de gasto (issue #303), montado desde TablaGastos.jsx con estado
// local: mismo patron que ModalJornada.jsx. `gasto` ausente es alta; `gasto` con datos es
// edicion.
//
// Bloqueo de edicion (criterio 5): un gasto ya `aprobado`/`rechazado` no se puede editar
// (puedeEditarGasto() de permisos.js, que ya recibe el estado ademas del rol -
// tr_bloquear_gasto_finalizado en 00052 lo impide igual en el servidor). El formulario se
// deshabilita entero y se explica por que, en vez de dejar que el intento de guardar falle en
// silencio contra el trigger.
//
// Descarte con confirmacion (criterio 6): no hay ruteo que bloquear -es un modal, no una ruta
// propia, y apps/web no tiene ningun mecanismo de bloqueo de navegacion todavia (se verifico
// antes de escribir esto)-, asi que "abandonar la pantalla" es cerrar el modal. `sucio` del
// hook marca si hay cambios sin guardar; cerrar con cambios pendientes pide confirmacion con el
// mismo patron de Modal + alert-warning que ya usa JornadasPage.jsx para confirmar finalizar una
// jornada, en vez de un window.confirm() nativo fuera del catalogo visual de la app.
export default function ModalGasto({ visible = true, gasto, usuarioId, rol, onClose, onGuardado }) {
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
    cancelar,
  } = useFormularioGasto({ gasto, usuarioId });

  const [pidiendoConfirmacionDeDescarte, setPidiendoConfirmacionDeDescarte] = useState(false);

  // Dos motivos distintos por los que una edicion puede estar bloqueada, con dos mensajes
  // distintos: el gasto ya se resolvio (aprobado/rechazado, bloqueado para CUALQUIER rol --
  // tr_bloquear_gasto_finalizado en 00052 tampoco distingue), o el gasto sigue pendiente pero
  // quien mira esta pantalla no tiene permiso para editarlo (puedeEditarGasto(), permisos.js).
  const gastoResuelto =
    esEdicion &&
    (gasto.estado === ESTADOS_DE_GASTO.APROBADO || gasto.estado === ESTADOS_DE_GASTO.RECHAZADO);
  const sinPermisoDeEdicion = esEdicion && !gastoResuelto && !puedeEditarGasto(rol, gasto.estado);
  const bloqueadoPorPermisos = gastoResuelto || sinPermisoDeEdicion;

  const bloqueado = enviando || bloqueadoPorPermisos;

  const pedirCierre = () => {
    if (sucio && !bloqueadoPorPermisos) {
      setPidiendoConfirmacionDeDescarte(true);
      return;
    }
    cancelar();
    onClose?.();
  };

  const confirmarDescarte = () => {
    setPidiendoConfirmacionDeDescarte(false);
    cancelar();
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.gasto);
      onClose?.();
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        onClose={pedirCierre}
        title={esEdicion ? "Editar gasto" : "Registrar gasto"}
      >
        {gastoResuelto && (
          <div className="alert alert-secondary" role="alert">
            Este gasto ya esta {gasto.estado} y no se puede editar.
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
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            // "categoria" trae sus opciones ya escritas (campo.opciones, el enum
            // categoria_gasto vía campos.js) en vez de opcionesDesde: es un catálogo cerrado,
            // no uno que salga de la base. Mismo orden de resolución que FilterBar.jsx.
            const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                options={opciones}
                onSelect={(valor) => setCampo(campo.id, valor)}
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
          <SecondaryButton title="Cancelar" onClick={pedirCierre} disabled={enviando} />
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
