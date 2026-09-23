import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  COLUMNAS_CATALOGO_CONDICIONES,
  FILTROS_CATALOGO_CONDICIONES,
  useCatalogoCondiciones,
} from "@ecopac/shared";
import { colors, moduleAccents, spacing, typography } from "@ecopac/ui-tokens";

import {
  DataList,
  EmptyState,
  ErrorState,
  FilterBar,
  Modal,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function CatalogoCondicionesScreen() {
  const { rol } = useSesionCompartida();
  const [enEdicion, setEnEdicion] = useState(null);
  const [nombre, setNombre] = useState("");

  const {
    filas,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    enviando,
    erroresForm,
    recargar,
    permitido,
    puedeCrear,
    puedeMantener,
    crear,
    editar,
    alternarVigencia,
    catalogos,
  } = useCatalogoCondiciones({ rol });

  useEffect(() => {
    setNombre(enEdicion?.condicion?.nombre ?? "");
  }, [enEdicion]);

  if (!permitido) {
    return (
      <ScreenContainer>
        <ErrorState message="No tienes acceso al catálogo de condiciones crónicas." />
      </ScreenContainer>
    );
  }

  if (error && filas.length === 0) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  const guardar = async () => {
    const condicion = enEdicion?.condicion;
    const resultado = condicion ? await editar(condicion.id, { nombre }) : await crear({ nombre });
    if (resultado.ok) setEnEdicion(null);
  };

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Condiciones crónicas"
        subtitle={
          total === 1 ? "1 condición en el catálogo" : `${total} condiciones en el catálogo`
        }
        accent={moduleAccents.pacientes}
      />

      <FilterBar
        campos={FILTROS_CATALOGO_CONDICIONES}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <View style={estilos.lista}>
        <DataList
          columnas={COLUMNAS_CATALOGO_CONDICIONES}
          datos={filas}
          cargando={cargando}
          catalogos={catalogos}
          onRowPress={puedeMantener ? (fila) => setEnEdicion({ condicion: fila }) : undefined}
          vacio={
            hayFiltros ? (
              <EmptyState
                message="Ninguna condición coincide con los filtros."
                actionLabel="Limpiar filtros"
                onAction={limpiarFiltros}
              />
            ) : (
              <EmptyState message="Todavía no hay condiciones en el catálogo." />
            )
          }
        />
      </View>

      {puedeCrear ? (
        <PrimaryButton
          title="Nueva condición"
          onPress={() => setEnEdicion({ condicion: null })}
          style={estilos.accion}
        />
      ) : null}

      <Modal
        visible={Boolean(enEdicion)}
        onClose={() => setEnEdicion(null)}
        title={enEdicion?.condicion ? "Editar condición" : "Nueva condición"}
      >
        {error ? <Text style={estilos.error}>{error.mensaje}</Text> : null}

        <TextField
          label="Nombre"
          value={nombre}
          onChangeText={setNombre}
          error={erroresForm?.nombre}
          editable={!enviando}
        />

        <PrimaryButton
          title="Guardar"
          onPress={guardar}
          loading={enviando}
          disabled={enviando || nombre.trim().length === 0}
          style={estilos.accion}
        />

        {enEdicion?.condicion ? (
          <SecondaryButton
            title={enEdicion.condicion.esVigente ? "Retirar del catálogo" : "Reactivar"}
            onPress={async () => {
              const resultado = await alternarVigencia(enEdicion.condicion);
              if (resultado.ok) setEnEdicion(null);
            }}
            disabled={enviando}
            style={estilos.accion}
          />
        ) : null}

        <SecondaryButton
          title="Cancelar"
          onPress={() => setEnEdicion(null)}
          disabled={enviando}
          style={estilos.accion}
        />
      </Modal>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  lista: {
    flex: 1,
  },
  accion: {
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
});
