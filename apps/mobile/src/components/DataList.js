import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";
import { formatearFechaCorta, formatearMoneda } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import Card from "./Card";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import StatusChip from "./StatusChip";

const MARGEN_PANTALLA = spacing.md;
const ANCHO_MAXIMO_TARJETA = 600;
const ANCHO_TARJETA = Math.min(
  Dimensions.get("window").width - MARGEN_PANTALLA * 2,
  ANCHO_MAXIMO_TARJETA,
);

const ALTO_AVATAR = 40;
const ALTO_LINEA_PRINCIPAL = typography.sizes.md * 1.3;
const ALTO_LINEA_TEXTO = typography.sizes.sm * 1.3;
const ESPACIO_ENTRE_GRUPOS = spacing.lg;

function puedeFijarAltura(columnas) {
  return !columnas.some((columna) => columna.tipo === "chips");
}

function alturaDeTarjeta(columnas) {
  const hayAvatar = columnas.some((columna) => columna.tipo === "avatar");
  const hayPrincipal = columnas.some((columna) => columna.principal && columna.tipo !== "avatar");
  const filasDeDatos = columnas.filter(
    (columna) => columna.tipo !== "avatar" && !columna.principal,
  ).length;

  const altoSuperior =
    (hayAvatar ? ALTO_AVATAR + spacing.xs : 0) +
    (hayPrincipal ? ALTO_LINEA_PRINCIPAL + spacing.xs : 0);

  const altoInferior = filasDeDatos * (ALTO_LINEA_TEXTO + spacing.xs);

  return altoSuperior + ESPACIO_ENTRE_GRUPOS + altoInferior + spacing.md * 2;
}

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
        <Text style={styles.texto} numberOfLines={1}>
          {columna.sufijo ? `${valor} ${columna.sufijo}` : String(valor)}
        </Text>
      );

    case "moneda":
      return (
        <Text style={styles.texto} numberOfLines={1}>
          {formatearMoneda(valor)}
        </Text>
      );

    case "fecha":
      return (
        <Text style={styles.texto} numberOfLines={1}>
          {formatearFechaCorta(valor)}
        </Text>
      );

    case "chip":
      return <StatusChip status={valor} />;

    case "estado": {
      const catalogo = catalogos[columna.etiquetasDesde] ?? [];
      const entrada = catalogo.find((opcion) => opcion.value === valor);
      return (
        <StatusChip
          status={entrada?.clave ?? valor}
          label={entrada?.label}
          icono={entrada?.icono}
        />
      );
    }

    case "booleano":
      if (valor === null || valor === undefined) return null;
      return (
        <Text style={styles.texto} numberOfLines={1}>
          {valor ? "Si" : "No"}
        </Text>
      );

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
        return (
          <Text style={styles.texto} numberOfLines={1}>
            {opcion ? opcion.label : (valor ?? "")}
          </Text>
        );
      }
      if (valor === null || valor === undefined) return null;
      return (
        <Text style={styles.texto} numberOfLines={1}>
          {String(valor)}
        </Text>
      );
    }
  }
}

function Fila({ columna, fila, catalogos }) {
  if (columna.principal) {
    const valor = fila?.[columna.desde ?? columna.id];
    return (
      <Text style={styles.principal} numberOfLines={1}>
        {String(valor ?? "")}
      </Text>
    );
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
  const fijarAltura = puedeFijarAltura(columnas);

  // Grupo de arriba (avatar + nombre) y grupo de abajo (el resto de los campos), solo hace
  // falta separarlos cuando la tarjeta va a tener alto fijo: es lo que el espaciador de en
  // medio necesita para anclar el grupo de abajo al fondo.
  const grupoSuperior = fijarAltura
    ? enOrden.filter((columna) => columna.tipo === "avatar" || columna.principal)
    : [];
  const grupoInferior = fijarAltura
    ? enOrden.filter((columna) => columna.tipo !== "avatar" && !columna.principal)
    : [];
  const alturaTarjeta = fijarAltura ? alturaDeTarjeta(columnas) : undefined;

  return (
    <FlatList
      data={datos}
      keyExtractor={(fila, indice) => String(fila.id ?? indice)}
      ItemSeparatorComponent={() => <View style={styles.separador} />}
      contentContainerStyle={styles.listaContenido}
      renderItem={({ item }) => (
        <View style={styles.tarjetaWrapper}>
          <Card
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            style={fijarAltura ? { height: alturaTarjeta } : undefined}
          >
            {fijarAltura ? (
              <>
                <View>
                  {grupoSuperior.map((columna) => (
                    <Fila key={columna.id} columna={columna} fila={item} catalogos={catalogos} />
                  ))}
                </View>
                <View style={styles.espaciador} />
                <View>
                  {grupoInferior.map((columna) => (
                    <Fila key={columna.id} columna={columna} fila={item} catalogos={catalogos} />
                  ))}
                </View>
              </>
            ) : (
              enOrden.map((columna) => (
                <Fila key={columna.id} columna={columna} fila={item} catalogos={catalogos} />
              ))
            )}
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
  // Ancho FIJO (ver ANCHO_TARJETA arriba), no "100%": todas las tarjetas de la lista miden
  // exactamente lo mismo de ancho, igual que ya miden lo mismo de alto.
  tarjetaWrapper: {
    width: ANCHO_TARJETA,
  },
  separador: { height: spacing.sm },
  // El espaciador que ancla los datos al fondo de la tarjeta (ver nota de cabecera, paso 3).
  espaciador: { flex: 1 },
  // `height` fijo (no `minHeight`) + `overflow: "hidden"`: el nombre mide siempre una linea,
  // pase lo que pase con el texto. Ver nota de cabecera.
  principal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    lineHeight: ALTO_LINEA_PRINCIPAL,
    height: ALTO_LINEA_PRINCIPAL,
    overflow: "hidden",
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
  valor: {
    flexShrink: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  // Mismo `height` fijo + `overflow: "hidden"` que `principal`, para Ficha/Edad/Comunidad y
  // cualquier otro valor de texto simple. "chip"/"estado" (StatusChip) ya son compactos de por
  // si, y "chips" queda fuera de este esquema entero (ver `puedeFijarAltura`).
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    lineHeight: ALTO_LINEA_TEXTO,
    height: ALTO_LINEA_TEXTO,
    overflow: "hidden",
    color: colors.text,
    textAlign: "right",
  },
  avatar: {
    width: ALTO_AVATAR,
    height: ALTO_AVATAR,
    borderRadius: ALTO_AVATAR / 2,
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
