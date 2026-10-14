import { StyleSheet, Text, View } from "react-native";
import { formatearMoneda, useConsumoDeJornada } from "@ecopac/shared";
import { colors, moduleAccents, spacing, typography } from "@ecopac/ui-tokens";

import { DataList, StatCard } from "../components";

/**
 * Pestaña Consumo del detalle de una jornada, en movil. Espejo de
 * apps/web/src/pages/ConsumoDeJornada.jsx: lote por lote, lo que se cargo a su bodega movil, lo
 * que se entrego en sus recetas, lo que espera aprobacion, lo que se devolvio y lo que le queda a
 * la jornada, con su valor. Con la bodega principal solo hay entregas. El calculo y los totales
 * viven en useConsumoDeJornada(); aqui solo se dibuja.
 */
export default function ConsumoDeJornada({ jornadaId, rol, usaBodegaPrincipal = false }) {
  const { columnas, consumo, resumen, cargando, error } = useConsumoDeJornada({
    jornadaId,
    rol,
    usaBodegaPrincipal,
  });

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.kpis}>
        {!usaBodegaPrincipal && (
          <StatCard
            label="Cargado a la bodega"
            value={formatearMoneda(resumen.valorCargado) ?? "—"}
            caption="Lo que se trasladó para esta jornada"
            accent={moduleAccents.inventario}
          />
        )}
        <StatCard
          label="Entregado"
          value={formatearMoneda(resumen.valorEntregado) ?? "—"}
          caption={`${resumen.unidadesEntregadas} unidades en recetas`}
          accent={colors.success}
        />
        {!usaBodegaPrincipal && (
          <>
            <StatCard
              label="Devuelto"
              value={formatearMoneda(resumen.valorDevuelto) ?? "—"}
              caption="Regresó a una bodega fija"
              accent={moduleAccents.presupuestos}
            />
            <StatCard
              label="Le queda a la jornada"
              value={formatearMoneda(resumen.valorQueda) ?? "—"}
              caption="Cargado menos entregado y devuelto"
              accent={moduleAccents.jornadas}
            />
          </>
        )}
      </View>

      <Text style={estilos.textoMuted}>
        Entregado es lo que salió en las recetas emitidas de esta jornada, con la cantidad corregida
        si se ajustó; una receta anulada no cuenta.
        {resumen.unidadesPendientes > 0 &&
          ` ${resumen.unidadesPendientes} unidad(es) entregadas esperan que administración apruebe su salida: ya no se pueden recetar a nadie más.`}
        {!usaBodegaPrincipal &&
          resumen.unidadesDeOtros > 0 &&
          ` En la bodega hay además ${resumen.unidadesDeOtros} unidad(es) que no son de esta jornada (sobrante de otra jornada o lo que entró sin jornada).`}
        {usaBodegaPrincipal &&
          " Esta jornada entrega de la bodega principal: no hay carga ni devolución."}
        {resumen.lotesSinCosto > 0 &&
          ` ${resumen.lotesSinCosto} lote(s) no tienen costo registrado y no se suman a los valores.`}
      </Text>

      {error && <Text style={estilos.aviso}>No se pudo cargar el consumo: {error.mensaje}</Text>}

      <DataList
        columnas={columnas}
        datos={consumo.map((fila) => ({ ...fila, id: fila.loteId }))}
        cargando={cargando}
        vacio={
          usaBodegaPrincipal
            ? "Esta jornada todavía no ha entregado insumos en sus recetas."
            : "Esta jornada todavía no tiene insumos cargados ni entregados."
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: spacing.md,
  },
  kpis: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
  },
});
