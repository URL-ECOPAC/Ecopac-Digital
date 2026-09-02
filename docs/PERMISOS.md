# Permisos por rol - Ecopac Digital

Quien puede hacer que, en cada modulo, y **donde esta escrito**. Este documento existe porque la
matriz de permisos vivia solo en un PDF (`docs/entregables/Entregable Semana 6.pdf`, seccion
"Matriz de Permisos por Rol") y cada issue la reinterpretaba por su cuenta.

## Que manda cuando algo no coincide

1. **`supabase/migrations/` manda sobre este documento.** Si una politica dice una cosa y esta
   tabla dice otra, la politica tiene razon y esta tabla tiene un error que hay que corregir.
2. **Este documento se actualiza en el mismo PR que cambia una politica.** No despues. Un PR que
   agrega, quita o modifica una politica RLS o un `GRANT` y no toca este archivo esta incompleto.
3. Cuando el PDF del entregable y el criterio acordado con la organizacion difieren, **manda el
   criterio acordado**, que es posterior. Los dos casos donde eso pasa estan anotados abajo.

Notacion de las tablas: **C** crear, **R** leer, **U** actualizar, **A** aprobar,
**—** sin acceso. Cuando lo que hay hoy no coincide con lo que deberia haber, la celda lleva un
aviso y la fila correspondiente aparece en "Divergencias".

## Los cinco roles

Los define el enum `rol_usuario` de `00001_initial_schema.sql`. Los valores son **en minusculas y
con espacios**; escribirlos de otra forma es un error que no falla hasta tiempo de ejecucion:

| Valor del enum       | Etiqueta en la interfaz | Que es                                                    |
| -------------------- | ----------------------- | --------------------------------------------------------- |
| `administrador`      | Administradora          | Acceso total. Es quien aprueba lo que registran los demas |
| `junta directiva`    | Junta directiva         | Gobernanza, solo lectura y solo de agregados              |
| `socio fundador`     | Socio fundador          | **Identico a junta directiva**                            |
| `medico`             | Medico                  | Operacion clinica en jornada                              |
| `voluntario general` | Voluntario              | Apoyo en campo: pacientes y triaje, sin clinica           |

En el codigo se usan siempre desde `packages/shared/usuarios/roles.js`, que replica el enum y
publica `ROLES`, `ROLES_CONSULTIVOS`, `esAdministrador()` y `esConsultivo()`. **Nunca se escribe un
rol como string suelto.**

> **Los dos roles consultivos son el mismo permiso.** `junta directiva` y `socio fundador` tienen
> exactamente los mismos derechos: es decision del equipo, y es la razon de ser de la funcion
> `es_consultivo()` que pide la issue #404. Hoy no existe, y el olvido esta medido: de las
> politicas del esquema, **siete nombran a `junta directiva` y solo una nombra a `socio fundador`**
> (la de lectura de `gastos`). Un socio fundador ve cuatro modulos en el menu y recibe cero filas
> en casi todos.

## Las cuatro capas, y cual protege de verdad

El sistema decide permisos en cuatro sitios. **Solo el ultimo protege.**

| #   | Capa                         | Donde vive                                  | Que hace                                               | Protege?                                                 |
| --- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| 1   | Navegacion                   | `packages/shared/navegacion.js`             | Decide que modulos aparecen en el menu                 | **No.** Ocultar una opcion no impide llegar a la ruta    |
| 2   | Guard de rutas               | `apps/web/src/components/RutaProtegida.jsx` | Corta la navegacion a una ruta cuyo rol no alcanza     | **No.** Es del lado del cliente; se salta con la consola |
| 3   | `permisos.js` de cada modulo | `packages/shared/<modulo>/permisos.js`      | Decide que botones se dibujan y cuales se deshabilitan | **No.** Es presentacion                                  |
| 4   | **RLS + GRANT**              | `supabase/migrations/`                      | Decide que filas devuelve y acepta la base             | **Si. Es la unica.**                                     |

Las capas 1 a 3 existen para que la interfaz no ofrezca lo que va a fallar. Si una de ellas dice
que si y la capa 4 dice que no, el usuario ve un error; si dice que no y la capa 4 diria que si,
la funcion es inalcanzable. Las dos situaciones son defectos, y las que hay estan en
"Divergencias".

### Un perfil desactivado no tiene rol efectivo (issue #529)

`perfiles.activo` era hasta la `00079` un control de **cliente**: la aplicacion lo respetaba y la
capa 4 no lo miraba. Una cuenta dada de baja conservaba un JWT valido y la base le seguia
entregando filas -comprobado: leyo la tabla `pacientes`-.

Desde la `00079`, **`rol_actual()` devuelve NULL para un perfil desactivado**, y con ella
`es_administrador()` devuelve FALSE. Como de esas dos cuelgan 77 de las 104 politicas del esquema,
dar de baja a alguien le retira el acceso de verdad. Se blindaron ademas las otras cuatro vias que
no pasaban por ahi:

- `tiene_permiso()` y `participa_en_jornada()`, que resolvian por `auth.uid()` sin mirar `activo`.
- La politica de UPDATE de `perfiles`, que dejaba a un desactivado **reactivarse a si mismo**
  -`impedir_autodesactivacion()` de la `00072` solo bloquea *poner* `activo = FALSE`-. Era la via
  que anulaba el arreglo entero.
- Las quince politicas de lectura que decian `USING (true)`, que dejaban leer catalogos e
  inventario a cualquier sesion.

**Lo unico que un perfil desactivado conserva es leer su propia fila de `perfiles`**, y es
deliberado: es como `evaluarPerfilDeSesion()` averigua que la cuenta esta de baja para decirlo en
pantalla en vez de responder un "permiso denegado" que no explica nada.

Una cosa que el arreglo **no** alcanza, y conviene tener escrita:

- El token ya emitido **no se revoca**: deja de servir para leer o escribir, pero existe hasta que
  expire (`jwt_expiry`). Invalidarlo exige la Admin API de GoTrue.

(Las siete politicas de donaciones leian el rol de `auth.jwt() -> app_metadata`, no de
`perfiles` -era la Divergencia 1, issue #403-, asi que tampoco pasaban por `rol_actual()` y
quedaban fuera de este arreglo. La `00083` las corrigio a `es_administrador()`/`es_consultivo()`:
desde ahi ya heredan el mismo blindaje que las demas 77 politicas.)

Nota para quien lea la `00072`: el comentario de su cabecera justifica el `SECURITY DEFINER` de
`impedir_dejar_sin_administrador_activo()` diciendo que "la unica forma de que `OLD.rol` ya sea
'administrador' en la fila propia es que la sesion actual lo sea, porque `rol_actual()` lee la
fila ya confirmada". **Ese razonamiento dejo de ser cierto con la `00079`**: ahora podria ser un
administrador desactivado. No hay defecto -el `SECURITY DEFINER` es justo lo que lo salva-, pero
la migracion esta aplicada y no se edita.

> **La prueba de que la capa 4 basta:** la app movil **no aplica hoy ningun control de acceso por
> rol** (issue #427) -su navegador registra las mismas pantallas para los cinco roles-, y aun asi
> los datos siguen protegidos, porque la base sigue negando. Lo que falla ahi es la experiencia:
> el usuario llega a una pantalla que se le va a vaciar.

## La matriz

### Pacientes y clinica

| Tabla                     | administrador | junta directiva / socio fundador | medico | voluntario general | Como se implementa                                                                                                     |
| ------------------------- | ------------- | -------------------------------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pacientes`               | C R U         | —                                | C R U  | C R                | `00032` + `00086` (editar paso de `rol_actual() = 'medico'` a `tiene_permiso('pacientes.editar')`, que medico recibe por rol desde la `00003`). Sin DELETE para nadie; ademas el trigger de `00026` bloquea el borrado fisico |
| `expedientes`             | C R U         | —                                | C R U  | C R                | `00032` + `00086`, mismo cambio                                                                                       |
| `triajes`                 | C R U         | —                                | C R U  | C R U              | `00033`. El voluntario crea y corrige el triaje; el `imc` es columna generada y no se envia                            |
| `atenciones`              | C R U         | —                                | C R U  | C R                | `00033`; cola de la jornada en `00060`                                                                                 |
| `consultas`               | C R U         | —                                | C R U  | —                  | `00033`. El INSERT exige `medico_id = auth.uid()` **y** `participa_en_jornada()`; el UPDATE, ser el medico que atendio |
| `consulta_diagnostico`    | C R           | —                                | C R    | —                  | `00033`                                                                                                                |
| `recetas`                 | C R U         | —                                | C R U  | —                  | `00033`; anulacion en `00066`. El UPDATE exige ser el medico que la firmo **y** que siga `emitida` (`00075`)           |
| `receta_detalle`          | C R           | —                                | C R    | —                  | `00033`                                                                                                                |
| `padecimientos_cronicos`  | C R U D       | —                                | C R U  | —                  | `00010`. Unica tabla clinica con DELETE, y solo para administrador. Auditada desde la `00070`                          |
| `diagnosticos` (catalogo) | C R U         | —                                | R      | —                  | `00033` (lectura) + `00105` (mantenimiento). Hasta la `00105` era un catalogo VACIO y de solo lectura -nadie lo podia poblar por la API-, asi que el paso "diagnostico CIE-10" del flujo clinico no existia; esa migracion siembra el conjunto inicial y deja el mantenimiento a la administradora. **Sin DELETE:** `consulta_diagnostico` lo referencia `ON DELETE RESTRICT` (`00018`) y un diagnostico ya usado es historia clinica |
| `fusiones_pacientes`      | R             | —                                | —      | —                  | `00101` (issue #140). Solo administrador lee; sin politicas de escritura, la unica que inserta es `fn_fusionar_pacientes()` (SECURITY DEFINER) |

**Ninguna tabla clinica tiene politica de DELETE** (salvo `padecimientos_cronicos`). La baja es
logica, no fisica. En `padecimientos_cronicos` esa excepcion existe para corregir un alta
equivocada, no para dar de alta a un paciente de su condicion: para eso se pasa el estado a
`resuelta`, que es lo que hace `desasociarCondicion()` en `packages/shared/pacientes`. Por ser el
unico borrado real del esquema clinico, la `00070` le puso el trigger de auditoria que la `00026`
le habia dejado fuera.

> **Los roles consultivos no leen ninguna fila clinica, y es deliberado.** `00041` les habia dado
> lectura sobre `atenciones`, `consultas`, `recetas` y `receta_detalle` para que cuadrara un
> reporte; **`00054` la retiro** (issue #407). El motivo esta en la seccion de reglas: RLS filtra
> filas, no columnas. Los agregados les llegan por vista.
>
> Aqui el PDF del entregable quedo desactualizado: concede a junta directiva el "listado de
> pacientes". El criterio vigente es que **nunca ven pacientes identificables**.

> **El voluntario no accede a consultas ni recetas, ni siquiera para leer.** Es lo que dice el PDF
> (`-` en las dos filas) y su descripcion de rol -"no accede a diagnosticos ni consultas medicas
> completas"-, y es coherente con la regla de `00054`: una politica de lectura le entregaria
> sintomas, tratamiento y observaciones enteros.

Reflejo en el cliente: `pacientes/permisos.js` (issue #396), que tambien absorbio
`puedeVerHistorial` y `puedeCorregirTriaje`/`puedeTomarTriaje`, sueltas hasta ahora fuera de un
`permisos.js`. `pacientes/condiciones.permisos.js` cubre `padecimientos_cronicos` por separado.

`fn_detectar_pacientes_duplicados()` (`00101`, issue #140) es SECURITY INVOKER: la ve quien ya
puede leer `pacientes` (administrador, medico, voluntario general), porque el criterio de
aceptacion no restringe la lectura de posibles duplicados, solo la fusion. `fn_fusionar_pacientes()`
si es SECURITY DEFINER con el chequeo de administrador escrito en su cuerpo -mismo motivo que
`fn_reporte_pacientes_atendidos` mas abajo-: tiene que quedar mas restringida que la politica
UPDATE de `pacientes` (que tambien alcanza a medico via `pacientes.editar`, `00086`). Reasigna
`atenciones`, `padecimientos_cronicos` y `consultas` del expediente absorbido al sobreviviente
dentro de una sola transaccion, salvo la fila puntual que chocaria con una restriccion UNIQUE del
sobreviviente (misma jornada ya atendida, misma condicion cronica ya registrada): esa se conserva
sin reasignar, bajo el absorbido. Reflejo en el cliente: `puedeFusionarPacientes()` en
`pacientes/permisos.js`.

### Inventario

| Tabla                    | administrador | junta directiva / socio fundador | medico | voluntario general | Como se implementa                                                                                          |
| ------------------------ | ------------- | -------------------------------- | ------ | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `medicamentos`           | C R U         | R                                | R      | R                  | `00034`, alta por `fn_registrar_medicamento` (`00050`). La lectura la endurecio la `00079` a `rol_actual() IS NOT NULL`: un perfil desactivado deja de verla |
| `principios_activos`     | C R U D       | R                                | R      | R                  | `00034` + `00046`                                                                                           |
| `medicamento_principio`  | C R           | R                                | R      | R                  | `00034`                                                                                                     |
| `lotes`                  | C R U         | R                                | C R U\* | C R U\*            | `00034` + `00107`. \*Medico y voluntario dan de alta el lote que acompania a su ingreso, pero **nace provisional** (`confirmado = FALSE`) y solo lo pueden editar mientras siga asi; al aprobar el ingreso pasa a firme y deja de ser suyo. La politica les exige ademas `registrado_por = auth.uid()`. **Sin DELETE para nadie** |
| `existencias`            | C R U         | R                                | R      | R                  | `00034`; disponibilidad por `fn_existencias_disponibles` (`00065`)                                          |
| `bodegas`                | C R U         | R                                | R      | R                  | `00034`, con la lectura endurecida por la `00079` a `rol_actual() IS NOT NULL`. Las politicas duplicadas de la `00061`/`00062` las retiro esa misma migracion (era la Divergencia 12). **Sin DELETE para nadie**, y no solo por politica: la `00034` nunca otorgo `GRANT DELETE`, asi que el borrado muere en `42501` antes de llegar a RLS. Cubierto rol por rol en `politicas_rls_inventario.sql` (issue #513)                                                          |
| `proveedores`            | C R U         | R                                | R      | R                  | `00034`, con la lectura endurecida por la `00079` a `rol_actual() IS NOT NULL`. Las politicas duplicadas de la `00061`/`00062` las retiro esa misma migracion (era la Divergencia 12). **Sin DELETE para nadie**, y no solo por politica: la `00034` nunca otorgo `GRANT DELETE`, asi que el borrado muere en `42501` antes de llegar a RLS. Cubierto rol por rol en `politicas_rls_inventario.sql` (issue #513)                                                                             |
| `alertas_caducidad`      | R U           | R                                | R      | R                  | `00034`. Sin INSERT para nadie: las genera una rutina con `service_role`                                    |
| `movimientos_inventario` | R U **A**     | R                                | C R U\* | C R U\*            | `00034` + `00048` + `00086` (aprobar admite tambien `tiene_permiso('inventario.aprobar')`) + `00106`. \*Solo el **propio** movimiento y solo mientras siga `pendiente` |

**El circuito de aprobacion del inventario** es el patron central del modulo: medico y voluntario
crean un movimiento y la politica de INSERT (`00034`) les exige `estado = 'pendiente'` y
`registrado_por = auth.uid()`. El trigger `fn_autoaprobar_movimiento_inventario` (`00047`) hace
nacer ya aprobado lo que registra el propio administrador.

**De quien es un movimiento, y hasta cuando** (`00106`, issue #625). La propiedad cambia con el
estado, y con ella quien puede editarlo:

| Estado                  | Quien lo edita                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `pendiente`             | Quien lo registro (y la administradora, que es quien lo resuelve) |
| `aprobado` / `rechazado`| Solo la administradora, y solo el texto                           |

Hasta la `00106` la politica de UPDATE admitia unicamente al administrador, asi que
`editarMovimiento()` -que documenta editar "si la modificacion es realizada por la misma persona
que lo registro"- **no podia funcionar para nadie mas**: el UPDATE no alcanzaba ninguna fila y
PostgREST devolvia exito sin haber cambiado nada.

Dos guardas acompanian a esa apertura:

- `fn_proteger_decision_de_movimiento` (`00106`) impide que quien registro cambie `estado` o
  escriba `aprobado_por`, `aprobado_en`, `motivo_rechazo` o `aprobacion_automatica`. **Es el que
  frena la autoaprobacion**, y no el `WITH CHECK` de la politica: los triggers `BEFORE` corren
  antes de que Postgres evalue el `WITH CHECK`, asi que el error que se ve es un `P0001`, no un
  `42501`.
- `fn_bloquear_movimiento_finalizado` (`00023`, reescrita por la `00106`) congela `tipo`,
  `lote_id`, `bodega_id`, `cantidad`, `estado` y `registrado_por` de un movimiento ya resuelto
  **incluso para la administradora**: eso ya ajusto existencias y se corrige con un movimiento
  compensatorio, no reescribiendo la historia. Lo que si puede corregir ella es el texto
  (`motivo`, `motivo_rechazo`), que antes tambien quedaba congelado sin que eso protegiera
  ninguna integridad. El DELETE sigue prohibido para todos.

Reflejo en el cliente: `inventario/medicamentos.permisos.js`, `lotes.permisos.js`,
`bodegas.permisos.js`, `principios-activos.permisos.js`, y `inventario/permisos.js` para
`movimientos_inventario` (issue #396).

### Jornadas

| Tabla                      | administrador | junta directiva / socio fundador | medico         | voluntario general | Como se implementa                                                           |
| -------------------------- | ------------- | -------------------------------- | -------------- | ------------------ | ---------------------------------------------------------------------------- |
| `jornadas`                 | C R U         | R (solo junta directiva)         | R si participa | R si participa     | `00039`. Crear y editar admite tambien `tiene_permiso('jornadas.gestionar')` |
| `jornada_personal`         | C R U D       | R (solo junta directiva)         | R la propia    | R la propia        | `00039` + `00044`                                                            |
| `jornada_estado_historial` | R             | —                                | —              | —                  | `00039`. Lo escribe un trigger DEFINER, nadie por la API                     |

La transicion de estados la valida `fn_validar_transicion_estado_jornada` (`00051`), que deja
reabrir una jornada finalizada **solo al administrador**. Reflejo en el cliente:
`jornadas/permisos.js`.

### Proyectos y presupuestos

| Tabla                       | administrador | junta directiva / socio fundador | medico           | voluntario general | Como se implementa                                                |
| --------------------------- | ------------- | -------------------------------- | ---------------- | ------------------ | ----------------------------------------------------------------- |
| `proyectos`                 | C R U         | R (solo junta directiva)         | —                | —                  | `00039` + `00086` (crear/editar, y tambien SU LECTURA, admiten `tiene_permiso('proyectos.gestionar')`: sin eso, `INSERT ... RETURNING` -patron real de `crearProyecto()`- falla igual aunque el `WITH CHECK` del INSERT ya lo permita) |
| `proyecto_hitos`            | C R U D       | R (solo junta directiva)         | —                | —                  | `00053`                                                           |
| `proyecto_seguimiento`      | C R           | R (solo junta directiva)         | —                | —                  | `00053`                                                           |
| `proyecto_estado_historial` | R             | —                                | —                | —                  | `00039`                                                           |
| `gastos`                    | C R **A**     | R                                | C R si participa | C R si participa   | `00052`. Unica tabla donde `socio fundador` aparece por su nombre |

`gastos` es el otro circuito de aprobacion: quien participa en la jornada registra en estado
`pendiente` y a su nombre; aprobar es un UPDATE que exige `es_administrador()` o
`tiene_permiso('presupuestos.aprobar')`. El trigger `fn_autoaprobar_gasto_administrador`
(`00109`, espejo de `fn_autoaprobar_movimiento_inventario`) hace nacer ya aprobado el gasto que
inserta el propio administrador, sin ajuste de existencias: un gasto no mueve inventario
(`00089`). Reflejo en el cliente: `presupuestos/permisos.js` y `donaciones/proyectos.permisos.js`.

### Donaciones

| Tabla              | administrador | junta directiva / socio fundador | medico | voluntario general | Como se implementa                                       |
| ------------------ | ------------- | -------------------------------- | ------ | ------------------ | --------------------------------------------------------- |
| `donantes`         | C R U         | R                                | —      | —                  | `00083` + `00086` (registrar Y SU LECTURA admiten `tiene_permiso('donaciones.registrar')`, mismo motivo que `proyectos`: `registrarDonante()` hace `.insert().select()`). `es_administrador()` escribe, `es_consultivo()` o el permiso fino leen |
| `donaciones`       | C R U         | R                                | —      | —                  | `00083` + `00086`, mismo cambio. La anulacion (UPDATE) exige `estado = 'anulada'` y `motivo_anulacion` |
| `donacion_detalle` | C R           | R                                | —      | —                  | `00083` + `00086`, mismo cambio. Sin UPDATE para nadie: el detalle no se corrige, se anula la donacion completa |

Hasta la `00083`, las tres tablas estaban **denegadas a los cinco roles, incluido el
administrador**, por dos motivos independientes que detalla la Divergencia 1 (resuelta).

### Usuarios y permisos

| Tabla                 | administrador | junta directiva / socio fundador | medico      | voluntario general | Como se implementa                             |
| --------------------- | ------------- | -------------------------------- | ----------- | ------------------ | ---------------------------------------------- |
| `perfiles`            | C R U         | R el propio                      | R el propio | R el propio        | `00038`. Cada quien lee y edita solo su perfil. La fila la crea el trigger de la `00002`, que desde la `00074` rechaza el alta si viene del registro publico |
| `perfil_especialidad` | C R D         | R                                 | C R D la propia | C R D la propia | `00058`, `00085`. `es_administrador()` lee/escribe cualquiera; `es_consultivo()` solo lee cualquiera; cada perfil crea y borra las suyas. Sin UPDATE: la PK incluye el nombre, cambiar una especialidad es borrar e insertar |
| `permisos`            | R             | R                                | R           | R                  | `00038`. Catalogo de solo lectura              |
| `rol_permiso`         | R             | R                                | R           | R                  | `00038`. Solo lectura                          |
| `usuario_permiso`     | C R U D       | R el propio                      | R el propio | R el propio        | `00038`, con auditoria en `00045`; escribir Y LEER LA FILA AJENA QUE SE ACABA DE ESCRIBIR admiten `tiene_permiso('usuarios.gestionar_permisos')` desde `00086` |
| `eventos_auditoria`   | R             | —                                | —           | —                  | `00026`. Lo escriben triggers DEFINER          |

**Nadie puede cambiar su propio rol.** Eso no lo impide una politica -RLS no puede comparar el
valor viejo con el nuevo- sino el trigger `impedir_cambio_de_rol_propio` (`00038`), que lanza
`insufficient_privilege`.

**Nadie se da de alta a si mismo.** Issue #508, migracion `00074`. El trigger
`trg_auth_users_crear_perfil` de la `00002` creaba el perfil de toda cuenta nueva con el rol por
defecto `voluntario general` y `activo = TRUE`, y el registro publico de GoTrue estaba abierto:
cualquiera con la llave anonima obtenia escritura sobre pacientes, expedientes, atenciones y
triajes. Ahora ese trigger rechaza el alta salvo que venga de una migracion o traiga la marca
administrativa en `raw_app_meta_data`, que el cliente no puede escribir. La via de alta es
`fn_crear_usuario_administrativo()`, que no se le concede a ningun rol de la aplicacion. Detalle
en `docs/SEGURIDAD.md`, "Alta de cuentas".

**Nadie puede desactivar su propia fila, y nunca puede quedar el sistema sin ningun
administrador activo.** Issue #107, migracion `00072`, mismo patron que el trigger anterior
(`BEFORE UPDATE`, no puede ser una politica). Dos triggers nuevos sobre `perfiles`:

- `impedir_autodesactivacion` bloquea `UPDATE perfiles SET activo = false` cuando `id =
  auth.uid()`. Es mas amplio que el criterio 4 del issue, que solo habla del administrador:
  aplica a los cinco roles por igual, porque la politica de UPDATE de `00038` ya le permite a
  cualquiera desactivar su propia fila y no hay ningun flujo legitimo que dependa de eso.
- `impedir_dejar_sin_administrador_activo` bloquea desactivar **o** cambiarle el rol al ultimo
  administrador activo -las dos puertas del mismo escenario de bloqueo total-, contando sobre
  toda la tabla con un `pg_advisory_xact_lock` para que dos desactivaciones concurrentes no lo
  esquiven.

Los dos lanzan `check_violation` (`23514`), no `insufficient_privilege` (`42501`) como el
trigger de rol: `errores-de-supabase.js` traduce `42501` a "pideselo a la administradora", que
no tiene sentido cuando quien esta bloqueada ya es la administradora.

**Ninguno de los dos cubre el `DELETE`.** `perfiles.id` es `FK` a `auth.users(id) ON DELETE
CASCADE` (`00002`): borrar al ultimo administrador desde el Dashboard de Supabase o la Admin
API de GoTrue borra `auth.users` y en cascada su perfil sin pasar por ningun `BEFORE UPDATE`,
dejando el sistema sin administrador igual. Ver Divergencia 15.

### Territorio y catalogos

| Tabla                  | Quien lee             | Como se implementa                                                     |
| ---------------------- | --------------------- | ------------------------------------------------------------------------ |
| `departamentos`        | cualquier autenticado | `00006` (politica) + `00073` (GRANT, issue #406 resuelto)                |
| `municipios`           | cualquier autenticado | Igual que departamentos                                                  |
| `comunidades`          | cualquier autenticado | `00008` (politica) + `00041` (GRANT). La politica de `00041` se retiro en `00104`: era redundante con la de `00008`, ver Divergencia 10 (resuelta) |
| `condiciones_cronicas` | cualquier autenticado | `00010`                                                                  |

### Reportes: las vistas

Los roles consultivos no leen filas clinicas, asi que sus reportes llegan por **vista**, no por
tabla:

| Vista                     | Modo                    | Quien la lee                                                                       | Migracion                 |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| `vista_reporte_impacto`   | **DEFINER**             | administrador, los dos consultivos y quien tiene `reportes.exportar`, por el `WHERE` | `00027`, `00054`, `00064`, `00080`, `00086` |
| `pacientes_reporte`       | **DEFINER**             | administrador, los dos consultivos y quien tiene `reportes.exportar`, por el `WHERE`. Solo expone `id` y `comunidad_id` | `00041`, `00080`, `00086` |
| `perfiles_directorio`     | **DEFINER**             | administrador, junta directiva y el propio; enmascara telefono y correo            | `00038`                   |
| `vista_cola_jornada`      | **DEFINER**             | administrador y quien participa en la jornada                                      | `00060`                   |
| `vista_lotes_disponibles` | `security_invoker=true` | cualquier autenticado, con su propia RLS                                           | `00024`, `00041`, `00047` |
| `privilegios_de_anon`     | DEFINER                 | nadie: es una guarda de CI                                                         | `00056`                   |
| `tablas_sin_rls`          | DEFINER                 | nadie: es introspeccion                                                            | `00030`                   |

`fn_reporte_pacientes_atendidos` (`00067`, guarda actualizada en `00080` y `00086`) es la unica
funcion de negocio con la comprobacion de rol escrita en su cuerpo, porque es DEFINER y tiene que
sustituir a la politica que no la protege.

Reflejo en el cliente: `reportes/permisos.js` (issue #396), que absorbio
`puedeVerIndicadoresDeImpacto` y `puedeVerReporteDePacientes`, sueltas hasta ahora fuera de un
`permisos.js`. Este ultimo excluye a socio fundador a proposito, espejo de la guarda de
`fn_reporte_pacientes_atendidos`.

## Los permisos finos

Junto al rol base hay un mecanismo de excepciones **por persona**: tres tablas de `00003`
\-`permisos`, `rol_permiso`, `usuario_permiso`- y la funcion `tiene_permiso(clave)` de `00004`, que
resuelve primero la concesion o revocacion puntual del usuario y, si no hay ninguna, cae al valor
por defecto de su rol.

Sirve para lo que el rol base no sabe expresar: **darle a una persona concreta una atribucion que
su rol no tiene, sin cambiarle el rol.**

| Permiso                       | Por defecto lo tienen                          | Gobierna alguna politica?                                                             |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `jornadas.gestionar`          | administrador                                  | **Si** — INSERT y UPDATE de `jornadas` (`00039`)                                     |
| `presupuestos.registrar`      | administrador                                  | **Si** — INSERT de `gastos` (`00052`)                                                |
| `presupuestos.aprobar`        | administrador                                  | **Si** — UPDATE de `gastos` (`00052`)                                                |
| `pacientes.editar`            | administrador, medico                          | **Si** — UPDATE de `pacientes` y `expedientes` (`00086`)                             |
| `inventario.aprobar`          | administrador                                  | **Si** — UPDATE de `movimientos_inventario` (`00086`)                                |
| `donaciones.registrar`        | administrador                                  | **Si** — INSERT de `donantes`, `donaciones` y `donacion_detalle` (`00086`)           |
| `proyectos.gestionar`         | administrador                                  | **Si** — INSERT y UPDATE de `proyectos` (`00086`)                                    |
| `usuarios.gestionar_permisos` | administrador                                  | **Si** — INSERT/UPDATE/DELETE de `usuario_permiso` (`00086`)                         |
| `reportes.exportar`           | administrador, junta directiva, socio fundador | **Si** — `vista_reporte_impacto`, `pacientes_reporte`, `fn_reporte_pacientes_atendidos` (`00086`) |

**Los nueve permisos gobiernan de verdad una politica.** Concederlos o revocarlos en
`usuario_permiso` cambia lo que el servidor permite. Resuelto por la issue #409 (migracion
`00086`).

Consecuencia practica: `permisos` y `rol_permiso` son de **solo lectura** para todos: no hay
forma de anadir un permiso ni de cambiar el default de un rol desde la aplicacion, solo por
migracion. `usuario_permiso` si tiene CRUD completo y auditoria propia, asi que la excepcion por
persona si es manejable.

Guardia asociado: ningun permiso fino de escritura puede concederse a un perfil `junta
directiva` o `socio fundador` (son consultivos por definicion). Ver la regla dedicada mas abajo.

## Las reglas que explican el diseno

**RLS filtra filas, no columnas.** Una politica `FOR SELECT` entrega la fila entera; no existe
"que lea solo estas dos columnas". Por eso un rol que solo debe ver agregados **no puede recibir
una politica sobre la tabla clinica**: se le da una **vista SECURITY DEFINER** con el filtro en su
`WHERE`. Es el patron de `00038`, `00041`, `00054` y `00060`. Ignorarlo fue exactamente el defecto
de `00041` que corrigio `00054`.

**Hacen falta las dos capas: `GRANT` y politica.** El `GRANT` decide si el rol puede tocar la tabla;
la politica, que filas. Sin `GRANT`, PostgREST devuelve `42501` y la politica no llega a evaluarse.
Cinco tablas del esquema tienen politicas y ningun `GRANT`, y por eso estan muertas.

**Las politicas son permisivas y se combinan con OR.** Anadir una politica nunca restringe: solo
puede ampliar. Para restringir hay que **quitar** la que sobra, como hizo `00054`.

**`anon` no tiene nada.** `00049` y `00056` revocan todos los privilegios del rol anonimo sobre el
esquema publico, y la vista `privilegios_de_anon` mas su prueba pgTAP lo vigilan en cada PR. Ojo:
RLS **no cubre `TRUNCATE`**; los `GRANT` son la unica defensa contra el.

**Como se comprueba una negativa, que no es igual en los tres comandos.** Un `INSERT` que no pasa
el `WITH CHECK` **lanza 42501**. Un `UPDATE` o un `DELETE` que no pasan el `USING` **corren sin
afectar filas**, en silencio, y PostgREST responde 204. Una prueba que espere un error donde solo
hay cero filas pasa en verde sin comprobar nada.

**La escalada de rol la para un trigger, no una politica**, porque una politica no puede comparar
el valor viejo con el nuevo (`impedir_cambio_de_rol_propio`, `00038`). Lo mismo vale para
autodesactivarse y para quedarse sin ningun administrador activo
(`impedir_autodesactivacion` / `impedir_dejar_sin_administrador_activo`, `00072`): ninguna de
las dos preguntas ("¿el rol cambio?", "¿quedaria alguien mas?") se puede expresar en un `USING`
o un `WITH CHECK`.

**Conectar un permiso fino a un INSERT/UPDATE no alcanza si el cliente pide `RETURNING`.**
Cuando el comando lleva `RETURNING` -el patron real de `supabase-js`, `.insert(...).select()`,
usado por `crearProyecto()` y `registrarDonante()`-, Postgres exige ademas que la fila pase una
politica de **SELECT**: si no la pasa, el `INSERT` entero falla con "new row violates row-level
security policy", **aunque el `WITH CHECK` del INSERT ya lo permitiera**. Se encontro probando
en vivo contra Postgres real (issue #409): un `INSERT` sin `RETURNING` en una prueba pgTAP pasa
en verde y no lo detecta. Por eso la `00086` amplio con el mismo `OR tiene_permiso(...)` tanto
la politica de escritura como la de lectura de `proyectos`, `donantes`, `donaciones`,
`donacion_detalle` y `usuario_permiso`. Al conectar un permiso fino nuevo a una politica de
escritura, la prueba pgTAP correspondiente debe usar `RETURNING` (o `.select()` si se prueba
contra la API real) para que este defecto no se repita en silencio.

**Ningun permiso fino puede convertir a un rol consultivo en escritor.** Mismo motivo que la
regla anterior: la pregunta es sobre el rol del *perfil objetivo* de la fila de
`usuario_permiso`, no sobre quien ejecuta la operacion, asi que tampoco es expresable en un
`USING`/`WITH CHECK`. El trigger `impedir_permiso_escritura_a_consultivo` (`00086`) bloquea
conceder cualquier permiso salvo `reportes.exportar` (el unico de lectura) a un perfil `junta
directiva` o `socio fundador`.

## Como se comprueba que esta matriz es cierta

No basta con leer las migraciones: lo que vale es lo que responde la base. Las celdas de esta
matriz estan cubiertas por las suites pgTAP de `supabase/tests/database/`, que **corren en cada
PR** dentro del job "Validar migraciones y funciones". Entre otras, ya afirman que
`voluntario general` no lee consultas ni recetas, y que `junta directiva` no accede a atenciones,
consultas ni recetas.

Para comprobar una celda a mano contra la base local, el patron es el de esas suites:

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '<uuid del perfil>';
SELECT count(*) FROM consultas;   -- 0 filas = la politica lo niega
```

Dos avisos al escribir una comprobacion nueva, porque los dos han producido pruebas que pasaban
sin comprobar nada:

- **Cero filas no es lo mismo que un error.** Si falta el `GRANT`, sale `42501`; si el `GRANT`
  esta y lo que niega es la politica, la consulta corre y devuelve cero filas. La negativa se
  comprueba distinto en cada caso.
- **El rol de un perfil no se puede cambiar ni siquiera para preparar una prueba** sin desactivar
  antes el trigger `trg_perfiles_impedir_cambio_de_rol_propio`, como hace `00063`.

## Divergencias

Lo que hoy no coincide con la matriz. Cada fila con la issue que la cierra, cuando existe.

| #   | Divergencia                                                                                                                                                                                                                                                                                                           | Efecto                                                                                                                                               | Issue                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | ~~Las tres tablas de donaciones leian el rol de `auth.jwt() -> 'app_metadata' ->> 'role'`, que nada en el repositorio escribe, y lo comparaban con literales capitalizados que no existen en el enum. Ademas no tenian ningun `GRANT`~~ (resuelto: `00083` las reescribe con `es_administrador()`/`es_consultivo()`, agrega el `GRANT`, quita el `FOR ALL` y corrige el valor de `estado` en la anulacion) | Denegadas a los cinco roles, administrador incluido. Bloqueaba diez issues del modulo                                                                | resuelto por **#403**        |
| 2   | `socio fundador` aparece en **una sola politica** de todo el esquema (lectura de `gastos`), frente a siete que nombran a `junta directiva`. No existe `es_consultivo()`                                                                                                                                               | Un socio fundador ve cuatro modulos en el menu y recibe cero filas en casi todos                                                                     | **#404**                     |
| 3   | `perfil_especialidad` tiene lectura desde `00058`, pero **ninguna politica ni `GRANT` de escritura**                                                                                                                                                                                                                  | Nadie puede editar especialidades, ni el administrador                                                                                               | **#405**                     |
| 4   | ~~`departamentos` y `municipios` tienen politica de lectura publica y ningun `GRANT`~~ (resuelto: `00073` agrega `GRANT SELECT ... TO authenticated` sobre las dos tablas, issue #179)                                                                                                                               | El catalogo geografico sembrado en `seed.sql` ya es legible por la API: el selector de lugar en cascada se puede armar. Sigue sin sembrarse en `ecopac-dev`/`ecopac-prod` (`db push` no corre seeds, ver docs/DATOS-DEMO.md) -- eso es un problema de datos, no de permisos, y queda fuera de esta divergencia | resuelto por **#179**        |
| 5   | ~~Seis de los nueve permisos finos no los consulta ninguna politica~~ (resuelto: `00086` conecta los seis restantes -`pacientes.editar`, `inventario.aprobar`, `donaciones.registrar`, `proyectos.gestionar`, `usuarios.gestionar_permisos`, `reportes.exportar`- y agrega el trigger que impide que un permiso fino convierta a un rol consultivo en escritor) | Concederlos o revocarlos no cambiaba nada                                                                                                            | resuelto por **#409**        |
| 6   | ~~`proyectos.permisos.js` concede administracion de proyectos a `junta directiva`~~ (resuelto: solo administrador queda en `ROLES_QUE_ADMINISTRAN_PROYECTOS`)                                                                                                                                                         | El cliente ofrece lo que la base niega                                                                                                               | #423, resuelto por **#396**  |
| 7   | El sidebar ofrece Pacientes a los dos roles consultivos                                                                                                                                                                                                                                                               | Llegan a una pantalla que la base les vacia                                                                                                          | **#426**                     |
| 8   | La app movil no aplica ningun control de acceso por rol                                                                                                                                                                                                                                                               | Los cinco roles ven las mismas pantallas; `tabsMoviles(rol)` existe en `navegacion.js` y no la usa nadie                                             | **#427**                     |
| 9   | ~~`packages/shared` exporta **dos sistemas de roles** por el mismo barril: `usuarios/roles.js` y `types/index.ts` + `utils/permisos.ts` + `hooks/usePermisos.ts`~~ (resuelto: el Modelo B se elimino entero)                                                                                                        | Un `import` desde `@ecopac/shared` expone las dos matrices en el mismo espacio de nombres. Ningun perfil real puede tener uno de esos cuatro valores | resuelto por **#396**        |
| 10  | ~~`comunidades` tiene la politica `USING (true)` de `00008` **y** la restringida de `00041`. Como son permisivas y se combinan con OR, la segunda no restringe nada~~ (resuelto: `00104` retira la de `00041`; se queda la lectura abierta de `00008`, mismo criterio que `departamentos`/`municipios`, porque `comunidades` es catalogo geografico sin dato sensible) | Cualquier autenticado lee todas las comunidades. Si `00041` pretendia limitarlo, no lo logra                                                         | resuelto por **#511**        |
| 11  | ~~`00066` agrego la anulacion de recetas sin politica propia, asi que se ejerce con el UPDATE generico de `00033`~~ (resuelto: la `00075` borra esa politica y la recrea exigiendo `medico_id = auth.uid()` y `estado = 'emitida'`, mas `anulada_por = auth.uid()` en el `WITH CHECK`)                                    | Cualquier medico podia anular la receta de otro                                                                                                      | resuelto por **#510**        |
| 12  | ~~La politica `FOR ALL` de `00062` sobre `bodegas` y `proveedores` abarca DELETE, pero no hay `GRANT DELETE`. Ademas duplica en otro estilo lo que ya decia `00034`~~ (resuelto: la `00079` borra las cuatro politicas de la `00062`; mandan las de la `00034`, que si pasan por `es_administrador()`) | El borrado muere en `42501` antes de llegar a RLS. Las dos tablas acaban con cinco politicas, dos redundantes                                        | resuelto por **#529**        |
| 13  | ~~Cinco funciones de permiso por rol viven **fuera** de un `permisos.js`... Y cinco modulos no tienen `permisos.js` ninguno~~ (resuelto: `puedeVerHistorial`, `puedeCorregirTriaje` y `puedeTomarTriaje` se mudaron a `pacientes/permisos.js`; `puedeVerIndicadoresDeImpacto` y `puedeVerReporteDePacientes` a `reportes/permisos.js`; `pacientes`, `inventario`, `usuarios` y `reportes` ya tienen su `permisos.js`, y `presupuestos` ya lo tenia) | La matriz del cliente esta repartida y es dificil de auditar                                                                                         | resuelto por **#396**        |
| 14  | `navegacion.js` y los `permisos.js` no coinciden en cuatro sitios: presupuestos concede registrar gasto a roles que no pueden abrir la ruta; `socio fundador` entra a Reportes y `puedeVerReporteDePacientes` lo excluye; proyectos; y Pacientes frente a `puedeVerHistorial`                                         | Funciones inalcanzables, o pantallas que se vacian                                                                                                   | sin issue                    |
| 15  | ~~Los triggers `impedir_autodesactivacion` e `impedir_dejar_sin_administrador_activo` (`00072`) son `BEFORE UPDATE`. `perfiles.id` es `FK ON DELETE CASCADE` a `auth.users`, y un `DELETE` -desde el Dashboard de Supabase o la Admin API de GoTrue, no desde esta aplicacion- no dispara ningun `BEFORE UPDATE`~~ (resuelto: `00103` agrega `impedir_borrar_ultimo_administrador()`, `BEFORE DELETE ON perfiles`, que se dispara tanto en un `DELETE` directo como en el borrado en cascada desde `auth.users`) | Borrar al ultimo administrador (o a cualquiera, incluyendose a si mismo) desde fuera de la aplicacion deja el sistema sin administrador, sin que ningun trigger lo impida | resuelto por **#511**        |

## Donde esta cada cosa

| Que                           | Donde                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| El enum de roles              | `supabase/migrations/00001_initial_schema.sql`                     |
| Las funciones de autorizacion | `supabase/migrations/00004_funciones_autorizacion_rls.sql`         |
| Los permisos finos            | `00003_permisos.sql` y `00037_permisos_proyectos_presupuestos.sql` |
| Conectar permisos finos a politicas | `00039` (jornadas), `00052` (gastos), `00086` (los otros seis y el guardia anti-escalada consultivo) |
| La denegacion por defecto     | `00030_rls_denegacion_por_defecto.sql`                             |
| Los roles en el codigo        | `packages/shared/usuarios/roles.js`                                |
| Que modulo ve cada rol        | `packages/shared/navegacion.js`                                    |
| Que botones se dibujan        | `packages/shared/<modulo>/permisos.js`                             |
| El guard de rutas web         | `apps/web/src/components/RutaProtegida.jsx`                        |
| Las pruebas de las politicas  | `supabase/tests/database/`                                         |

Documentos relacionados: [SEGURIDAD.md](./SEGURIDAD.md) cubre la autenticacion -contrasenas,
sesion, credenciales-, que es un asunto distinto del control de acceso.
[ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md) explica donde va cada capa del cliente.
