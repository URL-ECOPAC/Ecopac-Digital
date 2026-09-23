# Criterio de diseño de la app móvil

Este documento es la decisión que ordena el rediseño de `apps/mobile` (issue #840, bloque G6). Se
escribió antes de tocar pantallas para que cada cambio visual tenga una razón, no un gusto. Una
pantalla nueva o reescrita se revisa contra esta lista.

La paleta, la tipografía y el mapa de navegación siguen en [DISENO.md](./DISENO.md). Aquí va cómo
se usan en un teléfono.

## Quién usa la app y dónde

El criterio sale de las condiciones de la jornada, no de una app de consumo:

- **Se usa de pie, con una mano**, a veces con guantes, con la caja de medicamentos o al paciente
  enfrente. Cada toque de más es un toque que se equivoca.
- **Se interrumpe todo el tiempo.** Lo que se está capturando no se puede perder por salir de la
  pantalla (el borrador de la consulta, el aviso de cambios sin guardar).
- **Hay mala conexión y mucha luz.** El contraste importa más que en una oficina, y un error de red
  se tiene que ver, no quedarse en una lista vacía.
- **El teléfono es chico y barato.** Pantallas de 360 dp de ancho, texto agrandado por
  accesibilidad en algunos equipos.

## Fuentes

- Android Developers, *Make apps more accessible*: área táctil mínima de **48 × 48 dp**; contraste
  de **4.5:1** para texto menor de 18 sp (o de 14 sp en negrita) y de **3:1** para el resto.
- Apple, *Human Interface Guidelines* (Layout, Accessibility): área táctil mínima de 44 × 44 pt,
  respetar las áreas seguras, preferir que el texto se ajuste en varias líneas antes que truncarlo.
- W3C, WCAG 2.2, criterio 2.5.8 *Target Size (Minimum)*: 24 × 24 px como piso absoluto, con
  separación. Es el mínimo legal; aquí se usa el de Android, que es más exigente.
- Expo SDK 57 (React Native 0.86), documentación versionada: `SafeAreaView` de
  `react-native-safe-area-context` es la forma recomendada de respetar las áreas seguras, antes que
  `useSafeAreaInsets`, porque se aplica en nativo y no tiembla al rotar. Es lo que ya usa
  `ScreenContainer`.
- Material Design 3 (estructura y navegación): una acción principal por pantalla, la navegación
  principal abajo, al alcance del pulgar.

## Las reglas

### 1. Nada táctil por debajo de 48 dp

Botones, filas de lista, chips, cabeceras de sección que se abren y selectores: altura mínima de
48 dp. Ya lo aplican `TextField`, `Selector`, `FilterBar`, `PrimaryButton` y `SecondaryButton`
(`MIN_TOUCH_HEIGHT`). Una pantalla que dibuja su propio `Pressable` lo aplica igual.

### 2. Una acción principal por pantalla, abajo o al inicio del contenido

La acción que resuelve la pantalla es un `PrimaryButton`; las demás son `SecondaryButton`. Ejemplos:
en la jornada en curso es "Buscar paciente"; en la ficha, "Nueva consulta"; en la consulta,
"Guardar consulta". Dos botones primarios compitiendo es un error de diseño.

### 3. Nada se esconde a la derecha

Nada de filas con desplazamiento horizontal para información o filtros. En un teléfono de 360 dp
lo que no cabe queda cortado en el borde ("Bodega P...") y la persona no sabe que hay más. Los
indicadores se reparten el ancho (`flex: 1`); los filtros van en el panel colapsable de
`FilterBar`, con los mismos descriptores que la web. La excepción es una galería que se entiende
como tal (el tablero kanban), y aun así con alternativa.

### 4. El texto se ajusta, no se trunca

Un nombre de medicamento, un número de lote o una bodega se leen completos: se permiten dos líneas
(`numberOfLines={2}`) antes que cortar a media palabra. Solo se trunca lo que es secundario y cuyo
valor completo está a un toque. Nada en mayúsculas forzadas: se lee peor y ocupa más.

### 5. El dato que se busca, arriba a la derecha y grande

En cada tarjeta hay un dato que es la razón de mirarla: la existencia de un lote, el estado de una
jornada. Va arriba a la derecha, en `typography.sizes.lg` y negrita. El resto de la tarjeta es
contexto en `textMuted`, en una o dos líneas.

### 6. Lo que falta no se inventa

Un dato ausente no se rellena con un valor de ejemplo ("REF-000", "Central", "Q 0", "N/A"). Se
omite, o se dice qué falta ("Sin fecha de vencimiento"). Un relleno se confunde con un dato real,
que es peor que un hueco.

### 7. Estado siempre visible: cargando, vacío y error

Toda pantalla que trae datos dibuja los tres estados con `LoadingState`, `EmptyState` y
`ErrorState`. Un error de red se muestra con "Reintentar"; una lista vacía por filtros ofrece
"Limpiar filtros". Nunca una pantalla en blanco.

### 8. El color acompaña, no informa solo

El estado se dice con texto y con color a la vez (`StatusChip` con `label`). Una alarma de signos
vitales lleva su mensaje, no solo el borde naranja. Los colores salen de `@ecopac/ui-tokens` y los
vigila `npm run verificar:paleta`: ninguno se escribe a mano.

### 9. Pestañas: pocas y cortas

Dos o tres pestañas por pantalla, con etiquetas de una o dos palabras. Cuatro pestañas de dos
palabras no caben en 360 dp (issue #840, G3). Si hace falta más, es otra pantalla.

### 10. Formularios en pasos cuando son largos

Un formulario de más de una pantalla se parte en pasos con nombre (registro de paciente, consulta
con sus tres partes). Cada paso se puede guardar o recorrer sin perder lo anterior, y el teclado
correcto se abre solo (`decimal-pad` para un peso, `phone-pad` para un teléfono).

### 11. Mismo lenguaje que la web

Mismos nombres de componente, mismas props, mismos descriptores, mismas palabras. Lo que cambia
entre plataformas es la disposición (panel colapsable en vez de fila de filtros, tarjetas en vez de
tabla), no el contenido ni las etiquetas.

## Cómo se aplicó en la issue #840

| Pantalla | Qué se cambió | Reglas |
| --- | --- | --- |
| Ficha del paciente | Dos pestañas en vez de cuatro; el historial es una lista de visitas; "Nueva consulta" como única acción principal | 2, 9 |
| Consulta | Los signos vitales, la consulta y la receta como tres pasos de una misma pantalla, con borrador; decimales en el teclado; una sola capa de aviso por signo | 2, 8, 10 |
| Jornada en curso | Sin colas por etapa: una lista de pacientes y "Buscar paciente" como acción principal | 2, 3 |
| Inventario (stock) | Filtros de la web en panel colapsable en vez de dos filas de chips; indicadores repartidos; tarjeta sin truncar ni rellenar | 3, 4, 5, 6 |
| Selectores largos | Búsqueda dentro del selector cuando pasa de ocho opciones (diagnósticos, comunidades) | 1, 3 |
| Formularios de corrección | El mismo formulario que el alta, con lo que no se edita en solo lectura (`CampoDeFormulario`) | 11 |

Pantallas que quedaban fuera de esa issue: `DonacionesScreen` y `ProyectosScreen`. La #866 las
retiró de la app en vez de rediseñarlas (ver abajo).

## Regla 12: si nadie puede llegar, no existe

Una pantalla construida pero sin ruta, o una ruta que ningún botón abre, es peor que no tenerla:
aparece en las pruebas y en la cobertura como si funcionara. Toda pantalla nueva se registra en
`AppNavigator` **y** se abre desde algún sitio visible, y
`apps/mobile/src/navigation/guardaDeRol.test.js` lo comprueba en las dos direcciones: ninguna
pantalla sin guarda de rol, y ningún nombre de `ROUTES` sin pantalla registrada.

## Cómo se aplicó en la issue #866

| Pantalla | Qué se cambió | Reglas |
| --- | --- | --- |
| Inicio | Solo los cuatro módulos que existen en móvil; antes dibujaba tarjetas de donaciones y proyectos que no llevaban a ningún lado | 6, 12 |
| Cabecera (todas) | "Cerrar sesión" a la par de la campana, con su aviso de cambios sin guardar; antes había que entrar a Ajustes y bajar hasta el final | 1, 2 |
| Inventario (stock) | Los tres indicadores son productos, por vencer y sin stock; tocar un lote abre su detalle en vez del formulario de ingreso; fila de accesos a las demás secciones | 3, 5, 12 |
| Pacientes | Fila de accesos a crónicos, condiciones y diagnósticos, que en móvil no existían | 11, 12 |
| `StatCard` | Sin `toUpperCase()` en el rótulo | 4 |
| Ficha del paciente, consulta, notificaciones | Sin `textTransform: "uppercase"` en rótulos y categorías | 4 |
| Principios activos, Registrar salida, Por aprobar | Pantallas nuevas, con el mismo catálogo de componentes y los descriptores de la web | 7, 11 |
| Receta | "Imprimir o guardar PDF" con `expo-print`, sobre el mismo `datosDeRecetaImprimible` que usa la web | 11 |

**Mayúsculas forzadas: por qué se fueron.** La regla 4 las prohíbe desde la #840, pero
`StatCard.js` seguía llamando a `String(label).toUpperCase()` y tres pantallas usaban
`textTransform: "uppercase"`. En un rótulo corto ("POR VENCER", "CADUCIDAD") se lee peor, ocupa
más ancho del que hay en 360 dp y el lector de pantalla puede deletrearlo. El tamaño del rótulo
de `StatCard` subió de `xxs` a `xs` al quitarlas, que es lo que la regla de contraste pide para
texto pequeño.

**Pantallas que se retiraron.** `DonacionesScreen`, `ProyectosScreen`, `ColaboradoresScreen` y
`FichaColaboradorScreen` salieron del repositorio, junto con `MenuDrawer.js`, que era el único
sitio que las enlazaba y que **ningún archivo importaba**. Ninguno de los tres roles que entran a
la app móvil (#866) puede abrirlas: donaciones y colaboradores son de junta directiva y socio
fundador, que ya no entran, y proyectos no tiene política RLS que deje leer a un médico
(`00080`/`00086`). Quien retome proyectos en móvil las recupera con
`git show develop:apps/mobile/src/screens/ProyectosScreen.js`.
