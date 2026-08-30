import { useCallback, useEffect, useRef, useState } from "react";

import { esRespuestaVigente } from "../hooks/useBusquedaPacientes.js";
import { consultarExistencias } from "./existencias.api.js";

/**
 * View model de la pantalla de existencias de inventario (issue #152, RF-17), compartido por
 * la web (#158, #159) y el movil (#268, #270).
 *
 * Filtra por bodega y busqueda de texto libre, y expone `recargar()` para que quien aprueba un
 * movimiento desde `usePendientesValidacion()` pueda refrescar esta lista despues: las dos
 * pantallas normalmente conviven en el mismo layout (inventario y la bandeja de la
 * administradora), y es la pantalla que las combina la que sabe cuando una accion en una afecta
 * a la otra -- este hook no se suscribe solo a los cambios del otro, porque no hay un bus de
 * eventos ni una libreria de estado global en el proyecto (AGENTS.md).
 *
 * Se consulta al montar y cuando cambian bodega/busqueda/limite, nunca en cada render: React
 * vuelve a montar el hook con el mismo estado inicial si la pantalla se abandona y se vuelve a
 * entrar, asi que no repite la consulta salvo que los filtros de verdad cambien.
 *
 * Mismo resguardo contra respuestas fuera de orden que useBusquedaPacientes(): cada peticion
 * lleva un numero correlativo y solo la mas reciente pinta su resultado, para que cambiar de
 * bodega rapido no deje ganar a una respuesta vieja que llego tarde.
 *
 * @param {{ bodega?: string, busqueda?: string, limite?: number }} [opciones]
 */
export function useInventario({ bodega, busqueda, limite } = {}) {
  const [existencias, setExistencias] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Numero de la ultima peticion disparada. En una ref porque cambiarlo no debe redibujar nada.
  const peticionVigente = useRef(0);

  const consultar = useCallback(
    async (paginaAConsultar = 1) => {
      peticionVigente.current += 1;
      const idDeEstaPeticion = peticionVigente.current;

      setCargando(true);
      setError(null);

      const respuesta = await consultarExistencias({
        bodega,
        busqueda,
        limite,
        pagina: paginaAConsultar,
      });

      // Si mientras viajaba se disparo otra peticion (cambiaron los filtros o se llamo
      // recargar() dos veces seguidas), esta respuesta ya no le sirve a nadie. Misma funcion
      // que useBusquedaPacientes(), no reimplementada aparte.
      if (!esRespuestaVigente(idDeEstaPeticion, peticionVigente.current)) return;

      if (respuesta.error) {
        setError(respuesta.error);
        setCargando(false);
        return;
      }

      setExistencias(respuesta.existencias);
      setTotal(respuesta.total);
      setPagina(paginaAConsultar);
      setCargando(false);
    },
    [bodega, busqueda, limite],
  );

  useEffect(() => {
    consultar(1);
  }, [consultar]);

  const recargar = useCallback(() => consultar(pagina), [consultar, pagina]);

  return {
    existencias,
    total,
    pagina,
    cargando,
    error,
    recargar,
    irAPagina: consultar,
  };
}
