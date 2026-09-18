import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@ecopac/ui-tokens";

import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import Selector from "./Selector";
import TextField from "./TextField";

/**
 * Selector con la salida de crear la opcion que falta, sin salir del formulario.
 *
 * Espejo de apps/web/src/components/SelectorConAlta.jsx: mismas props, con la unica diferencia
 * que el contrato del catalogo admite (`onPress` por `onClick`, dentro de los botones).
 *
 * En jornada, la comunidad de la persona que se esta registrando muchas veces todavia no existe
 * en el catalogo, y mandar a quien registra a otra pantalla pierde lo que ya llevaba escrito
 * (issue #743 en web, #838 en movil). Solo dibuja: quien lo monta pasa `onCrear`, que es quien
 * llama al servidor, recarga el catalogo y deja la opcion nueva seleccionada.
 */
export default function SelectorConAlta({
  label,
  value,
  options = [],
  onSelect,
  placeholder = "Seleccionar",
  error,
  disabled = false,
  puedeCrear = false,
  habilitadoParaCrear = true,
  etiquetaAlta = "Crear",
  labelNuevo = "Nombre",
  onCrear,
  erroresAlta = {},
  creando = false,
  style,
}) {
  const [creandoNueva, setCreandoNueva] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorNueva, setErrorNueva] = useState(null);

  const cerrarAlta = () => {
    setCreandoNueva(false);
    setNombreNuevo("");
    setErrorNueva(null);
  };

  const guardar = async () => {
    const resultado = await onCrear?.(nombreNuevo);
    setErrorNueva(resultado?.error?.mensaje ?? null);
    // El hook devuelve la entidad creada bajo su propio nombre (`comunidad`, `especialidad`...),
    // asi que el exito se lee por la ausencia de error, no por una clave concreta.
    const hayErrores =
      Boolean(resultado?.error) || Object.keys(resultado?.errores ?? {}).length > 0;
    if (!hayErrores) cerrarAlta();
  };

  return (
    <View style={style}>
      <Selector
        label={label}
        value={value || null}
        options={options}
        onSelect={onSelect}
        placeholder={placeholder}
        error={error}
        disabled={disabled}
      />

      {puedeCrear && habilitadoParaCrear && !creandoNueva ? (
        <SecondaryButton
          title={etiquetaAlta}
          size="sm"
          onPress={() => setCreandoNueva(true)}
          disabled={disabled}
          style={estilos.accion}
        />
      ) : null}

      {puedeCrear && creandoNueva ? (
        <View style={estilos.alta}>
          <TextField
            label={labelNuevo}
            value={nombreNuevo}
            onChangeText={setNombreNuevo}
            error={erroresAlta.nombre ?? errorNueva}
            editable={!creando}
          />
          <View style={estilos.botones}>
            <PrimaryButton
              title="Guardar"
              size="sm"
              onPress={guardar}
              loading={creando}
              style={estilos.boton}
            />
            <SecondaryButton
              title="Cancelar"
              size="sm"
              onPress={cerrarAlta}
              disabled={creando}
              style={estilos.boton}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  accion: {
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  alta: {
    marginBottom: spacing.sm,
  },
  botones: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  boton: {
    flex: 1,
  },
});
