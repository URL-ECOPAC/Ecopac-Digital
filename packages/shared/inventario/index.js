// Modulo de inventario de la logica compartida.
//
// Estructura estandar de un modulo (ver docs/ARQUITECTURA-FRONTEND.md):
//   api.js           llamadas a Supabase y normalizacion de errores
//   validaciones.js  reglas de negocio
//   campos.js        esquema declarativo de los formularios
//   columnas.js      columnas de tabla y campos de tarjeta
//   filtros.js       filtros de las pantallas de listado
//   permisos.js      que puede hacer cada rol en el modulo
//   use<Pantalla>.js view model de una pantalla: datos, estado y handlers
//
// campos.js, columnas.js y filtros.js estan escritos (issue #285). api.js y permisos.js de
// principios activos tambien (issue "API del catalogo de principios activos"), los de
// medicamentos igual (issue #142), los de lotes tambien (issue "API de lotes de medicamentos
// en shared", RF-14), y los de bodegas y proveedores tambien (issue #143). El resto de inventario
// (movimientos...), las validaciones de principios activos, medicamentos y lotes, y los hooks de
// pantalla los construyen sus propias issues.
//
// bodegas y proveedores comparten bodegas.permisos.js: las politicas de las dos tablas son
// identicas (00062) y se administran desde la misma pantalla.

export * from "./campos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export * from "./principios-activos.api.js";
export * from "./principios-activos.permisos.js";
export * from "./medicamentos.api.js";
export * from "./medicamentos.permisos.js";
export * from "./lotes.api.js";
export * from "./existencias.api.js";
export * from "./entrega.api.js";
export * from "./valorizacion.api.js";
export * from "./lotes.permisos.js";
export * from "./lotes.validaciones.js";
export * from "./existencias.validaciones.js";
export * from "./bodegas.api.js";
export * from "./proveedores.api.js";
export * from "./bodegas.permisos.js";
export * from "./movimientos.api.js";
export * from "./alertas.api.js";
export * from "./permisos.js";
export * from "./validacion.api.js";
export * from "./useCatalogoMedicamentos.js";
export * from "./catalogoMedicamentos.js";
export * from "./useCatalogoPrincipiosActivos.js";
export * from "./useInventario.js";
export * from "./usePendientesValidacion.js";
export * from "./useRegistroIngreso.js";
export * from "./useEntregaMedicamentos.js";
export * from "./useDetalleLote.js";

// useVistaExistencias.js y useAlertasVencimiento.js declaran cada uno su propia
// calcularDiasRestantes(): un "export *" de los dos volveria ese nombre ambiguo y ESM lo
// excluiria del barril entero (el mismo problema que describen los comentarios de
// descriptores.js/enums.js arriba, issues #365/#397). Se listan los nombres explicitamente
// para evitar la colision; quien necesite esa funcion interna sigue importando el archivo
// directo, como ya hacian las pantallas antes de esta issue (#785).
export {
  ESTADO_EXISTENCIA,
  calcularEstadoVencimiento,
  useVistaExistencias,
} from "./useVistaExistencias.js";
export { datosAtenderAlerta, useAlertasVencimiento } from "./useAlertasVencimiento.js";

// Mismo caso que los dos de arriba: useExistenciasPorLote.js es de existencias lote a lote (la
// pantalla movil de inventario, issue #838) y no comparte nombres con useVistaExistencias.js, que
// agrupa por medicamento para la tabla de la web. Se listan por nombre por el mismo criterio.
export {
  ESTADOS_DE_LOTE,
  FILTROS_EXISTENCIAS_POR_LOTE,
  FILTROS_EXISTENCIAS_POR_LOTE_VACIOS,
  armarFilasDeExistencias,
  estadoDeLote,
  sumarExistenciasPorLote,
  useExistenciasPorLote,
} from "./useExistenciasPorLote.js";

// Los cuatro view model que ningun barril reexportaba (issue #700). No era un olvido inocuo: el
// `exports` de packages/shared/package.json resuelve "./<modulo>" a su index.js y nada mas, asi
// que sin estas lineas la unica forma de usarlos desde una app era importarlos por ruta relativa
// -que es justo lo que AGENTS.md prohibe- y, de paso, quedaban fuera de `vite build`, donde un
// error suyo habria aparecido antes de llegar a produccion.
//
// Por nombre y no con `export *`: es el criterio que ya seguia useAlertasVencimiento aqui arriba.
// Los helpers internos de cada archivo -resultadoDeListado(), validarDatosDeLote(), nombreDe(),
// filasDeKardex()- no son API del paquete y no salen.
export {
  TIPO_BODEGA,
  TIPO_PROVEEDOR,
  useAdministracionBodegasProveedores,
} from "./useAdministracionBodegasProveedores.js";
export { datosLoteParaRegistrar, useGestionLotes } from "./useGestionLotes.js";
export {
  ESTADO_MOVIMIENTO,
  TIPO_MOVIMIENTO,
  useKardexMovimientos,
} from "./useKardexMovimientos.js";
export { useRegistroSalida } from "./useRegistroSalida.js";
export { filaDeMisMovimientos, useMisMovimientos } from "./useMisMovimientos.js";
