import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  FILTROS_STOCK,
  formatearFechaCorta,
  puedeAprobarMovimiento,
  puedeRegistrarMovimiento,
  useCatalogoMedicamentos,
} from "@ecopac/shared";
import { colors, labels, moduleAccents, radii, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  FilterBar,
  MenuLateral,
  PageHeader,
  ScreenContainer,
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

/**
 * Las opciones de Inventario, agrupadas para el menu lateral. Eran siete botones a la vista
 * -seis accesos en una fila que se partia en tres lineas y "Registrar ingreso" en la cabecera,
 * junto a la campana y a cerrar sesion, que son de la sesion y no del inventario-; en un telefono
 * se guardan en un menu (docs/DISENO-MOVIL.md, reglas 2 y 3).
 */
function gruposDeInventario(rol) {
  const registra = puedeRegistrarMovimiento(rol);
  return [
    {
      titulo: "Movimientos",
      opciones: [
        {
          id: "ingreso",
          etiqueta: "Registrar ingreso",
          descripcion: "Compra o donación que entra a bodega",
          icono: "add-circle-outline",
          ruta: ROUTES.REGISTRO_INGRESO,
          visible: registra,
        },
        {
          id: "salida",
          etiqueta: "Registrar salida",
          descripcion: "Entrega, traslado, baja o donación",
          icono: "remove-circle-outline",
          ruta: ROUTES.REGISTRO_SALIDA,
          visible: registra,
        },
        {
          id: "aprobar",
          etiqueta: "Por aprobar",
          descripcion: "Movimientos pendientes de validar",
          icono: "checkmark-done-outline",
          ruta: ROUTES.VALIDACION_MOVIMIENTOS,
          visible: puedeAprobarMovimiento(rol),
        },
        {
          id: "movimientos",
          etiqueta: "Mis movimientos",
          descripcion: "Lo que registraste y su estado",
          icono: "swap-vertical-outline",
          ruta: ROUTES.MIS_MOVIMIENTOS,
          visible: registra,
        },
      ],
    },
    {
      titulo: "Consultar",
      opciones: [
        {
          id: "existencias",
          etiqueta: "Existencias",
          descripcion: "Cada lote en cada bodega",
          icono: "cube-outline",
          ruta: ROUTES.EXISTENCIAS_INVENTARIO,
        },
        {
          id: "alertas",
          etiqueta: "Alertas de vencimiento",
          descripcion: "Lotes vencidos o por vencer",
          icono: "alert-circle-outline",
          ruta: ROUTES.RESUMEN_ALERTAS_INVENTARIO,
        },
        {
          id: "principios",
          etiqueta: "Principios activos",
          descripcion: "Catálogo de principios activos",
          icono: "flask-outline",
          ruta: ROUTES.PRINCIPIOS_ACTIVOS,
        },
      ],
    },
  ];
}

export function CatalogoMedicamentosScreen({
  inventarioInicial = [],
  bodegas = [],
  medicamentosSinStock = 0,
  rol,
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
    totalProductos,
    totalPorVencer,
  } = useCatalogoMedicamentos({ inventarioInicial, bodegas });

  const alTocar = (fila) => {
    navigation?.navigate(ROUTES.DETALLE_LOTE, { loteId: fila.loteId });
  };

  return (
    <ScreenContainer scrollable={false}>
      <View style={estilos.encabezado}>
        <View style={estilos.encabezadoTitulo}>
          <PageHeader
            title="Inventario"
            subtitle={
              hayFiltros
                ? `${inventarioFiltrado.length} de ${total} lotes`
                : `${total} lotes en bodega`
            }
            accent={moduleAccents.inventario}
          />
        </View>
        {rol ? (
          <MenuLateral
            titulo="Inventario"
            grupos={gruposDeInventario(rol)}
            onElegir={(opcion) => navigation?.navigate(opcion.ruta)}
          />
        ) : null}
      </View>

      <View style={estilos.indicadores}>
        <StatCard label="Productos" value={totalProductos} style={estilos.indicador} />
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
  // El boton del menu a la derecha del titulo, alineado con el.
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  encabezadoTitulo: {
    flex: 1,
  },
});
