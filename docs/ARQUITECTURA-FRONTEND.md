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
  prefijo especial: `crearPaciente`, `esAdministrador`, `puedeAprobarMovimiento`.

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
deciden como dibujarlos. La app movil ya tiene `ScreenContainer`, `TextField`, `Selector`,
`PrimaryButton` y `SecondaryButton` implementados y con tokens; sirven de referencia.

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

Estas reglas se hacen cumplir con `no-restricted-imports` en `eslint.config`, para que la
frontera no dependa de la disciplina de ocho personas.

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

Ocultar una opcion del menu **no es control de acceso**: la restriccion real vive en las
politicas RLS y en el guard de rutas.

Los roles son los del enum `rol_usuario` de la migracion 00001, expuestos en
`packages/shared/usuarios/roles.js`. Nunca se escribe un rol como string suelto.

## Como construir una pantalla nueva

1. Escribir los descriptores en `packages/shared/<modulo>/` (`campos`, `columnas`, `filtros`).
2. Escribir el hook de pantalla en el mismo modulo, con datos, estado y handlers.
3. Escribir el componente web, que solo renderiza.
4. Escribir el componente movil, que consume el mismo hook y los mismos descriptores.

Si al escribir el paso 3 o el 4 aparece una condicion de negocio, va al paso 1 o 2: es senal de
que se estaba a punto de duplicar logica.

## Documentos relacionados

- [DISENO.md](./DISENO.md) - pantallas, navegacion y trazabilidad con las issues.
- [../AGENTS.md](../AGENTS.md) - contexto del repositorio.
