import SecondaryButton from "./SecondaryButton";

/**
 * "Limpiar filtros", el mismo en todas las pantallas.
 *
 * Gris y deshabilitado mientras no hay nada que limpiar; en verde en cuanto hay algun filtro
 * puesto, para que se lea de un vistazo que la lista esta filtrada. Antes cada pantalla lo armaba
 * a mano: unas en gris siempre, otras en verde siempre, y una con un <Button> de bootstrap suelto.
 *
 * Mismo contrato que apps/mobile/src/components/BotonLimpiarFiltros.js, salvo el nombre del
 * evento (`onClick` aqui, `onPress` en movil).
 *
 * @param {{ onClick: () => void, hayFiltros: boolean }} props
 */
export default function BotonLimpiarFiltros({ onClick, hayFiltros }) {
  return (
    <div className="ec-filtros-limpiar">
      <SecondaryButton
        title="Limpiar filtros"
        variant={hayFiltros ? "outline" : "neutra"}
        onClick={onClick}
        disabled={!hayFiltros}
      />
    </div>
  );
}
