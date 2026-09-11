import { useState, useCallback, useMemo } from "react";
import { listarBodegas, registrarBodega, actualizarBodega } from "./bodegas.api.js";
import { listarProveedores, registrarProveedor, actualizarProveedor } from "./proveedores.api.js";

/**
 * Separa una respuesta `{ <coleccion>, error }` de la capa de API en lo que va al estado.
 *
 * Existe para que el error no se pueda ignorar por descuido. listarBodegas() y
 * listarProveedores() no lanzan: atrapan por dentro y devuelven el fallo en `error`, ya
 * normalizado. Leer solo la coleccion y descartar `error` es lo que hacia esta pantalla, y por
 * eso un fallo de carga se leia como "No hay bodegas registradas" (issue #762). Aqui las dos
 * cosas salen juntas o no sale ninguna.
 *
 * @param {{ error?: { mensaje?: string } }} respuesta Lo que devolvio la funcion de listado.
 * @param {string} coleccion Nombre de la propiedad que trae el arreglo ("bodegas", "proveedores").
 * @returns {{ items: object[], error: string|null }} `error` es texto apto para pantalla.
 */
export function resultadoDeListado(respuesta, coleccion) {
  if (respuesta?.error) {
    return { items: [], error: respuesta.error.mensaje ?? "No se pudo cargar la informacion." };
  }

  return { items: respuesta?.[coleccion] ?? [], error: null };
}

// Tipos segun migracion
export const TIPO_BODEGA = {
  FIJA: "fija",
  MOVIL: "movil",
};

export const TIPO_PROVEEDOR = {
  COMERCIAL: "comercial",
  DONANTE: "donante",
};

export function useAdministracionBodegasProveedores() {
  // ─── BODEGAS ───
  const [bodegas, setBodegas] = useState([]);
  const [cargandoBodegas, setCargandoBodegas] = useState(false);
  const [errorBodegas, setErrorBodegas] = useState(null);

  // listarBodegas() NO lanza: atrapa por dentro y devuelve `{ bodegas, error }` con el error ya
  // normalizado. El try/catch que habia aqui no atrapaba nada, y `respuesta.error` se descartaba
  // sin leerlo, asi que un fallo de carga -red caida, RLS que deniega- llegaba a la pantalla
  // como una lista vacia y se leia "No hay bodegas registradas". Es la misma forma del fallo de
  // entrega de medicamentos que motivo la issue #762: algo no funciona y el sistema dice que si.
  const cargarBodegas = useCallback(async () => {
    setCargandoBodegas(true);

    const { items, error } = resultadoDeListado(
      await listarBodegas({ conExistencias: true }),
      "bodegas",
    );

    setBodegas(items);
    setErrorBodegas(error);
    setCargandoBodegas(false);
  }, []);

  // Existencia total por bodega
  const existenciaPorBodega = useMemo(() => {
    // Asegurarse de que sea un arreglo antes de usar reduce
    const lista = Array.isArray(bodegas) ? bodegas : [];
    return lista.reduce((mapa, bodega) => {
      mapa[bodega.id] = bodega.existenciasTotales ?? 0;
      return mapa;
    }, {});
  }, [bodegas]);

  const guardarBodega = useCallback(
    async (bodega) => {
      const tieneExistencias = existenciaPorBodega[bodega.id] ?? 0;
      if (tieneExistencias > 0 && bodega.esMovil) {
        throw new Error("No se puede convertir en bodega móvil mientras tenga existencias");
      }

      const datos = {
        nombre: bodega.nombre?.trim(),
        ubicacion: bodega.ubicacion?.trim() || null,
        esMovil: Boolean(bodega.esMovil), // La API espera esMovil (camelCase), no es_movil.
      };

      if (!datos.nombre) throw new Error("El nombre es obligatorio");
      if (datos.nombre.length > 100)
        throw new Error("Nombre demasiado largo (máx. 100 caracteres)");

      let resultado;
      if (bodega.id) {
        resultado = await actualizarBodega(bodega.id, datos);
      } else {
        resultado = await registrarBodega(datos);
      }

      // La API devuelve { bodega, error } y no lanza excepciones: el error se lee, no se atrapa.
      if (resultado.error) throw new Error(resultado.error.mensaje || "Error al guardar");

      await cargarBodegas();
    },
    [existenciaPorBodega, cargarBodegas],
  );

  // ─── PROVEEDORES ───
  const [proveedores, setProveedores] = useState([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(false);
  const [errorProveedores, setErrorProveedores] = useState(null);

  // Mismo contrato y mismo motivo que cargarBodegas: listarProveedores() devuelve el error en
  // vez de lanzarlo, y descartarlo convertia el fallo en una lista vacia.
  const cargarProveedores = useCallback(async () => {
    setCargandoProveedores(true);

    const { items, error } = resultadoDeListado(await listarProveedores(), "proveedores");

    setProveedores(items);
    setErrorProveedores(error);
    setCargandoProveedores(false);
  }, []);

  const guardarProveedor = useCallback(
    async (proveedor) => {
      const datos = {
        nombre: proveedor.nombre?.trim(),
        contacto: proveedor.contacto?.trim() || null,
        tipo: proveedor.tipo, // "comercial" o "donante"
      };

      if (!datos.nombre) throw new Error("El nombre es obligatorio");
      if (!datos.tipo) throw new Error("El tipo es obligatorio");

      let resultado;
      if (proveedor.id) {
        resultado = await actualizarProveedor(proveedor.id, datos);
      } else {
        resultado = await registrarProveedor(datos);
      }

      // Mismo contrato que guardarBodega: el error viene en la respuesta, no como excepcion.
      if (resultado.error) {
        throw new Error(resultado.error.mensaje || "Error al guardar proveedor");
      }

      await cargarProveedores();
    },
    [cargarProveedores],
  );

  return {
    // Bodegas
    bodegas,
    cargandoBodegas,
    errorBodegas,
    cargarBodegas,
    guardarBodega,
    existenciaPorBodega,
    TIPO_BODEGA,

    // Proveedores
    proveedores,
    cargandoProveedores,
    errorProveedores,
    cargarProveedores,
    guardarProveedor,
    TIPO_PROVEEDOR,
  };
}
