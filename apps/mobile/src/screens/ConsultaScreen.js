import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  TIPOS_DE_CAMPO,
  nombreCompletoDePaciente,
  usePaciente,
  useJornadaActiva,
  useRegistroConsulta,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  TextField,
} from "../components";
import { almacenamientoMovil } from "../almacenamiento";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

function CabeceraDeSignos({ signos }) {
  if (!signos) {
    return (
      <Card title="Signos vitales" style={styles.tarjeta}>
        <Text style={styles.textoTenue}>Este paciente no tiene triaje en esta jornada.</Text>
      </Card>
    );
  }

  const renglones = [
    signos.presionSistolica && signos.presionDiastolica
      ? `PA ${signos.presionSistolica}/${signos.presionDiastolica}`
      : null,
    signos.frecuenciaCardiaca ? `FC ${signos.frecuenciaCardiaca}` : null,
    signos.temperatura ? `T ${signos.temperatura}` : null,
    signos.glucosa ? `Glu ${signos.glucosa}` : null,
    signos.peso ? `${signos.peso} kg` : null,
    signos.imc ? `IMC ${signos.imc}` : null,
  ].filter(Boolean);

  return (
    <Card title="Signos vitales" style={styles.tarjeta}>
      <Text style={styles.signos}>{renglones.join("  ·  ")}</Text>
    </Card>
  );
}

function Diagnosticos({ campo, valor, opciones, onChange, deshabilitado }) {
  const elegidos = valor ?? [];

  const agregar = (id) => {
    if (!id || elegidos.includes(id)) return;
    onChange([...elegidos, id]);
  };

  const quitar = (id) => onChange(elegidos.filter((uno) => uno !== id));

  return (
    <View>
      <Selector
        label={campo.label}
        value={null}
        options={opciones.filter((opcion) => !elegidos.includes(opcion.value))}
        onSelect={agregar}
        placeholder="Agregar diagnostico"
        disabled={deshabilitado || opciones.length === 0}
      />
      {elegidos.map((id, indice) => (
        <Pressable key={id} onPress={() => quitar(id)} style={styles.diagnostico}>
          <Text style={styles.textoDiagnostico}>
            {indice === 0 ? "Principal: " : ""}
            {opciones.find((opcion) => opcion.value === id)?.label ?? id}
          </Text>
          <Text style={styles.quitar}>Quitar</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ConsultaScreen() {
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
    secciones,
    valores,
    error,
    enviando,
    preparando,
    guardada,
    signos,
    bloqueo,
    setCampo,
    descartarBorrador,
    guardar,
    catalogos,
  } = useRegistroConsulta({
    pacienteId,
    expedienteId: paciente?.expediente?.id,
    jornadaId,
    estadoDeJornada: jornada?.estado,
    perfilId: perfil?.id,
    almacenamiento: almacenamientoMovil,
  });

  const [abiertas, setAbiertas] = useState(() => new Set([secciones[0]?.id]));

  const alternar = (id) =>
    setAbiertas((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  if (!bloqueo.puede) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={bloqueo.motivo} />
      </ScreenContainer>
    );
  }

  if ((cargandoPaciente && !paciente) || preparando) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (guardada) {
    return (
      <ScreenContainer>
        <Card title="Consulta registrada">
          <Text style={styles.texto}>
            Queda guardada para {nombreCompletoDePaciente(paciente) ?? "el paciente"}.
          </Text>
        </Card>
        <PrimaryButton
          title="Generar receta"
          onPress={() =>
            navigation.navigate(ROUTES.RECETA, { pacienteId, consultaId: guardada.id })
          }
        />
        <SecondaryButton
          title="Volver a la ficha"
          onPress={() => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId })}
          style={styles.accion}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.paciente}>{nombreCompletoDePaciente(paciente) ?? "Paciente"}</Text>
      {jornada?.nombre && <Text style={styles.jornada}>{jornada.nombre}</Text>}

      <CabeceraDeSignos signos={signos} />

      {error && (
        <Card style={styles.tarjeta}>
          <Text style={styles.textoError}>{error.mensaje}</Text>
        </Card>
      )}

      {secciones.map((seccion) => {
        const abierta = abiertas.has(seccion.id);

        return (
          <Card key={seccion.id} style={styles.tarjeta}>
            <Pressable onPress={() => alternar(seccion.id)} style={styles.cabeceraSeccion}>
              <Text style={styles.tituloSeccion}>{seccion.titulo}</Text>
              <Text style={styles.textoTenue}>{abierta ? "Ocultar" : "Mostrar"}</Text>
            </Pressable>

            {abierta &&
              seccion.campos.map((campo) =>
                campo.tipo === TIPOS_DE_CAMPO.MULTI_SELECT ? (
                  <Diagnosticos
                    key={campo.id}
                    campo={campo}
                    valor={valores[campo.id]}
                    opciones={catalogos[campo.opcionesDesde] ?? []}
                    onChange={(siguiente) => setCampo(campo.id, siguiente)}
                    deshabilitado={enviando}
                  />
                ) : (
                  <TextField
                    key={campo.id}
                    label={campo.validacion?.requerido ? `${campo.label} *` : campo.label}
                    value={valores[campo.id] ?? ""}
                    onChangeText={(texto) => setCampo(campo.id, texto)}
                    multiline
                    numberOfLines={3}
                    editable={!enviando}
                  />
                ),
              )}
          </Card>
        );
      })}

      <PrimaryButton
        title="Guardar consulta"
        onPress={guardar}
        loading={enviando}
        style={styles.accion}
      />
      <SecondaryButton
        title="Descartar borrador"
        onPress={descartarBorrador}
        disabled={enviando}
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
  tarjeta: {
    marginBottom: spacing.sm,
  },
  cabeceraSeccion: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  tituloSeccion: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  signos: {
    color: colors.text,
    fontSize: typography.sizes.md,
  },
  diagnostico: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  textoDiagnostico: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.sizes.sm,
  },
  quitar: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
  textoTenue: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  textoError: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
