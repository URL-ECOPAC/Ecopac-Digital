import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import {
  ESTADOS_MOVIMIENTO,
  ETIQUETAS_ESTADO_MOVIMIENTO,
  OPCIONES_ORIGEN_LOTE,
  OPCIONES_PRESENTACION,
  listarBodegas,
  listarMedicamentos,
  listarPrincipiosActivos,
  listarProveedores,
  useRegistroIngreso,
} from "@ecopac/shared";

import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import {
  DateField,
  ErrorState,
  LoadingState,
  Modal,
  NumberField,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  StatusChip,
  TextField,
} from "../components";

const FORM_MEDICAMENTO_VACIO = {
  nombre: "",
  concentracion: "",
  presentacion: "",
  marca: "",
  principioActivoId: "",
};

// Un medicamento no puede vencer en el pasado: DateField solo usa el anio de minDate para
// acotar la lista de "Anio" (apps/mobile/src/components/DateField.js), asi que alcanza con el 1
// de enero del anio en curso para que la lista deje de ofrecer anios anteriores a hoy.
const ANIO_MINIMO_VENCIMIENTO = `${new Date().getFullYear()}-01-01`;

/** `{ label, value }` de cada catalogo, tal como lo espera Selector (issue #399). */
function aOpciones(lista, { label = "nombre", value = "id" } = {}) {
  return (lista || []).map((item) => ({ label: item[label], value: item[value] }));
}

/**
 * Registro rapido de ingreso de medicamentos en campo (issue #165).
 *
 * Reutiliza el MISMO hook que la pantalla web #156 (useRegistroIngreso, ModalRegistroIngreso.jsx)
 * y las mismas primitivas de shared (registrarIngreso, registrarMedicamento): esta pantalla solo
 * es presentacion. La diferencia con la web no es de logica sino de flujo -un item a la vez, con
 * la bodega del botiquin de la jornada activa precargada- para que un solo ingreso se complete en
 * menos de un minuto (criterio 4).
 *
 * "Agregar" y "Guardar" quedan como dos pasos separados a proposito: guardarMovimiento() lee
 * `items` del estado del hook, y llamarlo en el mismo tick que agregarItem() leeria el arreglo
 * viejo (el setState de agregarItem todavia no se aplico). Encadenarlos con un efecto que reaccione
 * a `items` evitaria eso, pero agregaria una segunda pieza de estado asincrono a coordinar con
 * guardando/resumenGuardado solo para ahorrar un toque -no vale el riesgo en un hook que comparte
 * la pantalla web ya en produccion.
 */
export default function RegistroIngresoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const medicamentoIdPreseleccionado = route.params?.medicamentoId;
  const { perfil, rol } = useSesionCompartida();
  const { jornada } = useJornadaActivaCompartida();

  const [catalogos, setCatalogos] = useState({ medicamentos: [], proveedores: [], bodegas: [] });
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState(null);

  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [modalMedicamentoVisible, setModalMedicamentoVisible] = useState(false);
  const [formMedicamento, setFormMedicamento] = useState(FORM_MEDICAMENTO_VACIO);

  const {
    origen,
    setOrigen,
    proveedorId,
    setProveedorId,
    numeroComprobante,
    setNumeroComprobante,
    items,
    itemActual,
    setItemActual,
    agregarItem,
    eliminarItem,
    guardarMovimiento,
    resumenGuardado,
    resetFormulario,
    error,
    guardando,
    puedeCrearMedicamento,
    crearMedicamentoNuevo,
    creandoMedicamento,
    errorMedicamento,
  } = useRegistroIngreso({ usuarioId: perfil?.id, rol });

  const cargarCatalogos = useCallback(async () => {
    setCargandoCatalogos(true);
    setErrorCatalogos(null);

    const [respuestaMedicamentos, respuestaProveedores, respuestaBodegas] = await Promise.all([
      listarMedicamentos(),
      listarProveedores(),
      listarBodegas(),
    ]);

    setCatalogos({
      medicamentos: respuestaMedicamentos.medicamentos,
      proveedores: respuestaProveedores.proveedores,
      bodegas: respuestaBodegas.bodegas,
    });
    setErrorCatalogos(
      respuestaMedicamentos.error ?? respuestaProveedores.error ?? respuestaBodegas.error ?? null,
    );
    setCargandoCatalogos(false);
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // El escenario central de #165 es una donacion recibida en el lugar: se cambia el default del
  // formulario (no el del hook, que sigue en 'compra' para no alterar lo que ya usa #156).
  useEffect(() => {
    setOrigen("donacion");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo una vez, al montar
  }, []);

  // Precarga la bodega del botiquin de la jornada activa (issue #165, criterio 4), sin inventar
  // un mecanismo nuevo: useJornadaActivaCompartida() ya expone botiquinBodegaId (jornadas/api.js).
  useEffect(() => {
    if (jornada?.botiquinBodegaId && !itemActual.bodega_id) {
      setItemActual((anterior) => ({ ...anterior, bodega_id: jornada.botiquinBodegaId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona a que aparezca la jornada
  }, [jornada?.botiquinBodegaId]);

  // Llega al tocar un medicamento en el catalogo (CatalogoMedicamentosScreen.js, issue #165,
  // criterio 1: "seleccionar un medicamento existente"). Se aplica una sola vez, cuando el
  // catalogo ya trae ese id (si se aplicara antes de cargar, setItemActual lo pisaria con
  // ITEM_VACIO en cuanto termine de cargar).
  useEffect(() => {
    if (
      medicamentoIdPreseleccionado &&
      !cargandoCatalogos &&
      catalogos.medicamentos.some((medicamento) => medicamento.id === medicamentoIdPreseleccionado)
    ) {
      setItemActual((anterior) => ({ ...anterior, medicamento_id: medicamentoIdPreseleccionado }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona a que el catalogo termine de cargar
  }, [medicamentoIdPreseleccionado, cargandoCatalogos]);

  const abrirModalMedicamento = async () => {
    setModalMedicamentoVisible(true);
    if (principiosActivos.length === 0) {
      const { principiosActivos: lista } = await listarPrincipiosActivos();
      setPrincipiosActivos(lista);
    }
  };

  const guardarMedicamentoNuevo = async () => {
    const { medicamento, error: errorCreacion } = await crearMedicamentoNuevo({
      nombre: formMedicamento.nombre,
      concentracion: formMedicamento.concentracion,
      presentacion: formMedicamento.presentacion,
      marca: formMedicamento.marca,
      principiosActivosIds: formMedicamento.principioActivoId
        ? [formMedicamento.principioActivoId]
        : [],
    });

    if (errorCreacion) return;

    setCatalogos((anterior) => ({
      ...anterior,
      medicamentos: [...anterior.medicamentos, medicamento],
    }));
    setFormMedicamento(FORM_MEDICAMENTO_VACIO);
    setModalMedicamentoVisible(false);
  };

  const handleRegistrarOtro = () => {
    resetFormulario();
    cargarCatalogos();
  };

  if (cargandoCatalogos) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando catalogos..." />
      </ScreenContainer>
    );
  }

  if (errorCatalogos) {
    return (
      <ScreenContainer>
        <ErrorState message={errorCatalogos.mensaje} onRetry={cargarCatalogos} />
      </ScreenContainer>
    );
  }

  if (resumenGuardado) {
    const estadoResultado = resumenGuardado.movimientos?.[0]?.estado ?? ESTADOS_MOVIMIENTO.PENDIENTE;
    const esPendiente = estadoResultado === ESTADOS_MOVIMIENTO.PENDIENTE;

    return (
      <ScreenContainer>
        <PageHeader title="Ingreso registrado" />
        <View style={styles.resumen}>
          <StatusChip status={estadoResultado} label={ETIQUETAS_ESTADO_MOVIMIENTO[estadoResultado]} />
          <Text style={styles.textoResumen}>
            {esPendiente
              ? "Este ingreso quedo pendiente: la administradora debe validarlo antes de que sume al inventario."
              : "Este ingreso quedo aprobado automaticamente."}
          </Text>
        </View>
        <PrimaryButton title="Registrar otro ingreso" onPress={handleRegistrarOtro} />
        <SecondaryButton
          title="Volver"
          onPress={() => navigation.goBack()}
          style={styles.botonVolver}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Registrar ingreso"
        subtitle="Ingreso rapido de medicamentos en campo"
      />

      <Selector
        label="Origen"
        value={origen}
        options={OPCIONES_ORIGEN_LOTE}
        onSelect={setOrigen}
      />

      <Selector
        label={origen === "donacion" ? "Donante" : "Proveedor"}
        value={proveedorId || null}
        options={aOpciones(catalogos.proveedores)}
        onSelect={setProveedorId}
        placeholder="Seleccionar"
      />

      <TextField
        label="No. de comprobante (opcional)"
        value={numeroComprobante}
        onChangeText={setNumeroComprobante}
      />

      <View style={styles.filaMedicamento}>
        <Selector
          label="Medicamento"
          value={itemActual.medicamento_id || null}
          options={aOpciones(catalogos.medicamentos, {
            label: "nombre",
            value: "id",
          })}
          onSelect={(valor) => setItemActual({ ...itemActual, medicamento_id: valor })}
          style={styles.selectorMedicamento}
        />
        {puedeCrearMedicamento ? (
          <SecondaryButton title="Nuevo" onPress={abrirModalMedicamento} style={styles.botonNuevo} />
        ) : null}
      </View>

      <TextField
        label="Numero de lote"
        value={itemActual.numero_lote}
        onChangeText={(texto) => setItemActual({ ...itemActual, numero_lote: texto })}
      />

      <DateField
        label="Fecha de vencimiento"
        value={itemActual.fecha_vencimiento || null}
        onChange={(valor) => setItemActual({ ...itemActual, fecha_vencimiento: valor ?? "" })}
        minDate={ANIO_MINIMO_VENCIMIENTO}
      />

      <NumberField
        label="Cantidad"
        value={itemActual.cantidad === "" ? null : Number(itemActual.cantidad)}
        onChange={(valor) => setItemActual({ ...itemActual, cantidad: valor ?? "" })}
        min={1}
      />

      <Selector
        label="Bodega"
        value={itemActual.bodega_id || null}
        options={aOpciones(catalogos.bodegas)}
        onSelect={(valor) => setItemActual({ ...itemActual, bodega_id: valor })}
      />

      {error ? <Text style={styles.textoError}>{error}</Text> : null}

      {items.length === 0 ? (
        <PrimaryButton title="Agregar a la lista" onPress={agregarItem} />
      ) : (
        <View style={styles.tarjetaItem}>
          <Text style={styles.tituloItem}>Listo para guardar</Text>
          <Text style={styles.detalleItem}>
            {items[0].numero_lote} - {items[0].cantidad} unidades
          </Text>
          <View style={styles.filaBotonesItem}>
            <SecondaryButton title="Quitar" onPress={() => eliminarItem(items[0].id)} />
            <PrimaryButton
              title={guardando ? "Guardando..." : "Guardar ingreso"}
              onPress={guardarMovimiento}
              disabled={guardando}
              loading={guardando}
            />
          </View>
        </View>
      )}

      <SecondaryButton
        title="Cancelar"
        onPress={() => navigation.goBack()}
        style={styles.botonCancelar}
      />

      <Modal
        visible={modalMedicamentoVisible}
        onClose={() => setModalMedicamentoVisible(false)}
        title="Registrar medicamento nuevo"
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <TextField
            label="Nombre"
            value={formMedicamento.nombre}
            onChangeText={(texto) => setFormMedicamento({ ...formMedicamento, nombre: texto })}
          />
          <TextField
            label="Concentracion"
            value={formMedicamento.concentracion}
            onChangeText={(texto) =>
              setFormMedicamento({ ...formMedicamento, concentracion: texto })
            }
          />
          <Selector
            label="Presentacion"
            value={formMedicamento.presentacion || null}
            options={OPCIONES_PRESENTACION}
            onSelect={(valor) => setFormMedicamento({ ...formMedicamento, presentacion: valor })}
          />
          <TextField
            label="Marca"
            value={formMedicamento.marca}
            onChangeText={(texto) => setFormMedicamento({ ...formMedicamento, marca: texto })}
          />
          <Selector
            label="Principio activo"
            value={formMedicamento.principioActivoId || null}
            options={aOpciones(principiosActivos)}
            onSelect={(valor) =>
              setFormMedicamento({ ...formMedicamento, principioActivoId: valor })
            }
          />
          {errorMedicamento ? <Text style={styles.textoError}>{errorMedicamento}</Text> : null}
          <PrimaryButton
            title={creandoMedicamento ? "Guardando..." : "Guardar medicamento"}
            onPress={guardarMedicamentoNuevo}
            disabled={creandoMedicamento}
            loading={creandoMedicamento}
          />
        </ScrollView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filaMedicamento: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  selectorMedicamento: {
    flex: 1,
  },
  botonNuevo: {
    marginBottom: spacing.md,
  },
  textoError: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  tarjetaItem: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tituloItem: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  detalleItem: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  filaBotonesItem: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  botonCancelar: {
    marginTop: spacing.sm,
  },
  resumen: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  textoResumen: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  botonVolver: {
    marginTop: spacing.sm,
  },
});
