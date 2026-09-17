import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import { useFormularioComunidad } from "@ecopac/shared";

import { Modal, PrimaryButton, SecondaryButton, Selector, TextField } from "../components";
import MapaUbicacionComunidad from "../components/MapaUbicacionComunidad";

function valoresDe(comunidad) {
  return {
    nombre: comunidad?.nombre ?? "",
    referenciaAcceso: comunidad?.referenciaAcceso ?? "",
    esVigente: comunidad?.esVigente ?? true,
    latitud: comunidad?.latitud ?? null,
    longitud: comunidad?.longitud ?? null,
  };
}

/**
 * Modal de alta y edicion de comunidad en movil (issue #756). Espejo de
 * apps/web/src/pages/ModalComunidad.jsx: mismo estado local, mismo hook compartido de la
 * cascada (useFormularioComunidad), mismo guardar()/erroresForm que resuelve la pantalla de
 * catalogo.
 */
export default function ModalComunidad({ visible, comunidad, onClose, onGuardar, erroresForm }) {
  const editando = Boolean(comunidad?.id);
  const [valores, setValores] = useState(() => valoresDe(comunidad));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const {
    departamentos,
    municipios,
    departamentoId,
    elegirDepartamento,
    municipioId,
    setMunicipioId,
    cargando: cargandoCascada,
  } = useFormularioComunidad(comunidad?.id ?? null);

  useEffect(() => {
    setValores(valoresDe(comunidad));
    setError(null);
  }, [comunidad]);

  const cambiar = (campo, valor) => setValores((anteriores) => ({ ...anteriores, [campo]: valor }));

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(comunidad?.id ?? null, {
      nombre: valores.nombre,
      municipioId,
      referenciaAcceso: valores.referenciaAcceso || null,
      latitud: valores.latitud,
      longitud: valores.longitud,
      ...(editando ? { esVigente: valores.esVigente } : {}),
    });

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar comunidad" : "Nueva comunidad"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error.mensaje}</Text> : null}
        {erroresForm?.ubicacion ? <Text style={styles.aviso}>{erroresForm.ubicacion}</Text> : null}

        <TextField
          label="Nombre"
          value={valores.nombre}
          onChangeText={(texto) => cambiar("nombre", texto)}
          error={erroresForm?.nombre}
        />

        <Selector
          label="Departamento"
          value={departamentoId}
          options={departamentos}
          onSelect={elegirDepartamento}
          disabled={cargandoCascada}
        />
        <Selector
          label="Municipio"
          value={municipioId}
          options={municipios}
          onSelect={setMunicipioId}
          disabled={!departamentoId || cargandoCascada}
          error={erroresForm?.municipio_id}
        />

        <TextField
          label="Referencia de acceso"
          value={valores.referenciaAcceso}
          onChangeText={(texto) => cambiar("referenciaAcceso", texto)}
          placeholder="Como llegar cuando no hay dirección formal"
          multiline
          numberOfLines={2}
        />

        <View style={styles.campoMapa}>
          <Text style={styles.label}>Ubicacion en el mapa</Text>
          <MapaUbicacionComunidad
            latitud={valores.latitud}
            longitud={valores.longitud}
            onCambiarUbicacion={(latitud, longitud) => {
              cambiar("latitud", latitud);
              cambiar("longitud", longitud);
            }}
          />
        </View>

        {editando && (
          <View style={styles.filaVigente}>
            <Text style={styles.label}>Comunidad vigente</Text>
            <Switch
              value={valores.esVigente}
              onValueChange={(valor) => cambiar("esVigente", valor)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        )}

        <View style={styles.acciones}>
          <SecondaryButton
            title="Cancelar"
            onPress={onClose}
            disabled={enviando}
            style={styles.boton}
          />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear comunidad"}
            onPress={guardar}
            loading={enviando}
            disabled={!municipioId || !valores.nombre}
            style={styles.boton}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  campoMapa: {
    marginBottom: spacing.md,
  },
  filaVigente: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  acciones: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  boton: {
    flex: 1,
  },
});
