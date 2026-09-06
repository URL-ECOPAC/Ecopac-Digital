import { useEffect, useState } from "react";

import { TIPOS_DE_DONACION, TIPOS_DE_DONANTE } from "../enums.js";
import { listarProyectos } from "../proyectos/api.js";
import { listarDonantes, registrarDonante } from "./donantes.api.js";
import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";
import { registrarDonacion } from "./registro.api.js";

/**
 * Renglon de detalle vacio. Los nombres de campo son los de `donacion_detalle` (00022) y de
 * `CAMPOS_DONACION.detalles.campos` (campos.js): `descripcion`, `cantidad`, `unidad`, `monto`,
 * `fechaVencimiento`. Antes de la #635 el campo se llamaba `concepto` -que ni `validarDonacion()`
 * ni `donacion_detalle` reconocen- y no existian `unidad` ni `fechaVencimiento`, asi que
 * `validarDonacion()` habria rechazado cualquier renglon con "falta descripcion" sin importar lo
 * que la persona hubiera escrito. `medicamentoId` no es una columna de `donacion_detalle` -queda
 * fuera del payload que arma `guardarDonacion()`- pero se conserva en el estado del renglon
 * porque lo necesita el paso posterior de generar el ingreso de inventario
 * (`generarIngresoDesdeDonacion`, fuera del alcance de #635).
 */
function renglonVacio() {
  return {
    id: Date.now(),
    descripcion: "",
    cantidad: 1,
    unidad: "",
    monto: 0,
    fechaVencimiento: "",
    medicamentoId: "",
  };
}

/** Catalogo `{ value, label }` a partir de filas con `id`/`nombre`, mismo patron que
 * useFormularioJornada.js -> aOpciones() para listarProyectos(). */
function aOpciones(filas = []) {
  return filas.map((fila) => ({ value: fila.id, label: fila.nombre }));
}

/**
 * Decide si, tras un intento de guardarDonacion(), corresponde ofrecer el paso de generar el
 * ingreso de inventario. Solo si la donacion se guardo sin error y es de tipo medicamentos
 * (criterio 6 de #635: un error de registrarDonacion() no debe avanzar al paso 2).
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
  return error == null && tipoDonacion === TIPOS_DE_DONACION.MEDICAMENTOS;
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

export function useRegistroDonacion({ _client, usuarioRol, onGuardarExito }) {
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);
  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);

  // 'dinero' y no 'economica': el enum tipo_donacion de la migracion 00022 solo acepta
  // medicamentos, insumos, dinero y servicios. Con el valor viejo, el dia que guardarDonacion()
  // llegue a escribir en la base, el INSERT lo rechaza.
  const [tipoDonacion, setTipoDonacion] = useState(TIPOS_DE_DONACION.DINERO);
  const [donanteId, setDonanteId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const [detalles, setDetalles] = useState([renglonVacio()]);

  const [donantesOptions, setDonantesOptions] = useState([]);
  const [proyectosOptions, setProyectosOptions] = useState([]);

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

    listarProyectos().then(({ proyectos }) => {
      if (vigente) setProyectosOptions(aOpciones(proyectos));
    });

    return () => {
      vigente = false;
    };
  }, [tieneAccesoLectura, usuarioRol]);

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
      tipo: tipoDonacion,
      fecha,
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
    setResumenRegistro({ ...payload, detalles: conIdsReales(detalles, datos.detalleIds) });

    if (debeOfrecerIngresoInventario(tipoDonacion, fallo)) {
      setOfrecerIngresoInventario(true);
    }

    if (onGuardarExito) onGuardarExito(datos);
  };

  return {
    permisos: { tieneAccesoLectura, puedeEscribir },
    tipoDonacion,
    setTipoDonacion: manejarCambioTipo,
    donanteId,
    setDonanteId,
    proyectoId,
    setProyectoId,
    fecha,
    setFecha,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
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
