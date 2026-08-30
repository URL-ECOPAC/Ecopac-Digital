# Arquitectura del frontend - Ecopac Digital

Este documento define como se construye el frontend para que la web y la app movil compartan
el maximo de codigo sin ser dos proyectos separados. Es la referencia que citan las issues de
`platform:web` y `platform:mobile` en su seccion `Contrato de reutilizacion`.

## El problema

No existe forma de escribir JSX de React DOM y que corra tal cual en React Native: `<div>`,
`<table>` y las clases de Bootstrap no existen en RN. Se evaluaron tres caminos:

| Estrategia | Comparte | Costo |
| ---------- | -------- | ----- |
| React Native Web | ~85% | Elimina Bootstrap, pierde tabla semantica y complica imprimir recetas y exportar PDF |
| Tamagui / NativeWind | ~85% | Elimina Bootstrap, agrega un compilador a Vite y a Metro |
| **Logica en shared, UI por plataforma** | **~75%** | **Se escribe dos veces el JSX de presentacion, que en este proyecto ya es distinto** |

Se eligio la tercera. La razon concreta es que en este diseno la web y el movil no son la misma
interfaz: la web tiene sidebar de nueve modulos y kanban de
tres etapas; el movil tiene tab bar de cinco, esas mismas existencias como tarjetas apiladas y
un kanban de cinco etapas que sigue al paciente en vez de a la jornada. Con React Native Web
habria que escribir layouts condicionales para cada una de esas pantallas, asi que la ganancia
real seria mucho menor que la nominal, a cambio de tirar Bootstrap.

## La regla

> Una pantalla es **un hook y unos descriptores en `packages/shared`**, mas **un componente por
> app**. Todo lo que no sea JSX ni estilos vive en `shared`.

## Estructura de un modulo compartido

```
packages/shared/<modulo>/
  api.js            llamadas a Supabase y normalizacion de errores
  validaciones.js   reglas de negocio del modulo
  campos.js         esquema declarativo de los formularios
  columnas.js       columnas de tabla y campos de tarjeta
  filtros.js        filtros de las pantallas de listado
  permisos.js       que puede hacer cada rol en el modulo
  use<Pantalla>.js  view model de una pantalla: datos, estado, handlers y textos
  index.js          re-exports del modulo
```

`packages/shared/pacientes/` esta escrito como **ejemplar de referencia**: sus descriptores de
filtros y columnas muestran el patron a copiar en el resto de modulos.

### Convencion de nombres de export

- Los **descriptores** (los arrays y objetos declarativos de `campos.js`, `columnas.js` y
  `filtros.js`) se exportan en `MAYUSCULAS_CON_GUION_BAJO`: `FILTROS_PACIENTE`,
  `COLUMNAS_PACIENTE`, `CAMPOS_USUARIO`, `TIPOS_DE_FILTRO`. Son constantes, no datos que
  cambien en tiempo de ejecucion.
- Los **hooks de pantalla** (`use<Pantalla>.js`) se exportan con prefijo `use` en camelCase,
  igual que cualquier hook de React: `usePacientesListado`, `useJornadasKanban`.
- Las **funciones** de `api.js`, `validaciones.js` y `permisos.js` van en camelCase sin
  prefijo especial: `registrarPaciente`, `puedeVerJornadas`, `puedeAprobarGasto`.

Cada modulo expone un `index.js` que re-exporta sus archivos (`export * from './archivo.js'`),
y el `index.js` de la raiz de `packages/shared` re-exporta cada modulo.

## Ejemplo completo

El listado de pacientes, que es la issue #124 en web y la #133 en movil:

```js
// packages/shared/pacientes/filtros.js   — se escribe UNA vez
export const FILTROS_PACIENTE = [
  { id: 'busqueda',  tipo: 'busqueda', label: 'Buscar paciente' },
  { id: 'comunidad', tipo: 'select',   label: 'Lugar',  opcionesDesde: 'comunidades' },
  { id: 'sexo',      tipo: 'select',   label: 'Genero', opcionesDesde: 'sexo' },
  { id: 'rangoEdad', tipo: 'rango',    label: 'Rango de edad', min: 0, max: 120 },
];

// packages/shared/pacientes/usePacientesListado.js
export function usePacientesListado() {
  return { pacientes, filtros, setFiltro, cargando, error, recargar };
}
```

```jsx
// apps/web/src/pages/PacientesPage.jsx      — solo presentacion
const { pacientes, filtros, setFiltro } = usePacientesListado();
<FilterBar campos={FILTROS_PACIENTE} valores={filtros} onChange={setFiltro} />
<DataList columnas={COLUMNAS_PACIENTE} datos={pacientes} />   // se vuelve <Table>
```

```jsx
// apps/mobile/src/screens/BusquedaPacienteScreen.js  — solo presentacion
const { pacientes, filtros, setFiltro } = usePacientesListado();
<FilterBar campos={FILTROS_PACIENTE} valores={filtros} onChange={setFiltro} />
<DataList columnas={COLUMNAS_PACIENTE} datos={pacientes} />   // se vuelve tarjetas
```

Se comparte la API, las validaciones, los permisos, los filtros, las columnas, el estado, los
handlers y los textos. Se repite unicamente el layout visual, que ya era distinto.

## El catalogo de componentes

Segunda pieza, la que hace que portar una pantalla sea mecanico: **ambas apps implementan el
mismo catalogo, con los mismos nombres y las mismas props**. Son dos implementaciones cortas de
la misma interfaz, no dos disenos distintos.

| Componente | Web | Movil |
| ---------- | --- | ----- |
| `ScreenContainer` | contenedor con padding | `SafeAreaView` + `ScrollView` |
| `PageHeader` | titulo, subtitulo y acciones | igual, adaptado a ancho angosto |
| `TextField`, `Selector`, `DateField`, `NumberField` | `react-bootstrap` `Form.*` | `TextInput` y `Pressable` con area tactil de 48 dp |
| `PrimaryButton`, `SecondaryButton` | `Button` | `Pressable` |
| `FilterBar` | fila de `Form.Select` | panel colapsable con boton Aplicar |
| `DataList` | `<Table>` | `FlatList` de tarjetas |
| `StatusChip` | `Badge` | `View` con `statusColors` |
| `Card`, `EmptyState`, `LoadingState`, `ErrorState` | | |
| `KanbanBoard`, `Tabs`, `Modal` | | `Modal` se vuelve hoja inferior |

`FilterBar` y `DataList` son los que hacen el trabajo: consumen los descriptores de `shared` y
deciden como dibujarlos.

**La web tiene los 18 implementados** en `apps/web/src/components/`, planos y con un barril
`index.js` (issue #280). La app movil tiene cinco: `ScreenContainer`, `TextField`, `Selector`,
`PrimaryButton` y `SecondaryButton` (`apps/mobile/src/components/`); los trece que le faltan son
la issue #281, y su referencia es la implementacion web, que ya siguio este contrato.

### Excepciones de nombres entre plataformas

La regla es "mismos nombres, mismas props", con dos excepciones que vienen de la plataforma
subyacente y no tiene sentido esconder detras de una capa de traduccion:

- **Evento de cambio de texto**: la web usa `onChange` (evento DOM de `Form.Control`), el movil
  usa `onChangeText` (convencion de `TextInput` de React Native, recibe el string directo en vez
  de un evento). Aplica a `TextField`.
- **Evento de toque/click**: la web usa `onClick` (`Button` de `react-bootstrap`), el movil usa
  `onPress` (convencion de `Pressable`). Aplica a `PrimaryButton`, `SecondaryButton` y a
  cualquier componente con `Card` interactiva.

Todas las demas props (`label`, `value`, `error`, `disabled`, `title`, etc.) se llaman igual en
las dos plataformas.

### Contrato de FilterBar y DataList

Estos dos son deliberadamente "tontos": no conocen los filtros ni las columnas de ningun modulo
especifico, solo saben interpretar la forma generica de un descriptor. El mismo `FilterBar` sirve
para pacientes, inventario o donaciones porque toda la informacion especifica del modulo vive en
`shared`, no en el componente.

**`FilterBar`**

| Prop | Tipo | Descripcion |
| ---- | ---- | ----------- |
| `campos` | array | Descriptores de `filtros.js` del modulo, ej. `FILTROS_PACIENTE`. Cada uno trae `id`, `tipo`, `label` y, segun el tipo, `placeholder`, `opcionesDesde`, `min`/`max` (ver `packages/shared/pacientes/filtros.js`). |
| `valores` | objeto | Valor actual de cada filtro, indexado por `id` (ej. `{ busqueda: '', comunidad: null }`). |
| `onChange` | fn(id, valor) | Se llama cuando el usuario cambia un filtro. `FilterBar` no guarda estado propio: quien lo usa decide que hacer con el valor nuevo. |
| `catalogos` | objeto | Listas de opciones indexadas por el nombre que declara `opcionesDesde`, ej. `{ roles: [...], comunidades: [...] }`. Ver "Resolucion de catalogos" abajo. |

Por cada entrada de `campos`, `FilterBar` dibuja el control segun `tipo` (los valores de
`TIPOS_DE_FILTRO`): `busqueda` se vuelve un `TextField`, `select` un `Selector` (resolviendo sus
opciones de `opcionesDesde`), `rango` un par de `NumberField` acotados por `min`/`max`.

- **Web**: una fila de controles (`Form.Select`/`Form.Control`) sobre el listado.
- **Movil**: panel colapsable con boton "Aplicar", para no ocupar toda la pantalla en un
  dispositivo angosto.

**`DataList`**

| Prop | Tipo | Descripcion |
| ---- | ---- | ----------- |
| `columnas` | array | Descriptores de `columnas.js` del modulo, ej. `COLUMNAS_PACIENTE`. Cada uno trae `id`, `label`, `tipo` y, segun el caso, `principal`, `anchoWeb`, `desde` (de que campo de la fila sale el valor, si no es `id`) y `sufijo` (ver `packages/shared/pacientes/columnas.js`). |
| `datos` | array | Las filas a mostrar. |
| `cargando` | bool | Si es `true`, `DataList` delega en `LoadingState` en vez de dibujar filas. |
| `vacio` | string \| nodo | Mensaje o contenido para `EmptyState` cuando `datos` esta vacio. |
| `onRowPress` | fn(fila) | Opcional. Se llama al tocar/hacer click en una fila. |
| `catalogos` | objeto | Igual que en `FilterBar`: listas de `{ label, value }`. Lo consumen las columnas que declaran `etiquetasDesde`, y las de `tipo: 'estado'` cuyo valor no es el del enum. Una opcion de ese catalogo puede traer un tercer campo `clave`: `DataList` se lo pasa a `StatusChip` como `status` -es lo que indexa `statusColors`- y usa `label` como texto. Sin `clave`, una columna booleana pintaria `true` en lugar de un estado legible. |

Por cada entrada de `columnas`, `DataList` sabe pintar el `tipo` declarado, tomando el valor de
la fila por `id` o por `desde` si la columna lo declara. Los tipos que interpreta son `texto`,
`numero` (con `sufijo`), `fecha` (con `formatearFechaCorta` de `shared`, nunca `Intl`), `estado`
(resuelto por catalogo, porque el valor guardado puede ser un booleano), `chip` (el valor ya es
el del enum, indexa `statusColors` directo), `chips`, `booleano` ("Si" / "No") y `avatar`.

- **Web**: se vuelve una `<Table>` de `react-bootstrap`; cada columna es un `<td>`, en el orden
  declarado. La columna `principal` solo se resalta en negrita: no hace falta moverla, porque el
  encabezado de la tabla ya dice que es cada celda.
- **Movil**: se vuelve un `FlatList` de tarjetas; cada `columna` se apila dentro de la tarjeta
  (no hay filas ni columnas literales en una pantalla angosta).

**Orden dentro de una tarjeta.** El movil respeta el orden declarado con una sola excepcion: el
`avatar` y la columna `principal` suben al tope. Una tarjeta no tiene encabezado, asi que su
primera linea funciona como titulo. `COLUMNAS_MOVIMIENTO` declara `tipo` antes que `medicamento`,
y sin la excepcion la tarjeta empezaba con "Tipo: ingreso" y el nombre del medicamento quedaba a
media altura, leyendose como un dato mas. Lo que las dos plataformas comparten es el descriptor,
no la disposicion: es la misma clase de diferencia que `FilterBar` (fila en web, panel colapsable
en movil) o `Modal` (centrado en web, hoja inferior en movil).

### Resolucion de catalogos

Un descriptor declara **de donde** salen las opciones de un filtro, no cuales son:
`opcionesDesde: 'comunidades'` en `packages/shared/pacientes/filtros.js`, `etiquetasDesde:
'roles'` en `usuarios/columnas.js`. Tiene que ser asi porque varias de esas listas -comunidades,
especialidades- salen de la base de datos y no se pueden escribir en el descriptor.

Quien tiene esos datos -la pantalla o su hook- los pasa por la prop `catalogos`, y el componente
hace `catalogos[campo.opcionesDesde] ?? []`. Asi `FilterBar` y `DataList` siguen sin conocer
ningun modulo ni pedir datos por su cuenta.

Un catalogo que todavia no cargo deja el select vacio y **deshabilitado**, en vez de mostrar un
desplegable que no hace nada.

**Forma de una opcion.** Una opcion es `{ label, value }`, y **es la unica forma que existe**:
la publican asi todos los catalogos de `shared` -los escritos a mano, como `OPCIONES_ROL` en
`packages/shared/usuarios/campos.js`, y los que se arman en tiempo de ejecucion desde la base de
datos, como las comunidades-. `Selector` la consume tal cual, sin normalizar nada.

Hasta la issue #399 convivian dos formas, `{ label, value }` y `{ etiqueta, valor }`, y cada app
cargaba un adaptador que aceptaba las dos. El problema no era el adaptador sino lo que tapaba:
un descriptor nuevo podia nacer con cualquiera de las dos y nadie lo notaba. Si al escribir un
catalogo dudas, es `{ label, value }`.

**El tercer campo, `clave`.** Un catalogo de estado puede traer ademas `clave`, y **eso no es la
forma vieja**: `value` es lo que guarda la columna y `clave` es el valor del enum que indexa
`statusColors`. Hacen falta los dos cuando no coinciden, que es el caso de una columna booleana
-`ESTADOS_USUARIO` guarda `true`/`false` en `value` y `'activo'`/`'inactivo'` en `clave`- y el de
un enum que se muestra traducido. Lo llevan `ESTADOS_USUARIO`, `ESTADOS_DONANTE`,
`OPCIONES_ESTADO_DONACION`, `OPCIONES_ESTADO_PROYECTO`, `ESTADOS_DE_VENCIMIENTO_REPORTE` y
`ESTADOS_JORNADA_REPORTE`.

### Contrato de cada componente

Convenciones de la tabla: **Default** es el valor si la prop no se pasa; "—" quiere decir que la
prop es requerida o que no aplica un default. **Estado** indica si el componente ya existe
(referencia real) o si su contrato es una propuesta para implementarlo.

**`ScreenContainer`** — implementado en movil (`apps/mobile/src/components/ScreenContainer.js`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `children` | nodo | — | Contenido de la pantalla. |
| `scrollable` | bool | `true` | Si `false`, el contenido no se vuelve scrolleable (para pantallas con su propio scroll interno, ej. una lista). |
| `style` | estilo | — | Estilo del contenedor raiz. |
| `contentContainerStyle` | estilo | — | Estilo del contenido interno. |

Envuelve toda pantalla de la app. En movil evita ademas que el teclado tape los campos
enfocados (`KeyboardAvoidingView`); en web el navegador ya lo resuelve solo.

- **Web**: contenedor simple con padding.
- **Movil**: `SafeAreaView` + `KeyboardAvoidingView` + `ScrollView` condicional (implementado).

**`PageHeader`** — implementado en web (`apps/web/src/components/PageHeader.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `title` | string | — | Titulo de la pantalla. |
| `subtitle` | string | — | Subtitulo opcional. |
| `actions` | array de `{ label, onPress/onClick, variant }` | `[]` | Botones de accion asociados a la pantalla (ej. "Nuevo paciente"). |

- **Web**: titulo/subtitulo a la izquierda, acciones alineadas a la derecha en la misma fila.
- **Movil**: titulo/subtitulo arriba, acciones en una fila debajo (para no romper en ancho
  angosto).

**`TextField`** — implementado en movil (`apps/mobile/src/components/TextField.js`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `label` | string | — | Etiqueta sobre el campo. |
| `error` | string | — | Mensaje de error bajo el campo; si esta presente, el borde cambia de color. |
| `style` | estilo | — | Estilo del contenedor. |
| resto de props | — | — | Cualquier prop nativa del input subyacente pasa directo: `value`, `placeholder`, `keyboardType`, `secureTextEntry`, etc. (ver la excepcion `onChange`/`onChangeText` arriba). |

Area tactil minima de 48 dp en movil (el personal a veces llena formularios con guantes). El
borde cambia de color al enfocar y al haber error.

- **Web**: `Form.Control` de `react-bootstrap`.
- **Movil**: `TextInput` de React Native (implementado).

**`Selector`** — implementado en movil (`apps/mobile/src/components/Selector.js`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `label` | string | — | Etiqueta sobre el selector. |
| `value` | string \| number | — | Valor seleccionado actualmente. |
| `options` | array de `{ label, value }` | — | Opciones disponibles. |
| `onSelect` | fn(value) | — | Se llama con el `value` ya resuelto (no un evento) al elegir una opcion. Mismo nombre en ambas plataformas. |
| `placeholder` | string | `'Seleccionar'` | Texto cuando no hay valor elegido. |
| `error` | string | — | Mensaje de error bajo el selector. |
| `style` | estilo | — | Estilo del contenedor. |

- **Web**: `Form.Select` nativo de `react-bootstrap`.
- **Movil**: boton que abre una hoja inferior con la lista de opciones (`Modal` transparente +
  `FlatList`), implementado. Este es el patron de hoja inferior que `Modal` y `DateField`
  reutilizan en movil.

**`DateField`** — implementado en web (`apps/web/src/components/DateField.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `label` | string | — | Etiqueta sobre el campo. |
| `value` | string ISO `'YYYY-MM-DD'` \| `null` | `null` | Fecha seleccionada. |
| `onChange` | fn(value) | — | Mismo nombre en ambas plataformas (no es un input de texto libre, no aplica la excepcion `onChangeText`). |
| `minDate`, `maxDate` | string ISO | — | Limites opcionales. |
| `error` | string | — | Mensaje de error bajo el campo. |
| `style` | estilo | — | Estilo del contenedor. |

Mismo patron visual que `TextField` (label arriba, error abajo), pero el valor se elige, no se
escribe.

- **Web**: `input type="date"` o un date-picker de `react-bootstrap`.
- **Movil**: abre un selector nativo en hoja inferior, mismo patron que `Selector`.

**`NumberField`** — implementado en web (`apps/web/src/components/NumberField.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `label` | string | — | Etiqueta sobre el campo. |
| `value` | number \| `null` | `null` | Valor actual. |
| `onChange` | fn(value) | — | Mismo nombre en ambas plataformas. |
| `min`, `max` | number | — | Limites opcionales. |
| `step` | number | `1` | Incremento. |
| `suffix` | string | — | Texto pegado al valor (ej. `'anios'`, ver `sufijo` en `COLUMNAS_PACIENTE`). |
| `error` | string | — | Mensaje de error bajo el campo. |
| `style` | estilo | — | Estilo del contenedor. |

- **Web**: `input type="number"` de `react-bootstrap`.
- **Movil**: `TextInput` con `keyboardType="numeric"`, mismo componente base que `TextField`.

**`PrimaryButton`** — implementado en movil (`apps/mobile/src/components/PrimaryButton.js`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `title` | string | — | Texto del boton. |
| `onPress` / `onClick` | fn | — | Ver excepcion de nombres arriba. |
| `disabled` | bool | `false` | Deshabilita el boton. |
| `loading` | bool | `false` | Muestra un spinner en vez del texto y deshabilita el boton. |
| `style` | estilo | — | Estilo del boton. |

Altura minima de 48 dp en movil.

- **Web**: `Button` de `react-bootstrap`, con `Spinner` de `react-bootstrap` cuando `loading`.
- **Movil**: `Pressable` con `ActivityIndicator` cuando `loading` (implementado).

**`SecondaryButton`** — implementado en movil (`apps/mobile/src/components/SecondaryButton.js`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `title` | string | — | Texto del boton. |
| `onPress` / `onClick` | fn | — | Ver excepcion de nombres arriba. |
| `disabled` | bool | `false` | Deshabilita el boton. |
| `style` | estilo | — | Estilo del boton. |

A diferencia de `PrimaryButton`, no tiene `loading`: se usa para acciones que no disparan una
espera (ej. "Cancelar", "Volver").

- **Web**: `Button variant="outline-..."` de `react-bootstrap`.
- **Movil**: `Pressable` con borde, sin relleno (implementado).

**`FilterBar`** y **`DataList`** — implementados en web (`apps/web/src/components/`), ver la
seccion anterior para su contrato completo.

**`StatusChip`** — implementado en web (`apps/web/src/components/StatusChip.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `status` | string | — | Debe ser exactamente un valor de un enum de `supabase/migrations/00001_initial_schema.sql` (ej. `'pendiente de validacion'`). Se usa tal cual como indice de `statusColors`, sin tabla de traduccion propia. |
| `label` | string | valor crudo de `status` | Texto a mostrar, si debe diferir del valor del enum. |

Si `status` no esta en `statusColors` (`@ecopac/ui-tokens`), usa `colors.secondary` como color
neutro por defecto en vez de fallar.

- **Web**: `Badge` de `react-bootstrap`.
- **Movil**: `View` con `backgroundColor` de `statusColors` y `Text`.

**`Card`** — implementado en web (`apps/web/src/components/Card.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `children` | nodo | — | Contenido de la tarjeta. |
| `title` | string | — | Titulo opcional dentro de la tarjeta. |
| `onPress` / `onClick` | fn | — | Opcional; si esta presente, la tarjeta es interactiva (ver excepcion de nombres arriba). |
| `style` | estilo | — | Estilo del contenedor. |

Base visual de las tarjetas de `DataList` en movil y de cualquier bloque agrupado en un
dashboard.

- **Web**: `div` con borde/sombra de Bootstrap.
- **Movil**: `View` con sombra/borde equivalentes de los tokens de espaciado.

**`EmptyState`** — implementado en web (`apps/web/src/components/EmptyState.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `message` | string | `labels.sinResultados` | Mensaje central. |
| `actionLabel` | string | — | Texto del boton de accion. |
| `onAction` | fn | — | Handler del boton. El boton solo se muestra si `actionLabel` **y** `onAction` estan presentes. |

Lo usa `DataList` cuando `datos` esta vacio, o cualquier pantalla sin resultados.

- **Web**: contenedor centrado con texto y `Button` opcional (implementado).
- **Movil**: mismo patron con `View`/`Text`/`PrimaryButton`.

**`LoadingState`** — implementado en web (`apps/web/src/components/LoadingState.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `message` | string | `labels.cargando` | Mensaje junto al spinner. |

Lo usa `DataList` mientras `cargando` es `true`, o cualquier pantalla que espera datos.

- **Web**: `Spinner` de `react-bootstrap`, centrado (implementado).
- **Movil**: `ActivityIndicator` de React Native.

**`ErrorState`** — implementado en web (`apps/web/src/components/ErrorState.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `message` | string | `labels.errorDeConexion` | Mensaje del error. |
| `onRetry` | fn | — | Si esta presente, muestra un boton "Reintentar". |

- **Web**: `Alert variant="danger"` de `react-bootstrap` (implementado).
- **Movil**: mismo patron con `colors.danger`.

**`KanbanBoard`** — implementado en web (`apps/web/src/components/KanbanBoard.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `columnas` | array de `{ id, titulo, tarjetas }` | — | El componente no sabe cuantas columnas hay ni que representan: las declara el modulo que lo usa (ej. `jornadas` con 3 etapas en web, `pacientes` con 5 en movil — ver "El problema" arriba). |
| `renderTarjeta` | fn(tarjeta) | — | Que pintar dentro de cada tarjeta, normalmente usando `Card`. |
| `onMover` | fn(tarjetaId, columnaOrigenId, columnaDestinoId) | — | Se llama cuando una tarjeta cambia de columna. |

- **Web**: arrastrar y soltar entre columnas visibles simultaneamente.
- **Movil**: columnas en pestañas o scroll horizontal, con un boton "Mover" en la tarjeta en vez
  de arrastrar (arrastrar es poco confiable dentro de un `ScrollView` tactil).

**`Tabs`** — implementado en web (`apps/web/src/components/Tabs.jsx`)

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `tabs` | array de `{ id, label }` | — | Pestañas disponibles. |
| `activo` | string | — | `id` de la pestaña activa. |
| `onChange` | fn(id) | — | Se llama al cambiar de pestaña. |
| `children` | nodo | — | Contenido de la pestaña activa. |

Navegacion dentro de una misma pantalla, no cambia de ruta.

- **Web**: `Tabs`/`Nav` de `react-bootstrap`.
- **Movil**: fila de botones tipo pill (React Native no tiene tabs nativos de layout).

**`Modal`** — implementado en web (`apps/web/src/components/Modal.jsx`); en movil el patron de
hoja inferior ya existe dentro de `Selector`

| Prop | Tipo | Default | Descripcion |
| ---- | ---- | ------- | ----------- |
| `visible` | bool | `false` | Si el modal esta abierto. |
| `onClose` | fn | — | Se llama al cerrar (fondo, boton de cierre o boton atras en Android). |
| `title` | string | — | Titulo opcional. |
| `children` | nodo | — | Contenido. |

- **Web**: `Modal` de `react-bootstrap`, centrado.
- **Movil**: se abre como hoja inferior que sube desde abajo, el mismo patron que `Selector` ya
  implementa internamente (`Modal` transparente + `View` con la hoja).

## La frontera, en concreto

`packages/shared` **no puede**:

- importar `react-dom`, `react-native`, `react-bootstrap` ni ningun componente de una app;
- usar `document`, `window`, `localStorage`, `AsyncStorage` ni ninguna API de plataforma;
- devolver JSX.

Si puede importar `react` (para `useState` y `useEffect` dentro de los hooks) y
`@supabase/supabase-js`.

`apps/web` y `apps/mobile` **no pueden**:

- importar `@supabase/supabase-js` directamente;
- escribir validaciones, formateo de fechas, reglas de negocio o decisiones de permisos dentro
  de un componente;
- escribir un color a mano: todo sale de `@ecopac/ui-tokens`.

Las dos primeras se hacen cumplir con `no-restricted-imports` en `eslint.config`, para que la
frontera no dependa de la disciplina de ocho personas. **La de los permisos no la comprueba
ningun lint todavia**: depende de que cada quien la respete.

Que puede hacer cada rol no se decide aqui ni se repite en cada modulo: esta en
[PERMISOS.md](./PERMISOS.md), con la politica RLS que implementa cada celda.

## Tokens de diseno

`packages/ui-tokens` es la unica fuente de color, espaciado y tipografia. Exporta `colors`,
`moduleAccents`, `statusColors`, `spacing`, `typography` y `labels`.

- La web los publica como custom properties de CSS en `apps/web/src/theme.js`, y `index.css`
  solo consume `var(--color-*)`. No hay hex escritos a mano en ningun CSS.
- El movil los importa directo en sus `StyleSheet`.

Las claves de `statusColors` coinciden exactamente con los valores de los enums de
`supabase/migrations/00001_initial_schema.sql`, para que un estado que viene de la base de datos
se pueda usar como indice sin traducir.

## Navegacion

`packages/shared/navegacion.js` define los nueve modulos una sola vez, con su ruta, su seccion
del sidebar, el modulo de permisos al que corresponde y los roles que lo ven. El sidebar de la
web usa `seccionesVisibles(rol)` y la tab bar del movil usa `tabsMoviles(rol)`.

Ocultar una opcion del menu **no es control de acceso**, y el guard de rutas tampoco lo es:
los dos viven en el cliente. La unica capa que protege son las politicas RLS y los `GRANT`.
Las cuatro capas y cual hace que estan explicadas en [PERMISOS.md](./PERMISOS.md).

Los roles son los del enum `rol_usuario` de la migracion 00001, expuestos en
`packages/shared/usuarios/roles.js`. Nunca se escribe un rol como string suelto. **Que puede
hacer cada uno esta en [PERMISOS.md](./PERMISOS.md)**, no aqui: este documento describe donde
va cada capa, no que decide.

## Como construir una pantalla nueva

1. Escribir los descriptores en `packages/shared/<modulo>/` (`campos`, `columnas`, `filtros`).
2. Escribir el hook de pantalla en el mismo modulo, con datos, estado y handlers.
3. Escribir el componente web, que solo renderiza.
4. Escribir el componente movil, que consume el mismo hook y los mismos descriptores.

Si al escribir el paso 3 o el 4 aparece una condicion de negocio, va al paso 1 o 2: es senal de
que se estaba a punto de duplicar logica.

## Modulos que comparten etiqueta de GitHub

`packages/shared/proyectos/` es un modulo propio desde la issue #400, separado de
`packages/shared/donaciones/` porque proyectos sociales no es lo mismo que donantes y
donaciones aunque las dos issues originales (#194 y #189) hayan nacido en la misma carpeta.

Las issues de proyectos (#194 ya cerrada, mas #200, #201, #271, #307, #308, #309) siguen
etiquetadas `module:donaciones` en GitHub: crear la etiqueta `module:proyectos` y reasignarla
es una accion manual en GitHub que la issue #400 deja pendiente, no una decision de que los dos
modulos deban compartir etiqueta. Quien tenga permisos de escritura en el repositorio puede
crear la etiqueta y mover esas issues cuando le quede comodo; el codigo ya no depende de que
eso pase.

## Documentos relacionados

- [DISENO.md](./DISENO.md) - pantallas, navegacion y trazabilidad con las issues.
- [../AGENTS.md](../AGENTS.md) - contexto del repositorio.
