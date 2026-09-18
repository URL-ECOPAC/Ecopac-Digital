import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ESTADOS_DE_LOTE,
  FILTROS_EXISTENCIAS_POR_LOTE,
  formatearFechaCorta,
  useExistenciasPorLote,
} from "@ecopac/shared";
import { colors, labels, moduleAccents, radii, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
} from "../components";
import { ROUTES } from "../navigation/rutas";

// Existencias de inventario en movil.
//
// QUE CAMBIO (issue #838)
//
// 1. LA TARJETA. Era un bloque alto con tres columnas de datos, un numero de stock a tamano de
//    titulo y un pie con el estado: en un telefono entraban dos por pantalla y la lista de una
//    jornada no se podia recorrer. Ahora cada lote es una tarjeta de dos lineas -- medicamento y
//    lote arriba, existencia y vencimiento abajo -- con el chip de estado a la derecha. Cabe el
//    triple y se lee de un vistazo, que es lo que hace falta con la caja abierta enfrente.
// 2. LOS FILTROS. No habia ninguno. Ahora se filtra por bodega y por estado del lote (disponible,
//    proximo a vencer, critico, vencido, agotado), mas la busqueda por medicamento o numero de
//    lote, con FilterBar y los descriptores compartidos.
// 3. EL CALCULO SE FUE A shared. La pantalla sumaba existencias y decidia el estado de cada lote
//    dentro del componente. Ahora lo hace useExistenciasPorLote(), que es donde la arquitectura
//    dice que va y donde se puede probar sin montar la pantalla.

// Etiquetas de los estados de lote. Salen de @ecopac/ui-tokens, no de un texto escrito aqui, y
// alimentan tanto al selector del filtro como al chip de cada tarjeta.
const ESTADOS_CON_ETIQUETA = [
  { value: ESTADOS_DE_LOTE.DISPONIBLE, clave: "disponible", label: labels.disponible },
  { value: ESTADOS_DE_LOTE.POR_VENCER, clave: "por vencer", label: labels.proximoAVencer },
  { value: ESTADOS_DE_LOTE.CRITICO, clave: "critico", label: labels.critico },
  { value: ESTADOS_DE_LOTE.VENCIDO, clave: "vencido", label: labels.medicamentoVencido },
  { value: ESTADOS_DE_LOTE.AGOTADO, clave: "agotado", label: labels.sinStock },
];

const ETIQUETA_POR_ESTADO = Object.fromEntries(
  ESTADOS_CON_ETIQUETA.map((estado) => [estado.value, estado.label]),
);

/** El vencimiento en palabras. Un lote sin fecha no inventa una. */
function textoDeVencimiento(fila) {
  if (!fila.fechaVencimiento) return "Sin fecha de vencimiento";
  const fecha = formatearFechaCorta(fila.fechaVencimiento);
  if (fila.diasRestantes === null) return `Vence ${fecha}`;
  if (fila.diasRestantes < 0) return `Venció hace ${Math.abs(fila.diasRestantes)} d · ${fecha}`;
  if (fila.diasRestantes === 0) return `Vence hoy · ${fecha}`;
  return `${fila.diasRestantes} d · ${fecha}`;
}

export default function ExistenciasInventarioScreen() {
  const navigation = useNavigation();
  const {
    filas,
    total,
    totalSinFiltrar,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
    catalogos,
  } = useExistenciasPorLote({ estadosDeLote: ESTADOS_CON_ETIQUETA });

  if (cargando && totalSinFiltrar === 0) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState message="Cargando existencias..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Existencias"
        subtitle={
          hayFiltros
            ? `${total} de ${totalSinFiltrar} lotes`
            : `${totalSinFiltrar} ${totalSinFiltrar === 1 ? "lote" : "lotes"}`
        }
        accent={moduleAccents.inventario}
      />

      <FilterBar
        campos={FILTROS_EXISTENCIAS_POR_LOTE}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      {error ? <ErrorState message={error.mensaje} onRetry={recargar} /> : null}

      <FlatList
        data={filas}
        keyExtractor={(fila) => fila.id}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
        ItemSeparatorComponent={() => <View style={estilos.separador} />}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          error ? null : hayFiltros ? (
            <EmptyState
              message="Ningún lote coincide con los filtros."
              actionLabel="Limpiar filtros"
              onAction={limpiarFiltros}
            />
          ) : (
            <EmptyState message="Todavía no hay lotes registrados." />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate(ROUTES.DETALLE_LOTE, { loteId: item.loteId })}
            style={estilos.tarjeta}
          >
            <View style={estilos.superior}>
              <Text style={estilos.medicamento} numberOfLines={1}>
                {item.medicamento}
              </Text>
              <StatusChip status={item.estado} label={ETIQUETA_POR_ESTADO[item.estado]} />
            </View>

            <View style={estilos.inferior}>
              <View style={estilos.loteCaja}>
                <Text style={estilos.lote} numberOfLines={1}>
                  {item.numeroLote || "Sin número"}
                </Text>
              </View>
              <Text style={estilos.vencimiento} numberOfLines={1}>
                {textoDeVencimiento(item)}
              </Text>
              <Text style={estilos.existencia}>{item.cantidadDisponible}</Text>
            </View>
          </Card>
        )}
      />

      {hayFiltros && filas.length > 0 ? (
        <SecondaryButton title="Limpiar filtros" onPress={limpiarFiltros} style={estilos.pie} />
      ) : null}
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  lista: {
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  separador: {
    height: spacing.sm,
  },
  tarjeta: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  superior: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  medicamento: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  inferior: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  loteCaja: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  lote: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
  },
  vencimiento: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
  },
  // La existencia es el dato que se busca con la caja enfrente: va al final de la fila, en
  // negrita, sin ocupar una linea entera como antes.
  existencia: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  pie: {
    marginTop: spacing.sm,
  },
});
