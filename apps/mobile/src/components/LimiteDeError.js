import { Component } from "react";
import { StyleSheet, Text, View } from "react-native";
import { reportarError } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Limite de error de React (issue #762, "manejo global de errores"). Espejo de
 * apps/web/src/components/LimiteDeError.jsx, con las mismas props.
 *
 * Sin el, una excepcion al dibujar cualquier pantalla desmontaba la app entera: en una build de
 * tienda eso es la app cerrandose sola en mitad de una atencion, sin mensaje y sin nada registrado.
 * Ahora el fallo se reporta (ya limpio de datos de paciente, ver packages/shared/observabilidad) y
 * la persona ve que paso y tiene como seguir.
 *
 * Tiene que ser una clase: React solo ofrece getDerivedStateFromError/componentDidCatch ahi.
 *
 * `claveDeReinicio` vacia el error cuando cambia: un fallo en una pantalla no deja rota la
 * siguiente.
 */
export default class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportarError(error, {
      origen: "render",
      ruta: this.props.ruta,
      modulo: this.props.modulo,
      pilaDeComponentes: info?.componentStack,
    });
  }

  componentDidUpdate(propsAnteriores) {
    if (this.state.error && propsAnteriores.claveDeReinicio !== this.props.claveDeReinicio) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.contenedor} accessibilityRole="alert">
        <Text style={styles.titulo}>Algo salió mal en esta pantalla</Text>
        <Text style={styles.mensaje}>
          El error quedó registrado. Lo que ya estaba guardado no se perdió; lo que se estaba
          escribiendo en esta pantalla, sí. Puedes reintentar o volver al inicio.
        </Text>
        <View style={styles.acciones}>
          {this.props.onVolverAlInicio ? (
            <SecondaryButton
              title="Volver al inicio"
              variant="neutra"
              onPress={() => {
                this.setState({ error: null });
                this.props.onVolverAlInicio();
              }}
            />
          ) : null}
          <PrimaryButton title="Reintentar" onPress={() => this.setState({ error: null })} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  mensaje: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  acciones: {
    gap: spacing.sm,
  },
});
