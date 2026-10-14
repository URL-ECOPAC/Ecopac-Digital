# Revision integral del repositorio

Revision completa del codigo, el esquema y la documentacion, hecha el **3 de septiembre de 2026**
sobre `develop` en el commit `1d34b70`.

Cubre las siete preguntas que la motivaron: si el sistema tiene sentido, si los calculos son
correctos, si la logica es correcta, si las vistas usan todos los campos de los modelos, si los
tipos de datos son correctos, si se cumplen las reglas de seguridad y limpieza, si hay datos
duplicados o con nombres distintos para lo mismo, si hay logica duplicada, y si cada rol ve solo
lo que le toca.

## Como se hizo

| Que se reviso                | Como                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Esquema (103 migraciones)    | Extraccion de todo el DDL, los 21 enums, las 49 funciones y las 104 politicas RLS |
| `packages/shared` (49.314 l) | Lectura de las API, validaciones, permisos, descriptores y hooks                  |
| `apps/web` (16.616 l)        | Rutas, guards, paginas y componentes                                              |
| `apps/mobile` (7.363 l)      | Navegacion, guards y pantallas                                                    |
| Edge Functions               | `invitar-usuario` y `alertas-vencimiento`                                         |
| Herramientas                 | `npm run lint`, `npm test`, `verificar:shared-esquema`, `verificar:rewrite-vercel` |

Estado de las herramientas al momento de la revision: **lint en verde** (29 avisos, 0 errores),
**1.706 pruebas en verde**, `verificar:shared-esquema` en verde ("todo lo que `packages/shared`
nombra existe en `supabase/migrations/`").

Que esas tres cosas esten en verde y aun asi existan los hallazgos de abajo es, en si mismo, el
resultado mas importante de esta revision: **el andamiaje comprueba lo que hay escrito, no lo que
las pantallas muestran**.

## Resumen

**60 hallazgos**: 40 de codigo y esquema (bloques A-H), 10 del estado de despliegue (bloque I) y 10 de la segunda pasada sobre los modulos que la primera dejo a medias (bloque J). La mayoria no son errores de una linea: son **una segunda implementacion de algo
que ya existia, hecha aparte y peor**, o **una pieza terminada y probada que nadie llego a
conectar**.

| Bloque                                       | Hallazgos     | Severidad maxima |
| -------------------------------------------- | ------------- | ---------------- |
| A. Datos inventados en pantallas reales      | R-01 a R-05   | Alta             |
| B. Dos implementaciones del mismo reporte    | R-06 a R-09   | Alta             |
| C. Calculos incorrectos                      | R-10 a R-16   | Alta             |
| D. Modelo de datos y tipos                   | R-17 a R-22   | Media            |
| E. Seguridad y control de acceso             | R-23 a R-28   | Alta             |
| F. Arquitectura y frontera                   | R-29 a R-33   | Media            |
| G. Nombres, duplicacion y limpieza           | R-34 a R-37   | Media            |
| H. Pruebas, CI y documentacion               | R-38 a R-40   | Media            |
| I. Estado de despliegue                      | R-41 a R-50   | Alta             |
| J. Segunda pasada: modulos restantes         | R-51 a R-60   | Alta             |

Lo que **si** esta bien y no hace falta tocar, para que no se pierda entre lo anterior:

- No hay ninguna llave real en el repositorio, y `packages/shared/entorno/reglas.js` **rechaza al
  arrancar** una `service_role` en el bundle del cliente.
- `packages/shared` no importa `react-dom`, `react-native` ni `react-bootstrap`, y no toca
  `document`, `window`, `localStorage` ni `AsyncStorage`. La frontera se respeta.
- Las apps no importan `@supabase/supabase-js` directamente en ningun archivo de codigo.
- La matriz RLS es solida y esta bien razonada: denegacion por defecto (00030), perfil inactivo
  sin rol efectivo (00079), IDOR clinico cerrado (00082), imposibilidad de quedarse sin
  administrador (00072/00103), y `supabase/tests/database/` con 26 archivos pgTAP.
- El CI corre lint, formato, pruebas, build, verificacion de esquema, `supabase db lint`, pgTAP y
  e2e, y ademas verifica que ninguna migracion ya aplicada se edite y que la numeracion sea
  correcta.
- La documentacion (`PERMISOS.md`, `ARQUITECTURA-FRONTEND.md`, `CI-CD.md`) esta muy por encima de
  la media, y los comentarios de las migraciones explican el **por que**, no el **que**.

---

## Bloque A. Datos inventados en pantallas que estan en produccion

Cinco pantallas alcanzables por un usuario real muestran numeros, nombres y alertas que no salen
de la base de datos. Es el bloque mas grave porque el sistema **miente sin fallar**: no hay error,
no hay aviso, y los datos parecen plausibles.

### R-01. El reporte de resultados de la jornada esta inventado entero (ALTA)

`packages/shared/reportes/useReporteJornada.js:17`

```js
// TODO: Reemplazar por llamadas reales a API
setDatos({
  jornada: { nombre: "Jornada Comunidad Ejemplo", ... },
  pacientesAtendidos: 47,
  diagnosticos: [{ nombre: "Hipertension Arterial", cantidad: 12 }, ...],
  personal: [{ nombre: "Dr. Juan Perez", ... }, { nombre: "Dra. Maria Lopez", ... }],
});
```

La ruta `/reportes/jornada/:id` (`App.jsx:153`) renderiza `ReporteJornada.jsx`, que consume este
hook. **Cualquier jornada muestra los mismos 47 pacientes y el mismo personal ficticio.**

Lo grave del caso es que la implementacion real **ya existe y esta probada**:
`packages/shared/reportes/jornada.api.js` -> `obtenerReporteJornada({ jornadaId, rol })`, con su
guarda de rol correcta (solo administrador y medico, espejo de la 00033) y su propia suite en
`jornada.api.test.js`. **Ningun archivo la llama.**

Las issues #206 (API del reporte) y #215 (pantalla) estan **cerradas**.

### R-02. El kardex de movimientos esta inventado entero (ALTA)

`packages/shared/inventario/useKardexMovimientos.js:90`

```js
// TODO: Reemplazar por llamada real a API cuando #159 este lista
// const respuesta = await listarMovimientos({ loteId, medicamentoId });
setMovimientos([ { id: "m1", ... "Administradora Demo" }, ... ]);
```

`KardexMovimientosPage.jsx` muestra esos cuatro movimientos de mentira para cualquier lote.
`listarMovimientos()` **ya existe** en `inventario/movimientos.api.js:14`, asi que el TODO espera
algo que llego hace tiempo. Ademas `exportar()` (linea 162) solo hace `console.log`: el boton de
exportar no exporta nada.

Los datos de mentira usan `fecha_aprobacion`, columna renombrada a `aprobado_en` por la 00094.

Issue #161 (kardex) esta **cerrada**.

### R-03. La pantalla de inicio movil muestra metricas y alertas inventadas (ALTA)

`apps/mobile/src/screens/InicioScreen.js:113-152`. `metricas` y `alertasCaducidad` son constantes
locales: "235 pacientes atendidos", "Q 553,800 en donaciones", "9 voluntarios activos",
"Amoxicilina 500mg vence en 30d". Es la primera pantalla que ve cualquier persona al entrar a la
app movil.

### R-04. ProyectosScreen movil siempre pinta datos demo, para todos los roles (ALTA)

`apps/mobile/src/screens/ProyectosScreen.js:53`

```js
const { proyectos: proyectosBD, cargando, cambiarEtapaProyecto } = useProyectosSociales();
```

El hook recibe `{ usuarioRol }` (ver `useProyectosSociales.js:26`). Al llamarlo sin argumentos,
`usuarioRol` es `undefined`, `puedeVerProyectos(undefined)` es `false`, y el hook devuelve
`proyectos: []` **sin consultar nunca**. Y el `useMemo` de la linea 60 cae entonces a
`PROYECTOS_DEMO`. Resultado: **la administradora tambien ve tres proyectos inventados**.

`apps/web/src/pages/ProyectosSocialesPage.jsx:33` si pasa `{ usuarioRol }`. Es exactamente la
misma llamada, hecha bien en una plataforma y mal en la otra.

### R-05. InventarioPage opera con un usuario de prueba escrito a mano (ALTA)

`apps/web/src/pages/InventarioPage.jsx:104-108`

```js
// USUARIO DE PRUEBA (en produccion reemplaza por useAuth())
const esAdmin = true;
const usuarioActual = { id: "user-admin-uuid", rol: esAdmin ? "Administrador" : "Usuario" };
```

Ese objeto viaja a `usePendientesValidacion({ usuarioId, rolUsuario })` y de ahi, tal cual, a
`aprobarMovimiento()` / `rechazarMovimiento()`. La primera linea de `validacion.api.js:22` es:

```js
if (!esAdministrador(rolUsuario)) return { error: { mensaje: "Operacion exclusiva para el rol Administrador." } };
```

`esAdministrador("Administrador")` es **false**: el enum `rol_usuario` de la 00001 declara
`administrador` en minuscula. **La bandeja de validacion nunca aprueba ni rechaza nada, ni
siquiera para la administradora real.** Y si pasara la guarda, `aprobado_por: "user-admin-uuid"`
fallaria con `22P02` por no ser un UUID.

Es literalmente el mismo error que la issue #598 documenta haber corregido en donaciones:

> Los cuatro hooks del modulo traian su propia lista de roles escrita a mano --
> `["Administrador", "Junta Directiva", "Socio Fundador"]` -- con las iniciales en mayuscula.
> [...] ninguna de esas cadenas coincidia nunca.

---

## Bloque B. Dos implementaciones del mismo reporte

Los cuatro reportes tienen **dos versiones en el repositorio**: una en `<modulo>/api.js`, con
comentarios largos, guarda de rol y pruebas; y otra en un `use*.js` sin barril, sin pruebas y con
emojis en los comentarios. **Las pantallas usan siempre la segunda.**

| Reporte              | Version probada (sin usar)                        | Version conectada a la pantalla                    |
| -------------------- | ------------------------------------------------- | -------------------------------------------------- |
| Impacto              | `reportes/api.js` -> `obtenerIndicadoresImpacto`  | `reportes/useDashboardMetricas.js`                  |
| Pacientes atendidos  | `reportes/pacientes.api.js` (RPC 00067/00095)     | `reportes/useReportePacientes.js` (lee otra vista)  |
| Inventario actual    | `reportes/inventario.api.js`                      | `reportes/useReporteInventario.js`                  |
| Resultados de jornada| `reportes/jornada.api.js`                         | `reportes/useReporteJornada.js` (datos inventados)  |

### R-06. Las cuatro API de reporte no las llama nadie (ALTA)

Verificado por busqueda: `obtenerIndicadoresImpacto`, `obtenerReportePacientesAtendidos`,
`obtenerReporteDeInventario` y `obtenerReporteJornada` solo aparecen en su propio archivo, en su
test y en comentarios. Lo mismo pasa con `exportarFilasACSV` (R-19) y con el par
`useFiltrosReportes` + `BarraFiltrosReporte.jsx` (issues #208 y #210, ambas cerradas), que estan
huerfanos.

### R-07. Las dos versiones no calculan lo mismo

- **Comunidades beneficiadas**: `api.js` cuenta `comunidad_id` distintos ignorando los nulos;
  `useDashboardMetricas` no filtra los nulos.
- **Medicamentos distintos**: `inventario.api.js` cuenta todos los grupos;
  `useReporteInventario` cuenta solo los no vencidos.
- **Lote vencido**: tres definiciones distintas (ver R-11).
- **Guarda de rol**: `api.js` llama a `puedeVerIndicadoresDeImpacto(rol)`; el hook no comprueba
  nada.

### R-08. `vista_reporte_impacto.consultas_realizadas` no la lee nadie

`reportes/api.js` no la incluye en `COLUMNAS_DEL_REPORTE`. La vista la calcula en cada consulta y
se descarta. (Respuesta directa a "en las vistas se usan todos los campos de los modelos": aqui
no.)

### R-09. `reportes/pacientes.api.js` y `useReportePacientes` miden cosas distintas

La API llama a `fn_reporte_pacientes_atendidos` (00067, corregida por la 00095), que devuelve
`nuevos`, `recurrentes`, `hombres`, `mujeres`, `menores`, `adultos`, `adultos_mayores`. El hook lee
`vista_reporte_impacto`, que **solo tiene `pacientes_atendidos`**. Los indicadores demograficos que
la 00095 arreglo con detalle no llegan a ninguna pantalla.

---

## Bloque C. Calculos incorrectos

### R-10. `useVistaExistencias.calcularDiasRestantes` corre un dia todas las fechas (ALTA)

`packages/shared/inventario/useVistaExistencias.js:23-36`

```js
const hoy = new Date();            hoy.setHours(0, 0, 0, 0);
const fechaVenc = new Date(fechaCaducidad);   fechaVenc.setHours(0, 0, 0, 0);
```

`new Date("2026-01-15")` se interpreta como **medianoche UTC**, que en Guatemala (UTC-6) es el
**14 de enero a las 18:00**. `setHours(0,0,0,0)` la lleva entonces a la medianoche local del
**dia 14**. Todos los vencimientos se adelantan un dia.

Un lote que vence hoy sale `diasRestantes = -1` y por tanto **VENCIDO**, cuando la propia
cabecera del archivo promete lo contrario:

```js
// • Vence HOY -> SI es entregable -> DISPONIBLE
// COINCIDE CON: vista_lotes_disponibles -> fecha_vencimiento >= CURRENT_DATE
```

`packages/shared/formato/fechas.js` existe justo para esto, documenta la trampa en su cabecera y
ya expone `diasHastaVencimiento()`, que la resuelve con `aFechaLocal()`.

### R-11. Cuatro definiciones de "lote vencido", tres de ellas con el mismo desfase (ALTA)

| Donde                                          | Como decide                                     | Correcto |
| ---------------------------------------------- | ------------------------------------------------ | -------- |
| `inventario/lotes.validaciones.js` `esLoteEntregable` | `diasHastaVencimiento()` >= 0 (usa `aFechaLocal`) | Si      |
| `inventario/lotes.validaciones.js` `sugerirLote`     | `new Date(f) >= hoy` con `setHours(0,0,0,0)`      | No      |
| `inventario/useVistaExistencias.js`                  | ver R-10                                          | No      |
| `reportes/useReporteInventario.js:88`                | `new Date(f) < new Date()` (con hora)             | No      |

En `useReporteInventario` la comparacion es contra `hoy = new Date()` **con hora incluida**, asi
que un lote que vence hoy siempre cuenta como vencido.

Las dos primeras conviven **en el mismo archivo**, con `sugerirLote` re-implementando la regla que
`esLoteEntregable` ya resuelve diez lineas mas arriba.

### R-12. El panel de indicadores agrupa por nombre de mes y mezcla anios (ALTA)

`packages/shared/reportes/useDashboardMetricas.js:120-123`

```js
const fecha = new Date(fila.fecha);
clave = fecha.toLocaleDateString("es-GT", { month: "short" });
```

La clave del grupo es `"ene"`, `"feb"`. **Enero de 2025 y enero de 2026 caen en el mismo bucket**,
y el grafico suma anios distintos como si fueran el mismo mes. `reportes/api.js:58` lo resuelve
bien con `fecha.slice(0, 7)` -> `"2026-01"`.

Encima `new Date(fila.fecha)` vuelve a caer en la trampa de R-10: una jornada del dia 1 de un mes
se agrupa en el mes anterior.

### R-13. El rango de fechas del panel se calcula en UTC

Misma linea 159: `formatoFecha = (d) => d.toISOString().slice(0, 10)`. Con una hora local entre las
18:00 y las 24:00, `toISOString()` ya es del dia siguiente, y el rango consultado se desplaza un
dia.

### R-14. `useRegistroSalida` ofrece la cantidad ingresada como si fuera el stock (ALTA)

`packages/shared/inventario/useRegistroSalida.js:24-36`

```js
.from("lotes").select("id, numero_lote, fecha_vencimiento, cantidad_ingresada")
...
cantidad_disponible: lote.cantidad_ingresada,
```

`lotes.cantidad_ingresada` es lo que **entro** al lote, no lo que **queda**. El stock vivo esta en
`existencias.cantidad_disponible`, por bodega (00020, y la 00047 lo dejo explicito). Ademas la
consulta no filtra lotes vencidos ni por bodega.

Efecto: la pantalla de salida de medicamentos ofrece despachar cantidades que no existen. La base
lo frena (`fn_aplicar_ajuste_existencias`, 00047, lanza "Existencia insuficiente"), asi que no se
corrompe el inventario, pero quien opera en campo ve una cifra falsa y descubre el problema al
final del flujo.

`fn_existencias_disponibles` (00065) y `consultarLotesDisponibles()`
(`inventario/existencias.api.js:100`) hacen exactamente lo que este hook necesita.

### R-15. `useReporteInventario` se traga los errores de consulta (ALTA)

`packages/shared/reportes/useReporteInventario.js:23` y `:75`

```js
const { data, err } = await supabase.from("bodegas").select(...);
if (err) throw err;
```

`supabase-js` devuelve `{ data, error }`, **no `err`**. `err` es siempre `undefined`, el `throw`
no salta nunca, y cuando la consulta falla (denegacion RLS, red, `42501`) `data` llega `null`,
`procesados` queda vacio y **el reporte dice que no hay inventario**. Dos veces en el mismo
archivo.

Los otros dos sitios que parecian tener el mismo problema (`useRegistroSalida.js:24`,
`useReportePacientes.js:52`) usan el alias correcto `error: err` y estan bien.

### R-16. Otras dos imprecisiones menores

- `reportes/api.js:112`: `variacion()` devuelve `100` cuando el periodo anterior vale 0 y el
  actual es positivo. Es una convencion defendible, pero no esta documentada y no distingue entre
  "de 0 a 1" y "de 0 a 5.000".
- `useDashboardMetricas` deriva la lista de comunidades del selector **a partir de los datos ya
  filtrados**: al filtrar por una comunidad, el desplegable se queda con esa sola y no hay forma de
  volver sin recargar.

---

## Bloque D. Modelo de datos y tipos

### R-17. `pacientes.sexo` es texto libre sin CHECK ni enum

Todas las demas columnas categoricas del esquema son enums (21 tipos). `sexo` es
`VARCHAR(20) NOT NULL` sin restriccion, y el vocabulario real vive en `OPCIONES_SEXO`, dentro de
`pacientes/usePacientesListado.js` -- un hook, no `enums.js`.

Ya causo un error real: la 00095 documenta que el reporte de pacientes comparaba `upper(sexo) = 'M'`
y devolvia siempre cero. La correccion (comparar con `LIKE 'M%'` / `'F%'`) es explicitamente un
parche, y la propia migracion dice:

> No es la solucion definitiva -esa es normalizar la columna, que es un cambio de esquema con su
> propia issue-

**Esa issue no existe.**

### R-18. `triajes.imc` puede desbordar dentro de los CHECK vigentes

`NUMERIC(4, 1)` admite hasta `999.9`. Los CHECK de la misma tabla permiten `peso` hasta 400 y
`talla` desde 30, asi que `400 / (0.30^2) = 4444.4` -> `numeric field overflow` (22003) al
insertar. Un error de captura realista (talla de un lactante con el peso de un adulto) tumba el
registro del triaje con un error crudo de Postgres. Faltan un CHECK sobre el IMC o un tipo mas
ancho.

### R-19. El IMC se calcula en dos sitios, contradiciendo su propio comentario

`pacientes/triaje.api.js:7` dice, en mayusculas: *"EL IMC NO SE ENVIA NUNCA, Y ESO NO ES UN
OLVIDO... el IMC se lee de la base y no se recalcula en el cliente"*. Pero
`pacientes/useRegistroTriaje.js:30` exporta `calcularImc()`, y `TriajeScreen.js:111` lo pinta. La
base usa `NUMERIC` exacto; el cliente, coma flotante: pueden discrepar en la ultima cifra.

### R-20. El DPI tiene tres longitudes distintas segun donde se mire

| Donde                                     | Regla                    |
| ----------------------------------------- | ------------------------ |
| `pacientes.dpi` (00009)                   | `VARCHAR(20)`, sin CHECK |
| `CAMPOS_REGISTRO_PACIENTE` (`campos.js`)  | `maxLongitud: 20`        |
| `CAMPOS_PACIENTE` (`campos.js`)           | `maxLongitud: 13`        |
| `REGEX_DPI` (`validaciones.js:9`)         | exactamente 13 digitos   |

La regla correcta es la de 13 (el DPI guatemalteco), pero la columna y el descriptor de registro
dicen otra cosa.

### R-21. El formulario de edicion de paciente cubre 5 de 11 campos

`CAMPOS_PACIENTE` (el descriptor de edicion) tiene `nombres`, `apellidos`, `fechaNacimiento`, `dpi`
y `comunidad`. **No permite corregir** `sexo`, `telefonoContacto`, `idioma`, `tipoSangre`,
`nombreResponsable` ni `parentescoResponsable`, aunque el registro los captura, la ficha los
muestra y `MAPA_COLUMNAS_DEL_PACIENTE` (`api.js:87`) los sabe traducir. Un telefono mal escrito no
se puede arreglar desde la aplicacion.

Ademas `CAMPOS_PACIENTE.comunidad` declara `maxLongitud: 100` sobre lo que es un UUID.

### R-22. Un tipo de dato mal elegido en `useReporteInventario`

`ESTADO_EXISTENCIA` (`useVistaExistencias.js:8`) usa **cadenas de interfaz** como valores de
filtro: `"Proximo a vencer"`, `"Sin existencia"`. Los estados del dominio viven en `enums.js` con
la clave estable separada de la etiqueta, y las etiquetas en `@ecopac/ui-tokens`.

---

## Bloque E. Seguridad y control de acceso

La matriz RLS es la parte mas cuidada del proyecto y aguanta la revision. Los hallazgos de aqui
estan **por encima** de ella: en el cliente, en las Edge Functions y en las rutas.

### R-23. La Edge Function `invitar-usuario` no comprueba que el perfil este activo (ALTA)

`supabase/functions/invitar-usuario/index.ts:86-99`

```ts
.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
if (errorDePerfil || perfilDeQuienLlama?.rol !== "administrador") { ... 403 }
```

Comprueba el rol y **no `activo`**. La migracion 00079 existe precisamente para que un perfil
desactivado deje de tener privilegios, y lo consiguio en la base haciendo que `rol_actual()` filtre
por `activo`. Pero esta funcion no pasa por `rol_actual()`: lee la columna a mano.

Y la politica de SELECT de `perfiles` deja **a proposito** que un perfil desactivado lea su propia
fila (00079 lo documenta: es como la aplicacion averigua que la cuenta esta dada de baja). Asi que
la consulta devuelve `rol: 'administrador'` y **la funcion deja pasar**.

Una administradora desactivada, con un JWT todavia vigente (`jwt_expiry = 3600`), **puede seguir
dando de alta cuentas nuevas**. Es la quinta via de escape de la 00079, que esa migracion
enumero (a, b, c, d, e) sin incluir a las Edge Functions porque todavia no existian.

Arreglo: `select("rol, activo")` y exigir las dos cosas.

### R-24. La app movil no aplica control de acceso por rol; `RutaProtegida` es codigo muerto (ALTA)

`apps/mobile/src/components/RutaProtegida.js` se creo para la issue #427 ("La app movil no aplica
ningun control de acceso por rol"). **Ningun archivo lo importa.** `AppNavigator.js` filtra la tab
bar con `tabsMoviles(rol)`, pero registra las pantallas de los stacks internos
(`Donaciones`, `Proyectos`, `Presupuestos`, `Voluntarios`, `FichaVoluntario`) **sin guarda**, y
`InicioScreen` navega a ellas por nombre.

`Voluntarios` es `roles: ADMIN` en `navegacion.js`. La issue #427 esta **cerrada**.

### R-25. `InicioScreen` movil abre en modo administrador cuando no hay perfil (ALTA)

`apps/mobile/src/screens/InicioScreen.js:74-93`

```js
const rol = perfil?.rol || "administrador";
...
const modulosDisponibles = modulosCalculados.length > 0 ? modulosCalculados.map(...) : MODULOS_FIGMA;
```

Dos caidas abiertas seguidas: si el perfil aun no cargo, **el rol por defecto es administrador**;
y si el rol resuelto no tiene ningun modulo visible, se pintan **todos**. Ademas los botones
"Ver inventario" (linea 172) y "Ver presupuestos" (linea 178) navegan sin pasar por el filtro de
`modulosVisibles`.

Los datos siguen protegidos por RLS, pero el menu ensena a cada rol funciones que no le tocan y la
cabecera de `navegacion.js` dice exactamente lo contrario.

### R-26. `/reportes/dashboard` esta fuera del guard de rol

`apps/web/src/App.jsx:157`. Las otras tres rutas de reportes van dentro de
`<RutaProtegida roles={rolesDe("/reportes")} />`; esta queda fuera del grupo y solo hereda el guard
de autenticacion. Un medico o un voluntario pueden abrirla. El `WHERE` de `vista_reporte_impacto`
(00054/00080) impide la fuga de datos, asi que la consecuencia es una pantalla vacia sin
explicacion, no un escape -- pero es una linea de mas en la anidacion, no una decision.

### R-27. Inyeccion de formulas en los CSV exportados

`packages/shared/reportes/csv.js:43` implementa RFC 4180 correctamente (comillas, BOM, CRLF) pero
**no neutraliza el prefijo de formula**: un valor que empiece por `=`, `+`, `-`, `@` o tabulador se
ejecuta al abrir el archivo en Excel o Sheets.

Los reportes exportan nombres de paciente, nombres de medicamento y el campo libre `concepto` de
`gastos`, todos escritos por usuarios. Y como las tres pantallas que exportan **no usan esta
funcion** (R-19), hoy ni siquiera hay comillas: el problema esta en los dos sitios.

### R-28. Endurecimiento pendiente en funciones y CORS

- **`SET search_path` ausente** en 14 funciones, incluidas `es_administrador()` y `es_consultivo()`,
  que son la base de casi toda la matriz RLS, y en los triggers de inventario
  (`fn_aplicar_ajuste_existencias`, `fn_actualizar_existencias`,
  `fn_autoaprobar_movimiento_inventario`, `fn_bloquear_movimiento_finalizado`,
  `fn_registrar_paciente`, `fn_autoaprobar_gasto_administrador`, ...). Sus companeras
  `rol_actual()`, `tiene_permiso()` y `participa_en_jornada()` si lo tienen. Es la advertencia
  `function_search_path_mutable` del linter de Supabase, y `supabase db lint` **no la detecta**.
- **`Access-Control-Allow-Origin: "*"`** en `supabase/functions/_shared/cors.ts`, para una funcion
  que crea cuentas. La autenticacion va por cabecera y no por cookie, asi que no es un CSRF, pero
  no hay razon para no listar los origenes reales.
- **`invitar-usuario` se traga el fallo del correo** (linea 194): la cuenta se crea, el correo para
  establecer contrasena no sale, y la pantalla responde 200. La persona invitada nunca puede entrar
  y nadie se entera.

---

## Bloque F. Arquitectura y frontera

### R-29. 22 imports cruzan la frontera del paquete con rutas relativas

21 archivos de `apps/web` y 1 de `apps/mobile` importan asi:

```js
import { useGestionLotes } from "../../../../packages/shared/inventario/useGestionLotes.js";
```

en vez de por el alias `@ecopac/shared`. Consecuencias:

- Es lo que produce el aviso de `verificar:shared-esquema`: **13 archivos de `packages/shared` que
  ningun barril reexporta**, y por tanto *"vite build no los compila, asi que un error suyo no
  aparece hasta conectarlos"*.
- Cuatro de esos imports **omiten la extension** (`useVistaExistencias`, `useKardexMovimientos`,
  `useRegistroSalida`, `useCatalogoMedicamentos`): funciona en Vite y en Metro, no en Node ESM.
- El `exports` de `packages/shared/package.json` (`"./*": "./*/index.js"`) no resuelve esas rutas,
  asi que la unica forma de importarlas es saltandose el paquete.
- La app movil no puede reutilizar esos hooks sin repetir la ruta relativa.

`packages/shared/reportes/dashboard.campos.js` no lo importa nadie, ni siquiera asi.

### R-30. `InventarioPage.jsx` concentra un modulo entero en 1.657 lineas

Es el archivo mas grande del repositorio. Dentro conviven el catalogo de medicamentos, los lotes,
las existencias, las alertas, la bandeja de validacion y cuatro modales; 136 colores escritos a
mano; formateo de fechas con `toLocaleDateString`; y **ocho resultados de hooks que se piden y no
se usan** (`pendientes`, `aprobar`, `rechazar`, `cargandoValidacion`, `errorValidacion`,
`marcarComoAtendida`, `categoriasDisponiblesAlertas`, y el import de `PanelAlertasVencimiento`).
Cada uno de esos hooks dispara su consulta al montar.

### R-31. Formateo dentro de las apps, teniendo `formato/` en shared

`packages/shared/formato/fechas.js` documenta en su cabecera por que **no** se usa `Intl` (en React
Native el resultado depende de los datos ICU del sistema). Aun asi:

| Archivo                                      | Que hace                                          |
| -------------------------------------------- | ------------------------------------------------- |
| `InventarioPage.jsx:1329,1434`               | `new Date(...).toLocaleDateString(...)`            |
| `KardexMovimientosPage.jsx:30`               | `toLocaleString("es-GT", ...)`                     |
| `PanelAlertasVencimiento.jsx:40`             | `toLocaleDateString("es-GT")`                      |
| `SeguimientoProyectoPage.jsx:155,248`        | `Q{...toLocaleString()}` y `toLocaleString()`      |
| `mobile/DonacionesScreen.js:68`              | `` `Q ${val.toLocaleString("es-GT", ...)}` ``      |
| `mobile/ProyectosScreen.js:138,146,202`      | `Q {...toLocaleString()}`                          |
| `mobile/KanbanBoard.js:34`                   | `Q {Number(...).toLocaleString()}`                 |
| `web/ListaPacientes.jsx:14`                  | `` `${fila.edad}a` ``                              |

`formatearMoneda()` existe y solo lo usan `DataList` y dos paginas de presupuestos.

### R-32. 727 colores escritos a mano

521 en `apps/web` y 206 en `apps/mobile`, contando solo hexadecimales de seis digitos. La regla de
`AGENTS.md` es: *"Ningun color, espaciado ni tamano de fuente se escribe a mano: todo sale de
`@ecopac/ui-tokens`"*.

Peores casos: `InventarioPage.jsx` (136), `DonacionesScreen.js` (53),
`AdministracionBodegasProveedoresPage.jsx` (48), `ReportePacientesPage.jsx` (42),
`CatalogoMedicamentosScreen.js` (41), `ReporteInventarioPage.jsx` (39), `InicioScreen.js` (38),
`BarraFiltrosReporte.jsx` (38).

### R-33. Un vocabulario de descriptores paralelo

`useVistaExistencias.js:158` publica columnas como `{ clave, etiqueta, ordenable, alineacion }`.
El contrato del proyecto (`descriptores.js`, y todos los `columnas.js`) es
`{ id, label, tipo, desde, anchoWeb }`. Los `DataList` de las dos apps solo entienden el segundo,
asi que esas columnas no se pueden usar con el componente comun.

---

## Bloque G. Nombres, duplicacion y limpieza

### R-34. Vocabulario de estados divergente en la app movil

`apps/mobile/src/screens/ProyectosScreen.js:14`

```js
const ETAPAS_KANBAN = [
  { id: "planificacion", ... }, { id: "en_ejecucion", ... },
  { id: "completado", ... },    { id: "cancelado", ... },
];
```

El enum `estado_proyecto` (00007) y `ESTADOS_PROYECTO` (`enums.js:90`) dicen
`planificado`, `en curso`, `finalizado`, `cancelado`. Ninguno de los tres primeros coincide.

Con datos reales, `p.estado === "en_ejecucion"` nunca es cierto, las columnas del kanban quedan
vacias y `cambiarEtapaProyecto(id, "en_ejecucion")` fallaria con `22P02`. Hoy no se ve porque la
pantalla siempre pinta los datos demo (R-04).

La misma pantalla lee `p.presupuesto` y `p.beneficiarios`, que **no son columnas de `proyectos`**
ni las devuelve `COLUMNAS_DEL_PROYECTO`. Las metricas "presupuesto total" y "beneficiarios" darian
0 con datos reales.

### R-35. `sugerirLote` es una implementacion FEFO completa que nadie llama

`inventario/lotes.validaciones.js:60`, 45 lineas, con pruebas propias. No la importa ningun hook ni
ninguna pantalla, y `useRegistroSalida` -- que es justo donde haria falta -- toma el primer lote
por fecha sin usarla (y con el stock equivocado, R-14). Ademas usa `fecha_vencimiento` y
`cantidad_disponible` en snake_case, mientras `esLoteEntregable`, en el mismo archivo, acepta las
dos formas.

### R-36. Codigo construido que nadie conecta

| Pieza                                             | Issue de origen |
| ------------------------------------------------- | --------------- |
| `reportes/api.js` -> `obtenerIndicadoresImpacto`  | #205, #214      |
| `reportes/pacientes.api.js`                       | #202, #211      |
| `reportes/inventario.api.js`                      | #212            |
| `reportes/jornada.api.js`                         | #206, #215      |
| `reportes/csv.js` -> `exportarFilasACSV`          | #207            |
| `reportes/useFiltrosReportes.js`                  | #208            |
| `apps/web/src/pages/BarraFiltrosReporte.jsx`      | #210            |
| `apps/web/src/pages/VistaExistenciasPage.jsx`     | --              |
| `apps/mobile/src/components/RutaProtegida.js`     | #427            |
| `apps/mobile/src/screens/RestaurandoSesionScreen.js` | --           |
| `inventario/lotes.validaciones.js` -> `sugerirLote` | #146          |
| `reportes/dashboard.campos.js`                    | #214            |

Doce piezas, casi todas de issues **cerradas**. No es codigo de mas: es trabajo terminado que se
quedo a un import de servir.

### R-37. 161 emojis en 33 archivos de codigo

`AGENTS.md`: *"No usar emojis en codigo, descripciones, mensajes de commit, issues ni PRs"*.
Concentrados en los mismos archivos del bloque B: `InventarioPage.jsx` (21),
`DashboardMetricasPage.jsx` (13), `useVistaExistencias.js` (12),
`useAdministracionBodegasProveedores.js` (11), `useAlertasVencimiento.js` (11).

Dos de ellos **acaban en los datos exportados**: `useReporteInventario.js:174` escribe
`"❌ Vencido"`, `"⚠️ Por vencer"` y `"✅ Vigente"` en las celdas del CSV.

---

## Bloque H. Pruebas, CI y documentacion

### R-38. La cobertura real es mucho menor de lo que sugiere el numero

| Paquete          | Lineas | Archivos de prueba | Cobertura medida            |
| ---------------- | ------ | ------------------ | --------------------------- |
| `packages/shared`| 49.314 | 110                | solo `**/validaciones.js` (510 sentencias) |
| `apps/web`       | 16.616 | 2                  | ninguna                     |
| `apps/mobile`    | 7.363  | **0**              | ninguna, y **sin script `test`** |

El umbral del 97,64% de `packages/shared` esta bien razonado en `vitest.config.js` y no es
enganoso a proposito -- el propio archivo explica por que solo mide las validaciones. Pero el
efecto practico es que **ninguno de los hallazgos del bloque A ni del B puede detectarlos el CI**:
los `use*.js` con datos inventados no tienen prueba, y `npm test` salta `apps/mobile` por
`--if-present`.

La issue #515 ya arreglo el "apps sin script test" para web. Movil se quedo fuera.

### R-39. Consultas sin paginar contra un tope de 1.000 filas

`supabase/config.toml:16` fija `max_rows = 1000`. En `packages/shared` solo tres funciones paginan
(`donaciones/historial.api.js`, `pacientes/historial.api.js`, `usuarios/api.js`). Las demas piden
`.select()` sin `.range()` y **agregan en el cliente**:

- `reportes/inventario.api.js` suma sobre `existencias`, que tiene una fila por (lote, bodega).
- `useReporteInventario` filtra por estado de vencimiento **despues** del corte.
- `obtenerIndicadoresImpacto` y `useDashboardMetricas` suman filas de `vista_reporte_impacto`.
- `listarGastos`, `listarMovimientos` y los listados de catalogo.

Cuando se pase de 1.000 filas, los totales **empezaran a mentir sin ningun error**. La issue #228
("Verificar el rendimiento con el crecimiento de la base de datos") es el sitio natural para esto,
pero hoy no menciona el tope ni la agregacion en cliente.

### R-40. Documentacion desactualizada en tres sitios

- **`docs/PERMISOS.md`, tabla de divergencias**: las filas 2, 3 y 7 estan marcadas como abiertas y
  **ya estan resueltas** -- la 2 por la 00080 (`es_consultivo()`), la 3 por la 00085 (escritura de
  `perfil_especialidad`), y la 7 por `navegacion.js`, que ahora usa `OPERATIVOS_CLINICOS`. La fila
  14 sigue diciendo "sin issue" cuando la #514 la cubre. `AGENTS.md` exige que un PR que cambia una
  politica actualice ese documento en el mismo PR.
- **`inventario/bodegas.permisos.js:6` y `lotes.permisos.js:6`** citan la migracion **00062** como
  la politica vigente de bodegas y proveedores. La 00079 borro esas cuatro politicas; mandan las de
  la 00034. Es un comentario equivocado en un archivo de permisos.
- **`apps/web/src/App.jsx:165`** remite a `eme.md`, que no existe en el repositorio.

Ademas: **la 00061 y la 00062 son la misma migracion duplicada** (la 00062 solo anade
`DROP POLICY IF EXISTS`). Ya estan aplicadas y no se editan; queda como ruido historico.
Y `.expo/devices.json`, en la raiz, esta versionado: `.gitignore` solo ignora
`apps/mobile/.expo/`.

---

## Bloque I. Estado de despliegue

Revisado el **3 de septiembre de 2026**, sobre las seis ramas remotas, los cinco workflows, la
configuracion de Vercel y Docker, y el estado de `main`.

La conclusion corta: **el mecanismo de despliegue esta construido y bien construido; lo que falta
son datos, secrets y un primer merge**. El esquema se aplica solo, las Edge Functions se despliegan,
el primer administrador se aprovisiona sin credenciales versionadas, y `docs/QUICKSTART.md`
documenta con tablas de "que se rompe si falta" todo lo que hay que poner a mano en los dos
dashboards. Lo que sigue son los huecos.

### R-41. `main` lleva 274 commits y tres semanas de atraso (ALTA)

```
$ git rev-list --left-right --count origin/main...origin/develop
0    274
$ git log -1 --format=%cs origin/main
2026-08-13
```

`main` es la rama por defecto y tiene **una** migracion (`00001`); `develop` tiene **103**. Tres
consecuencias:

**Ningun cron del repositorio ha corrido jamas.** GitHub dispara `schedule:` solo desde la rama por
defecto, y dos de los tres workflows programados no existen alli:

```
$ gh run list --workflow=alertas-vencimiento.yml
HTTP 404: workflow alertas-vencimiento.yml not found on the default branch
$ gh run list --workflow=verificar-despliegue.yml
HTTP 404: workflow verificar-despliegue.yml not found on the default branch
```

`alertas-vencimiento.yml` ya lo advierte en su cabecera. `verificar-despliegue.yml` es el caso
ironico: se escribio para la issue #457 porque *"un workflow no puede avisar de que el mismo no
existio"*, y lleva desde entonces sin ejecutarse por la misma clase de motivo.

**`main` conserva dos workflows que `develop` elimino**: `backend-ci.yml` y
`supabase-migrations.yml`, absorbidos por `supabase.yml`.

**El primer merge no es un incremento, es una carga inicial de 102 migraciones.** No es
necesariamente un problema -- el job `validar` hace exactamente eso en cada corrida, con 466
aserciones pgTAP en verde -- salvo por R-43.

### R-42. El catalogo geografico no llega a ningun ambiente remoto (ALTA)

Es el bloqueo mas duro, y hoy no tenia issue: `docs/PERMISOS.md` lo menciona en la divergencia 4 y
lo declara fuera de su alcance.

`departamentos` y `municipios` viven en `supabase/seed.sql`; `comunidades`, en `seed-demo.sql`.
`supabase/config.toml` los engancha a `[db.seed].sql_paths`, que **solo corre en
`supabase db reset`**. El despliegue corre `db push`, que nunca ejecuta seeds.

| Catalogo | Como llega | Llega a prod |
| --- | --- | --- |
| `permisos`, `rol_permiso` (00003, 00037) | migracion | Si |
| `condiciones_cronicas` (00010) | migracion | Si |
| `bodegas` (00017) | migracion | Si |
| `medicamentos` (00050) | migracion | Si |
| `diagnosticos` (00105) | migracion | Si |
| `idiomas` (00110) | migracion | Si |
| **`departamentos`, `municipios`** | **`seed.sql`** | **No** |
| **`comunidades`** | **`seed-demo.sql`** | **No** |

Y tampoco se pueden crear desde la aplicacion: `comunidades` tiene **una sola politica**,
`"Sesion activa lee comunidades"` (SELECT, 00079). No hay INSERT ni UPDATE para ningun rol.

Como `jornadas.comunidad_id` es NOT NULL (00012), en `ecopac-prod` recien desplegado **no se puede
crear la primera jornada**. Sin jornada no hay atenciones, consultas, recetas, gastos ni reportes.

### R-43. Lo que pgTAP verifica no es lo que tendra produccion (ALTA)

La issue #666 documenta, midiendo, que el stack local del CLI **no se parece a Supabase Cloud** en
los privilegios por defecto:

| | CLI 2.115.0 (la del CI) | CLI 2.116.0 |
| --- | --- | --- |
| Funciones de `public` ejecutables por `anon` | 0 | **25** |
| Tablas con `DELETE` para `authenticated` | 6 | **45** |

Si la 2.116.0 concede eso porque asi arranca hoy un proyecto de Supabase, entonces los proyectos
reales -- creados desde el Dashboard -- probablemente los tienen, y la prueba 8 de
`privilegios_anon.sql` esta pasando en un entorno que no es el que se despliega.

La 00049 blindo los defaults solo `ON TABLES` y `ON SEQUENCES`. La 00102 revoco `EXECUTE`
`FROM PUBLIC` con una lista escrita a mano, partiendo de que *"un `REVOKE ... FROM anon` habria
sido un no-op"* -- premisa cierta en local y posiblemente falsa en la nube.

El arreglo **ya esta escrito** en la rama `fix/pgtap-privilegios-en-rojo` (PR #667, cerrado): 75
lineas que barren con `ALL FUNCTIONS` en vez de una lista. Su numero de migracion (00109) esta
ocupado.

### R-44. Una sola contrasena de base de datos para los dos ambientes (ALTA)

`supabase.yml` elige el **proyecto** por rama pero usa un unico `SUPABASE_DB_PASSWORD` para el
`supabase link` de los dos. O `ecopac-prod` comparte contrasena con desarrollo -- y quien tenga la
de dev entra a los datos clinicos reales --, o el link de `main` falla y no se aplica ninguna
migracion. Lo mismo en `verificar-despliegue.yml`.

### R-45. No existen los secrets de produccion de los crons (ALTA)

| Secret | DEV | PROD |
| --- | --- | --- |
| `SUPABASE_PROJECT_REF_*`, `VITE_SUPABASE_URL_*`, `VITE_SUPABASE_ANON_KEY_*` | si | si |
| `SUPABASE_URL_*` | si | **no existe** |
| `SUPABASE_SERVICE_ROLE_KEY_*` | si | **no existe** |

Los dos que faltan los leen `alertas-vencimiento.yml` y `keep-alive-supabase.yml`. Sin ellos, RF-19
(alertas de caducidad) **nunca se generara en produccion**, y el keep-alive dejara a `ecopac-prod`
expuesto a la pausa por inactividad del plan gratuito. Peor: en cuanto `develop` llegue a `main`,
los dos crons empiezan a correr **contra desarrollo**.

`SUPABASE_URL_DEV` ademas no esta en la tabla de secrets de `docs/CI-CD.md`.

### R-46. Cuatro ramas sin pull request (MEDIA)

`gh pr list --state open` no devuelve nada.

| Rama | Commits propios | Estado real |
| --- | --- | --- |
| `bugfix/registro-donacion-635` | **0** | Identica a `develop`. Pero #635 y #636 siguen abiertas |
| `fix/sidebar-pacientes-roles-consultivos` | 1 | Su cambio ya esta en `navegacion.js` por otra via |
| `fix/pgtap-privilegios-en-rojo` | 1 | **Numero de migracion 00109 ocupado**. Su contenido importa (R-43) |
| `feat/bandeja-validacion-inventario-#158` | 2 | Trabajo real sin PR; #158 y #162 cerradas |

### R-47. La web se sirve en un solo bundle de 934 kB (MEDIA)

```
dist/assets/index-C8ikqBJf.js   934.03 kB │ gzip: 251.13 kB
(!) Some chunks are larger than 500 kB after minification.
```

Sin code splitting: abrir el login descarga las 33 pantallas. Para jornadas en comunidades rurales
sobre datos moviles, es la optimizacion con mejor retorno del proyecto, y `App.jsx` ya tiene la
forma adecuada (grupos de rutas por modulo) para resolverlo con `React.lazy`.

### R-48. Sin cabeceras de seguridad en ningun sitio (ALTA, ya cubierto por #229)

Ni en los dos `vercel.json` ni en `apps/web/nginx.conf`. Ninguna de las seis habituales.
`Referrer-Policy` importa mas de lo normal aqui: las rutas llevan el UUID del paciente
(`/pacientes/:id`).

### R-49. Sin automatizacion de dependencias (MEDIA, ya cubierto por #242)

`npm audit`: **15 moderate, 0 high, 0 critical**, de dos avisos raiz
(`decode-uri-component`, `uuid`), todos por tooling de Expo y ninguno en codigo publicado. Lo que
falta no son esos 15 avisos sino la vigilancia: no hay `dependabot.yml`, ni `npm audit` en el CI,
ni CodeQL. Tampoco `.nvmrc` ni `engines.node`, aunque los workflows fijen Node 22.

### R-50. Builds moviles sin empezar (MEDIA, ya cubierto por #60)

No hay `eas.json` ni workflow que compile. Y dos decisiones bloqueadas antes de poder configurar
nada: el `bundleIdentifier` sigue marcado como provisional en `app.config.js` (y no se puede
cambiar despues de publicar), y no esta decidido si se distribuye por tienda o por APK interno.

### Lo que ya esta resuelto

Para que no se rehaga:

- El job `aplicar` elige proyecto por rama, detecta deriva de historial con `db push --dry-run`
  antes de aplicar, y avisa sin fallar cuando falta un secret.
- **Las Edge Functions si se despliegan** (`supabase functions deploy --use-api`): la #628 quedo
  cerrada de verdad.
- El primer administrador se aprovisiona por la 00063, sin contrasena versionada.
- `main` tiene proteccion: tres checks requeridos, una aprobacion, sin force-push, con resolucion
  de conversaciones obligatoria.
- `docs/QUICKSTART.md` documenta, con tablas de "que se rompe si falta", lo que hay que configurar
  a mano en Supabase (Site URL, redirect, signup, SMTP) y en Vercel (Root Directory, variables por
  ambiente, rama de produccion).
- Los dos `vercel.json` y el verificador que los compara resuelven el rewrite de SPA, que es el
  fallo mas facil de olvidar.
- El build de produccion sale en verde en 2 segundos.

### Dos cosas que confirmar con la organizacion

- **El buzon `admin@ecopac.org`**, que la 00063 aprovisiona: si no existe de verdad, el unico
  camino para fijar la primera contrasena es el Dashboard de Supabase.
- **El identificador de paquete movil**, hoy `org.ecopacguatemala.digital`, marcado como
  provisional.

## Bloque J. Segunda pasada: los modulos que la primera dejo a medias

La primera pasada fue profunda en reportes, inventario (lectura), pacientes, el esquema y RLS, y
superficial en donaciones, presupuestos, jornadas, usuarios, atenciones y recetas. Esta segunda
pasada, del **3 de septiembre de 2026**, los cubre con el mismo metodo: auditar cada funcion de
escritura de cada hook y comprobar si de verdad llama a su API.

**El resultado se resume en una frase: el flujo clinico esta bien construido y el de inventario
esta hueco.**

### El metodo

Se recorrieron las funciones de escritura (`guardar*`, `registrar*`, `crear*`, `actualizar*`,
`aprobar*`, `atender*`...) de los 62 hooks de `packages/shared`, comprobando en cada una si su
cuerpo llama a una funcion importada de un `api.js` o a Supabase directamente.

### Lo que si escribe de verdad

| Modulo                                                                                          | Estado                                          |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **pacientes** (registro, edicion, triaje, consulta, receta, condiciones)                        | Correcto                                        |
| **jornadas** (alta, edicion, estado, asignacion, turnos, cierre)                                | Correcto                                        |
| **usuarios** (alta, edicion, desactivacion, permisos, perfil, contrasena)                       | Correcto                                        |
| **atenciones** (cola, cierre)                                                                    | Correcto, y el modulo mejor escrito del paquete |
| **presupuestos** (gastos, aprobacion, rechazo)                                                   | Correcto                                        |
| **donaciones** (donantes, historial, constancia)                                                 | Correcto                                        |
| **proyectos** (seguimiento, hitos, avance)                                                       | Correcto                                        |
| **inventario** (medicamentos, principios activos, bodegas, proveedores, ingreso desde donacion) | Correcto                                        |

### R-51. La salida de medicamentos falla por tres motivos independientes (ALTA)

`inventario/useRegistroSalida.js`. Ademas del stock equivocado que ya recogia #690:

- **`guardarSalida()` no escribe nada**: arma el payload y llama a `onExito`. `registrarSalida()`
  existe en `movimientos.api.js:174` y no se llama.
- **El cliente de Supabase llega `undefined`**: el hook lo recibe por parametro
  (`useRegistroSalida({ supabase, onExito })`) y `ModalSalidaMedicamento.jsx:17` lo llama con
  `{ onExito: onClose }`. La linea 24 evalua `await supabase.from("lotes")` con `undefined`, el
  `catch` lo convierte en "Error al cargar los lotes disponibles.", y esa es la unica senal que
  recibe quien despacha. El comentario de la linea 3 remite a `../utils/supabaseClient`, que no
  existe en el repositorio.

### R-52. El registro de ingreso arma un movimiento de mentira (ALTA)

`inventario/useRegistroIngreso.js:70` construye
`{ id: "ING-<timestamp>", estado: "PENDIENTE", ... }` -- ni el id es un UUID ni `PENDIENTE` es un
valor del enum (`estado_movimiento` es minuscula) -- y llama a `onGuardarExitoso`. Ningun `await`
en las 149 lineas. `registrarIngreso()` existe.

Ademas `guardarMovimiento` no devuelve nada y `ModalRegistroIngreso.jsx:43` hace
`if (exito && onExito)`, asi que la recarga nunca se dispara; y el modal pasa
`donacionesDisponibles` a un hook cuya firma es `{ onGuardarExitoso }`.

### R-53. El alta de lote solo valida (ALTA)

`InventarioPage.jsx:348`: `if (validarNuevoLote(datosLote)) { cerrar modal; cargarDatos(); }`.
`validarNuevoLote` viene de `useGestionLotes`, que **solo importa React**. `registrarLote()` y
`listarLotes()` (`lotes.api.js:126` y `:161`) no las llama nadie en todo el repositorio.

### R-54. Atender una alerta de caducidad falla por dos caminos (ALTA)

- `useGestionLotes.atenderAlertaCaducidad` es una funcion pura: no escribe.
- `useAlertasVencimiento.marcarComoAtendida` llama `atenderAlerta(alertaId, { accionTomada })`,
  pero la API espera `{ accion, usuarioId, rolUsuario }`. `esAdministrador(undefined)` es `false`,
  asi que **siempre devuelve error** -- y el hook **descarta el valor de retorno** y marca la
  alerta como atendida en el estado local. Desaparece de la pantalla y sigue pendiente en la base.

### R-55. `/proyectos` son 368 lineas de datos inventados (ALTA)

`ProyectosPage.jsx` no importa nada de `packages/shared`: su estado inicial es un literal con
"Salud Comunitaria Guatemala 2024", "Dr. A. Juarez", "Q 45,000". Arrastrar una tarjeta mueve el
`useState` y nada mas.

Sus transiciones usan `planificada`/`en_curso`/`finalizada`/`cancelado`: el enum de **jornadas**
con guiones bajos, no el de proyectos (`planificado`, `en curso`, `finalizado`, `cancelado`). Es el
**tercer** vocabulario inventado para lo mismo, despues del de `ProyectosScreen` en movil (R-34).

Y existe la version buena: `/proyectos/sociales` monta `ProyectosSocialesPage`, que usa
`useProyectosSociales({ usuarioRol })` correctamente. El sidebar enlaza la de mentira.

### R-56. El inicio de la web es un marcador (ALTA)

`HomePage.jsx` renderiza `<PaginaPendiente titulo="Inicio / Dashboard" issues="#209" />`, es decir
"Pantalla pendiente de implementar. Se construye en #209." La issue **#209 esta cerrada**, y `/` es
donde cae todo el mundo despues de iniciar sesion.

### R-57. La receta y el descuento de inventario no son atomicos (MEDIA)

`useGeneracionReceta.js:188` emite la receta con `fn_generar_receta` y **despues** recorre
`registrarSalida()` en un bucle. Si una salida falla -- sin red a media receta, stock agotado por
otro puesto, lote que vencio entre la preparacion y la confirmacion --, la receta queda emitida y
el stock sin descontar.

Esta manejado con honestidad (avisa en pantalla y pide avisar a la administradora) y devuelve
`ok: true` a proposito, porque la receta si se emitio. Pero es una via de deriva de inventario que
nadie reconcilia despues, y `obtenerResumenCierre()` no la detecta.

### R-58. Una quinta implementacion de "dias hasta el vencimiento"

`useAlertasVencimiento.js:16` calcula `vencimiento - hoy` en milisegundos contra el instante
actual. Se suma a las cuatro de R-11. Es la que decide que sale como "por vencer" en el panel de
alertas.

### R-59. Una RPC por proyecto y por jornada

`useEjecucionPresupuestal.js:171` y `useDetalleProyectoPresupuesto.js:46` llaman a
`obtenerPresupuestoProyecto()` / `obtenerPresupuestoJornada()` **una vez por fila**, dentro de un
`Promise.all`. Con 40 jornadas son 40 RPC concurrentes al abrir la pantalla.
`presupuesto_de_proyecto()` ya agrega en la base; falta la version en lote.

### R-60. Errores de escritura mostrados con `alert()`

`InventarioPage` (6 veces), `AdministracionBodegasProveedoresPage` (2) y `PanelAlertasVencimiento`
(1) reportan el error con `alert()` del navegador, teniendo `ErrorState` en el catalogo de
componentes de las dos apps. `BandejaValidacionPage` va mas lejos: aprobar y rechazar son dos
`console.log`.

### El mapa que deja esta pasada

| Flujo                                                | Estado real                                |
| ---------------------------------------------------- | ------------------------------------------ |
| Registrar paciente -> triaje -> consulta -> receta   | **Funciona**                               |
| Cola de atenciones de la jornada                     | **Funciona**                               |
| Jornadas: alta, personal, turnos, estados, cierre    | **Funciona**                               |
| Usuarios, permisos, perfil, contrasenas              | **Funciona**                               |
| Gastos: registro, aprobacion, rechazo                | **Funciona**                               |
| Donantes e historial de donaciones                   | **Funciona**                               |
| Catalogo de medicamentos, bodegas, proveedores       | **Funciona**                               |
| **Registrar una donacion**                           | **No guarda** (#635)                       |
| **Ingreso de inventario**                            | **No guarda** (#709)                       |
| **Salida de inventario**                             | **No guarda, y no carga los lotes** (#690) |
| **Alta de lote**                                     | **No guarda** (#709)                       |
| **Atender alerta de caducidad**                      | **No guarda** (#709)                       |
| **Bandeja de validacion de movimientos**             | **Nunca aprueba** (#689)                   |
| **Kardex de movimientos**                            | **Datos inventados** (#687)                |
| **Reporte de resultados de jornada**                 | **Datos inventados** (#687)                |
| **Pagina de inicio de la web**                       | **Marcador** (#710)                        |
| **/proyectos en web**                                | **Datos inventados** (#710)                |
| **Proyectos en movil**                               | **Datos demo siempre** (#688)              |


## Prioridad sugerida

1. **R-01, R-02, R-03, R-04** -- quitar los datos inventados de las pantallas. Tres de los cuatro
   solo necesitan conectar codigo que ya existe.
2. **R-05** -- el usuario de prueba en `InventarioPage`.
3. **R-23** -- `perfiles.activo` en `invitar-usuario`.
4. **R-14, R-15** -- el stock falso en la salida de medicamentos y los errores que se tragan.
5. **R-10, R-11, R-12** -- las fechas.
6. **R-42, R-43, R-44, R-45** -- los cuatro bloqueos del despliegue a produccion, antes de crear
   `ecopac-prod`.
7. Lo demas, por bloques.

## Trazabilidad con las issues

### Issues nuevas (abiertas el 2026-09-03, sin asignar)

| Issue | Titulo                                                                                          | Hallazgos            |
| ----- | ----------------------------------------------------------------------------------------------- | -------------------- |
| #687  | Tres pantallas muestran datos inventados: reporte de jornada, kardex e inicio movil              | R-01, R-02, R-03     |
| #688  | ProyectosScreen movil no muestra nunca un proyecto real                                          | R-04, R-34           |
| #689  | InventarioPage opera con un usuario de prueba escrito a mano                                     | R-05                 |
| #690  | La salida de medicamentos ofrece `cantidad_ingresada` como si fuera el stock                     | R-14, R-35           |
| #691  | `invitar-usuario` no comprueba `perfiles.activo`                                                 | R-23, R-28           |
| #692  | La app movil sigue sin guarda de rol                                                             | R-24, R-25           |
| #693  | Cada reporte tiene dos implementaciones y las pantallas usan la que no esta probada              | R-06 a R-09          |
| #694  | Cuatro definiciones de lote vencido, y tres adelantan la fecha un dia                            | R-10, R-11           |
| #695  | El panel de indicadores agrupa por nombre de mes y mezcla anios                                  | R-12, R-13, R-16     |
| #696  | `useReporteInventario` desestructura `err` en vez de `error`                                     | R-15                 |
| #697  | La ruta `/reportes/dashboard` quedo fuera del guard de rol                                       | R-26                 |
| #698  | Los CSV de reportes se arman a mano: sin escape, sin BOM y con inyeccion de formulas             | R-19, R-27           |
| #699  | Modelo de paciente: sexo sin enum, DPI con tres longitudes, edicion parcial e IMC que desborda   | R-17 a R-21          |
| #700  | 22 imports cruzan la frontera de `packages/shared` con rutas relativas                           | R-29                 |
| #701  | 727 colores a mano, 161 emojis y formateo de fecha y moneda dentro de las apps                   | R-31, R-32, R-37     |
| #702  | `apps/mobile` no tiene ninguna prueba ni script `test`                                           | R-38                 |
| #703  | `main` lleva 274 commits de atraso: ningun cron ha corrido nunca                                 | R-41                 |
| #704  | El catalogo geografico no llega a ningun ambiente remoto                                         | R-42                 |
| #705  | Secrets de despliegue: una contrasena para dev y prod, y sin secrets `_PROD` para los crons      | R-44, R-45           |
| #706  | Los privilegios que pgTAP da por cerrados se verifican en un stack que no es el de produccion    | R-43                 |
| #707  | Cuatro ramas sin pull request, una con el numero de migracion 00109 ocupado                      | R-46                 |
| #708  | La web se sirve en un solo bundle de 934 kB                                                      | R-47                 |
| #709  | Ingreso, alta de lote y atencion de alerta del inventario no guardan nada                        | R-52, R-53, R-54     |
| #710  | El inicio de la web es un marcador y /proyectos son datos inventados                             | R-55, R-56           |
| #711  | La receta se emite y el descuento de inventario va aparte                                        | R-57                 |

### Issues abiertas que se ampliaron con los casos concretos

| Issue | Que se le anadio                                                                    | Hallazgos      |
| ----- | ------------------------------------------------------------------------------------ | -------------- |
| #518  | Tres sitios mas donde la documentacion describe algo que no existe                    | R-40           |
| #495  | El inventario concreto de avisos de lint y codigo huerfano                            | R-30, R-33, R-36 |
| #228  | El tope `max_rows = 1000` y la agregacion en cliente                                  | R-39           |
| #239  | La inyeccion de formulas en CSV, y lo que ya salio limpio                             | R-27           |
| #241  | Catorce funciones sin `search_path` y el CORS con comodin                             | R-28           |
| #252  | Los cinco bloqueos reales del despliegue, y lo que ya estaba resuelto                  | R-41 a R-46    |
| #229  | Que no hay ni una cabecera de seguridad, y cuales poner                                | R-48           |
| #242  | `npm audit` medido, y que falta dependabot, CodeQL y `.nvmrc`                          | R-49           |
| #642  | Que bloquea el despliegue y merece subir de prioridad                                  | R-42           |
| #60   | Que no hay `eas.json` y las dos decisiones pendientes antes de configurarlo            | R-50           |
| #635  | Confirmado que sigue igual, y que encadena hacia una operacion real con un id inexistente | R-51 (patron) |
| #690  | Los otros dos defectos del mismo hook: no escribe, y el cliente llega undefined         | R-51           |
| #694  | La quinta implementacion de "dias hasta el vencimiento"                                 | R-58           |
| #228  | Una RPC por proyecto y por jornada                                                      | R-59           |

### Issues cerradas cuyo entregable no llego a la pantalla

No se reabren -- lo que falta es distinto de lo que pedian -- pero conviene tenerlas a la vista:
**#161** (kardex), **#206** y **#215** (reporte de jornada), **#207** (CSV), **#208** y **#210**
(filtros de reportes), **#209** y **#214** (dashboard), **#202** y **#211** (pacientes atendidos),
**#212** (inventario actual), **#427** (control de acceso movil).

### Sin issue por decision

**R-22** (`ESTADO_EXISTENCIA` usa cadenas de interfaz como valores) y **R-33** (vocabulario de
descriptores paralelo en `useVistaExistencias`) se resuelven solos si #693 elimina la
implementacion duplicada. Quedan anotados aqui por si esa decision va en otra direccion.
