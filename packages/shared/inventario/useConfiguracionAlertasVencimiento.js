import { useCallback, useEffect, useMemo, useState } from "react";

import { sincronizarAlertas } from "./alertas.api.js";
import {
  guardarConfiguracionAlertas,
  obtenerConfiguracionAlertas,
} from "./configuracionAlertas.api.js";
import {
  DIA_MAXIMO_DE_UMBRAL,
  MAXIMO_DE_UMBRALES,
  normalizarUmbrales,
  resumenDeAvisos,
  validarUmbrales,
} from "./configuracionAlertas.validaciones.js";
import { puedeConfigurarAlertasVencimiento } from "./permisos.js";
import { recargarAlertasMontadas } from "./useAlertasVencimiento.js";
import { invalidarVentanaDeAviso } from "./useVentanaDeAvisoVencimiento.js";

/**
 * View model de la pantalla web "Avisos de vencimiento" (issue #899): la administracion elige
 * con cuantos dias de antelacion se avisa que un lote va a vencer. De cero a cuatro antelaciones:
 * se agregan de una en una segun se necesiten y se pueden quitar todas; el aviso del dia del
 * vencimiento no se configura, siempre se envia.
 *
 * Al guardar sincroniza las alertas (fn_sincronizar_alertas_caducidad) para que un lote que entra
 * a la ventana nueva avise en el momento, y no al dia siguiente con la rutina programada.
 *
 * @param {{ rolUsuario: string }} contexto
 * @returns {object} Con: umbrales, errores, errorGeneral, cargando, error, guardando, errorGuardar,
 *   guardadoEn, puedeEditar, puedeAgregar, puedeQuitar, resumen, actualizadoPorNombre,
 *   maximoDeUmbrales, diaMaximo, agregarUmbral, quitarUmbral, cambiarUmbral, guardar, recargar.
 */
export function useConfiguracionAlertasVencimiento({ rolUsuario } = {}) {
  const [configuracion, setConfiguracion] = useState(null);
  // Lo que se edita: textos, tal como los escribe la persona, para no perder un campo vacio.
  const [umbrales, setUmbrales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [guardadoEn, setGuardadoEn] = useState(null);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const puedeEditar = puedeConfigurarAlertasVencimiento(rolUsuario);

  const aplicar = useCallback((nueva) => {
    setConfiguracion(nueva);
    setUmbrales((nueva?.umbralesDias ?? []).map(String));
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const respuesta = await obtenerConfiguracionAlertas();
    if (respuesta.error) {
      setError(respuesta.error);
    } else {
      aplicar(respuesta.configuracion);
    }
    setCargando(false);
  }, [aplicar]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const validacion = useMemo(() => validarUmbrales(umbrales), [umbrales]);

  const agregarUmbral = useCallback(() => {
    setGuardadoEn(null);
    setUmbrales((actuales) =>
      actuales.length >= MAXIMO_DE_UMBRALES ? actuales : [...actuales, ""],
    );
  }, []);

  const quitarUmbral = useCallback((indice) => {
    setGuardadoEn(null);
    setUmbrales((actuales) => actuales.filter((_, i) => i !== indice));
  }, []);

  const cambiarUmbral = useCallback((indice, valor) => {
    setGuardadoEn(null);
    setUmbrales((actuales) =>
      actuales.map((actual, i) => (i === indice ? (valor ?? "").toString() : actual)),
    );
  }, []);

  const guardar = useCallback(async () => {
    setIntentoGuardar(true);
    setErrorGuardar(null);
    setGuardadoEn(null);
    if (!configuracion || validacion) return false;

    setGuardando(true);
    const respuesta = await guardarConfiguracionAlertas(configuracion.id, {
      umbralesDias: umbrales,
      rolUsuario,
    });
    if (respuesta.error) {
      setErrorGuardar(respuesta.error);
      setGuardando(false);
      return false;
    }

    aplicar(respuesta.configuracion);
    setIntentoGuardar(false);
    invalidarVentanaDeAviso();
    // Con la ventana nueva puede haber lotes que ya deban avisar. Su fallo no deshace lo guardado:
    // la rutina diaria los alcanza igual.
    await sincronizarAlertas();
    await recargarAlertasMontadas();
    setGuardadoEn(respuesta.configuracion?.updatedAt ?? new Date().toISOString());
    setGuardando(false);
    return true;
  }, [aplicar, configuracion, rolUsuario, umbrales, validacion]);

  const hayCambios = useMemo(() => {
    const guardados = configuracion?.umbralesDias ?? [];
    if (validacion) return true;
    const editados = normalizarUmbrales(umbrales);
    return (
      editados.length !== guardados.length || editados.some((valor, i) => valor !== guardados[i])
    );
  }, [configuracion, umbrales, validacion]);

  return {
    umbrales,
    errores: intentoGuardar ? (validacion?.porRenglon ?? {}) : {},
    errorGeneral: intentoGuardar ? (validacion?.general ?? null) : null,
    cargando,
    error,
    guardando,
    errorGuardar,
    guardadoEn,
    hayCambios,
    puedeEditar,
    puedeAgregar: puedeEditar && umbrales.length < MAXIMO_DE_UMBRALES,
    puedeQuitar: puedeEditar && umbrales.length > 0,
    resumen: resumenDeAvisos(configuracion?.umbralesDias ?? []),
    actualizadoPorNombre: configuracion?.actualizadoPorNombre ?? null,
    actualizadoEn: configuracion?.updatedAt ?? null,
    maximoDeUmbrales: MAXIMO_DE_UMBRALES,
    diaMaximo: DIA_MAXIMO_DE_UMBRAL,
    agregarUmbral,
    quitarUmbral,
    cambiarUmbral,
    guardar,
    recargar,
  };
}
