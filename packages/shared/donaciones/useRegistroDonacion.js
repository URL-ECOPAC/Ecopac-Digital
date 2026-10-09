import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ESTADOS_JORNADA,
  ETIQUETAS_TIPO_DONACION,
  TIPOS_DE_ARTICULO,
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
} from "../enums.js";
import { aCadenaFechaLocal, formatearFechaCorta, formatearFechaLarga } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";
import { opcionDeMedicamento } from "../inventario/catalogoMedicamentos.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { useAltaDeMedicamentoEnLinea } from "../inventario/useAltaDeMedicamentoEnLinea.js";
import { listarJornadas } from "../jornadas/api.js";
import { listarProyectos } from "../proyectos/api.js";
import { proyectosQueAdmitenCambios } from "../proyectos/validaciones.js";
import { camposDeRenglonDeDonacion } from "./campos.js";
import { listarDonantes, registrarDonante } from "./donantes.api.js";
import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";
import { registrarDonacion } from "./registro.api.js";

/**
 * Renglon de detalle vacio. Los nombres de campo son los de `donacion_detalle` (00022) y de
 * `CAMPOS_DONACION.detalles.campos` (campos.js): `descripcion`, `cantidad`, `unidad`, `monto`.
 * Antes de la #635 el campo se llamaba `concepto` -que ni `validarDonacion()` ni
 * `donacion_detalle` reconocen- y no existia `unidad`, asi que `validarDonacion()` habria
 * rechazado cualquier renglon con "falta descripcion" sin importar lo que la persona hubiera
 * escrito. `medicamentoId` es `donacion_detalle.medicamento_id` desde la 00135 (issue #840): en
 * una donacion de medicamentos se elige del catalogo, se guarda con el renglon, y el paso de
 * generar el ingreso de inventario lo recibe ya elegido. Ese paso pide su propia fecha de
 * vencimiento -no hay un campo `fechaVencimiento` aqui: pedirla dos veces era confuso y esta
 * nunca se guardaba en ningun lado.
 */
function renglonVacio() {
  return {
    id: Date.now(),
    descripcion: "",
    cantidad: 1,
    unidad: "",
    monto: 0,
    medicamentoId: "",
  };
}

/** Catalogo `{ value, label }` a partir de filas con `id`/`nombre`, mismo patron que
 * useFormularioJornada.js -> aOpciones() para listarProyectos(). */
function aOpciones(filas = []) {
  return filas.map((fila) => ({ value: fila.id, label: fila.nombre }));
}

/**
 * Que tipo de articulo del catalogo elige el renglon de cada tipo de donacion. Los tipos que no
 * aparecen (dinero, servicios) no eligen del catalogo. Espejo de fn_registrar_donacion (00170),
 * que rechaza un articulo del otro tipo.
 */
const TIPO_DE_ARTICULO_POR_DONACION = {
  [TIPOS_DE_DONACION.MEDICAMENTOS]: TIPOS_DE_ARTICULO.MEDICAMENTO,
  [TIPOS_DE_DONACION.INSUMOS]: TIPOS_DE_ARTICULO.INSUMO,
};

/**
 * Opciones del selector del renglon: solo los articulos del tipo que lleva la donacion. Una
 * donacion de medicamentos ofrecia tambien guantes y jeringas, y una de insumos todo el catalogo.
 * Pura y exportada para probarla sin montar el hook.
 *
 * @param {{ id: string, tipoArticulo?: string }[]} articulos Filas de listarMedicamentos().
 * @param {string} tipoDonacion Uno de TIPOS_DE_DONACION.
 * @returns {{ value: string, label: string }[]} Vacio si el tipo no elige del catalogo.
 */
export function opcionesDeArticuloParaDonacion(articulos, tipoDonacion) {
  const tipoArticulo = TIPO_DE_ARTICULO_POR_DONACION[tipoDonacion];
  if (!tipoArticulo) return [];
  return (articulos ?? [])
    .filter((articulo) => articulo.tipoArticulo === tipoArticulo)
    .map(opcionDeMedicamento);
}

/**
 * Decide si, tras un intento de guardarDonacion(), corresponde ofrecer el paso de generar el
 * ingreso de inventario. Solo si la donacion se guardo sin error y es de medicamentos o, desde la
 * 00170 -que les da un articulo del catalogo-, de insumos (criterio 6 de #635: un error de
 * registrarDonacion() no debe avanzar al paso 2).
 *
 * Aislada como funcion pura exportada -en vez de vivir inline dentro de guardarDonacion()- para
 * poder probar ese invariante sin montar el hook: packages/shared corre sus pruebas en entorno
 * "node", sin DOM (vitest.config.js), mismo criterio que usan las funciones puras de
 * useEjecucionPresupuestal.js.
 *
 * @param {string} tipoDonacion
 * @param {object|null} error El `error` que devolvio registrarDonacion() (null si tuvo exito).
 * @returns {boolean}
 */
export function debeOfrecerIngresoInventario(tipoDonacion, error) {
  return error == null && Boolean(TIPO_DE_ARTICULO_POR_DONACION[tipoDonacion]);
}

/**
 * Si el dinero de una donacion entra solo al presupuesto de la jornada para la que se recibe.
 *
 * Espejo de fn_aportar_donacion_a_su_jornada (00187), que es quien lo hace: una donacion de dinero
 * para una jornada planificada o en curso crea su aporte en el presupuesto de esa jornada. En una
 * finalizada o cancelada el presupuesto ya no se mueve y la donacion queda con su saldo libre.
 * Pura y exportada para probarla sin montar el hook.
 *
 * @param {string} tipoDonacion
 * @param {string|null|undefined} estadoDeLaJornada `estado` de la jornada elegida, si hay una.
 * @returns {boolean}
 */
export function entraAlPresupuestoDeLaJornada(tipoDonacion, estadoDeLaJornada) {
  return (
    tipoDonacion === TIPOS_DE_DONACION.DINERO &&
    (estadoDeLaJornada === ESTADOS_JORNADA.PLANIFICADA ||
      estadoDeLaJornada === ESTADOS_JORNADA.EN_CURSO)
  );
}

/**
 * Renglones locales combinados con los ids reales de `donacion_detalle` que devolvio
 * `registrarDonacion()` (`datos.detalleIds`, en el mismo orden en que se enviaron: ver el
 * comentario de `fn_registrar_donacion` en 00114_registrar_y_anular_donacion.sql). Sin esto, el
 * paso de generar el ingreso de inventario (`generarIngresoDesdeDonacion`, fuera de alcance de
 * #635) recibiria el `id` local de `renglonVacio()` -un `Date.now()`, no un UUID de la base- y
 * fallaria buscando un `donacion_detalle` que no existe.
 *
 * @param {object[]} detallesLocales Renglones tal como los trae el estado del formulario.
 * @param {string[]} detalleIds Ids reales, en el mismo orden.
 * @returns {object[]}
 */
export function conIdsReales(detallesLocales, detalleIds = []) {
  return detallesLocales.map((renglon, indice) => ({
    ...renglon,
    donacionDetalleId: detalleIds[indice] ?? null,
  }));
}

/**
 * El recibo de lo que se acaba de guardar, listo para leer (issue #840, A10).
 *
 * Antes la pantalla pintaba tres lineas crudas -"Tipo: dinero", "Fecha: 2026-09-18",
 * "Renglones registrados: 2"- con el valor del enum en minusculas. Aqui se traduce todo con los
 * catalogos, y se resume lo que importa segun el tipo: cuanto dinero entro, o cuantas unidades.
 * Pura y exportada para probarla sin montar el hook.
 *
 * @param {object|null} resumen El resumenRegistro del hook.
 * @param {{ medicamentos?: {value: string, label: string}[],
 *   proyectos?: {value: string, label: string}[] }} [catalogos]
 * @returns {{ titulo: string, datos: {label: string, valor: string}[],
 *   renglones: {id: string, texto: string, detalle: string|null}[] }|null}
 */
export function resumenLegibleDeDonacion(
  resumen,
  { medicamentos = [], proyectos = [], jornadas = [] } = {},
) {
  if (!resumen) return null;

  const nombreDeMedicamento = (id) => medicamentos.find((m) => m.value === id)?.label ?? null;
  const detalles = resumen.detalles ?? [];
  const esDinero = resumen.tipo === TIPOS_DE_DONACION.DINERO;
  const conUnidades = [TIPOS_DE_DONACION.MEDICAMENTOS, TIPOS_DE_DONACION.INSUMOS].includes(
    resumen.tipo,
  );

  const totalMonto = detalles.reduce((suma, d) => suma + (Number(d.monto) || 0), 0);
  const totalUnidades = detalles.reduce((suma, d) => suma + (Number(d.cantidad) || 0), 0);

  const datos = [
    { label: "Donante", valor: resumen.donanteNombre ?? "—" },
    { label: "Fecha", valor: formatearFechaLarga(resumen.fecha) || "—" },
  ];

  const jornada = jornadas.find((j) => j.value === resumen.jornadaId)?.label;
  if (jornada) datos.push({ label: "Jornada", valor: jornada });
  const proyecto = proyectos.find((p) => p.value === resumen.proyectoId)?.label;
  if (proyecto) datos.push({ label: "Proyecto", valor: proyecto });

  if (esDinero || totalMonto > 0) {
    datos.push({
      label: esDinero ? "Total" : "Valor estimado",
      valor: formatearMoneda(totalMonto),
    });
  }
  if (conUnidades) {
    datos.push({ label: "Unidades", valor: String(totalUnidades) });
  }

  const renglones = detalles.map((d, indice) => {
    const texto =
      (d.medicamentoId && nombreDeMedicamento(d.medicamentoId)) ||
      d.descripcion ||
      "Sin descripción";
    let detalle = null;
    if (conUnidades && d.cantidad) detalle = [d.cantidad, d.unidad].filter(Boolean).join(" ");
    else if (Number(d.monto) > 0) detalle = formatearMoneda(d.monto);
    return { id: String(d.donacionDetalleId ?? d.id ?? indice), texto, detalle };
  });

  return {
    titulo: `Donación de ${(ETIQUETAS_TIPO_DONACION[resumen.tipo] ?? resumen.tipo).toLowerCase()} registrada`,
    datos,
    renglones,
  };
}

/**
 * Formulario de registro de una donacion con sus renglones. Guarda con `fn_registrar_donacion`, que
 * crea la donacion y su detalle en una transaccion.
 *
 * @param {object} opciones
 * @param {object} [opciones._client] Cliente de Supabase para pruebas; por defecto el compartido.
 * @param {string} opciones.usuarioRol Rol de la sesion (`ROLES`).
 * @param {(donacion: object) => void} [opciones.onGuardarExito] Se llama con la donacion guardada.
 * @returns {object} `{ permisos, tipoDonacion, donanteId, proyectoId, fecha, observaciones,
 *   detalles, ... }`: cada campo con su setter, las operaciones sobre renglones, los errores de
 *   validacion y la accion de guardar.
 */
export function useRegistroDonacion({ _client, usuarioRol, onGuardarExito }) {
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);
  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);

  // 'dinero' y no 'economica': el enum tipo_donacion de la migracion 00022 solo acepta
  // medicamentos, insumos, dinero y servicios. Con el valor viejo, el dia que guardarDonacion()
  // llegue a escribir en la base, el INSERT lo rechaza.
  const [tipoDonacion, setTipoDonacion] = useState(TIPOS_DE_DONACION.DINERO);
  const [donanteId, setDonanteId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  // Para que jornada se recibio (00153). Si hay jornada, el proyecto es el de la jornada: la base lo
  // impone con un trigger, y aqui se refleja para que la pantalla no ofrezca otro.
  const [jornadaId, setJornadaIdCrudo] = useState("");
  const [jornadasOptions, setJornadasOptions] = useState([]);
  // aCadenaFechaLocal() y no toISOString(): esa da el dia UTC, y en Guatemala a partir de las
  // 18:00 ya es manana. Las donaciones registradas por la tarde se guardaban con la fecha del
  // dia siguiente sin que nadie la tocara (issue #840).
  const [fecha, setFecha] = useState(() => aCadenaFechaLocal());
  // registrarDonacion() ya aceptaba observaciones (p_observaciones en registro.api.js), pero el
  // formulario web nunca la tenia en su estado: el input no existia (issue #756).
  const [observaciones, setObservaciones] = useState("");

  const [detalles, setDetalles] = useState([renglonVacio()]);

  const [donantesOptions, setDonantesOptions] = useState([]);
  const [proyectosOptions, setProyectosOptions] = useState([]);
  // Filas completas, no opciones: el tipo de donacion decide cuales se ofrecen (mas abajo).
  const [articulos, setArticulos] = useState([]);

  // El renglon que pidio dar de alta un medicamento: el nuevo queda elegido en ESE renglon.
  const [renglonDeAlta, setRenglonDeAlta] = useState(null);

  const [modalNuevoDonante, setModalNuevoDonante] = useState(false);
  const [nuevoDonanteNombre, setNuevoDonanteNombre] = useState("");
  const [nuevoDonanteTipo, setNuevoDonanteTipo] = useState(TIPOS_DE_DONANTE.PERSONA);
  const [guardandoNuevoDonante, setGuardandoNuevoDonante] = useState(false);
  const [errorNuevoDonante, setErrorNuevoDonante] = useState(null);

  const [ofrecerIngresoInventario, setOfrecerIngresoInventario] = useState(false);
  const [resumenRegistro, setResumenRegistro] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Catalogos del formulario. Antes de esto ninguno de los dos <select> tenia opciones -el hook
  // nunca los cargaba-, asi que el de donante (obligatorio para validarDonacion()) bloqueaba
  // cualquier registro y el de proyecto (opcional) se veia "andando" solo porque su ausencia no
  // hace fallar la validacion.
  useEffect(() => {
    let vigente = true;

    if (tieneAccesoLectura) {
      listarDonantes({ soloActivos: true }, { rolUsuario: usuarioRol }).then(({ datos }) => {
        if (vigente) setDonantesOptions(aOpciones(datos));
      });
    }

    // Una donacion nueva no se asigna a un proyecto cancelado (00154).
    listarProyectos().then(({ proyectos }) => {
      if (vigente) setProyectosOptions(aOpciones(proyectosQueAdmitenCambios(proyectos)));
    });

    listarJornadas().then(({ jornadas }) => {
      if (!vigente) return;
      setJornadasOptions(
        (jornadas ?? []).map((jornada) => ({
          value: jornada.id,
          label: [jornada.nombre, formatearFechaCorta(jornada.fecha)].filter(Boolean).join(" · "),
          proyectoId: jornada.proyectoId ?? null,
          // Solo el dinero para una jornada planificada o en curso entra a su presupuesto (00187).
          estado: jornada.estado ?? null,
          // La bodega de botiquin: el ingreso a inventario de la donacion la trae ya puesta.
          bodegaId: jornada.botiquinBodegaId ?? null,
        })),
      );
    });

    // Desde la #840 el renglon de una donacion de medicamentos elige del catalogo, y desde la
    // 00170 tambien el de insumos.
    listarMedicamentos({ soloActivos: true }).then(({ medicamentos }) => {
      if (vigente) setArticulos(medicamentos ?? []);
    });

    return () => {
      vigente = false;
    };
  }, [tieneAccesoLectura, usuarioRol]);

  // Todo el catalogo, para el recibo (que nombra lo que se guardo aunque el tipo ya cambio), y lo
  // del tipo de la donacion, para el selector del renglon.
  const todasLasOpciones = useMemo(() => articulos.map(opcionDeMedicamento), [articulos]);
  const opcionesDelTipo = useMemo(
    () => opcionesDeArticuloParaDonacion(articulos, tipoDonacion),
    [articulos, tipoDonacion],
  );

  const alCrearMedicamento = useCallback(
    async (medicamento) => {
      setArticulos((anteriores) => [...anteriores, medicamento]);
      if (renglonDeAlta !== null) {
        setDetalles((prev) =>
          prev.map((item) =>
            item.id === renglonDeAlta ? { ...item, medicamentoId: medicamento.id } : item,
          ),
        );
      }
      setRenglonDeAlta(null);
    },
    [renglonDeAlta],
  );

  // Lo que se da de alta es del tipo de la donacion: un insumo nuevo no pide principio activo ni
  // concentracion (00164), y un medicamento nuevo no apareceria en el selector de insumos.
  const altaDeMedicamento = useAltaDeMedicamentoEnLinea({
    rol: usuarioRol,
    alCrear: alCrearMedicamento,
    tipoArticulo: TIPO_DE_ARTICULO_POR_DONACION[tipoDonacion] ?? TIPOS_DE_ARTICULO.MEDICAMENTO,
  });

  const { abrir: abrirAltaInterna, cerrar: cerrarAltaInterna } = altaDeMedicamento;

  /** Abre el alta de medicamento para un renglon concreto. */
  const abrirAltaDeMedicamento = useCallback(
    (renglonId) => {
      setRenglonDeAlta(renglonId);
      abrirAltaInterna();
    },
    [abrirAltaInterna],
  );

  const cerrarAltaDeMedicamento = useCallback(() => {
    setRenglonDeAlta(null);
    cerrarAltaInterna();
  }, [cerrarAltaInterna]);

  /** Elige la jornada y, con ella, su proyecto (o ninguno si la jornada no tiene). */
  const setJornadaId = useCallback(
    (valor) => {
      setJornadaIdCrudo(valor || "");
      if (valor) {
        const jornada = jornadasOptions.find((opcion) => opcion.value === valor);
        setProyectoId(jornada?.proyectoId ?? "");
      }
    },
    [jornadasOptions],
  );

  const agregarRenglon = () => {
    setDetalles((prev) => [...prev, renglonVacio()]);
  };

  const quitarRenglon = (id) => {
    if (detalles.length === 1) return;
    setDetalles((prev) => prev.filter((item) => item.id !== id));
  };

  const actualizarRenglon = (id, campo, valor) => {
    setDetalles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    );
  };

  const manejarCambioTipo = (nuevoTipo) => {
    setTipoDonacion(nuevoTipo);
    setDetalles([renglonVacio()]);
    // Un alta abierta era del tipo anterior (medicamento o insumo): ya no corresponde.
    cerrarAltaDeMedicamento();
  };

  const cerrarModalNuevoDonante = () => {
    setModalNuevoDonante(false);
    setNuevoDonanteNombre("");
    setNuevoDonanteTipo(TIPOS_DE_DONANTE.PERSONA);
    setErrorNuevoDonante(null);
  };

  /**
   * Alta rapida de donante sin salir del formulario: registra, recarga el catalogo y deja el
   * donante nuevo ya seleccionado. Antes el modal "+ Nuevo Donante" no llamaba a
   * registrarDonante() en absoluto -el boton "Guardar y Seleccionar" solo cerraba el modal-, asi
   * que nada de lo que la persona escribia se guardaba ni quedaba elegido.
   *
   * Solo pide nombre y tipo (persona/organizacion): son las dos columnas NOT NULL de `donantes`
   * (00022). El resto de los datos de contacto se completan despues desde /donantes, igual que
   * ya lo dice el texto del modal ("registro rapido").
   */
  const crearDonanteRapido = async () => {
    if (!puedeEscribir) return;
    setGuardandoNuevoDonante(true);
    setErrorNuevoDonante(null);

    const { datos, error: fallo } = await registrarDonante(
      { tipo: nuevoDonanteTipo, nombre: nuevoDonanteNombre },
      { rolUsuario: usuarioRol },
    );

    if (fallo) {
      setGuardandoNuevoDonante(false);
      setErrorNuevoDonante(fallo);
      return;
    }

    const { datos: listaActualizada } = await listarDonantes(
      { soloActivos: true },
      { rolUsuario: usuarioRol },
    );
    setGuardandoNuevoDonante(false);
    setDonantesOptions(aOpciones(listaActualizada));
    setDonanteId(datos.id);
    cerrarModalNuevoDonante();
  };

  const guardarDonacion = async () => {
    if (!puedeEscribir) return;
    setGuardando(true);
    setError(null);

    // Claves en camelCase: es exactamente lo que consume validarDonacion() (validaciones.js) y,
    // por tanto, registrarDonacion() (registro.api.js). Antes de la #635 este objeto viajaba en
    // snake_case (donante_id, proyecto_id) contra un validarDonacion() que lee donacion.donanteId
    // -asi que la validacion habria fallado siempre por "falta donante", sin importar lo que la
    // persona hubiera seleccionado.
    const payload = {
      donanteId,
      proyectoId: proyectoId || null,
      jornadaId: jornadaId || null,
      tipo: tipoDonacion,
      fecha,
      observaciones: observaciones.trim() || null,
      detalles,
    };

    const { datos, error: fallo } = await registrarDonacion(payload, { rolUsuario: usuarioRol });
    setGuardando(false);

    if (fallo) {
      setError(fallo);
      return;
    }

    // El resumen que ofrece generar el ingreso de inventario necesita, por renglon, tanto
    // medicamentoId (estado local, no una columna de donacion_detalle) como el id real que
    // acaba de crear fn_registrar_donacion (datos.detalleIds, en el mismo orden que se envio):
    // sin el segundo, ese paso posterior recibiria el id local de renglonVacio() -un Date.now(),
    // no un UUID de la base- y fallaria buscando un donacion_detalle inexistente (criterio 6).
    //
    // `donanteId` (en el payload) y `donanteNombre` tambien quedan congelados aqui (issue #756): el
    // paso de generar el ingreso usa el id para leer el proveedor del donante
    // (obtenerProveedorDeDonante(), inventario/proveedores.api.js, 00175) y el nombre para
    // mostrarlo, y el formulario se limpia -incluido donanteId- apenas termina esta funcion, asi
    // que ese paso ya no podria leerlos de ahi.
    setResumenRegistro({
      ...payload,
      detalles: conIdsReales(detalles, datos.detalleIds),
      donanteNombre: donantesOptions.find((opcion) => opcion.value === donanteId)?.label ?? null,
      // La bodega de botiquin de la jornada, si tiene (issue #911): el ingreso a inventario la
      // trae elegida, sin obligar a que sea esa.
      bodegaIdDeJornada:
        jornadasOptions.find((opcion) => opcion.value === jornadaId)?.bodegaId ?? null,
    });

    if (debeOfrecerIngresoInventario(tipoDonacion, fallo)) {
      setOfrecerIngresoInventario(true);
    }

    if (onGuardarExito) onGuardarExito(datos);

    // La donacion ya quedo guardada: limpiar el formulario aqui, no solo cuando la persona
    // termina (o descarta) el paso de ingreso a inventario, evita que alguien mire los mismos
    // campos llenos despues de guardar y piense que no paso nada (issue #756). resumenRegistro
    // no se toca: es el recibo de lo que se acaba de guardar.
    setTipoDonacion(TIPOS_DE_DONACION.DINERO);
    setDonanteId("");
    setProyectoId("");
    setJornadaIdCrudo("");
    setFecha(aCadenaFechaLocal());
    setObservaciones("");
    setDetalles([renglonVacio()]);
  };

  return {
    permisos: { tieneAccesoLectura, puedeEscribir },
    tipoDonacion,
    setTipoDonacion: manejarCambioTipo,
    donanteId,
    setDonanteId,
    proyectoId,
    setProyectoId,
    jornadaId,
    setJornadaId,
    jornadasOptions,
    // Con jornada elegida el proyecto sale de ella y no se elige a mano.
    proyectoFijadoPorJornada: Boolean(jornadaId),
    // 00187: el dinero donado para una jornada activa entra solo a su presupuesto.
    entraAlPresupuestoDeLaJornada: entraAlPresupuestoDeLaJornada(
      tipoDonacion,
      jornadasOptions.find((opcion) => opcion.value === jornadaId)?.estado,
    ),
    fecha,
    setFecha,
    observaciones,
    setObservaciones,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    camposDeRenglon: camposDeRenglonDeDonacion(tipoDonacion),
    catalogosDeRenglon: { medicamentos: opcionesDelTipo },
    altaDeMedicamento: {
      ...altaDeMedicamento,
      renglonId: renglonDeAlta,
      abrir: abrirAltaDeMedicamento,
      cerrar: cerrarAltaDeMedicamento,
    },
    resumenLegible: resumenLegibleDeDonacion(resumenRegistro, {
      medicamentos: todasLasOpciones,
      proyectos: proyectosOptions,
      jornadas: jornadasOptions,
    }),
    donantesOptions,
    proyectosOptions,
    modalNuevoDonante,
    setModalNuevoDonante,
    nuevoDonanteNombre,
    setNuevoDonanteNombre,
    nuevoDonanteTipo,
    setNuevoDonanteTipo,
    guardandoNuevoDonante,
    errorNuevoDonante,
    crearDonanteRapido,
    cerrarModalNuevoDonante,
    ofrecerIngresoInventario,
    setOfrecerIngresoInventario,
    resumenRegistro,
    guardando,
    error,
    guardarDonacion,
  };
}
