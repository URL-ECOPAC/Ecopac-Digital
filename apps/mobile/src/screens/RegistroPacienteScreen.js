import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { TIPOS_DE_CAMPO, pasosConCampos, pasosConError, useRegistroPaciente } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  CampoDeFormulario,
  Card,
  CascadaDeComunidad,
  DateField,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { EnFormulario } from "../components/contextoDeFormulario";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

const PASOS = pasosConCampos();

export default function RegistroPacienteScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();

  const { jornada } = useJornadaActivaCompartida();
  const { perfil } = useSesionCompartida();

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
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
  } = useRegistroPaciente({
    comunidadInicial: jornada?.comunidadId ?? null,
    nombresInicial: params?.termino ?? "",
    // Sin el rol, puedeCrearComunidad era siempre false y el alta de comunidad sin salir del
    // formulario -- que la web tiene desde la #743 -- no existia en movil (issue #838).
    rol: perfil?.rol,
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
          <Text style={styles.tenue}>Anota ese número en la ficha de papel.</Text>
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
            <CascadaDeComunidad
              key="comunidad"
              label={campo.label}
              requerido={campo.validacion?.requerido}
              comunidadId={valores.comunidad}
              error={errores.comunidad}
              catalogos={catalogos}
              departamentoId={departamentoId}
              municipioId={municipioId}
              onDepartamento={setDepartamento}
              onMunicipio={setMunicipio}
              onComunidad={(valor) => setCampo("comunidad", valor)}
              disabled={enviando}
              puedeCrear={puedeCrearComunidad}
              onCrear={registrarComunidad}
              erroresAlta={erroresComunidad}
              creando={creandoComunidad}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
          return (
            <View key={campo.id}>
              <DateField
                label={campo.label}
                requerido={campo.validacion?.requerido}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
              {edad && <Text style={styles.tenue}>Edad: {edad}</Text>}
            </View>
          );
        }

        // El resto, desde el descriptor (issue #927): un switch propio aqui no conocia
        // MULTI_SELECT y dibujaba las areas como un campo de texto.
        return (
          <CampoDeFormulario
            key={campo.id}
            campo={campo}
            valor={valores[campo.id]}
            onChange={(valor) => setCampo(campo.id, valor)}
            error={errores[campo.id]}
            catalogos={catalogos}
            disabled={enviando}
          />
        );
      })}

      {/* El primer paso ofrece "Cancelar" en el lugar de "Atrás": mismo par gris y verde que
          cualquier formulario de alta. */}
      <EnFormulario>
        <View style={styles.navegacion}>
          {indice > 0 ? (
            <SecondaryButton
              title="Atrás"
              onPress={() => setIndice(indice - 1)}
              disabled={enviando}
              style={styles.secundario}
            />
          ) : (
            <SecondaryButton
              title="Cancelar"
              onPress={() => navigation.goBack()}
              disabled={enviando}
              style={styles.secundario}
            />
          )}
          {esUltimo ? (
            <PrimaryButton
              title="Registrar paciente"
              onPress={guardar}
              loading={enviando}
              style={styles.principal}
            />
          ) : (
            <PrimaryButton
              title="Siguiente"
              onPress={() => setIndice(indice + 1)}
              disabled={enviando}
              style={styles.principal}
            />
          )}
        </View>
      </EnFormulario>
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
  // "Atras" o "Cancelar" a su ancho natural, sin encogerse, y la accion principal ocupa el resto,
  // a la derecha. Repartiendo el ancho a partes fijas, uno de los dos rotulos siempre se partia:
  // "Registrar paciente" a medio ancho, o "Cancela/r" a un tercio.
  secundario: {
    flexShrink: 0,
  },
  principal: {
    flex: 1,
  },
});
