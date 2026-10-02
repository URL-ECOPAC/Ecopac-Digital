/**
 * La marca de obligatorio u opcional que va junto al rotulo de un campo de formulario.
 *
 * `requerido` sale del descriptor (`campo.validacion.requerido`): true dibuja un asterisco, false
 * dibuja "(opcional)", y sin dato no dibuja nada -un campo cuyo descriptor no lo dice no se
 * adivina-. Asi cada ventana dice que hay que llenar sin que la persona tenga que intentar guardar
 * para enterarse.
 *
 * Va al lado del <label>, no dentro: el nombre accesible del campo sigue siendo su rotulo, y lo
 * obligatorio se anuncia con `aria-required` en el control.
 *
 * Su espejo en movil es apps/mobile/src/components/RotuloDeCampo.js.
 */
export default function MarcaDeRequerido({ requerido }) {
  if (requerido === true) {
    return (
      <span className="ec-requerido" title="Obligatorio" aria-hidden="true">
        {" *"}
      </span>
    );
  }
  if (requerido === false) {
    return (
      <span className="ec-opcional" aria-hidden="true">
        {" (opcional)"}
      </span>
    );
  }
  return null;
}
