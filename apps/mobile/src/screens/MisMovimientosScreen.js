import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  COLUMNAS_MIS_MOVIMIENTOS,
  FILTROS_MIS_MOVIMIENTOS,
  OPCIONES_TIPO_MOVIMIENTO,
  useMisMovimientos,
} from "@ecopac/shared";
import { colors, typography } from "@ecopac/ui-tokens";

import { DataList, ErrorState, FilterBar, PageHeader, ScreenContainer } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalCorreccionMovimiento from "./ModalCorreccionMovimiento";

/**
 * Pantalla "Mis movimientos" en movil (issue #756). Espejo de
 * apps/web/src/pages/MisMovimientosPage.jsx: mismo hook, mismos descriptores, mismo filtro
 * "Ver" (mios/todos) solo para quien puede aprobar movimientos.
 */
export default function MisMovimientosScreen() {
  const { perfil } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { movimiento: object }

  const {
    movimientos,
    total,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar,
    editar,
    puedeVer,
    puedeVerTodos,
  } = useMisMovimientos({ usuarioId: perfil?.id, rolUsuario: perfil?.rol });

  if (!puedeVer) {
    return (
      <ScreenContainer>
        <PageHeader title="Mis movimientos" />
        <ErrorState message="No tienes acceso a esta pantalla." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Mis movimientos" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  const campos = puedeVerTodos
    ? FILTROS_MIS_MOVIMIENTOS
    : FILTROS_MIS_MOVIMIENTOS.filter((campo) => campo.id !== "alcance");

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader title="Mis movimientos" subtitle="Movimientos de inventario que registraste" />

      <FilterBar campos={campos} valores={filtros} onChange={setFiltro} />

      <Text style={styles.total}>{total === 1 ? "1 movimiento" : `${total} movimientos`}</Text>

      <DataList
        columnas={COLUMNAS_MIS_MOVIMIENTOS}
        datos={movimientos}
        cargando={cargando}
        catalogos={{ tiposMovimiento: OPCIONES_TIPO_MOVIMIENTO }}
        onRowPress={(fila) => setModal({ movimiento: fila })}
        vacio="No hay movimientos que coincidan con el filtro."
      />

      {modal && (
        <ModalCorreccionMovimiento
          visible
          movimiento={modal.movimiento}
          onClose={() => setModal(null)}
          onGuardar={editar}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  total: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: 8,
  },
});
