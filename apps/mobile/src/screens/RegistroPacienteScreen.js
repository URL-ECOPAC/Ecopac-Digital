import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { TIPOS_DE_CAMPO, pasosConCampos, pasosConError, useRegistroPaciente } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  DateField,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  TextField,
} from "../components";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { ROUTES } from "../navigation/rutas";

const PASOS = pasosConCampos();

export default function RegistroPacienteScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();

  const { jornada } = useJornadaActivaCompartida();

  const {
    valores,
    errores,
    error,
    enviando,
    edad,
    advertenciaDuplicado,
    registrado,
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    registrar,
    reiniciar,
    catalogos,
  } = useRegistroPaciente({
    comunidadInicial: jornada?.comunidadId ?? null,
    nombresInicial: params?.termino ?? "",
  });

  const [indice, setIndice] = useState(0);
  const paso = PASOS[indice];
  const esUltimo = indice === PASOS.length - 1;
  const pasosMarcados = pasosConError(errores);

  const guardar = async () => {
    const resultado = await registrar();
    if (!resultado.ok) {
      const conError = pasosConError(errores);
      const primero = PASOS.findIndex((uno) => conError.includes(uno.id));
      if (primero >= 0) setIndice(primero);
    }
  };

  if (registrado) {
    return (
      <ScreenContainer>
        <Card title="Paciente registrado">
          <Text style={styles.ficha}>{registrado.expediente?.numeroFicha ?? "—"}</Text>
          <Text style={styles.texto}>
            {[registrado.nombres, registrado.apellidos].filter(Boolean).join(" ")}
          </Text>
          <Text style={styles.tenue}>Anota ese numero en la ficha de papel.</Text>
        </Card>

        <PrimaryButton
          title="Ir a la ficha del paciente"
          onPress={() => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId: registrado.id })}
        />
        <SecondaryButton
          title="Registrar otro"
          onPress={() => {
            reiniciar();
            setIndice(0);
          }}
          style={styles.accion}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.progreso}>
        {PASOS.map((uno, posicion) => (
          <View
            key={uno.id}
            style={[
              styles.punto,
              posicion === indice && styles.puntoActivo,
              pasosMarcados.includes(uno.id) && styles.puntoConError,
            ]}
          />
        ))}
      </View>
      <Text style={styles.titulo}>
        {paso.titulo} · paso {indice + 1} de {PASOS.length}
      </Text>

      {advertenciaDuplicado && <Text style={styles.advertencia}>{advertenciaDuplicado}</Text>}
      {error && <Text style={styles.errorGeneral}>{error.mensaje}</Text>}

      {paso.campos.map((campo) => {
        if (campo.id === "comunidad") {
          return (
            <View key="comunidad">
              <Selector
                label="Departamento"
                value={departamentoId}
                options={catalogos.departamentos}
                onSelect={setDepartamento}
                placeholder="Departamento"
                disabled={enviando || catalogos.departamentos.length === 0}
              />
              <Selector
                label="Municipio"
                value={municipioId}
                options={catalogos.municipios}
                onSelect={setMunicipio}
                placeholder="Municipio"
                disabled={enviando || !departamentoId || catalogos.municipios.length === 0}
              />
              <Selector
                label={campo.label}
                value={valores.comunidad || null}
                options={catalogos.comunidades}
                onSelect={(valor) => setCampo("comunidad", valor)}
                placeholder="Comunidad"
                error={errores.comunidad}
                disabled={enviando || !municipioId || catalogos.comunidades.length === 0}
              />
            </View>
          );
        }

        if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
          const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
          return (
            <Selector
              key={campo.id}
              label={campo.label}
              value={valores[campo.id] || null}
              options={opciones}
              onSelect={(valor) => setCampo(campo.id, valor)}
              error={errores[campo.id]}
              disabled={enviando || opciones.length === 0}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
          return (
            <View key={campo.id}>
              <DateField
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
              {edad && <Text style={styles.tenue}>Edad: {edad}</Text>}
            </View>
          );
        }

        return (
          <TextField
            key={campo.id}
            label={campo.label}
            value={valores[campo.id] ?? ""}
            onChangeText={(texto) => setCampo(campo.id, texto)}
            keyboardType={campo.tipo === TIPOS_DE_CAMPO.TELEFONO ? "phone-pad" : "default"}
            maxLength={campo.validacion?.maxLongitud}
            error={errores[campo.id]}
            editable={!enviando}
          />
        );
      })}

      <View style={styles.navegacion}>
        {indice > 0 && (
          <SecondaryButton
            title="Atras"
            onPress={() => setIndice(indice - 1)}
            disabled={enviando}
            style={styles.mitad}
          />
        )}
        {esUltimo ? (
          <PrimaryButton
            title="Registrar paciente"
            onPress={guardar}
            loading={enviando}
            style={styles.mitad}
          />
        ) : (
          <PrimaryButton
            title="Siguiente"
            onPress={() => setIndice(indice + 1)}
            disabled={enviando}
            style={styles.mitad}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  progreso: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  punto: {
    backgroundColor: colors.border,
    borderRadius: 3,
    flex: 1,
    height: 6,
  },
  puntoActivo: {
    backgroundColor: colors.primary,
  },
  puntoConError: {
    backgroundColor: colors.danger,
  },
  titulo: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  ficha: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
  tenue: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  advertencia: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  errorGeneral: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  navegacion: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mitad: {
    flex: 1,
  },
});
