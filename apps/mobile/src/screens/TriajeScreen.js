import { createRef, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  nombreCompletoDePaciente,
  usePaciente,
  useJornadaActiva,
  useRegistroTriaje,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  NumberField,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { almacenamientoMovil } from "../almacenamiento";
import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Id fijo: solo hay un formulario de Triaje montado a la vez (una atencion por pantalla).
const ID_FORMULARIO = "triaje";

export default function TriajeScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { perfil, rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;

  const { paciente, cargando: cargandoPaciente } = usePaciente(pacienteId, { rol });
  const { jornadaId, jornada } = useJornadaActiva({
    perfilId: perfil?.id,
    almacenamiento: almacenamientoMovil,
  });

  const {
    campos,
    valores,
    errores,
    advertencias,
    error,
    enviando,
    guardado,
    imc,
    permitido,
    hayCambios,
    setCampo,
    reiniciar,
    guardar,
  } = useRegistroTriaje({
    pacienteId,
    fechaNacimiento: paciente?.fechaNacimiento,
    jornadaId,
    estadoDeJornada: jornada?.estado,
    perfilId: perfil?.id,
    rol,
  });

  const { registrar, desregistrar } = useRegistroSinGuardar();

  // Se registra mientras haya algo sin guardar (issue #110, criterio 2) y se desregistra solo:
  // el cleanup de este efecto corre tanto cuando hayCambios pasa a false (guardar() exitoso, ya
  // que useRegistroTriaje apaga hayCambios en cuanto guardado deja de ser null) como al
  // desmontar la pantalla. Salir de Triaje sin guardar ya pierde los datos sin aviso hoy -esto
  // no lo resuelve, solo evita que quede un aviso fantasma para la proxima pantalla sucia.
  useEffect(() => {
    if (!hayCambios) return;
    registrar(ID_FORMULARIO);
    return () => desregistrar(ID_FORMULARIO);
  }, [hayCambios, registrar, desregistrar]);

  const referencias = useMemo(
    () => Object.fromEntries(campos.map((campo) => [campo.id, createRef()])),
    [campos],
  );

  const enfocarSiguiente = (indice) => {
    const siguiente = campos[indice + 1];
    if (siguiente) referencias[siguiente.id].current?.focus();
  };

  if (!permitido) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Tu rol no puede tomar signos vitales." />
      </ScreenContainer>
    );
  }

  if (cargandoPaciente && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!jornadaId) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="No hay una jornada en curso asignada. Sin jornada no se puede registrar un triaje." />
      </ScreenContainer>
    );
  }

  if (guardado) {
    return (
      <ScreenContainer>
        <Card title="Signos registrados">
          <Text style={styles.texto}>
            {nombreCompletoDePaciente(paciente) ?? "El paciente"} quedo en la cola de espera del
            medico.
          </Text>
          {imc !== null && <Text style={styles.texto}>IMC: {imc}</Text>}
        </Card>
        <PrimaryButton title="Volver a la ficha" onPress={() => navigation.goBack()} />
        <SecondaryButton title="Tomar otro triaje" onPress={reiniciar} style={styles.accion} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.paciente}>{nombreCompletoDePaciente(paciente) ?? "Paciente"}</Text>
      {jornada?.nombre && <Text style={styles.jornada}>{jornada.nombre}</Text>}

      {error && (
        <Card style={styles.tarjetaError}>
          <Text style={styles.textoError}>{error.mensaje}</Text>
        </Card>
      )}

      {campos.map((campo, indice) => (
        <View key={campo.id}>
          <NumberField
            ref={referencias[campo.id]}
            label={campo.validacion?.requerido ? `${campo.label} *` : campo.label}
            value={valores[campo.id] === "" ? null : valores[campo.id]}
            onChange={(valor) => setCampo(campo.id, valor === null ? "" : valor)}
            suffix={campo.sufijo}
            error={errores[campo.id]}
            editable={!enviando}
            returnKeyType={indice === campos.length - 1 ? "done" : "next"}
            blurOnSubmit={indice === campos.length - 1}
            onSubmitEditing={() => enfocarSiguiente(indice)}
          />
          {advertencias[campo.id] && (
            <Text style={styles.advertencia}>{advertencias[campo.id]}</Text>
          )}
        </View>
      ))}

      {imc !== null && <Text style={styles.imc}>IMC: {imc}</Text>}

      <PrimaryButton
        title="Guardar y pasar a la cola"
        onPress={guardar}
        loading={enviando}
        style={styles.accion}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  paciente: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  jornada: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  advertencia: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  imc: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  accion: {
    marginTop: spacing.sm,
  },
  tarjetaError: {
    marginBottom: spacing.sm,
  },
  textoError: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
});
