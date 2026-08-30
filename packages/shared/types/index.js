// Tipos del dominio compartidos entre web y movil (issue #48).
//
// Se documentan con JSDoc (`@typedef`), no con TypeScript. Es la decision A de la issue #493:
// packages/shared se escribe en JavaScript, porque un `.ts` queda fuera del bloque de la
// frontera de eslint.config.mjs -que solo alcanza {js,jsx}- y entra sin pasar por
// no-restricted-imports ni no-restricted-globals. La regla y su porque estan en
// docs/ARQUITECTURA-FRONTEND.md, en "La frontera, en concreto". Un `@typedef` da el mismo
// autocompletado que una interfaz sin agregar un paso de compilacion al bundler de Expo.
//
// COMO SE USAN
//
// Desde cualquier archivo de apps/web o apps/mobile, por el barril del paquete:
//
//   /** @typedef {import("@ecopac/shared").Paciente} Paciente */
//
//   /** @param {Paciente} paciente */
//   function nombreCompleto(paciente) {
//     return `${paciente.nombres} ${paciente.apellidos}`;
//   }
//
// QUE DESCRIBEN: EL OBJETO QUE DEVUELVE EL api.js, NO LA FILA CRUDA
//
// Las propiedades van en camelCase, que es como llegan al cliente: cada api.js pide sus columnas
// con alias (`comunidadId:comunidad_id` en jornadas/api.js, `fechaIngreso:fecha_ingreso` en
// usuarios/api.js) para que coincidan con los ids de los descriptores, y DataList busca el valor
// por el id de la columna. Un tipo en snake_case describiria algo que ninguna pantalla ve.
//
// La conversion es mecanica y no tiene excepciones: cada `@property` es la columna de su tabla
// pasada a camelCase, todas las columnas y solo esas.
//
// LAS RELACIONES EMBEBIDAS NO ESTAN, A PROPOSITO
//
// `comunidad:comunidades(nombre)` y `responsable:perfiles(nombres, apellidos)` no son columnas de
// jornadas: dependen del select() de cada consulta, no de la tabla, y RLS las puede devolver en
// null aunque la fila si se vea. Quien las necesite tipadas compone el tipo donde las pide:
//
//   /** @typedef {Jornada & { comunidad: { nombre: string }|null }} JornadaConComunidad */
//
// LOS VALORES DE ENUM NO SE REESCRIBEN
//
// Cada enum se declara una sola vez, en enums.js (issue #397) o en usuarios/roles.js. Los alias
// de abajo derivan la union de literales de esas constantes, asi que un valor nuevo en el enum
// aparece en el tipo sin tocar este archivo, y uno escrito mal aqui no puede existir. Funciona
// porque esos objetos estan congelados: sin `Object.freeze`, TypeScript infiere `string` y el
// autocompletado se pierde.
//
// LOS TIPOS SALEN DE LA BASE
//
// `uuid`, `text`, `varchar`, `citext`, `date`, `time` y `timestamptz` llegan como `string` por
// JSON; `integer`, `smallint`, `bigint` y `numeric` como `number`; `jsonb` como `object`. El
// `|null` es el `is_nullable` de la columna, no una impresion: se leyo del information_schema de
// la base local, aplicando todas las migraciones desde cero.
//
// Cada bloque cita la migracion que crea la tabla y las que le cambiaron columnas despues, con la
// misma disciplina que enums.js: cuando una migracion posterior renombro o recreo algo, se dice
// cual manda hoy.
//
// Lo que sostiene todo esto es types/index.test.js, que compara los `@typedef` de aqui contra
// supabase/migrations/ y falla si falta una tabla, sobra una propiedad o falta una columna.
//
// RolUsuario y Permiso estuvieron aqui antes y se retiraron en la issue #396: eran del Modelo B
// de permisos (utils/permisos.ts), con roles capitalizados que no coinciden con el enum
// rol_usuario de la base. Los dos vuelven, pero derivados del esquema: RolUsuario de ROLES en
// usuarios/roles.js, y Permiso como la fila de la tabla `permisos` de la 00003.

// --- Alias de los enums del dominio ------------------------------------------------------

/** @typedef {(typeof import("../enums.js").ACCIONES_DE_ALERTA)[keyof typeof import("../enums.js").ACCIONES_DE_ALERTA]} AccionAlerta */
/** @typedef {(typeof import("../enums.js").CATEGORIAS_DE_GASTO)[keyof typeof import("../enums.js").CATEGORIAS_DE_GASTO]} CategoriaGasto */
/** @typedef {(typeof import("../enums.js").ESTADOS_ALERTA)[keyof typeof import("../enums.js").ESTADOS_ALERTA]} EstadoAlerta */
/** @typedef {(typeof import("../enums.js").ESTADOS_CONDICION_CRONICA)[keyof typeof import("../enums.js").ESTADOS_CONDICION_CRONICA]} EstadoCondicionCronica */
/** @typedef {(typeof import("../enums.js").ESTADOS_DE_DONACION)[keyof typeof import("../enums.js").ESTADOS_DE_DONACION]} EstadoDonacion */
/** @typedef {(typeof import("../enums.js").ESTADOS_DE_GASTO)[keyof typeof import("../enums.js").ESTADOS_DE_GASTO]} EstadoGasto */
/** @typedef {(typeof import("../enums.js").ESTADOS_JORNADA)[keyof typeof import("../enums.js").ESTADOS_JORNADA]} EstadoJornada */
/** @typedef {(typeof import("../enums.js").ESTADOS_MOVIMIENTO)[keyof typeof import("../enums.js").ESTADOS_MOVIMIENTO]} EstadoMovimiento */
/** @typedef {(typeof import("../enums.js").ESTADOS_PROYECTO)[keyof typeof import("../enums.js").ESTADOS_PROYECTO]} EstadoProyecto */
/** @typedef {(typeof import("../enums.js").ESTADOS_RECETA)[keyof typeof import("../enums.js").ESTADOS_RECETA]} EstadoReceta */
/** @typedef {(typeof import("../enums.js").IDIOMAS)[keyof typeof import("../enums.js").IDIOMAS]} IdiomaPreferido */
/** @typedef {(typeof import("../enums.js").ORIGENES_DE_LOTE)[keyof typeof import("../enums.js").ORIGENES_DE_LOTE]} OrigenLote */
/** @typedef {(typeof import("../enums.js").PRESENTACIONES_DE_MEDICAMENTO)[keyof typeof import("../enums.js").PRESENTACIONES_DE_MEDICAMENTO]} PresentacionMedicamento */
/** @typedef {(typeof import("../enums.js").TIPOS_DE_DONACION)[keyof typeof import("../enums.js").TIPOS_DE_DONACION]} TipoDonacion */
/** @typedef {(typeof import("../enums.js").TIPOS_DE_DONANTE)[keyof typeof import("../enums.js").TIPOS_DE_DONANTE]} TipoDonante */
/** @typedef {(typeof import("../enums.js").TIPOS_DE_MOVIMIENTO)[keyof typeof import("../enums.js").TIPOS_DE_MOVIMIENTO]} TipoMovimiento */
/** @typedef {(typeof import("../enums.js").TIPOS_DE_PROVEEDOR)[keyof typeof import("../enums.js").TIPOS_DE_PROVEEDOR]} TipoProveedor */
/** @typedef {(typeof import("../enums.js").TIPOS_SANGUINEOS)[keyof typeof import("../enums.js").TIPOS_SANGUINEOS]} TipoSanguineo */

/**
 * `rol_usuario` (00001_initial_schema.sql), desde ROLES en usuarios/roles.js.
 *
 * No sale de enums.js: rol_usuario es el unico enum que no vive ahi, porque ya era fuente unica
 * antes de la issue #397 y lleva helpers propios. El comentario de ese archivo lo explica.
 *
 * @typedef {(typeof import("../usuarios/roles.js").ROLES)[keyof typeof import("../usuarios/roles.js").ROLES]} RolUsuario
 */

// --- Usuarios y permisos --------------------------------------------------------------------

/**
 * Fila de `perfiles` (00002_perfiles_especialidades.sql).
 *
 * `id` es tambien el id de auth.users: la 00002 lo declara como llave foranea contra esa
 * tabla, no como una identidad propia.
 *
 * @typedef {object} Perfil
 * @property {string} id
 * @property {string} nombres
 * @property {string} apellidos
 * @property {string} email Columna `citext`: se compara sin distinguir mayusculas.
 * @property {string|null} telefono
 * @property {RolUsuario} rol
 * @property {boolean} activo
 * @property {string|null} fechaIngreso
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `perfil_especialidad` (00002_perfiles_especialidades.sql).
 *
 * No tiene columna `id`: su llave es la pareja completa. Es lo que explica que
 * usuarios/api.js la pida embebida como `especialidades:perfil_especialidad(nombre_especialidad)`
 * y no por id.
 *
 * @typedef {object} PerfilEspecialidad
 * @property {string} perfilId
 * @property {string} nombreEspecialidad
 */

/**
 * Fila de `permisos` (00003_permisos.sql).
 *
 * Este `Permiso` no es el que retiro la issue #396. Aquel era un tipo del Modelo B de permisos
 * del cliente, sin respaldo en el esquema. Este es la tabla que existe desde la 00003 y que la
 * 00086 conecto a las politicas RLS.
 *
 * @typedef {object} Permiso
 * @property {string} id
 * @property {string} clave
 * @property {string} modulo
 * @property {string|null} descripcion
 */

/**
 * Fila de `rol_permiso` (00003_permisos.sql): los permisos que trae un rol por defecto.
 *
 * @typedef {object} RolPermiso
 * @property {RolUsuario} rol
 * @property {string} permisoId
 */

/**
 * Fila de `usuario_permiso` (00003_permisos.sql): la excepcion por persona sobre lo que da su
 * rol. `concedido` en false quita un permiso que el rol si da.
 *
 * @typedef {object} UsuarioPermiso
 * @property {string} perfilId
 * @property {string} permisoId
 * @property {boolean} concedido
 * @property {string|null} otorgadoPor
 * @property {string|null} motivo
 */

// --- Territorio -----------------------------------------------------------------------------

/**
 * Fila de `departamentos` (00006_departamentos_municipios.sql; created_at y updated_at los
 * agrega la 00008).
 *
 * `id` es `integer` y no uuid: es un catalogo fijo del pais, cargado por la propia migracion.
 *
 * @typedef {object} Departamento
 * @property {number} id
 * @property {string} nombre
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `municipios` (00006_departamentos_municipios.sql; created_at y updated_at los agrega
 * la 00008). Mismo criterio de id entero que Departamento.
 *
 * @typedef {object} Municipio
 * @property {number} id
 * @property {number} departamentoId
 * @property {string} nombre
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `comunidades` (00008_ajustes_departamentos_municipios.sql).
 *
 * A diferencia de departamentos y municipios, si lleva uuid: las comunidades se dan de alta desde
 * la aplicacion.
 *
 * @typedef {object} Comunidad
 * @property {string} id
 * @property {number} municipioId
 * @property {string} nombre
 * @property {number|null} latitud
 * @property {number|null} longitud
 * @property {string|null} referenciaAcceso
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// --- Pacientes ------------------------------------------------------------------------------

/**
 * Fila de `pacientes` (00009_pacientes_expedientes.sql; tipo_sangre, nombre_responsable y
 * parentesco_responsable los agrega la 00035).
 *
 * @typedef {object} Paciente
 * @property {string} id
 * @property {string} nombres
 * @property {string} apellidos
 * @property {string} fechaNacimiento
 * @property {string} sexo Columna `varchar`, no un enum: el catalogo vive en pacientes/campos.js.
 * @property {string} comunidadId
 * @property {string} telefonoContacto No es el telefono del paciente sino el de quien se le puede
 *   contactar (00093).
 * @property {IdiomaPreferido} idioma
 * @property {string|null} dpi
 * @property {string|null} fechaBaja Baja logica: con valor, el paciente esta dado de baja.
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {TipoSanguineo|null} tipoSangre
 * @property {string|null} nombreResponsable
 * @property {string|null} parentescoResponsable
 */

/**
 * Fila de `expedientes` (00009_pacientes_expedientes.sql).
 *
 * `numero_ficha` es `varchar` y no un entero: desde la 00081 lo genera una secuencia y la columna
 * guarda el texto ya formateado.
 *
 * @typedef {object} Expediente
 * @property {string} id
 * @property {string} pacienteId
 * @property {string} numeroFicha
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `condiciones_cronicas` (00010_condiciones_cronicas.sql): el catalogo de condiciones,
 * no lo que padece una persona. Eso es PadecimientoCronico.
 *
 * @typedef {object} CondicionCronica
 * @property {string} id
 * @property {string} nombre
 * @property {string} createdAt
 */

/**
 * Fila de `padecimientos_cronicos` (00010_condiciones_cronicas.sql): una condicion del catalogo
 * atribuida a un paciente concreto.
 *
 * @typedef {object} PadecimientoCronico
 * @property {string} id
 * @property {string} pacienteId
 * @property {string} condicionId
 * @property {string} fechaDiagnostico
 * @property {EstadoCondicionCronica} estado
 * @property {string|null} notas
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `fusiones_pacientes` (00101_deteccion_y_fusion_de_pacientes_duplicados.sql): la
 * bitacora de los expedientes duplicados que se unieron.
 *
 * @typedef {object} FusionPacientes
 * @property {string} id
 * @property {string} pacienteAbsorbidoId
 * @property {string} pacienteSobrevivienteId
 * @property {string|null} realizadaPor
 * @property {string} realizadaEn
 */

// --- Jornadas -------------------------------------------------------------------------------

/**
 * Fila de `jornadas` (00012_jornadas.sql; codigo, fecha_inicio_real, fecha_fin_real,
 * orden_kanban, cupo_estimado y botiquin_bodega_id los agrega la 00036).
 *
 * @typedef {object} Jornada
 * @property {string} id
 * @property {string} nombre
 * @property {string} fecha
 * @property {string} comunidadId
 * @property {string} responsableId
 * @property {string|null} proyectoId
 * @property {EstadoJornada} estado
 * @property {number} presupuestoAsignado
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} codigo
 * @property {string|null} fechaInicioReal
 * @property {string|null} fechaFinReal
 * @property {number|null} ordenKanban
 * @property {number|null} cupoEstimado
 * @property {string|null} botiquinBodegaId
 */

/**
 * Fila de `jornada_personal` (00012_jornadas.sql; asistio lo agrega la 00036): una persona
 * asignada a una jornada.
 *
 * @typedef {object} JornadaPersonal
 * @property {string} id
 * @property {string} jornadaId
 * @property {string} perfilId
 * @property {RolUsuario} rolEnJornada Reusa el enum `rol_usuario`: el rol con el que la persona
 *   trabaja ese dia.
 * @property {string} horaInicio Columna `time`, sin fecha ni zona: llega como "08:00:00".
 * @property {string} horaFin Columna `time`, igual que hora_inicio.
 * @property {string|null} responsabilidad
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} asistio
 */

/**
 * Fila de `jornada_estado_historial` (00012_jornadas.sql).
 *
 * Solo la escribe el trigger SECURITY DEFINER de esa migracion; desde el cliente es de lectura.
 * `estado_anterior` llega en null en el primer registro, cuando la jornada se crea.
 *
 * @typedef {object} JornadaEstadoHistorial
 * @property {string} id
 * @property {string} jornadaId
 * @property {EstadoJornada|null} estadoAnterior
 * @property {EstadoJornada} estadoNuevo
 * @property {string|null} cambiadoPor
 * @property {string} createdAt
 */

// --- Atenciones -----------------------------------------------------------------------------

/**
 * Fila de `atenciones` (00013_atenciones_triajes.sql; cerrada_en y motivo_cierre los agrega la
 * 00060): el paso de un paciente por una jornada.
 *
 * @typedef {object} Atencion
 * @property {string} id
 * @property {string} pacienteId
 * @property {string} jornadaId
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} cerradaEn
 * @property {string|null} motivoCierre
 */

/**
 * Fila de `triajes` (00013_atenciones_triajes.sql): los signos vitales tomados en la atencion.
 *
 * @typedef {object} Triaje
 * @property {string} id
 * @property {string} atencionId
 * @property {number} presionSistolica
 * @property {number} presionDiastolica
 * @property {number|null} glucosa
 * @property {number|null} peso
 * @property {number|null} talla
 * @property {number|null} temperatura
 * @property {number} frecuenciaCardiaca
 * @property {number|null} imc Columna generada a partir de peso y talla: se lee, no se escribe.
 * @property {string} tomadoPor
 * @property {string} tomadoEn
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `consultas` (00018_consultas_medicas_diagnosticos.sql).
 *
 * @typedef {object} Consulta
 * @property {string} id
 * @property {string} expedienteId
 * @property {string} atencionId
 * @property {string} medicoId
 * @property {string} jornadaId
 * @property {string} motivoConsulta
 * @property {string|null} antecedentes
 * @property {string|null} sintomas
 * @property {string|null} exploracion
 * @property {string|null} tratamiento
 * @property {string|null} observaciones
 * @property {string|null} planSeguimiento
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `diagnosticos` (00018_consultas_medicas_diagnosticos.sql): el catalogo, no el
 * diagnostico de una consulta. Eso es ConsultaDiagnostico.
 *
 * @typedef {object} Diagnostico
 * @property {string} id
 * @property {string|null} codigo
 * @property {string} nombre
 * @property {string|null} descripcion
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `consulta_diagnostico` (00018_consultas_medicas_diagnosticos.sql): un diagnostico del
 * catalogo atribuido a una consulta.
 *
 * @typedef {object} ConsultaDiagnostico
 * @property {string} id
 * @property {string} consultaId
 * @property {string} diagnosticoId
 * @property {boolean} esPrincipal
 * @property {string} createdAt
 */

/**
 * Fila de `recetas` (00019_recetas_medicas_detalle.sql; estado, motivo_anulacion, anulada_por y
 * anulada_en los agrega la 00066).
 *
 * @typedef {object} Receta
 * @property {string} id
 * @property {string} consultaId
 * @property {string} medicoId
 * @property {string} folio
 * @property {string|null} indicacionesGenerales
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {EstadoReceta} estado
 * @property {string|null} motivoAnulacion
 * @property {string|null} anuladaPor
 * @property {string|null} anuladaEn
 */

/**
 * Fila de `receta_detalle` (00019_recetas_medicas_detalle.sql): un medicamento recetado.
 *
 * Sin `updated_at`: una linea de receta no se corrige, se anula la receta entera.
 *
 * @typedef {object} RecetaDetalle
 * @property {string} id
 * @property {string} recetaId
 * @property {string} medicamentoId
 * @property {string|null} loteId En null mientras no se despache: la receta se emite antes de saber
 *   de que lote sale.
 * @property {string} dosis
 * @property {string} frecuencia
 * @property {string} duracion
 * @property {number} cantidadEntregada
 * @property {string} createdAt
 */

// --- Inventario -----------------------------------------------------------------------------

/**
 * Fila de `medicamentos` (00016_medicamentos.sql; activo lo agrega la 00050).
 *
 * @typedef {object} Medicamento
 * @property {string} id
 * @property {string} nombre
 * @property {string} concentracion
 * @property {PresentacionMedicamento} presentacion
 * @property {string} marca
 * @property {string|null} formaFarmaceutica
 * @property {boolean} esPediatrico
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} activo
 */

/**
 * Fila de `principios_activos` (00016_medicamentos.sql; nombre_normalizado lo agrega la 00046).
 *
 * Sin `updated_at`: la 00016 no lo declaro para esta tabla.
 *
 * @typedef {object} PrincipioActivo
 * @property {string} id
 * @property {string} nombre
 * @property {string} createdAt
 * @property {string|null} nombreNormalizado
 */

/**
 * Fila de `medicamento_principio` (00016_medicamentos.sql): que principios lleva un medicamento.
 * Sin `id` ni marcas de tiempo, igual que PerfilEspecialidad.
 *
 * @typedef {object} MedicamentoPrincipio
 * @property {string} medicamentoId
 * @property {string} principioId
 */

/**
 * Fila de `proveedores` (00017_proveedores_bodegas.sql).
 *
 * @typedef {object} Proveedor
 * @property {string} id
 * @property {string} nombre
 * @property {string|null} contacto
 * @property {TipoProveedor} tipo De donde viene el proveedor, no de donde vino un lote suyo
 *   (00090).
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `bodegas` (00017_proveedores_bodegas.sql). `es_movil` distingue el botiquin que viaja
 * a una jornada de la bodega fija.
 *
 * @typedef {object} Bodega
 * @property {string} id
 * @property {string} nombre
 * @property {string|null} ubicacion
 * @property {boolean} esMovil
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `lotes` (00019_recetas_medicas_detalle.sql; proveedor_id, origen, cantidad_ingresada y
 * fecha_ingreso los agrega la 00020).
 *
 * @typedef {object} Lote
 * @property {string} id
 * @property {string} medicamentoId
 * @property {string} numeroLote
 * @property {string} fechaVencimiento
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} proveedorId
 * @property {OrigenLote} origen Como entro este lote, que puede no coincidir con el tipo de su
 *   proveedor (00090).
 * @property {number} cantidadIngresada
 * @property {string} fechaIngreso
 */

/**
 * Fila de `existencias` (00020_lotes_existencias.sql): cuanto queda de un lote en una bodega.
 *
 * @typedef {object} Existencia
 * @property {string} id
 * @property {string} loteId
 * @property {string} bodegaId
 * @property {number} cantidadDisponible
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `movimientos_inventario` (00023_movimientos_inventario.sql; aprobacion_automatica la
 * agrega la 00028 y motivo_rechazo la 00084).
 *
 * `tipo` y `estado` son los enums que la 00023 recreo con DROP TYPE ... CASCADE: no los de la
 * 00001. `aprobado_en` se llamo `fecha_aprobacion` hasta la 00094.
 *
 * @typedef {object} MovimientoInventario
 * @property {string} id
 * @property {TipoMovimiento} tipo
 * @property {string} loteId
 * @property {string} bodegaId
 * @property {number} cantidad
 * @property {string} motivo
 * @property {EstadoMovimiento} estado
 * @property {string} registradoPor
 * @property {string|null} aprobadoPor
 * @property {string|null} aprobadoEn
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} aprobacionAutomatica
 * @property {string|null} motivoRechazo
 */

/**
 * Fila de `alertas_caducidad` (00021_alertas_caducidad.sql): un lote proximo a vencer.
 *
 * Las genera la rutina programada de la 00088, no el cliente.
 *
 * @typedef {object} AlertaCaducidad
 * @property {string} id
 * @property {string} loteId
 * @property {EstadoAlerta} estado
 * @property {number} cantidadAfectada
 * @property {AccionAlerta|null} accion
 * @property {string|null} atendidaPor
 * @property {string|null} atendidaEn
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// --- Donaciones -----------------------------------------------------------------------------

/**
 * Fila de `donantes` (00022_donantes_donaciones.sql).
 *
 * @typedef {object} Donante
 * @property {string} id
 * @property {string} nombre
 * @property {TipoDonante} tipo
 * @property {string|null} contacto
 * @property {string|null} telefono
 * @property {string|null} email Columna `citext`: se compara sin distinguir mayusculas.
 * @property {string|null} direccion
 * @property {boolean} activo
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `donaciones` (00022_donantes_donaciones.sql; proyecto_id lo agrega la 00097).
 *
 * `registrado_por` se llamo `registrada_por` hasta la 00091, que lo unifico con el resto del
 * esquema.
 *
 * @typedef {object} Donacion
 * @property {string} id
 * @property {string} donanteId
 * @property {string} fecha
 * @property {TipoDonacion} tipo
 * @property {string|null} observaciones
 * @property {EstadoDonacion} estado
 * @property {string|null} motivoAnulacion
 * @property {string|null} anuladaPor
 * @property {string|null} anuladaEn
 * @property {string|null} registradoPor
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} proyectoId
 */

/**
 * Fila de `donacion_detalle` (00022_donantes_donaciones.sql): una linea de la donacion.
 *
 * @typedef {object} DonacionDetalle
 * @property {string} id
 * @property {string} donacionId
 * @property {string} descripcion
 * @property {number|null} cantidad
 * @property {string|null} unidad
 * @property {number|null} monto Solo lo llevan las donaciones de dinero; las de especie usan
 *   cantidad y unidad.
 * @property {string|null} loteId Con valor cuando la linea entro al inventario como lote.
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// --- Proyectos ------------------------------------------------------------------------------

/**
 * Fila de `proyectos` (00007_proyectos.sql; orden_columna lo agrega la 00029).
 *
 * `estado` es `estado_proyecto`, no `estado_jornada`: son dos enums distintos aunque compartan
 * el valor 'en curso'.
 *
 * @typedef {object} Proyecto
 * @property {string} id
 * @property {string} nombre
 * @property {string|null} descripcion
 * @property {string|null} fechaInicio
 * @property {string|null} fechaFin
 * @property {string|null} responsableId
 * @property {EstadoProyecto} estado
 * @property {number} porcentajeAvance
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} ordenColumna
 */

/**
 * Fila de `proyecto_estado_historial` (00029_kanban_proyectos_historial.sql). Como la de
 * jornadas, solo la escribe un trigger.
 *
 * @typedef {object} ProyectoEstadoHistorial
 * @property {string} id
 * @property {string} proyectoId
 * @property {EstadoProyecto|null} estadoAnterior
 * @property {EstadoProyecto} estadoNuevo
 * @property {string|null} cambiadoPor
 * @property {string} createdAt
 */

/**
 * Fila de `proyecto_hitos` (00053_seguimiento_avance_proyectos.sql). `fecha_real` en null
 * significa que el hito todavia no se cumplio.
 *
 * @typedef {object} ProyectoHito
 * @property {string} id
 * @property {string} proyectoId
 * @property {string} nombre
 * @property {string|null} descripcion
 * @property {string} fechaPrevista
 * @property {string|null} fechaReal
 * @property {string|null} registradoPor
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Fila de `proyecto_seguimiento` (00053_seguimiento_avance_proyectos.sql): cada nota de avance,
 * con el porcentaje antes y despues.
 *
 * @typedef {object} ProyectoSeguimiento
 * @property {string} id
 * @property {string} proyectoId
 * @property {string|null} nota
 * @property {number|null} porcentajeAnterior
 * @property {number|null} porcentajeNuevo
 * @property {string|null} registradoPor
 * @property {string} createdAt
 */

// --- Presupuestos ---------------------------------------------------------------------------

/**
 * Fila de `gastos` (00025_presupuesto_gastos.sql; motivo_rechazo lo agrega la 00071).
 *
 * No hay tabla de presupuestos: el techo es `jornadas.presupuesto_asignado` y los gastos cuelgan
 * de la jornada. `responsable_id` se llamo `encargado_id` hasta la 00092 y `aprobado_en` se llamo
 * `fecha_aprobacion` hasta la 00094.
 *
 * @typedef {object} Gasto
 * @property {string} id
 * @property {string} jornadaId
 * @property {string} concepto
 * @property {CategoriaGasto} categoria
 * @property {number} monto
 * @property {string} fecha
 * @property {string|null} responsableId
 * @property {EstadoGasto} estado
 * @property {string} registradoPor Quien capturo el gasto, distinto de responsableId, que es
 *   quien lo asume.
 * @property {string|null} aprobadoPor
 * @property {string|null} aprobadoEn
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} motivoRechazo
 */

// --- Auditoria ------------------------------------------------------------------------------

/**
 * Fila de `eventos_auditoria` (00026_auditoria_borrado_logico.sql).
 *
 * Unica tabla con `id` autoincremental -departamentos y municipios tambien lo tienen entero, pero
 * se lo asigna la migracion que los carga- y unica con marca de tiempo propia (`realizado_en`) en
 * vez de created_at.
 *
 * @typedef {object} EventoAuditoria
 * @property {number} id
 * @property {string} tablaAfectada
 * @property {string} filaId
 * @property {string} operacion Enum `operacion_auditoria`. Es el unico enum del esquema sin
 *   constante en enums.js, que lo deja fuera a proposito porque ningun archivo de packages/ lo
 *   nombra.
 * @property {string|null} realizadoPor
 * @property {string} realizadoEn
 * @property {object|null} valoresAnteriores
 * @property {object|null} valoresNuevos
 */

// Este archivo no exporta valores -son todos comentarios-, pero tiene que ser un modulo de todos
// modos: TypeScript solo considera exportados los `@typedef` de un archivo que ya sea modulo, y
// un .js sin un solo import ni export es un script global. Sin esta linea, `export * from
// "./types/index.js"` en el barril no propaga nada y `import("@ecopac/shared").Paciente` falla con
// "has no exported member". Cuando el archivo fue types/index.ts eso no se notaba, porque un .ts
// es modulo por serlo.
export {};
