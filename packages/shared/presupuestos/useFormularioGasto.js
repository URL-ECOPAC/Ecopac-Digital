// Hook de pantalla del formulario de gasto: alta y edicion (issue #303).
//
// Mismo patron que jornadas/useFormularioJornada.js: un solo hook para las dos operaciones.
// `gasto` ausente/sin `id` es alta (llama registrarGasto()); `gasto` con `id` es edicion (llama
// editarGasto(id, datos)). Los campos, la carga de catalogos y la validacion viven aca; el
// componente solo dibuja lo que el hook entrega.
//
// El aviso de excedente (criterio 3) se recalcula en vivo, sin bloquear el envio: usa
// validarGasto() de validaciones.js con el presupuesto de la jornada elegida
// (obtenerPresupuestoJornada()). `jornadas` no tiene columna `fecha_inicio` (solo `fecha`,
// 00012_jornadas.sql), pero validarGasto() ya usa esa clave -- se mapea aca en la llamada
// (`fecha_inicio: jornadaElegida.fecha`), sin tocar validaciones.js ni sus pruebas.
//
// `sucio` (criterio 6) marca si hay cambios sin guardar desde que se abrio el formulario o desde
// el ultimo guardado exitoso: el modal lo usa para decidir si avisa antes de cerrarse. Vive aca y
// no en el componente porque "que cambio" es una pregunta sobre los valores del formulario, que
// es justamente el estado que este hook administra.

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarJornadas } from "../jornadas/api.js";
import { listarUsuarios } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { editarGasto, obtenerPresupuestoJornada, registrarGasto } from "./api.js";
import { validarGasto } from "./validaciones.js";

function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({ value: fila.id, label: etiquetaDe(fila) }));
}

/** Valores del formulario a partir de un gasto existente (edicion), o vacios (alta). */
export function valoresInicialesDeGasto(gasto) {
  return {
    jornada_id: gasto?.jornada_id ?? "",
    concepto: gasto?.concepto ?? "",
    categoria: gasto?.categoria ?? "",
    monto: gasto?.monto ?? "",
    fecha: gasto?.fecha ?? "",
    responsable_id: gasto?.responsable_id ?? "",
  };
}

/**
 * Estado y envio del formulario de alta/edicion de gasto.
 *
 * @param {object} [opciones]
 * @param {{ id: string, jornada_id: string, concepto: string, categoria: string, monto: number,
 *   fecha: string, responsable_id: string|null }|null} [opciones.gasto] Con `id`, edicion; sin
 *   `id` o ausente, alta.
 * @param {string} [opciones.usuarioId] Quien registra, para registrarGasto() (alta unicamente).
 */
export function useFormularioGasto({ gasto, usuarioId } = {}) {
  const gastoId = gasto?.id ?? null;
  const esEdicion = Boolean(gastoId);

  const [valores, setValores] = useState(() => valoresInicialesDeGasto(gasto));
  const [errores, setErrores] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sucio, setSucio] = useState(false);

  const [jornadas, setJornadas] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [presupuestoDeJornada, setPresupuestoDeJornada] = useState(null);

  // Catalogos: se cargan una sola vez, al montar.
  useEffect(() => {
    let vigente = true;

    listarJornadas().then(({ jornadas: filas }) => {
      if (vigente) setJornadas(filas);
    });

    listarUsuarios({ estado: true }).then(({ usuarios }) => {
      if (vigente) setPerfiles(aOpciones(usuarios, nombreCompletoDe));
    });

    return () => {
      vigente = false;
    };
  }, []);

  // Presupuesto de la jornada elegida, para el aviso de excedente del criterio 3.
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

  // Contexto de jornada que validarGasto() necesita, o null si todavia no hay suficiente para
  // evaluar el excedente (no hay jornada elegida, o su presupuesto no ha llegado). Memorizado
  // para que enviar() (mas abajo) no se recree en cada render solo porque este objeto literal
  // cambia de identidad.
  const contextoDeJornada = useMemo(
    () =>
      jornadaElegida && presupuestoDeJornada
        ? {
            presupuesto_asignado: presupuestoDeJornada.asignado,
            // gastado ya suma solo lo aprobado (presupuesto_de_jornada(), 00040): un gasto
            // pendiente en edicion no esta contado ahi todavia, asi que no hay doble conteo.
            gasto_acumulado: presupuestoDeJornada.gastado,
            fecha_inicio: jornadaElegida.fecha,
          }
        : null,
    [jornadaElegida, presupuestoDeJornada],
  );

  const resultadoValidacion = validarGasto(valores, contextoDeJornada);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setSucio(true);
  }, []);

  const cancelar = useCallback(() => {
    setValores(valoresInicialesDeGasto(gasto));
    setErrores([]);
    setError(null);
    setEnviando(false);
    setSucio(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastoId]);

  const enviar = useCallback(async () => {
    const resultado = validarGasto(valores, contextoDeJornada);

    if (!resultado.valido) {
      setErrores(resultado.errores);
      return { ok: false };
    }

    setEnviando(true);
    setError(null);

    const respuesta = esEdicion
      ? await editarGasto(gastoId, valores)
      : await registrarGasto(valores, { usuarioId });

    setEnviando(false);

    if (respuesta.error) {
      setError(respuesta.error);
      return { ok: false };
    }

    setSucio(false);
    if (!esEdicion) setValores(valoresInicialesDeGasto(null));
    return { ok: true, gasto: respuesta.gasto };
  }, [valores, contextoDeJornada, esEdicion, gastoId, usuarioId]);

  return {
    valores,
    errores,
    error,
    enviando,
    esEdicion,
    sucio,
    catalogos: {
      jornadas: aOpciones(jornadas, (jornada) => jornada.nombre),
      perfiles,
    },
    esExcedente: resultadoValidacion.esExcedente,
    mensajeExcedente: resultadoValidacion.mensajeExcedente,
    setCampo,
    enviar,
    cancelar,
  };
}
