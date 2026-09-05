import { FlatList, StyleSheet, Text, View } from "react-native";
import { formatearFechaCorta, formatearMoneda } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import Card from "./Card";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import StatusChip from "./StatusChip";

/**
 * Listado generico. Espejo de apps/web/src/components/DataList.jsx: interpreta el MISMO
 * descriptor de columnas, pero lo dibuja distinto.
 *
 * En web cada columna es un <td> de una fila; aqui cada columna se apila dentro de una
 * tarjeta. En una pantalla angosta no hay filas ni columnas literales, y forzar una tabla
 * obligaria a desplazarse en horizontal para leer un dato.
 *
 * ORDEN DENTRO DE LA TARJETA. Se respeta el orden declarado con una sola excepcion: el
 * avatar y la columna `principal` suben al tope. En una tabla el orden de las columnas es
 * libre porque el encabezado dice que es cada celda, pero una tarjeta necesita un titulo
 * arriba: COLUMNAS_MOVIMIENTO declara `tipo` antes que `medicamento`, y sin esta excepcion
 * la tarjeta empezaba con "Tipo: ingreso" y el nombre del medicamento quedaba a media
 * altura, leyendose como un dato mas.
 *
 * El valor de cada celda sale de la fila por `id`, o por `desde` si la columna lo declara.
 *
 * COMO COMPONERLO. Este es un FlatList, y React Native avisa -con razon- si se anida un
 * FlatList dentro de un ScrollView con la misma orientacion: se rompe el reciclado de filas
 * y una lista larga se vuelve lenta. La pantalla que muestre un DataList debe usar
 * <ScreenContainer scrollable={false}> y dejar que el scroll lo haga la lista, que es
 * justamente para lo que ScreenContainer tiene esa prop.
 */

/** Iniciales de un nombre, para el avatar. Dos como maximo, que es lo que cabe. */
function iniciales(texto) {
  return String(texto ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ texto }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarTexto}>{iniciales(texto)}</Text>
    </View>
  );
}

/** Dibuja el valor de una columna segun el tipo que declara. */
function Valor({ columna, fila, catalogos }) {
  const valor = fila?.[columna.desde ?? columna.id];

  switch (columna.tipo) {
    case "avatar":
      return <Avatar texto={valor} />;

    case "numero":
      if (valor === null || valor === undefined) return null;
      return (
        <Text style={styles.texto}>
          {columna.sufijo ? `${valor} ${columna.sufijo}` : String(valor)}
        </Text>
      );

    case "moneda":
      return <Text style={styles.texto}>{formatearMoneda(valor)}</Text>;

    case "fecha":
      return <Text style={styles.texto}>{formatearFechaCorta(valor)}</Text>;

    case "chip":
      return <StatusChip status={valor} />;

    case "estado": {
      const catalogo = catalogos[columna.etiquetasDesde] ?? [];
      const entrada = catalogo.find((opcion) => opcion.value === valor);
      return <StatusChip status={entrada?.clave ?? valor} label={entrada?.label} />;
    }

    case "booleano":
      if (valor === null || valor === undefined) return null;
      return <Text style={styles.texto}>{valor ? "Si" : "No"}</Text>;

    case "chips": {
      const elementos = Array.isArray(valor) ? valor : [];
      if (elementos.length === 0) return null;
      return (
        <View style={styles.chips}>
          {elementos.map((elemento) => (
            <View key={String(elemento)} style={styles.chip}>
              <Text style={styles.chipTexto}>{elemento}</Text>
            </View>
          ))}
        </View>
      );
    }

    default: {
      if (columna.etiquetasDesde) {
        const catalogo = catalogos[columna.etiquetasDesde] ?? [];
        const opcion = catalogo.find((entrada) => entrada.value === valor);
        return <Text style={styles.texto}>{opcion ? opcion.label : (valor ?? "")}</Text>;
      }
      if (valor === null || valor === undefined) return null;
      return <Text style={styles.texto}>{String(valor)}</Text>;
    }
  }
}

function Fila({ columna, fila, catalogos }) {
  if (columna.principal) {
    const valor = fila?.[columna.desde ?? columna.id];
    return <Text style={styles.principal}>{String(valor ?? "")}</Text>;
  }

  if (columna.tipo === "avatar") {
    return <Valor columna={columna} fila={fila} catalogos={catalogos} />;
  }

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{columna.label}</Text>
      <View style={styles.valor}>
        <Valor columna={columna} fila={fila} catalogos={catalogos} />
      </View>
    </View>
  );
}

function ordenarParaTarjeta(columnas) {
  const avatar = columnas.filter((columna) => columna.tipo === "avatar");
  const principal = columnas.filter((columna) => columna.principal && columna.tipo !== "avatar");
  const resto = columnas.filter((columna) => columna.tipo !== "avatar" && !columna.principal);
  return [...avatar, ...principal, ...resto];
}

export default function DataList({
  columnas = [],
  datos = [],
  cargando = false,
  vacio,
  onRowPress,
  catalogos = {},
}) {
  if (cargando) return <LoadingState />;

  if (!datos || datos.length === 0) {
    return typeof vacio === "string" || vacio === undefined ? (
      <EmptyState message={vacio} />
    ) : (
      vacio
    );
  }

  const enOrden = ordenarParaTarjeta(columnas);

  return (
    <FlatList
      data={datos}
      keyExtractor={(fila, indice) => String(fila.id ?? indice)}
      ItemSeparatorComponent={() => <View style={styles.separador} />}
      contentContainerStyle={styles.listaContenido}
      renderItem={({ item }) => (
        <View style={styles.tarjetaWrapper}>
          <Card onPress={onRowPress ? () => onRowPress(item) : undefined}>
            {enOrden.map((columna) => (
              <Fila key={columna.id} columna={columna} fila={item} catalogos={catalogos} />
            ))}
          </Card>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listaContenido: {
    alignItems: "center", // Centra las tarjetas si la pantalla se vuelve muy ancha
    width: "100%",
  },
  tarjetaWrapper: {
    width: "100%",
    maxWidth: 600, // Limita el ancho util en tablets (evita cientos de dp de separacion vacia)
  },
  separador: { height: spacing.sm },
  principal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  campo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs / 2,
    gap: spacing.sm,
  },
  etiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  valor: { flexShrink: 1, alignItems: "flex-end" },
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    textAlign: "right",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  avatarTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "flex-end" },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
});
