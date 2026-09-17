import { useEffect, useState } from "react";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import { Save, X } from "lucide-react";

function valoresDe(movimiento) {
  return {
    cantidad: movimiento?.cantidad ?? null,
    motivo: movimiento?.motivo ?? "",
  };
}

/**
 * Detalle de un movimiento de "Mis movimientos" (issue #756). Con `movimiento.puedeEditar`
 * (calculado en filaDeMisMovimientos.js: pendiente y propio) es un formulario de correccion de
 * cantidad y motivo, los dos unicos campos que editarMovimiento() permite tocar. Sin
 * `puedeEditar` -un movimiento ajeno visto con el filtro "Ver: todos", o uno que ya no esta
 * pendiente- es solo lectura: la pantalla sigue sirviendo para ver el detalle, pero el servidor
 * rechazaria el UPDATE de todas formas (00106), asi que no se ofrece el boton.
 */
export default function ModalCorreccionMovimiento({ visible, movimiento, onClose, onGuardar }) {
  const puedeEditar = Boolean(movimiento?.puedeEditar);
  const [valores, setValores] = useState(() => valoresDe(movimiento));
  const [error, setError] = useState(null);
  const [erroresForm, setErroresForm] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(movimiento));
    setError(null);
    setErroresForm({});
  }, [movimiento]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(movimiento.id, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setErroresForm(resultado.errores ?? {});
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={puedeEditar ? "Corregir movimiento" : "Detalle del movimiento"}
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      <p className="text-muted small mb-3">
        {movimiento?.medicamentoNombre} · Lote {movimiento?.numeroLote} · {movimiento?.bodegaNombre}
        <br />
        {movimiento?.estado} · Registrado por {movimiento?.registradoPorNombre ?? "—"}
      </p>

      {!puedeEditar && (
        <div className="alert alert-secondary small" role="status">
          {movimiento?.estado === "pendiente"
            ? "Solo quien registro el movimiento puede corregirlo."
            : "Solo se pueden corregir movimientos pendientes."}
        </div>
      )}

      <form onSubmit={guardar}>
        <NumberField
          label="Cantidad"
          value={valores.cantidad}
          onChange={(valor) => setValores((anteriores) => ({ ...anteriores, cantidad: valor }))}
          min={1}
          error={erroresForm.cantidad}
          disabled={!puedeEditar}
        />
        <TextField
          label="Motivo"
          as="textarea"
          rows={2}
          value={valores.motivo}
          onChange={(evento) =>
            setValores((anteriores) => ({ ...anteriores, motivo: evento.target.value }))
          }
          error={erroresForm.motivo}
          disabled={!puedeEditar}
        />

        <div className="d-flex justify-content-end gap-2 mt-3">
          {puedeEditar ? (
            <>
              <SecondaryButton
                title="Cancelar"
                onClick={onClose}
                disabled={enviando}
                icon={<X size={16} aria-hidden="true" />}
              />
              <PrimaryButton
                title="Guardar corrección"
                onClick={guardar}
                loading={enviando}
                icon={<Save size={16} aria-hidden="true" />}
              />
            </>
          ) : (
            <SecondaryButton title="Cerrar" onClick={onClose} />
          )}
        </div>
      </form>
    </Modal>
  );
}
