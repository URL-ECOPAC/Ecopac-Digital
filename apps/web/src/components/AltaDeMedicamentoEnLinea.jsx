import { Save, X } from "lucide-react";

import CampoDeFormulario from "./CampoDeFormulario";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Formulario corto para dar de alta un medicamento sin salir del formulario que lo necesita
 * (issue #840). Dibuja lo que devuelve useAltaDeMedicamentoEnLinea() de packages/shared: los
 * campos, sus errores y el catalogo de principios activos salen de alli.
 *
 * No es SelectorConAlta porque un medicamento no se crea con un nombre solo: el catalogo exige
 * concentracion, presentacion, marca y principio activo para distinguir uno de otro.
 */
export default function AltaDeMedicamentoEnLinea({ alta }) {
  if (!alta?.abierto) return null;

  return (
    <div className="ec-alta-en-linea" role="group" aria-label="Nuevo medicamento">
      <p className="ec-alta-en-linea-titulo">Nuevo medicamento del catálogo</p>
      {alta.error && (
        <div className="alert alert-danger py-2" role="alert">
          {alta.error.mensaje}
        </div>
      )}
      <div className="ec-form-grid">
        {alta.campos.map((campo) => (
          <CampoDeFormulario
            key={campo.id}
            campo={campo}
            valor={alta.valores[campo.id]}
            error={alta.errores[campo.id]}
            catalogos={alta.catalogos}
            disabled={alta.creando}
            onChange={(valor) => alta.setCampo(campo.id, valor)}
          />
        ))}
      </div>
      <div className="ec-acciones">
        <PrimaryButton
          title="Guardar medicamento"
          size="sm"
          icon={<Save size={14} aria-hidden="true" />}
          onClick={alta.crear}
          loading={alta.creando}
        />
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          size="sm"
          icon={<X size={14} aria-hidden="true" />}
          onClick={alta.cerrar}
          disabled={alta.creando}
        />
      </div>
    </div>
  );
}
