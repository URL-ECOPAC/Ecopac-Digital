import { useCallback, useEffect, useMemo, useState } from "react";
import { listarJornadas } from "../jornadas/api.js";
import { listarNombresDePerfiles } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { ESTADOS_DE_GASTO, ESTADOS_JORNADA } from "../enums.js";
import {
  crearCategoriaDeGasto,
  editarGasto,
  listarCategoriasGasto,
  obtenerPresupuestoJornada,
  registrarGasto,
} from "./api.js";
import { puedeCrearCategoriaDeGasto } from "./permisos.js";
import { validarGasto } from "./validaciones.js";

function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({
    value: fila.id, //  UUID real
    label: etiquetaDe(fila),
  }));
}

/**
 * @param {object|null} gasto Gasto a editar; `null` para uno nuevo.
 * @param {string} [estadoInicial] Estado de un gasto nuevo; por defecto `pendiente`.
 * @returns {object} Valores del formulario, con `""` donde no hay dato.
 */
export function valoresInicialesDeGasto(gasto, estadoInicial) {
  return {
    jornada_id: gasto?.jornada_id ?? "",
    concepto: gasto?.concepto ?? "",
    categoria: gasto?.categoria ?? "",
    monto: gasto?.monto ?? "",
    fecha: gasto?.fecha ?? "",
    responsable_id: gasto?.responsable_id ?? "",
    estado: gasto?.estado ?? estadoInicial ?? "pendiente",
  };
}

//  Función clave: extrae el valor real si llega un objeto
function extraerValor(valor) {
  if (!valor) return valor;
  if (typeof valor === "object" && valor.value !== undefined) {
    return valor.value;
  }
  return valor;
}

/**
 * Formulario de alta y edicion de un gasto, con catalogos y el aviso de que el gasto excede el
 * disponible de la jornada.
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.gasto] Gasto a editar; sin el, es un alta.
 * @param {string} [opciones.usuarioId] Quien registra.
 * @param {string} [opciones.estadoInicial] Estado de un gasto nuevo.
 * @param {string} [opciones.rol] Rol de la sesion, para ofrecer o no crear una categoria.
 * @returns {object} `{ valores, errores, error, enviando, esEdicion, sucio, catalogos, esExcedente,
 *   mensajeExcedente, puedeCrearCategoria, crearCategoria, creandoCategoria, errorCategoria,
 *   limpiarErrorCategoria, ... }`.
 */
export function useFormularioGasto({ gasto, usuarioId, estadoInicial, rol } = {}) {
  const gastoId = gasto?.id ?? null;
  const esEdicion = Boolean(gastoId);
  const [valores, setValores] = useState(() => valoresInicialesDeGasto(gasto, estadoInicial));
  const [errores, setErrores] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [jornadas, setJornadas] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState(null);
  const [presupuestoDeJornada, setPresupuestoDeJornada] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarJornadas().then(({ jornadas: filas }) => {
      if (vigente) setJornadas(filas);
    });
    listarCategoriasGasto().then(({ categorias: catalogo }) => {
      if (vigente) setCategorias(catalogo);
    });
    return () => {
      vigente = false;
    };
  }, []);

  // nombres_de_perfiles (00161): quien registra un gasto en su jornada no lee perfiles, y el
  // selector de encargado y "Registrado por" quedaban vacios. Se ofrecen las personas activas y,
  // si el gasto ya las nombra, las que ya no lo estan.
  const responsableDelGasto = gasto?.responsable_id ?? null;
  const registradoPorDelGasto = gasto?.registrado_por ?? null;
  const aprobadoPorDelGasto = gasto?.aprobado_por ?? null;
  useEffect(() => {
    let vigente = true;
    const nombrados = [responsableDelGasto, registradoPorDelGasto, aprobadoPorDelGasto];
    listarNombresDePerfiles().then(({ perfiles: filas }) => {
      if (!vigente) return;
      setPerfiles(
        aOpciones(
          filas.filter((fila) => fila.activo || nombrados.includes(fila.id)),
          nombreCompletoDe,
        ),
      );
    });
    return () => {
      vigente = false;
    };
  }, [responsableDelGasto, registradoPorDelGasto, aprobadoPorDelGasto]);

  useEffect(() => {
    if (!valores.jornada_id) {
      setPresupuestoDeJornada(null);
      return undefined;
    }
    let vigente = true;
    obtenerPresupuestoJornada(valores.jornada_id).then(({ presupuesto }) => {
      if (vigente) setPresupuestoDeJornada(presupuesto);
    });
    return () => {
      vigente = false;
    };
  }, [valores.jornada_id]);

  const jornadaElegida = jornadas.find((jornada) => jornada.id === valores.jornada_id) ?? null;
  // Lo comprometido es lo aprobado mas lo pendiente (00159). Al editar un gasto pendiente de la
  // misma jornada, su monto anterior ya esta en esa suma y no se cuenta dos veces.
  const yaContado =
    esEdicion &&
    gasto?.estado === ESTADOS_DE_GASTO.PENDIENTE &&
    gasto?.jornada_id === valores.jornada_id
      ? Number(gasto.monto) || 0
      : 0;
  const contextoDeJornada = useMemo(
    () =>
      jornadaElegida
        ? {
            fecha: jornadaElegida.fecha,
            estado: jornadaElegida.estado,
            ...(presupuestoDeJornada
              ? {
                  presupuesto_asignado: presupuestoDeJornada.asignado,
                  comprometido:
                    presupuestoDeJornada.gastado + presupuestoDeJornada.pendiente - yaContado,
                }
              : {}),
          }
        : null,
    [jornadaElegida, presupuestoDeJornada, yaContado],
  );

  const resultadoValidacion = validarGasto(valores, contextoDeJornada);

  //  Al guardar cualquier campo, normalizar el valor
  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({
      ...anteriores,
      [id]: extraerValor(valor),
    }));
    setSucio(true);
  }, []);

  const cancelar = useCallback(() => {
    setValores(valoresInicialesDeGasto(gasto, estadoInicial));
    setErrores([]);
    setError(null);
    setEnviando(false);
    setSucio(false);
  }, [gastoId, estadoInicial]);

  const enviar = useCallback(async () => {
    const resultado = validarGasto(valores, contextoDeJornada);
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return { ok: false };
    }
    setEnviando(true);
    setError(null);

    //  Asegurar que TODOS los valores sean correctos antes de enviar
    const datosLimpios = {
      ...valores,
      jornada_id: extraerValor(valores.jornada_id),
      responsable_id: extraerValor(valores.responsable_id) || null,
      categoria: extraerValor(valores.categoria),
    };

    const respuesta = esEdicion
      ? await editarGasto(gastoId, datosLimpios)
      : await registrarGasto(datosLimpios, { usuarioId, estado: valores.estado });

    setEnviando(false);

    if (respuesta.error) {
      setError(respuesta.error);
      return { ok: false };
    }

    setSucio(false);
    if (!esEdicion) {
      setValores(valoresInicialesDeGasto(null, estadoInicial));
    }
    return { ok: true, gasto: respuesta.gasto };
  }, [valores, contextoDeJornada, esEdicion, gastoId, usuarioId, estadoInicial]);

  /**
   * Agrega una categoria al catalogo (00158) y la deja elegida. Antes "Crear categoria nueva"
   * solo la agregaba en pantalla y el gasto se rechazaba al guardar.
   *
   * @param {string} nombre
   * @returns {Promise<boolean>}
   */
  const crearCategoria = useCallback(async (nombre) => {
    setCreandoCategoria(true);
    setErrorCategoria(null);
    const { categoria, error: fallo } = await crearCategoriaDeGasto(nombre);
    setCreandoCategoria(false);
    if (fallo) {
      setErrorCategoria(fallo);
      return false;
    }
    setCategorias((anteriores) =>
      [...anteriores, categoria].sort((a, b) => a.label.localeCompare(b.label, "es")),
    );
    setValores((anteriores) => ({ ...anteriores, categoria: categoria.value }));
    setSucio(true);
    return true;
  }, []);

  return {
    valores,
    errores,
    error,
    enviando,
    esEdicion,
    sucio,
    catalogos: {
      // Una jornada finalizada ya no admite gastos (00159): no se ofrece, salvo la del gasto que
      // se esta viendo.
      jornadas: aOpciones(
        jornadas.filter(
          (jornada) =>
            jornada.estado !== ESTADOS_JORNADA.FINALIZADA || jornada.id === gasto?.jornada_id,
        ),
        (jornada) => jornada.nombre,
      ),
      perfiles,
      categorias,
    },
    esExcedente: resultadoValidacion.esExcedente,
    mensajeExcedente: resultadoValidacion.mensajeExcedente,
    puedeCrearCategoria: puedeCrearCategoriaDeGasto(rol),
    crearCategoria,
    creandoCategoria,
    errorCategoria,
    limpiarErrorCategoria: () => setErrorCategoria(null),
    setCampo,
    enviar,
    cancelar,
  };
}
