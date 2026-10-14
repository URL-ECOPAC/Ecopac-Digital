import { useCallback, useEffect, useRef, useState } from "react";

import {
  listarComunidades,
  listarDepartamentos,
  listarMunicipios,
  obtenerComunidad,
} from "./api.js";

/** Forma que esperan los selectores de las dos apps. */
function aOpciones(filas = []) {
  return filas.map((fila) => ({ value: fila.id, label: fila.nombre }));
}

/**
 * Departamento -> municipio -> comunidad, encadenados (issue #840).
 *
 * POR QUE SE EXTRAJO
 *
 * Esta cascada existia solo dentro de useRegistroPaciente. El formulario de EDICION de un
 * paciente tenia en su lugar un unico selector con la lista plana de todas las comunidades del
 * pais: al editar no aparecian ni el departamento ni el municipio. Eran dos formularios distintos
 * para la misma entidad, que es justamente lo que la issue pide dejar de hacer -- crear y editar
 * tienen que pedir lo mismo.
 *
 * Copiar el bloque al hook de edicion habria dejado dos cascadas que se separan con el tiempo,
 * que es como se llego a esto. Vive aqui una sola vez y la usan los dos.
 *
 * QUE NO SE GUARDA. `pacientes` no tiene columnas de departamento ni de municipio: la unica que
 * se guarda es `comunidad_id`, y de ahi salen las otras dos por join (ver COLUMNAS_DE_COMUNIDAD
 * en api.js). Por eso departamento y municipio NO son campos del formulario -- no entran en
 * CAMPOS_REGISTRO_PACIENTE ni viajan en el payload --: son dos filtros que acotan la lista de
 * comunidades. Agregarlos como campos habria hecho que actualizarPaciente() intentara escribir
 * dos columnas que no existen.
 *
 * @param {object} [opciones]
 * @param {string|null} [opciones.comunidadInicial] Comunidad ya elegida (un paciente que se
 *   edita, o un alta desde la ficha de una comunidad). La cascada se posiciona sola en su
 *   municipio y su departamento, para que al abrir el formulario se vea de donde es la persona
 *   y no un selector en blanco.
 * @param {(comunidadId: string) => void} opciones.alElegirComunidad Se llama cuando la eleccion
 *   de comunidad cambia, incluida la cadena vacia al cambiar de departamento o municipio.
 * @returns {{
 *   departamentoId: string|number|null,
 *   municipioId: string|number|null,
 *   setDepartamento: (id) => void,
 *   setMunicipio: (id) => void,
 *   posicionarEn: (comunidadId: string|null) => Promise<void>,
 *   recargarComunidades: () => Promise<void>,
 *   reiniciar: () => void,
 *   catalogos: { departamentos: object[], municipios: object[], comunidades: object[] },
 * }}
 */
export function useCascadaTerritorial({ comunidadInicial = null, alElegirComunidad } = {}) {
  const [departamentoId, setDepartamentoId] = useState(null);
  const [municipioId, setMunicipioId] = useState(null);
  const [departamentos, setDepartamentos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [comunidades, setComunidades] = useState([]);

  useEffect(() => {
    let vigente = true;
    listarDepartamentos().then(({ departamentos: filas }) => {
      if (vigente) setDepartamentos(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!departamentoId) {
      setMunicipios([]);
      return undefined;
    }
    let vigente = true;
    listarMunicipios({ departamentoId }).then(({ municipios: filas }) => {
      if (vigente) setMunicipios(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, [departamentoId]);

  useEffect(() => {
    if (!municipioId) {
      setComunidades([]);
      return undefined;
    }
    let vigente = true;
    listarComunidades({ municipioId }).then(({ comunidades: filas }) => {
      if (vigente) setComunidades(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, [municipioId]);

  // Por ref: quien llama puede redefinir la funcion en cada render, y listarla como dependencia
  // volveria a consultar la comunidad en bucle.
  const alElegirRef = useRef(alElegirComunidad);
  useEffect(() => {
    alElegirRef.current = alElegirComunidad;
  }, [alElegirComunidad]);

  // Cuenta las peticiones de posicionamiento: solo la ultima puede escribir. Si alguien descarta
  // los cambios mientras la primera consulta sigue en vuelo, la respuesta vieja no pisa la nueva.
  const ultimaPeticion = useRef(0);

  /**
   * Coloca la cascada en el municipio y el departamento de una comunidad. Sin esto, editar a
   * alguien de Chimaltenango abriria el formulario con los tres selectores vacios y obligaria a
   * volver a elegir la comunidad que ya estaba bien.
   */
  const posicionarEn = useCallback(async (comunidadId) => {
    const peticion = ++ultimaPeticion.current;
    if (!comunidadId) {
      setDepartamentoId(null);
      setMunicipioId(null);
      return;
    }
    const { comunidad } = await obtenerComunidad(comunidadId);
    if (peticion !== ultimaPeticion.current || !comunidad) return;
    setDepartamentoId(comunidad.departamentoId ?? null);
    setMunicipioId(comunidad.municipioId ?? null);
    alElegirRef.current?.(comunidad.id);
  }, []);

  useEffect(() => {
    if (comunidadInicial) posicionarEn(comunidadInicial);
    // Al desmontar, cualquier respuesta pendiente queda descartada.
    return () => {
      ultimaPeticion.current += 1;
    };
  }, [comunidadInicial, posicionarEn]);

  // Cambiar de departamento o de municipio invalida la comunidad elegida: una comunidad de
  // Solola no puede quedar seleccionada bajo un municipio de Peten.
  const setDepartamento = useCallback((id) => {
    setDepartamentoId(id);
    setMunicipioId(null);
    setComunidades([]);
    alElegirRef.current?.("");
  }, []);

  const setMunicipio = useCallback((id) => {
    setMunicipioId(id);
    alElegirRef.current?.("");
  }, []);

  /** Vuelve a pedir las comunidades del municipio actual, tras crear una desde el formulario. */
  const recargarComunidades = useCallback(async () => {
    if (!municipioId) return;
    const { comunidades: filas } = await listarComunidades({ municipioId });
    setComunidades(aOpciones(filas ?? []));
  }, [municipioId]);

  const reiniciar = useCallback(() => {
    ultimaPeticion.current += 1;
    setDepartamentoId(null);
    setMunicipioId(null);
    setComunidades([]);
  }, []);

  return {
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    posicionarEn,
    recargarComunidades,
    reiniciar,
    catalogos: { departamentos, municipios, comunidades },
  };
}
