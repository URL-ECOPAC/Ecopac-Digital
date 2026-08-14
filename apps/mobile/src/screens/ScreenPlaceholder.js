import { View, Text, StyleSheet } from 'react-native';

/**
 * Componente base para pantallas provisionales.
 * Muestra el nombre de la pantalla para poder verificar el flujo de navegacion.
 */
export default function ScreenPlaceholder({ name }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>Pantalla provisional</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});
