import { useCallback, useEffect, useMemo, useState } from "react";
import { listarJornadas } from "../jornadas/api.js";
import { listarUsuarios } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { CATEGORIAS_DE_GASTO } from "@ecopac/shared";
import {
  editarGasto,
  obtenerPresupuestoJornada,
  registrarGasto,
  listarCategoriasGasto,
} from "./api.js";
import { validarGasto } from "./validaciones.js";

function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({
    value: fila.id, //  UUID real
    label: etiquetaDe(fila),
  }));
}

const categoriasFijas = Object.entries(CATEGORIAS_DE_GASTO).map(([_, valor]) => ({
  value: valor,
  label: valor,
}));

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

export function useFormularioGasto({ gasto, usuarioId, estadoInicial } = {}) {
  const gastoId = gasto?.id ?? null;
  const esEdicion = Boolean(gastoId);
  const [valores, setValores] = useState(() => valoresInicialesDeGasto(gasto, estadoInicial));
  const [errores, setErrores] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [jornadas, setJornadas] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [categoriasExtra, setCategoriasExtra] = useState([]);
  const [presupuestoDeJornada, setPresupuestoDeJornada] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarJornadas().then(({ jornadas: filas }) => {
      if (vigente) setJornadas(filas);
    });
    listarUsuarios({ estado: true }).then(({ usuarios }) => {
      if (vigente) setPerfiles(aOpciones(usuarios, nombreCompletoDe));
    });
    listarCategoriasGasto().then(({ categorias }) => {
      if (vigente) setCategoriasExtra(categorias);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const categoriasCompletas = useMemo(() => {
    const fijasValores = categoriasFijas.map((c) => c.value);
    const soloNuevas = (categoriasExtra || []).filter((c) => !fijasValores.includes(c.value));
    return [...categoriasFijas, ...soloNuevas];
  }, [categoriasExtra]);

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
  const contextoDeJornada = useMemo(
    () =>
      jornadaElegida && presupuestoDeJornada
        ? {
            presupuesto_asignado: presupuestoDeJornada.asignado,
            gasto_acumulado: presupuestoDeJornada.gastado,
            fecha_inicio: jornadaElegida.fecha,
          }
        : null,
    [jornadaElegida, presupuestoDeJornada],
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
      listarCategoriasGasto().then(({ categorias }) => {
        setCategoriasExtra(categorias);
      });
    }
    return { ok: true, gasto: respuesta.gasto };
  }, [valores, contextoDeJornada, esEdicion, gastoId, usuarioId, estadoInicial]);

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
      categorias: categoriasCompletas,
    },
    esExcedente: resultadoValidacion.esExcedente,
    mensajeExcedente: resultadoValidacion.mensajeExcedente,
    setCampo,
    enviar,
    cancelar,
  };
}
