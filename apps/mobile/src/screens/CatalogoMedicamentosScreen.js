import { FlatList, StyleSheet, Text, View } from "react-native";
import { FILTROS_STOCK, formatearFechaCorta, useCatalogoMedicamentos } from "@ecopac/shared";
import { colors, labels, moduleAccents, radii, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  FilterBar,
  PageHeader,
  ScreenContainer,
  SecondaryButton,
  StatCard,
  StatusChip,
} from "../components";
import { ROUTES } from "../navigation/rutas";

// Stock en movil (issue #840, G5), segun el criterio de docs/DISENO-MOVIL.md.
//
// QUE CAMBIO
//
// - Los filtros eran dos filas de chips con desplazamiento horizontal que se cortaban en el borde
//   ("Bodega P...", "Biologicos" partido), y una de ellas ofrecia categorias que no existen en el
//   esquema. Ahora es el FilterBar de la web con FILTROS_STOCK: busqueda y bodega.
// - Los tres indicadores iban en una fila con desplazamiento horizontal; ahora son tres StatCard
//   que se reparten el ancho, sin nada escondido a la derecha.
// - La tarjeta truncaba el lote y la bodega (en mayusculas, a media palabra) y mostraba valores
//   de relleno cuando faltaba un dato: "REF-000", bodega "Central", "Q 0". Ahora el nombre puede
//   ocupar dos lineas, el lote y la bodega van en su propia linea y lo que falta no se inventa.

function textoDeVencimiento(fila) {
  if (!fila.fechaVencimiento) return null;
  const fecha = formatearFechaCorta(fila.fechaVencimiento);
  if (fila.diasRestantes === 0) return `Vence hoy · ${fecha}`;
  if (fila.porVencer) return `Vence en ${fila.diasRestantes} d · ${fecha}`;
  return `Vence ${fecha}`;
}

export function CatalogoMedicamentosScreen({
  inventarioInicial = [],
  bodegas = [],
  medicamentosSinStock = 0,
  navigation,
}) {
  const {
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    catalogos,
    inventarioFiltrado,
    total,
    totalPorVencer,
  } = useCatalogoMedicamentos({ inventarioInicial, bodegas });

  // Tocar un lote abre el ingreso de ese medicamento (issue #165). Habia tambien un "modo
  // seleccion" por parametros de ruta que ninguna pantalla usaba; se retiro con la #840.
  const alTocar = (fila) => {
    navigation?.navigate(ROUTES.REGISTRO_INGRESO, {
      medicamentoId: fila.medicamentoId,
      medicamentoNombre: fila.nombre,
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Inventario"
        subtitle={
          hayFiltros ? `${inventarioFiltrado.length} de ${total} lotes` : `${total} lotes en bodega`
        }
        accent={moduleAccents.inventario}
      />

      <View style={estilos.indicadores}>
        <StatCard label="Lotes" value={inventarioFiltrado.length} style={estilos.indicador} />
        <StatCard
          label="Por vencer"
          value={totalPorVencer}
          accent={colors.warning}
          style={estilos.indicador}
        />
        <StatCard
          label="Sin stock"
          value={medicamentosSinStock}
          accent={colors.danger}
          style={estilos.indicador}
        />
      </View>

      <FilterBar
        campos={FILTROS_STOCK}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <FlatList
        data={inventarioFiltrado}
        keyExtractor={(fila) => fila.id}
        contentContainerStyle={estilos.lista}
        ItemSeparatorComponent={() => <View style={estilos.separador} />}
        ListEmptyComponent={
          hayFiltros ? (
            <EmptyState
              message="Ningún lote coincide con los filtros."
              actionLabel="Limpiar filtros"
              onAction={limpiarFiltros}
            />
          ) : (
            <EmptyState message="No hay lotes con existencia en ninguna bodega." />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => alTocar(item)} style={estilos.tarjeta}>
            <View style={estilos.superior}>
              <Text style={estilos.nombre} numberOfLines={2}>
                {item.nombre}
              </Text>
              <Text style={estilos.cantidad}>{item.cantidadDisponible}</Text>
            </View>

            <Text style={estilos.detalle}>
              {[item.numeroLote && `Lote ${item.numeroLote}`, item.bodega]
                .filter(Boolean)
                .join(" · ")}
            </Text>

            <View style={estilos.inferior}>
              <Text style={estilos.detalle}>{textoDeVencimiento(item)}</Text>
              <StatusChip
                status={item.porVencer ? "por vencer" : "disponible"}
                label={item.porVencer ? labels.proximoAVencer : labels.disponible}
              />
            </View>
          </Card>
        )}
      />

      {hayFiltros && inventarioFiltrado.length > 0 ? (
        <SecondaryButton title="Limpiar filtros" onPress={limpiarFiltros} style={estilos.pie} />
      ) : null}
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  indicadores: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  indicador: {
    flex: 1,
  },
  lista: {
    paddingBottom: spacing.md,
  },
  separador: {
    height: spacing.sm,
  },
  tarjeta: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  superior: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  nombre: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  // La existencia es el dato que se busca con la caja enfrente: arriba a la derecha, en grande.
  cantidad: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  detalle: {
    color: colors.textMuted,
    flexShrink: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  inferior: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  pie: {
    marginTop: spacing.sm,
  },
});
