import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  TIPOS_DE_CAMPO,
  nombreCompletoDePaciente,
  usePaciente,
  useRegistroConsulta,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  MultiSelector,
  ScreenContainer,
  SecondaryButton,
  TextField,
} from "../components";
import { almacenamientoMovil } from "../almacenamiento";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
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

/**
 * Diagnosticos de la consulta.
 *
 * ISSUE #834: era un Selector mas una lista de filas con "Quitar" escrita a mano -- el
 * MultiSelector del catalogo hecho de nuevo, peor, y sin la salida que la web tiene desde la
 * #641: crear el diagnostico que falta sin salir de la consulta. Ahora es el componente del
 * catalogo, que ademas ya sabe elegir una opcion existente cuando se escribe su nombre.
 *
 * El primero de la lista es el diagnostico PRINCIPAL (asi lo guarda registrarConsulta), y eso
 * tiene que decirlo la pantalla: la nota de abajo es lo unico propio que queda aqui.
 */
function Diagnosticos({ campo, valor, opciones, onChange, onCrear, deshabilitado }) {
  const elegidos = valor ?? [];

  return (
    <View>
      <MultiSelector
        label={campo.label}
        value={elegidos}
        options={opciones}
        onChange={onChange}
        onCrear={onCrear ?? undefined}
        placeholder="Agregar diagnóstico"
        placeholderLibre="Escribe uno que no esté en el catálogo"
        disabled={deshabilitado}
      />
      {elegidos.length > 0 ? (
        <Text style={styles.textoTenue}>El primero de la lista es el diagnóstico principal.</Text>
      ) : null}
    </View>
  );
}

export default function ConsultaScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { perfil, rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;

  const { paciente, cargando: cargandoPaciente } = usePaciente(pacienteId, { rol });
  const { jornadaId, jornada } = useJornadaActivaCompartida();

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
    // Solo llega con rol si puedeAdministrarDiagnosticos(rol); el hook lo deja en null para el
    // resto, y MultiSelector entonces no ofrece crear nada.
    crearDiagnosticoNuevo,
    errorDiagnostico,
  } = useRegistroConsulta({
    pacienteId,
    expedienteId: paciente?.expediente?.id,
    jornadaId,
    estadoDeJornada: jornada?.estado,
    perfilId: perfil?.id,
    rol,
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

      {/* El fallo al crear un diagnostico nuevo va aparte del de guardar la consulta: no impide
          seguir escribiendola, solo dice que ese diagnostico no entro al catalogo. */}
      {errorDiagnostico && (
        <Card style={styles.tarjeta}>
          <Text style={styles.textoError}>{errorDiagnostico.mensaje}</Text>
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
                    onCrear={crearDiagnosticoNuevo}
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
