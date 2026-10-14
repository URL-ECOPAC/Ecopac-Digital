import SecondaryButton from "./SecondaryButton";

/**
 * "Limpiar filtros", el mismo en todas las pantallas.
 *
 * Espejo de apps/web/src/components/BotonLimpiarFiltros.jsx: gris y deshabilitado mientras no hay
 * nada que limpiar, en verde en cuanto hay algun filtro puesto. Cambia el nombre del evento
 * (`onPress` aqui, `onClick` en la web) y acepta `style` para el ancho que le de la pantalla.
 *
 * @param {{ onPress: () => void, hayFiltros: boolean, style?: object }} props
 */
export default function BotonLimpiarFiltros({ onPress, hayFiltros, style }) {
  return (
    <SecondaryButton
      title="Limpiar filtros"
      variant={hayFiltros ? "outline" : "neutra"}
      onPress={onPress}
      disabled={!hayFiltros}
      style={style}
    />
  );
}
