import { StyleSheet, Text, View } from "react-native";
import { formatearFechaCorta, formatearMoneda } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import Card from "./Card";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

/**
 * Lo que hay en una o varias bodegas, lote por lote. Espejo de
 * apps/web/src/components/ContenidoDeBodega.jsx, con las mismas props -web la dibuja como tabla,
 * aqui como tarjetas, mismo criterio que el resto del catalogo (DataList).
 *
 * `mostrarBodega`/`mostrarJornada` agregan esos datos a cada tarjeta cuando la lista junta varias
 * bodegas o jornadas (insumos del proyecto). `conValor` agrega el costo unitario y el valor del
 * lote: solo donde el rol ve dinero (useInsumosDeJornada ya decide si pasar esta prop).
 */
export default function ContenidoDeBodega({
  contenido = [],
  cargando = false,
  error = null,
  vacio = "Esta bodega no tiene existencias.",
  mostrarBodega = false,
  mostrarJornada = false,
  conValor = false,
}) {
  if (cargando) return <LoadingState message="Cargando existencias..." />;
  if (error) return <ErrorState message={error} />;
  if (contenido.length === 0) return <EmptyState message={vacio} />;

  const total = contenido.reduce((suma, fila) => suma + fila.cantidadDisponible, 0);
  const valorTotal = contenido.reduce((suma, fila) => suma + (fila.valor ?? 0), 0);
  const sinCosto = contenido.filter((fila) => fila.valor === null).length;

  return (
    <View>
      {contenido.map((fila) => (
        <Card key={`${fila.loteId}|${fila.bodegaId}|${fila.jornadaId ?? ""}`} style={estilos.fila}>
          <View style={estilos.filaSuperior}>
            <Text style={estilos.articulo} numberOfLines={1}>
              {fila.articulo}
            </Text>
            <Text style={estilos.cantidad}>{fila.cantidadDisponible}</Text>
          </View>
          <Text style={estilos.detalle}>
            Lote {fila.numeroLote ?? "—"} ·{" "}
            {fila.fechaVencimiento
              ? `vence ${formatearFechaCorta(fila.fechaVencimiento)}`
              : "no vence"}
            {fila.vencido ? " · Vencido" : ""}
            {mostrarBodega && fila.bodega ? ` · ${fila.bodega}` : ""}
            {mostrarJornada && fila.jornada ? ` · ${fila.jornada}` : ""}
          </Text>
          {conValor ? (
            <Text style={estilos.detalle}>
              {fila.costoUnitario === null
                ? "Sin costo registrado"
                : `${formatearMoneda(fila.costoUnitario)} c/u · ${
                    fila.valor === null ? "Sin costo" : formatearMoneda(fila.valor)
                  }`}
            </Text>
          ) : null}
        </Card>
      ))}

      <View style={estilos.totalFila}>
        <Text style={estilos.totalEtiqueta}>Total: {total}</Text>
        {conValor ? (
          <Text style={estilos.totalEtiqueta}>
            {formatearMoneda(Math.round(valorTotal * 100) / 100)}
            {sinCosto > 0
              ? ` (${sinCosto === 1 ? "1 lote sin costo" : `${sinCosto} lotes sin costo`})`
              : ""}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  filaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  articulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  cantidad: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  detalle: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  totalFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalEtiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
});
