import { useEffect, useState } from "react";

import { TIPOS_DE_CAMPO } from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";
import { X } from "lucide-react";

function valoresDe(insumo, campos) {
  return campos.reduce((valores, campo) => {
    valores[campo.id] = insumo?.[campo.id] ?? "";
    return valores;
  }, {});
}

/**
 * Alta y edicion de un insumo previsto de un proyecto (proyecto_insumos, 00147). Mismo patron
 * generico dirigido por descriptores (CAMPOS_INSUMO_PROYECTO) que ModalHito.jsx: no valida ni
 * decide permisos aca, solo dibuja lo que useProyectosSociales() le entrega.
 *
 * Al editar, el insumo (el articulo) no se puede cambiar: la fila es "este articulo en este
 * proyecto", y cambiar de articulo es quitarlo y agregar otro. Se muestra su nombre, no un select.
 */
export default function ModalInsumoProyecto({
  visible,
  insumo,
  campos,
  catalogos,
  errores,
  onClose,
  onGuardar,
}) {
  const editando = Boolean(insumo?.id);
  const [valores, setValores] = useState(() => valoresDe(insumo, campos));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(insumo, campos));
    setError(null);
  }, [insumo, campos]);

  const cambiar = (id, valor) => setValores((anteriores) => ({ ...anteriores, [id]: valor }));

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(insumo?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? null);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar insumo previsto" : "Agregar insumo previsto"}
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <form onSubmit={guardar}>
        {campos.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            if (editando) {
              return (
                <p key={campo.id} className="mb-3">
                  <strong>{campo.label}:</strong> {insumo.articuloNombre}
                </p>
              );
            }
            const opciones = catalogos?.[campo.opcionesDesde] ?? [];
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                options={opciones}
                onSelect={(valor) => cambiar(campo.id, valor)}
                placeholder={opciones.length === 0 ? "No hay productos disponibles" : "Seleccionar"}
                error={errores?.[campo.id]}
                disabled={enviando || opciones.length === 0}
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
                step={campo.id === "costoUnitarioEstimado" ? 0.01 : 1}
                onChange={(valor) => cambiar(campo.id, valor ?? "")}
                error={errores?.[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              placeholder={campo.placeholder}
              as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
              rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 2 : undefined}
              maxLength={campo.validacion?.maxLongitud}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => cambiar(campo.id, evento.target.value)}
              error={errores?.[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton
            title="Cancelar"
            onClick={onClose}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Agregar insumo"}
            onClick={guardar}
            loading={enviando}
          />
        </div>
      </form>
    </Modal>
  );
}
