// Los rechazos de negocio de cargar, devolver y trasladar inventario (00179, 00181, 00186), con
// un mensaje escrito aqui para cada uno. Los usa normalizarErrorConReglas() (api/errores-de-
// supabase.js): sin ellos la pantalla decia "Alguno de los datos no cumple las reglas del sistema"
// cuando, por ejemplo, el proyecto estaba cancelado (issue #925).
//
// El patron reconoce el RAISE EXCEPTION de la funcion del servidor; de lo que coincide solo se
// reutilizan numeros o el estado del proyecto (un valor del enum), nunca nombres ni texto libre.

const ESTADOS_DE_PROYECTO_LEGIBLES = {
  cancelado: "cancelado",
  finalizado: "finalizado",
};

/** @type {Array<{ patron: RegExp, mensaje: string|((c: RegExpMatchArray) => string) }>} */
export const REGLAS_DE_RECHAZO_DE_INVENTARIO = [
  {
    patron: /^El proyecto esta (cancelado|finalizado)/,
    mensaje: (c) =>
      `El proyecto está ${ESTADOS_DE_PROYECTO_LEGIBLES[c[1]]}: ya no se puede modificar su inventario.`,
  },
  {
    patron: /^La jornada ya finalizo/,
    mensaje: "La jornada ya finalizó: su bodega ya no se carga. Lo que sobra se puede devolver.",
  },
  {
    patron: /esta ahora en la jornada .+, que sigue en curso/,
    mensaje: "Esa bodega está ahora en otra jornada en curso: cárgala cuando esa jornada termine.",
  },
  {
    patron: /^De ese lote, a esta jornada le quedan (\d+)/,
    mensaje: (c) =>
      `De ese lote, a esta jornada le quedan ${c[1]} unidad(es): no se puede devolver más.`,
  },
  {
    patron: /^Existencia insuficiente.*Disponible: (\d+), solicitado: (\d+)/,
    mensaje: (c) =>
      `No hay existencia suficiente: hay ${c[1]} disponible(s) y se pidieron ${c[2]}. ` +
      "Lo que espera aprobación ya no se puede usar.",
  },
  {
    patron: /^Un traslado sale de una bodega y entra a otra distinta/,
    mensaje: "La bodega destino tiene que ser distinta de la bodega de origen.",
  },
  {
    patron: /^El lote vencio el/,
    mensaje: "El lote está vencido: se da de baja desde su alerta, no se mueve de bodega.",
  },
  {
    patron: /^Lo que sobra se devuelve a una bodega fija/,
    mensaje: "Lo que sobra se devuelve a una bodega fija, no a otra bodega móvil.",
  },
  {
    patron: /^La bodega de origen es la misma de la jornada/,
    mensaje: "La bodega de origen es la misma de la jornada: elige otra bodega para cargarla.",
  },
  {
    patron: /^La jornada usa la bodega principal/,
    mensaje:
      "Esta jornada entrega directo de la bodega principal: no hay nada que cargar ni devolver.",
  },
];
