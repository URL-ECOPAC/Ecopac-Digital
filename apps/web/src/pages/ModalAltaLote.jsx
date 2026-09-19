import { useState } from "react";
import { PackagePlus, X } from "lucide-react";

import { CAMPOS_LOTE, opcionDeMedicamento, valoresInicialesDeLote } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";
import SecondaryButton from "../components/SecondaryButton";

/**
 * Alta de un lote de medicamento.
 *
 * POR QUE SE REESCRIBIO (issue #840, regla B1)
 *
 * Estaba dibujado entero a mano: etiquetas propias, nombres de campo en snake_case, colores
 * escritos en el archivo y un campo "Bodega destino" obligatorio que registrarLote() nunca
 * guardaba -la bodega se elegia y se perdia-. Tampoco leia CAMPOS_LOTE, asi que el alta y la
 * correccion del lote (CAMPOS_CORRECCION_LOTE) no eran el mismo juego de campos aunque lo
 * parecieran. Ahora dibuja el descriptor, y la validacion es la de validarDatosDeLote()
 * (useGestionLotes.js), con los errores debajo de cada campo.
 *
 * Un lote registrado aqui no tiene existencias en ninguna bodega: eso lo hace un ingreso
 * (Registrar ingreso), que crea el lote y el movimiento a la vez.
 */
export function ModalAltaLote({
  abierto,
  onClose,
  onGuardar,
  medicamentos = [],
  proveedores = [],
  errorValidacion,
  errores = {},
}) {
  const [valores, setValores] = useState(valoresInicialesDeLote);
  const [enviando, setEnviando] = useState(false);

  const catalogos = {
    medicamentos: medicamentos.map(opcionDeMedicamento),
    proveedores: proveedores.map((proveedor) => ({ value: proveedor.id, label: proveedor.nombre })),
  };

  const setCampo = (id, valor) => setValores((anteriores) => ({ ...anteriores, [id]: valor }));

  const guardar = async () => {
    setEnviando(true);
    await onGuardar(valores);
    setEnviando(false);
  };

  return (
    <Modal visible={abierto} onClose={onClose} title="Registrar lote de medicamento" size="lg">
      {errorValidacion && (
        <div className="alert alert-danger" role="alert">
          {errorValidacion}
        </div>
      )}

      <SeccionDeFormulario
        titulo="Datos del lote"
        descripcion="Para la trazabilidad y el control de vencimiento."
        acento="var(--accent-inventario)"
        campos={CAMPOS_LOTE}
        valores={valores}
        errores={errores}
        catalogos={catalogos}
        onChange={setCampo}
        disabled={enviando}
      >
        <div className="ec-acciones ec-acciones--fin">
          <SecondaryButton
            title="Cancelar"
            variant="neutra"
            onClick={onClose}
            disabled={enviando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title="Guardar lote"
            onClick={guardar}
            loading={enviando}
            icon={<PackagePlus size={16} aria-hidden="true" />}
          />
        </div>
      </SeccionDeFormulario>
    </Modal>
  );
}
