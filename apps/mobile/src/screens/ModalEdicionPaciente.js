import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import { TIPOS_DE_CAMPO, useEdicionPaciente } from "@ecopac/shared";

import {
  CascadaDeComunidad,
  DateField,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Selector,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

const TECLADO_DE_CAMPO = {
  [TIPOS_DE_CAMPO.TELEFONO]: "phone-pad",
};

/**
 * Edicion de los datos del paciente en movil (issue #756). Espejo de
 * apps/web/src/pages/ModalEdicionPaciente.jsx: mismo hook compartido (useEdicionPaciente),
 * mismos campos y el mismo aviso de "hay cambios sin guardar" antes de cerrar.
 */
export default function ModalEdicionPaciente({ visible, paciente, onClose, onGuardado }) {
  const { rol } = useSesionCompartida();
  const {
    campos,
    valores,
    errores,
    error,
    enviando,
    hayCambios,
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    descartar,
    guardar,
    catalogos,
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
  } = useEdicionPaciente(paciente, { rol });
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  const intentarCerrar = () => {
    if (hayCambios && !enviando) {
      setConfirmandoSalida(true);
      return;
    }
    onClose?.();
  };

  const salirSinGuardar = () => {
    descartar();
    setConfirmandoSalida(false);
    onClose?.();
  };

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.paciente);
  };

  const opcionesDe = (campo) =>
    campo.opciones ?? (campo.opcionesDesde ? (catalogos[campo.opcionesDesde] ?? []) : []);

  return (
    <>
      <Modal
        visible={visible && !confirmandoSalida}
        onClose={intentarCerrar}
        title="Editar datos del paciente"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error.mensaje}</Text> : null}

          {campos.map((campo) => {
            // La misma cascada que el registro (issue #840): antes aqui habia un selector plano
            // con todas las comunidades del pais.
            if (campo.id === "comunidad") {
              return (
                <CascadaDeComunidad
                  key="comunidad"
                  label={campo.label}
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

            if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
              const opciones = opcionesDe(campo);
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
                <DateField
                  key={campo.id}
                  label={campo.label}
                  value={valores[campo.id] || null}
                  onChange={(valor) => setCampo(campo.id, valor)}
                  error={errores[campo.id]}
                  disabled={enviando}
                />
              );
            }

            return (
              <TextField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] ?? ""}
                onChangeText={(texto) => setCampo(campo.id, texto)}
                keyboardType={TECLADO_DE_CAMPO[campo.tipo] ?? "default"}
                maxLength={campo.validacion?.maxLongitud}
                error={errores[campo.id]}
                editable={!enviando}
              />
            );
          })}

          <PrimaryButton
            title="Guardar cambios"
            onPress={guardarCambios}
            loading={enviando}
            disabled={!hayCambios}
            style={styles.boton}
          />
          <SecondaryButton
            title="Cancelar"
            onPress={intentarCerrar}
            disabled={enviando}
            style={styles.boton}
          />
        </ScrollView>
      </Modal>

      <Modal
        visible={visible && confirmandoSalida}
        onClose={() => setConfirmandoSalida(false)}
        title="Hay cambios sin guardar"
      >
        <Text style={styles.aviso}>
          Si salis ahora se pierden los cambios que hiciste en la ficha del paciente.
        </Text>
        <PrimaryButton
          title="Seguir editando"
          onPress={() => setConfirmandoSalida(false)}
          style={styles.boton}
        />
        <SecondaryButton title="Salir sin guardar" onPress={salirSinGuardar} style={styles.boton} />
      </Modal>
    </>
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
    color: colors.text,
    marginBottom: spacing.md,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
