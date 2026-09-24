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
| `junta directiva`    | Junta directiva         | Gobernanza: **solo Reportes** (issue #864)                |
| `socio fundador`     | Socio fundador          | **Identico a junta directiva**                            |
| `medico`             | Medico                  | Operacion clinica en jornada                              |
| `voluntario general` | Colaborador              | Apoyo en campo: pacientes y triaje, sin clinica           |

En el codigo se usan siempre desde `packages/shared/usuarios/roles.js`, que replica el enum y
publica `ROLES`, `ROLES_CONSULTIVOS`, `esAdministrador()` y `esConsultivo()`. **Nunca se escribe un
rol como string suelto.**

> **Los dos roles consultivos son el mismo permiso.** `junta directiva` y `socio fundador` tienen
> exactamente los mismos derechos: es decision del equipo, y es la razon de ser de `es_consultivo()`,
> que pidio la issue #404 y que **existe desde la `00080`**. Hasta entonces el olvido estaba medido:
> siete politicas nombraban a `junta directiva` y una sola a `socio fundador` (la de lectura de
> `gastos`), asi que un socio fundador veia cuatro modulos en el menu y recibia cero filas en casi
> todos.
>
> La issue **#864** cierra el capitulo por el otro extremo: en vez de igualar a los dos hacia
> arriba, los deja a los dos con **una sola pantalla, Reportes**. Gobernanza no necesita ver la
> operacion del dia -jornadas, proyectos, gastos, donaciones, el personal-, y verla era lo que
> obligaba a mantener once politicas al dia para dos roles que solo consultan agregados. La `00141`
> les retira esas once lecturas de una vez.

## Las cuatro capas, y cual protege de verdad

El sistema decide permisos en cuatro sitios. **Solo el ultimo protege.**

| #   | Capa                         | Donde vive                                  | Que hace                                               | Protege?                                                 |
| --- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| 1   | Navegacion                   | `packages/shared/navegacion.js`             | Decide que modulos aparecen en el menu                 | **No.** Ocultar una opcion no impide llegar a la ruta    |
| 2   | Guard de rutas               | `apps/web/src/components/RutaProtegida.jsx` y `apps/mobile/src/components/RutaProtegida.js` | Corta la navegacion a una ruta cuyo rol no alcanza     | **No.** Es del lado del cliente; se salta con la consola |
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

Las cuatro vias de arriba son SQL: la `00079` las alcanza porque las cuatro corren dentro de
Postgres. Las Edge Functions no existian todavia cuando se escribio esa migracion, y son una capa
mas que tiene que comprobar `activo` por su cuenta -no heredan el blindaje solo por invocar RPCs
que si lo tienen-:

- La Edge Function `invitar-usuario`, que resolvia la autorizacion leyendo solo `rol` de
  `perfiles` sin comprobar `activo` (issue #691): una administradora desactivada con un JWT
  todavia vigente podia seguir invitando personal nuevo. Esta funcion lee `perfiles` con el
  cliente del llamador, no con `rol_actual()` ni con el service role, asi que pasa por la misma
  politica de SELECT que describe el punto de abajo -la que a proposito deja leer la propia fila
  desactivada- y el chequeo de `activo` tiene que hacerse a mano en el codigo de la funcion.

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

> **La prueba de que la capa 4 basta:** la app movil **estuvo sin ningun control de acceso por
> rol** (issue #427) -su navegador registraba las mismas pantallas para los cinco roles-, y aun asi
> los datos siguieron protegidos, porque la base seguia negando. Lo que fallaba ahi era la
> experiencia: el usuario llegaba a una pantalla que se le iba a vaciar.
>
> Desde la **#820** la capa 2 ya existe entera en movil: todas las pantallas de los cuatro
> stacks van envueltas en `RutaProtegida`, con los roles que `rolesDelModulo()` declara en
> `packages/shared/navegacion.js`, y una lista de roles vacia **deniega** en vez de dejar pasar a
> cualquier sesion autenticada. Que ninguna pantalla se registre sin guarda lo comprueba
> `apps/mobile/src/navigation/guardaDeRol.test.js`, que recorre el arbol de navegacion. Sigue sin
> proteger nada -es cliente-: lo que evita es que alguien llegue a una pantalla que no va a poder
> usar.

## Quien entra a la app movil (issue #866)

La app del telefono **no es una version reducida del sistema entero**: es la herramienta de la
jornada. Desde la #866 solo tres de los cinco roles inician sesion en ella.

| Rol              | Entra a la app movil | Para que                                                           |
| ---------------- | -------------------- | ------------------------------------------------------------------ |
| Medico           | Si                   | Pacientes, consulta, receta, inventario y sus jornadas asignadas   |
| Voluntario       | Si                   | Lo mismo, sin lo que su rol no permite (no aprueba ni corrige)     |
| Administrador    | Si                   | Lo anterior, mas aprobar los movimientos de inventario pendientes  |
| Junta directiva  | **No**               | Su trabajo -presupuestos, reportes, donaciones- vive solo en la web |
| Socio fundador   | **No**               | Igual que junta directiva                                           |

Lo declara `ROLES_CON_ACCESO_MOVIL` en `packages/shared/navegacion.js`, y lo aplica
`puedeUsarAppMovil()` en dos sitios: `apps/mobile/App.js`, que en vez del navegador dibuja
`AppSoloParaCampoScreen` -una pantalla que explica por que y ofrece cerrar sesion-, y
`modulosVisibles(rol, { plataforma: "mobile" })`, que devuelve `[]`.

**Esto no es control de acceso, es producto.** Junta directiva y socio fundador conservan
exactamente los mismos permisos que ya tenian: si abrieran la API con su sesion, RLS les seguiria
dejando leer lo de siempre. Lo que cambia es que la app no les abre pantallas que no les sirven
-de los cuatro modulos que tiene, `00032` ya les niega pacientes, y los otros tres los leen mejor
en la web-. Quien protege sigue siendo la capa 4.

Los cuatro modulos que existen en movil los declara cada entrada de `MODULOS` con `movil: true`
(inicio, pacientes, inventario y jornadas). Antes el filtro era `soloWeb` mas dos rutas escritas
aparte, y por eso la pantalla de inicio dibujaba tarjetas de donaciones y proyectos, que en movil
no llevan a ningun lado.

## La matriz

### Pacientes y clinica

| Tabla                     | administrador | junta directiva / socio fundador | medico | voluntario general | Como se implementa                                                                                                     |
| ------------------------- | ------------- | -------------------------------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pacientes`               | C R U         | —                                | C R U  | C R                | `00032` + `00086` (editar paso de `rol_actual() = 'medico'` a `tiene_permiso('pacientes.editar')`, que medico recibe por rol desde la `00003`). Sin DELETE para nadie; ademas el trigger de `00026` bloquea el borrado fisico |
| `expedientes`             | C R U         | —                                | C R U  | C R                | `00032` + `00086`, mismo cambio                                                                                       |
| `triajes`                 | C R U         | —                                | C R U  | C R U              | `00033`. El voluntario crea y corrige el triaje; el `imc` es columna generada y no se envia                            |
| `atenciones`              | C R U         | —                                | C R U  | C R                | `00033`; cola de la jornada en `00060`                                                                                 |
| `consultas`               | C R U         | —                                | C R U  | —                  | `00033`. El INSERT exige `medico_id = auth.uid()` **y** `participa_en_jornada()`; el UPDATE, ser el medico que atendio |
| `consulta_diagnostico`    | C R D         | —                                | C R D  | —                  | `00033` (INSERT sin exigir consulta propia) + `00082` (INSERT: medico solo en su propia consulta, `EXISTS` contra `consultas.medico_id`) + `00127` (issue #756: mismo actor de la `00082` para DELETE, para corregir un diagnostico mal elegido) |
| `recetas`                 | C R U         | —                                | C R U  | —                  | `00033`; anulacion en `00066`. El UPDATE exige ser el medico que la firmo **y** que siga `emitida` (`00075`)           |
| `receta_detalle`          | C R           | —                                | C R    | —                  | `00033`                                                                                                                |
| `padecimientos_cronicos`  | C R U D       | —                                | C R U  | —                  | `00010`. Unica tabla clinica con DELETE, y solo para administrador. Auditada desde la `00070`                          |
| `diagnosticos` (catalogo) | C R U         | —                                | R      | —                  | `00033` (lectura) + `00105` (mantenimiento). Hasta la `00105` era un catalogo VACIO y de solo lectura -nadie lo podia poblar por la API-, asi que el paso "diagnostico CIE-10" del flujo clinico no existia; esa migracion siembra el conjunto inicial y deja el mantenimiento a la administradora. **Sin DELETE:** `consulta_diagnostico` lo referencia `ON DELETE RESTRICT` (`00018`) y un diagnostico ya usado es historia clinica |
| `fusiones_pacientes`      | R             | —                                | —      | —                  | `00101` (issue #140). Solo administrador lee; sin politicas de escritura, la unica que inserta es `fn_fusionar_pacientes()` (SECURITY DEFINER) |

**Casi ninguna tabla clinica tiene politica de DELETE**: las excepciones son
`padecimientos_cronicos` y, desde la `00127` (issue #756), `consulta_diagnostico`. La baja de un
registro clinico en si (una consulta, una receta, un padecimiento) es logica, no fisica. En
`padecimientos_cronicos` esa excepcion existe para corregir un alta equivocada, no para dar de alta
a un paciente de su condicion: para eso se pasa el estado a `resuelta`, que es lo que hace
`desasociarCondicion()` en `packages/shared/pacientes`. Por ser el unico borrado real de una fila
que documenta un hecho clinico, la `00070` le puso el trigger de auditoria que la `00026` le habia
dejado fuera. `consulta_diagnostico` es distinta: no es el hecho clinico (la consulta sigue
existiendo, intacta), es el VINCULO entre esa consulta y un diagnostico -- elegir el diagnostico
equivocado y corregirlo despues no es un hecho que deba conservarse como la consulta misma se
conserva, es un error de captura. Por eso no lleva el mismo trigger de auditoria que
`padecimientos_cronicos`.

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

`fn_generar_receta()` (`00066`, ampliada en la `00112`) emite la receta, sus renglones **y la
salida de inventario correspondiente** en una sola transaccion (issue #711). Es SECURITY INVOKER y
no gana ningun privilegio: el INSERT en `movimientos_inventario` pasa por la politica de la `00034`
con el usuario que llama, y por eso la funcion fija `registrado_por = auth.uid()`, que es lo que
esa politica exige a medico y voluntario. **Consecuencia de acceso:** quien no pueda registrar un
movimiento de inventario tampoco puede emitir una receta con lote, y se entera antes de entregar
nada en vez de despues. El flujo de aprobacion no cambia: al administrador se lo autoaprueba la
`00028` y el stock baja en el acto; a medico y voluntario el movimiento les nace `pendiente` y el
stock espera a que administracion lo apruebe. Lo que la `00112` garantiza no es que el stock baje
siempre en el momento, sino que **nunca exista una receta emitida sin su movimiento registrado**.
No hace falta ningun `GRANT` nuevo: el que ya tenia (`authenticated`) sigue siendo el mismo.

`fn_ajustar_entrega_receta()` (`00128`, issue #764) corrige la cantidad realmente entregada de un
renglon sin reescribir `cantidad_entregada` ni descontar el inventario dos veces: calcula la
diferencia contra el ultimo valor confirmado y registra un movimiento nuevo solo por esa
diferencia. A diferencia de `fn_generar_receta()`, es **SECURITY DEFINER**: `cantidad_ajustada`,
`ajustada_por` y `ajustada_en` no tienen policy ni `GRANT` de `UPDATE` para ningun rol -mismo
candado que ya protegia `cantidad_entregada`-, asi que la funcion no podria escribirlas de otro
modo. Como SECURITY DEFINER se salta RLS, la funcion valida el rol a mano (`es_administrador()` o
`rol_actual() = 'medico'`, la misma combinacion que ya protege `receta_detalle` en la tabla de
arriba) en vez de depender de una politica. El movimiento de inventario que genera sigue el mismo
flujo de aprobacion que cualquier otro (administrador autoaprueba, medico y voluntario dejan
pendiente). Tiene su propio `REVOKE EXECUTE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated`
en la misma migracion (issue #706: un `ALTER DEFAULT PRIVILEGES` no basta). Reflejo en el
cliente: `inventario/permisos.js`, `puedeAjustarEntregaReceta(rol)`.

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
| `medicamentos`           | C R U         | R                                | **C** R | R                  | `00034` + `00141`, alta por `fn_registrar_medicamento` (`00050`). La lectura la endurecio la `00079` a `rol_actual() IS NOT NULL`: un perfil desactivado deja de verla |
| `principios_activos`     | C R U D       | R                                | R      | R                  | `00034` + `00046`                                                                                           |
| `presentaciones`         | C R U D       | R                                | R      | R                  | `00144`. Mismo patron que `principios_activos`: catalogo abierto a lectura, escritura solo administrador. RESTRICT desde `medicamentos.presentacion_id`: una presentacion en uso no se borra |
| `medicamento_principio`  | C R           | R                                | R      | R                  | `00034`                                                                                                     |
| `lotes`                  | C R U         | R                                | C R U\* | C R U\*            | `00034` + `00107`. \*Medico y voluntario dan de alta el lote que acompania a su ingreso, pero **nace provisional** (`confirmado = FALSE`) y solo lo pueden editar mientras siga asi; al aprobar el ingreso pasa a firme y deja de ser suyo. La politica les exige ademas `registrado_por = auth.uid()`. **Sin DELETE para nadie** |
| `existencias`            | C R U         | R                                | R      | R                  | `00034`; disponibilidad por `fn_existencias_disponibles` (`00065`)                                          |
| `bodegas`                | C R U         | R                                | R      | R                  | `00034`, con la lectura endurecida por la `00079` a `rol_actual() IS NOT NULL`. Las politicas duplicadas de la `00061`/`00062` las retiro esa misma migracion (era la Divergencia 12). **Sin DELETE para nadie**, y no solo por politica: la `00034` nunca otorgo `GRANT DELETE`, asi que el borrado muere en `42501` antes de llegar a RLS. Cubierto rol por rol en `politicas_rls_inventario.sql` (issue #513)                                                          |
| `proveedores`            | C R U         | R                                | R      | R                  | `00034`, con la lectura endurecida por la `00079` a `rol_actual() IS NOT NULL`. Las politicas duplicadas de la `00061`/`00062` las retiro esa misma migracion (era la Divergencia 12). **Sin DELETE para nadie**, y no solo por politica: la `00034` nunca otorgo `GRANT DELETE`, asi que el borrado muere en `42501` antes de llegar a RLS. Cubierto rol por rol en `politicas_rls_inventario.sql` (issue #513)                                                                             |
| `alertas_caducidad`      | R **A**       | R                                | R      | R                  | `00034` + `00138`. Sin INSERT DIRECTO para nadie: las genera `fn_generar_alertas_caducidad` (`00088`, redefinida por la `00129` y la `00138`), que es `SECURITY DEFINER`. La invocan la rutina programada con `service_role` y, desde la `00129`, tambien la administradora a traves de `fn_sincronizar_alertas_caducidad` (ver abajo). **Sin UPDATE directo para nadie desde la `00138`**: se atiende solo con `fn_atender_alerta_caducidad`, que ademas descuenta el stock (ver abajo) |
| `movimientos_inventario` | R U **A**     | R                                | C R U\* | C R U\*            | `00034` + `00048` + `00086` (aprobar admite tambien `tiene_permiso('inventario.aprobar')`) + `00106`. \*Solo el **propio** movimiento y solo mientras siga `pendiente` |
| `notificaciones`         | R U\*\*       | R U\*\*                          | R U\*\* | R U\*\*             | `00138` (issue #755). \*\*Cada perfil activo solo **sus propias** filas (`perfil_id = auth.uid() AND rol_actual() IS NOT NULL`), y el UPDATE solo alcanza a `leida_en` (`GRANT UPDATE (leida_en)`, por columna). Sin INSERT ni DELETE para nadie: las escriben triggers `SECURITY DEFINER` (ver abajo). Hoy solo la administracion recibe filas |

**El medico da de alta un medicamento (issue #864).** `fn_registrar_medicamento` (`00050`) **no es
`SECURITY DEFINER` a proposito**, asi que quien puede llamarla lo deciden las politicas de INSERT de
`medicamentos` y `medicamento_principio`, que hasta la `00141` exigian `es_administrador()`. El
resultado es que el alta en linea que la issue #851 puso en el formulario -para no tener que
adivinar a que medicamento correspondia el texto de una donacion- le terminaba en `42501` a un
medico. Se abre **solo el INSERT**: editar y desactivar siguen siendo de la administracion. Las dos
tablas van en el mismo cambio porque la funcion escribe en las dos dentro de la misma transaccion.

**Los roles consultivos conservan la lectura de inventario, y es deliberado (issue #864).** Aunque
su unica pantalla pasa a ser Reportes, **no** se les retira `existencias`, `lotes`, `medicamentos`
ni `bodegas`: dos de sus cuatro reportes las leen **directo de la tabla**, no por una vista
(`reportes/inventario.api.js` y `reportes/vencimientos.api.js` consultan `existencias`;
`reportes/api.js` consulta `lotes`). Quitarles esa lectura les vaciaria lo unico que deben ver.
Queda anotado en "Divergencias" con su salida: pasar esos dos reportes a vistas `SECURITY DEFINER`,
que es la regla de "RLS filtra filas, no columnas" de este mismo documento.

**`fn_sincronizar_alertas_caducidad` (issue #838): la unica funcion de inventario con `GRANT
EXECUTE` a `authenticated` que escribe `alertas_caducidad`.** Existe porque un lote ya vencido no
tenia alerta -- `fn_generar_alertas_caducidad` (`00088`) descartaba por vencido a sus candidatos,
asi que el bloque "Vencidos - Para dar de baja" salia vacio con el lote a la vista en el
inventario -- y, corregida esa funcion en la `00129`, la fila igual tardaba hasta la corrida
siguiente de la rutina nocturna en aparecer. Es un envoltorio `SECURITY DEFINER` que **comprueba
`es_administrador()` por dentro y lanza `42501` a cualquier otro rol**, y lo unico que puede hacer
es crear alertas pendientes que la rutina habria creado igual. No abre ninguna puerta nueva: es la
misma regla que la politica "Solo administrador atiende alertas_caducidad" (`00034`) ya exige para
cerrarlas.

**`fn_atender_alerta_caducidad` (issue #755, `00138`): atender una alerta descuenta el stock.**
Atender era un `UPDATE` de la alerta y nada mas: las unidades seguian en existencias y el
generador creaba otra alerta del mismo lote -con su notificacion y su correo- en cuanto el panel
recargaba. Ahora la unica forma de cerrar una alerta es esta funcion `SECURITY DEFINER`, que
**comprueba `es_administrador()` y lanza `42501` a cualquier otro rol**, y en la misma transaccion:
con `descartado` o `donado` da de baja todo el stock del lote (una salida aprobada por bodega, en
el Kardex); con `reubicado` lo traslada a la bodega destino, y solo si el lote no vencio.
`atendida_por` es `auth.uid()`, no un parametro. Por eso la `00138` retira el `GRANT UPDATE` sobre
`alertas_caducidad` que daba la `00034`: con el abierto, cerrar una alerta sin descontar nada
seguia a una peticion de distancia. Dar de baja un vencido pasa por `fn_aplicar_ajuste_existencias`
con una bandera de transaccion (`ecopac.baja_por_caducidad`) que solo fija esta funcion; fuera de
ella, la salida de un vencido sigue rechazada como antes (CP-RF03-04).

**Notificaciones al administrador (issue #755, `00138`): quien las escribe.** Nadie las inserta
desde la aplicacion. Las crean cuatro triggers `SECURITY DEFINER` -`AFTER INSERT` en
`alertas_caducidad`, en `movimientos_inventario` con `estado = 'pendiente'` y en `gastos` con
`estado = 'pendiente'`, y `AFTER UPDATE` de sentencia en `existencias` cuando el total de un
medicamento pasa de mayor que cero a cero- a traves de `fn_notificar_administradores`, que inserta
una fila por **administrador activo** (un perfil desactivado no recibe nada, mismo criterio que la
`00079`). Lo que registra la propia administracion nace autoaprobado y no notifica. Ninguna de estas
funciones tiene `EXECUTE` para `anon` ni `authenticated`. `fn_reclamar_correos_de_notificaciones`
solo la ejecuta `service_role`: la usan las Edge Functions `enviar-notificaciones` y
`alertas-vencimiento` para mandar el correo, y lee `perfiles.email` del destinatario. El trigger que
dispara el correo lee de **Supabase Vault** la URL de la funcion y la llave de servicio
(`notificaciones_url`, `notificaciones_llave`); si no estan configuradas no hace nada.

**`lotes.costo_unitario` y `lotes.moneda` (issue #752): divergencia declarada entre RLS y lo que
de verdad protege el dato.** La fila de `lotes` de arriba dice `C R U` para medico y voluntario
general igual que el resto de sus columnas -y es cierto para estas dos tambien: no hay ninguna
politica ni `GRANT` que las trate distinto-. El costo es informacion financiera que ninguna
pantalla les muestra hoy, pero **quien lo protege no es RLS de `lotes`, es
`fn_valor_de_inventario_disponible` (`00122`)**, la unica funcion pensada para leer el valor
monetario: es `SECURITY DEFINER` y comprueba ella misma que quien llama sea administrador o un
rol consultivo, con la misma regla que ya protege `presupuesto_de_jornada`/`proyecto`/`sistema`
(`00080`). Se probo restringir las dos columnas con `REVOKE SELECT (columna) ... FROM
authenticated` y no funciona: Postgres no retira nada a nivel de columna mientras el rol
conserve `SELECT` a nivel de tabla (que `authenticated` ya tiene sobre `lotes` desde la `00034`),
comprobado contra el stack local con un JWT de medico. Reescribir el `GRANT` de las 13 columnas
de `lotes` para excluir solo estas dos es la unica forma real de cerrarlo a nivel de fila, y es
una migracion grande y fragil para dos columnas -queda anotado como limitacion conocida, no como
decision cerrada-. Reflejo en el cliente: `inventario/permisos.js`, `puedeVerValorizacion(rol)`.

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
| `jornadas`                 | C R U         | —                                | R si participa o es su responsable | R si participa o es su responsable | `00039`, `00141`. Crear y editar admite tambien `tiene_permiso('jornadas.gestionar')` |
| `jornada_personal`         | C R U D       | —                                | R el equipo de su jornada | R el equipo de su jornada | `00039` + `00044` + `00141`                                       |
| `jornada_estado_historial` | R             | —                                | —              | —                  | `00039`. Lo escribe un trigger DEFINER, nadie por la API                     |

La transicion de estados la valida `fn_validar_transicion_estado_jornada` (`00051`), que deja
reabrir una jornada finalizada **solo al administrador**. Reflejo en el cliente:
`jornadas/permisos.js`.

**Dos cambios de la issue #864 (`00141`) en esta tabla:**

1. **El responsable de una jornada la lee.** `jornadas.responsable_id` y `jornada_personal` son dos
   cosas distintas -quien organiza la jornada y quien esta en el cuadro de turnos de ese dia- y
   `participa_en_jornada()` solo mira la segunda, asi que **una persona podia ser responsable de una
   jornada y no verla**. La issue #838 encontro esto y lo arreglo **solo en el cliente**
   (`obtenerJornadasDePersona()` consulta las dos vias por separado); la base nunca recibio el
   arreglo, asi que la administradora veia las dos jornadas del medico en su ficha y el medico no
   veia una de ellas. Se comprueba en `permisos_por_rol_864.sql`.
2. **Quien esta en una jornada ve su equipo completo**, no solo su propia fila. Lo pide el criterio
   6 de la issue ("en el detalle de la jornada ve el resumen, el equipo y los pacientes
   atendidos"); antes la pantalla decia "esta vista solo muestra tu propia asignacion".

### Proyectos y presupuestos

| Tabla                       | administrador | junta directiva / socio fundador | medico           | voluntario general | Como se implementa                                                |
| --------------------------- | ------------- | -------------------------------- | ---------------- | ------------------ | ----------------------------------------------------------------- |
| `proyectos`                 | C R U         | —                                | R el de su jornada | R el de su jornada | `00039` + `00086` + `00141` (crear/editar, y tambien SU LECTURA, admiten `tiene_permiso('proyectos.gestionar')`: sin eso, `INSERT ... RETURNING` -patron real de `crearProyecto()`- falla igual aunque el `WITH CHECK` del INSERT ya lo permita) |
| `proyecto_hitos`            | C R U D       | —                                | —                | —                  | `00053` + `00141`                                                 |
| `proyecto_seguimiento`      | C R           | —                                | —                | —                  | `00053` + `00141`                                                 |
| `proyecto_estado_historial` | R             | —                                | —                | —                  | `00039`                                                           |
| `gastos`                    | C R **A**     | —                                | C R si participa | C R si participa   | `00052` + `00141`. Era la unica tabla donde `socio fundador` aparecia por su nombre |
| `jornada_presupuesto_origen` | C R U D      | —                                | —                | —                  | `00135` + `00141`. Escribir admite tambien `tiene_permiso('jornadas.gestionar')`, igual que actualizar la jornada; su lectura tambien, por el `INSERT ... RETURNING` |

**La lectura de `proyectos` del personal de campo (issue #864)** no es "todos los proyectos": es
`EXISTS (SELECT 1 FROM jornadas j WHERE j.proyecto_id = proyectos.id AND participa_en_jornada(j.id))`.
Solo el proyecto del que cuelga una jornada en la que esta. En la interfaz, el medico entra a
Proyectos pero **sin las pestañas de insumos y gastos y sin poder crear ni editar nada**
(`puedeVerInsumosYGastosDeProyecto()` en `proyectos/permisos.js`); el voluntario general no tiene
el modulo en el menu, aunque la politica le entregue la misma fila si la pidiera.

`jornada_presupuesto_origen` (issue #840) dice de donde viene cada parte del presupuesto de una
jornada: una donacion de dinero, fondos propios o un aporte externo. `jornadas.presupuesto_asignado`
es la suma de estas filas y la mantiene `fn_sincronizar_presupuesto_de_jornada` (DEFINER); un UPDATE
directo de esa columna lo rechaza `fn_impedir_presupuesto_a_mano`, asi que ya no basta con poder
actualizar la jornada para cambiar su presupuesto. El personal de campo ve el total en `jornadas`
pero no el desglose. Que una donacion no se asigne por encima de su monto lo valida
`fn_validar_origen_de_presupuesto` (DEFINER, solo lee), para que valga igual aunque quien escribe no
tenga lectura sobre `donaciones`. Reflejo en el cliente: `permisosDeOrigenDePresupuesto()` en
`presupuestos/permisos.js`.

`gastos` es el otro circuito de aprobacion: quien participa en la jornada registra en estado
`pendiente` y a su nombre; aprobar es un UPDATE que exige `es_administrador()` o
`tiene_permiso('presupuestos.aprobar')`. El trigger `fn_autoaprobar_gasto_administrador`
(`00109`, espejo de `fn_autoaprobar_movimiento_inventario`) hace nacer ya aprobado el gasto que
inserta el propio administrador, sin ajuste de existencias: un gasto no mueve inventario
(`00089`). Reflejo en el cliente: `presupuestos/permisos.js` y `donaciones/proyectos.permisos.js`.

### Donaciones

| Tabla              | administrador | junta directiva / socio fundador | medico | voluntario general | Como se implementa                                       |
| ------------------ | ------------- | -------------------------------- | ------ | ------------------ | --------------------------------------------------------- |
| `donantes`         | C R U         | —                                | —      | —                  | `00083` + `00086` + `00141` (registrar Y SU LECTURA admiten `tiene_permiso('donaciones.registrar')`, mismo motivo que `proyectos`: `registrarDonante()` hace `.insert().select()`). `es_administrador()` escribe, `es_consultivo()` o el permiso fino leen |
| `donaciones`       | C R U         | —                                | —      | —                  | `00083` + `00086` + `00141`, mismo cambio. La anulacion (UPDATE) exige `estado = 'anulada'` y `motivo_anulacion` |
| `donacion_detalle` | C R U (`lote_id`) | —                            | —      | —                  | `00083` + `00086` + `00141`, mismo cambio. El detalle no se corrige, se anula la donacion completa. Desde la `00135` el renglon de una donacion de medicamentos lleva `medicamento_id`, que exige `fn_registrar_donacion` (INVOKER: no cambia quien puede escribir). El unico UPDATE es enlazar el lote que produjo el renglon: GRANT de la columna `lote_id` y nada mas, una sola vez (la politica solo alcanza `lote_id IS NULL`), con un lote del mismo medicamento (trigger), y lo hace quien registra donaciones (`es_administrador() OR tiene_permiso('donaciones.registrar')`). Hasta la `00135` no habia GRANT ni politica y `enlazarLoteConDonacion()` fallaba siempre. La `00135` concedio el GRANT de columna sin revocar el UPDATE de tabla completa que `authenticated` ya traia por default desde que la tabla se creo (`00022`, antes de que la `00120` empezara a revocar privilegios por defecto): el resto del renglon si se podia corregir con un UPDATE directo hasta que la `00145` revoco el UPDATE amplio |

Hasta la `00083`, las tres tablas estaban **denegadas a los cinco roles, incluido el
administrador**, por dos motivos independientes que detalla la Divergencia 1 (resuelta).

Desde la **`00141`** (issue #864) las lee **solo la administradora**, o quien tenga
`donaciones.registrar`. Los dos roles consultivos salen: su unica pantalla es Reportes y ninguno
de los cuatro reportes lee donantes, donaciones ni su detalle.

### Usuarios y permisos

| Tabla                 | administrador | junta directiva / socio fundador | medico      | voluntario general | Como se implementa                             |
| --------------------- | ------------- | -------------------------------- | ----------- | ------------------ | ---------------------------------------------- |
| `perfiles`            | C R U         | R el propio                      | R el propio | R el propio        | `00038`. Cada quien lee y edita solo su perfil. La fila la crea el trigger de la `00002`, que desde la `00074` rechaza el alta si viene del registro publico |
| `perfil_especialidad` | C R D         | R las propias                     | C R D la propia | C R D la propia | `00058`, `00085`, `00141`. `es_administrador()` lee/escribe cualquiera; cada perfil crea y borra las suyas. La lectura de las ajenas que la `00085` dio a los roles consultivos existia para el cuadro de turnos, que ya no ven: se la retira la `00141`. Sin UPDATE: la PK incluye el nombre, cambiar una especialidad es borrar e insertar |
| `permisos`            | R             | R                                | R           | R                  | `00038`. Catalogo de solo lectura              |
| `rol_permiso`         | C R D         | R                                | R           | R                  | `00038` lee; `00139` (issue #638) abre C/D solo a administrador, sin U (no hay columna que actualizar); auditoria propia con `permiso_id` como `fila_id` |
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

| Tabla                  | Quien lee             | Quien escribe          | Como se implementa                                    |
| ---------------------- | --------------------- | ---------------------- | ------------------------------------------------------- |
| `departamentos`        | cualquier autenticado | **nadie**              | `00006` (politica) + `00073` (GRANT, issue #406 resuelto). El catalogo lo siembra la `00125`, no la aplicacion |
| `municipios`           | cualquier autenticado | **nadie**              | Igual que departamentos                                 |
| `comunidades`          | cualquier autenticado | administrador: C U     | Lectura: `00008` (politica) + `00041` (GRANT); la politica de `00041` se retiro en `00104` por redundante. Escritura: `00116` (politicas de INSERT y UPDATE) + `00118` (`GRANT INSERT, UPDATE`), y `00117` agrega `es_vigente` como retiro logico |
| `condiciones_cronicas` | cualquier autenticado | administrador: C U; medico y voluntario general: C | Lectura: `00010` (politica), reescrita en `00079`; GRANT en `00032`. Escritura: `00140` (issue #850), que agrega `GRANT INSERT, UPDATE`, una politica de INSERT para los tres roles que atienden y una de UPDATE solo para administrador. `00115` habia agregado `es_vigente` como retiro logico |

**Ni `departamentos` ni `municipios` se escriben desde la aplicacion, y es deliberado**: son el
catalogo oficial de Guatemala, con `id` entero fijo, y quien lo necesite corregir lo hace en una
migracion. Hasta la `00125` ese catalogo solo existia en `supabase/seed.sql` y por tanto **no
llegaba a ningun ambiente remoto**, porque `supabase db push` no ejecuta seeds (issue #704). Las
comunidades si son operativas -crecen con cada jornada nueva- y por eso la administradora las crea
y las edita desde la aplicacion, con `es_vigente` para retirar una sin borrarla.

**El catalogo de condiciones cronicas lo mantiene quien atiende, no solo la administracion.**
Issue #850, migracion `00140`. Es la unica tabla del esquema donde el alta alcanza a los tres roles
de campo -administrador, medico y **voluntario general**- y el mantenimiento no. La razon es
operativa: una condicion cronica que falta en el catalogo se descubre en jornada, con el paciente
delante, y quien la ve es quien atiende. Si escribirla exige esperar a que la administracion la de
de alta, el dato se pierde o se escribe mal en otro campo. Junta directiva y socio fundador quedan
fuera por la regla de la `00054`: los roles consultivos no tocan filas clinicas, y un catalogo de
diagnosticos cronicos lo es.

El `UPDATE` no se reparte igual, y tampoco es un descuido: retirar una condicion (`es_vigente =
FALSE`) la quita del selector de **todas** las fichas, y renombrarla reescribe lo que ya citan
expedientes ajenos. Eso es curaduria del catalogo, no captura en jornada, y queda en la
administracion. Sin `DELETE` para nadie, como el resto de los catalogos: `padecimientos_cronicos`
lo referencia `ON DELETE RESTRICT` (`00010`) y la `00120` ya revoco ese privilegio por defecto.

> **Una asimetria que conviene tener a la vista.** El voluntario general puede dar de alta en este
> catalogo pero **no vera el resultado en la ficha de ningun paciente**: `padecimientos_cronicos`
> (`00010`) no tiene ninguna politica para su rol, ni de SELECT, asi que para el la unica pantalla
> que usa el catalogo es la de mantenimiento. Es el alcance de la `00010`, no de la `00140`;
> ampliarlo es una decision clinica que necesita su propia issue.

Ademas, la `00140` agrega un indice unico sobre `lower(f_unaccent(btrim(nombre)))`. El `UNIQUE` de
la columna cruda (`00010`) es sensible a mayusculas y acentos, asi que "Hipertension",
"hipertension" e "Hipertension" con tilde entraban como tres filas distintas. Con un solo rol
escribiendo eso era teorico; con tres y una pantalla en cada plataforma, deja de serlo. El cliente
ademas elige la existente en vez de duplicarla (`buscarOpcionPorEtiqueta`), pero eso es comodidad
de la pantalla: la garantia es el indice.

**Ojo con cual de las dos capas los protege.** Comprobado contra la base local con las 125
migraciones aplicadas: `authenticated` conserva `GRANT INSERT, UPDATE` sobre `departamentos` y
`municipios` -no lo dio ninguna migracion; viene de los privilegios por defecto que Supabase
concede sobre el esquema `public`, los mismos que la `00120` tuvo que retirar para el `DELETE`-.
Lo que hoy impide escribir es **solo RLS**: como ninguna politica de INSERT o UPDATE las cubre, un
administrador autenticado recibe `new row violates row-level security policy` al insertar y un
`UPDATE` que no afecta ninguna fila, que es la asimetria de la regla de #221. El resultado efectivo
es el correcto, pero descansa en una sola capa en vez de dos: el dia que alguien agregue una
politica permisiva a estas tablas, el `GRANT` ya esta puesto. Retirarlo es trabajo de una issue
propia, no de la #704, que no toca privilegios.

### Reportes: las vistas

Los roles consultivos no leen filas clinicas, asi que sus reportes llegan por **vista**, no por
tabla:

| Vista                     | Modo                    | Quien la lee                                                                       | Migracion                 |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| `vista_reporte_impacto`   | **DEFINER**             | administrador, los dos consultivos y quien tiene `reportes.exportar`, por el `WHERE` | `00027`, `00054`, `00064`, `00080`, `00086` |
| `pacientes_reporte`       | **DEFINER**             | administrador, los dos consultivos y quien tiene `reportes.exportar`, por el `WHERE`. Solo expone `id` y `comunidad_id` | `00041`, `00080`, `00086` |
| `perfiles_directorio`     | **DEFINER**             | administrador y el propio; enmascara telefono y correo                             | `00038`, `00141`          |
| `vista_cola_jornada`      | **DEFINER**             | administrador y quien participa en la jornada                                      | `00060`                   |
| `vista_lotes_disponibles` | `security_invoker=true` | cualquier autenticado, con su propia RLS                                           | `00024`, `00041`, `00047` |
| `privilegios_de_anon`     | DEFINER                 | nadie: es una guarda de CI                                                         | `00056`                   |
| `tablas_sin_rls`          | DEFINER                 | nadie: es introspeccion                                                            | `00030`                   |

`fn_reporte_pacientes_atendidos` (`00067`, guarda actualizada en `00080` y `00086`) es la unica
funcion de negocio con la comprobacion de rol escrita en su cuerpo, porque es DEFINER y tiene que
sustituir a la politica que no la protege.

Reflejo en el cliente: `reportes/permisos.js` (issue #396), que absorbio
`puedeVerIndicadoresDeImpacto` y `puedeVerReporteDePacientes`, sueltas hasta ahora fuera de un
`permisos.js`.

**`puedeVerReporteDePacientes` excluia a socio fundador, y no debia (issue #864).** El comentario
decia que era el espejo de la guarda de `fn_reporte_pacientes_atendidos`, y lo fue: la `00067`
escribia `es_administrador() OR rol_actual() = 'junta directiva'`. Pero la `00086` reescribio esa
funcion entera con `es_administrador() OR es_consultivo() OR tiene_permiso('reportes.exportar')`, y
el cliente se quedo con el texto viejo. Era una divergencia **silenciosa y hacia el lado estricto**:
la pantalla le escondia a un socio fundador un reporte que la base si le habria servido, sin error
ni aviso. Se corrige el cliente; la base no se toca.

**`perfiles_directorio` ya no la lee junta directiva (issue #864).** La vista existia para darle
una lectura del personal sin telefono ni correo, y la issue #756 le abrio la ruta para que esa
vista tuviera por donde llegarse. La `00141` la cierra en las tres capas a la vez -la vista,
`puedeVerListadoUsuarios()` y `navegacion.js`-, que es exactamente lo que la #756 pedia: que la
ruta y la vista digan lo mismo. La vista se conserva porque la administradora la sigue usando y
porque cada quien se lee a si mismo por ella.

**`puedeVerReporteDeVencimientos`, el quinto reporte (issue #862).**
`useReporteMedicamentosPorVencer` usaba `puedeVerIndicadoresDeImpacto` -la regla de
`vista_reporte_impacto`, mas estrecha y de otro reporte-. El de vencimientos lee `existencias`
(`00079`) y `lotes`/`medicamentos`/`bodegas` (`00034`), abiertas a toda sesion activa, igual que
el de inventario. No cambia quien entra, porque los tres roles que alcanzan el modulo pasan las
dos guardas; cambia que la funcion describe la politica que de verdad protege.

**Que roles alcanzan `/reportes` no lo decide este archivo**, sino `navegacion.js`:
administrador, junta directiva y socio fundador. Es una decision deliberada de la issue #426 que
`navegacion.test.js` afirma, y la #862 la respeto sin tocarla. Un medico o un voluntario no llegan
a estas pantallas, y ven los vencimientos en `Inventario > Alertas`.

### Divergencia abierta: `reportes.exportar` es inoperante desde la interfaz

Las tres guardas del servidor aceptan `tiene_permiso('reportes.exportar')`, pero **ninguna funcion
de `reportes/permisos.js` lo mira**: todas deciden por rol base. Conceder ese permiso fino a
alguien no cambia nada en la pantalla.

Cerrarlo exige que la sesion cargue los permisos efectivos
(`usuarios/permisos.api.js`, `obtenerPermisosEfectivos`) y eso es un cambio transversal al contexto
de autenticacion, fuera del alcance de la #862. Mientras tanto, el permiso solo tendria efecto para
un rol que ya alcance el modulo.

## Los permisos finos

Junto al rol base hay un mecanismo de excepciones **por persona**: tres tablas de `00003`
\-`permisos`, `rol_permiso`, `usuario_permiso`- y la funcion `tiene_permiso(clave)` de `00004`, que
resuelve primero la concesion o revocacion puntual del usuario y, si no hay ninguna, cae al valor
por defecto de su rol.

Sirve para lo que el rol base no sabe expresar: **darle a una persona concreta una atribucion que
su rol no tiene, sin cambiarle el rol.**

| Permiso                       | Por defecto lo tienen                          | Gobierna alguna politica?                                                             |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `jornadas.gestionar`          | administrador                                  | **Si** — INSERT y UPDATE de `jornadas` (`00039`); escritura y lectura de `jornada_presupuesto_origen` (`00135`) |
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

**Las ocho politicas conectadas por la `00086` son siempre `es_administrador() OR
tiene_permiso(clave)`, nunca solo `tiene_permiso(clave)`.** Consecuencia directa: para el rol
`administrador`, lo que diga `rol_permiso` sobre estos nueve permisos no cambia nada en la
practica -ese rol ya tiene acceso completo por diseno, con o sin la fila-. La matriz de permisos
por rol (issue #638) deshabilita la columna `administrador` por este motivo, con un aviso en
pantalla en vez de dejarla editable sin efecto.

Consecuencia practica: `permisos` sigue siendo de **solo lectura** para todos -el catalogo de
permisos que existen se define por migracion, no por la aplicacion-, pero `rol_permiso` ya no lo
es: la matriz de permisos por rol (issue #638, migracion `00139`) le da a administrador **C R D**
sobre el default de cada rol (sin U: no hay columna que actualizar, conceder es insertar la fila y
retirar es borrarla), con auditoria propia. `usuario_permiso` sigue siendo la excepcion por
persona, con su propio CRUD y auditoria desde antes (`00045`).

Guardia asociado: ningun permiso fino de escritura puede concederse **por excepcion individual**
a un perfil `junta directiva` o `socio fundador` (son consultivos por definicion) — trigger
`impedir_permiso_escritura_a_consultivo` sobre `usuario_permiso` (`00086`). Ver la regla dedicada
mas abajo.

**Asimetria conocida, dejada asi a proposito (issue #638):** `rol_permiso` no tiene ese mismo
guardia. Un administrador puede, desde la matriz de permisos por rol, marcar un permiso de
escritura como parte del **default de todo un rol consultivo** -mas grave que la excepcion
individual, porque afecta a todas las personas con ese rol, presentes y futuras-, y ninguna
politica ni trigger lo impide todavia. Queda para una issue futura si se decide cerrar esta
brecha.

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

## Divergencias

Una divergencia es una celda donde **una capa dice una cosa y otra dice otra**. Las dos direcciones
son defectos: si el cliente permite lo que la base niega, la persona ve un error; si el cliente
niega lo que la base permite, la funcion es inalcanzable y nada lo avisa. Este documento referencia
esta seccion desde la introduccion y desde "Las cuatro capas", y hasta la issue #864 **no existia**:
las filas vivian sueltas en la prosa de cada modulo o en `docs/REVISION-INTEGRAL.md`.

| # | Que divergo | Estado |
| - | ----------- | ------ |
| 1 | Las siete politicas de donaciones leian el rol de `auth.jwt() -> app_metadata` en vez de `perfiles` | **Resuelta** por la `00083` |
| 2 | `es_consultivo()` no existia y solo una politica nombraba a `socio fundador` | **Resuelta** por la `00080`; la `00141` la cierra del todo dejando a los dos consultivos con una sola pantalla |
| 3 | `perfil_especialidad` no tenia politica de escritura | **Resuelta** por la `00085` |
| 12 | `bodegas` y `proveedores` tenian politicas duplicadas (`00061`/`00062`) | **Resuelta** por la `00079` |
| 15 | Borrar el ultimo administrador via `DELETE` en cascada desde `auth.users` no lo para ningun trigger | **Abierta**. `impedir_dejar_sin_administrador_activo` (`00072`) cubre el UPDATE, no el DELETE |
| — | `lotes.costo_unitario` y `lotes.moneda`: el `REVOKE SELECT` por columna no funciona, y lo que protege de verdad el dato es `fn_valor_de_inventario_disponible` (`00122`) | **Abierta**, limitacion conocida (ver la seccion de Inventario) |
| — | `rol_permiso` no tiene el guardia `impedir_permiso_escritura_a_consultivo` que si tiene `usuario_permiso` | **Abierta** (`00139`) |
| — | `authenticated` conserva `GRANT INSERT, UPDATE` sobre `departamentos` y `municipios`; hoy solo RLS lo frena | **Abierta** (ver "Territorio y catalogos") |
| — | **Los roles consultivos conservan la lectura de inventario aunque solo vean Reportes** | **Abierta y deliberada** (issue #864). Dos de sus cuatro reportes leen `existencias` y `lotes` directo de la tabla. La salida es pasarlos a vistas `SECURITY DEFINER`, y va en su propia issue |

Dos divergencias que la issue #864 **cerro**, y que conviene tener escritas porque las dos eran
silenciosas -ninguna fallaba, las dos escondian algo-:

- **El cliente era mas estricto que la base en `puedeVerReporteDePacientes`**: citaba la guarda de
  la `00067` que la `00086` ya habia reescrito, y le escondia el reporte a socio fundador.
- **La base era mas estricta que el cliente en `jornadas`**: la issue #838 arreglo en
  `obtenerJornadasDePersona()` que el responsable de una jornada la viera, pero la politica de
  SELECT nunca lo recibio. La administradora veia las dos jornadas de una persona en su ficha y esa
  persona no veia una de ellas.

## Como se comprueba que esta matriz es cierta

No basta con leer las migraciones: lo que vale es lo que responde la base. Las celdas de esta
matriz estan cubiertas por las suites pgTAP de `supabase/tests/database/`, que **corren en cada
PR** dentro del job "Validar migraciones y funciones". Entre otras, ya afirman que
`voluntario general` no lee consultas ni recetas, y que `junta directiva` no accede a atenciones,
consultas ni recetas.

Lo que cambio la issue #864 lo afirma `permisos_por_rol_864.sql`, rol por rol: que los dos roles
consultivos reciben **cero filas** de jornadas, proyectos, gastos y donaciones y **si** conservan
`existencias`; que el medico lee el proyecto de su jornada y no el de al lado; que ve el equipo
completo de su jornada; que da de alta un medicamento y no puede editarlo despues; y que el
responsable de una jornada la lee aunque no este en su cuadro de turnos.

Para comprobar una celda a mano contra la base local, el patron es el de esas suites:

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '<uuid del perfil>';
SELECT count(*) FROM consultas;   -- 0 filas = la politica lo niega