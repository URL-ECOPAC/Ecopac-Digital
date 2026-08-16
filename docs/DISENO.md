# Referencia de diseno - Ecopac Digital

Este documento es la fuente unica de verdad sobre como se ven las pantallas del sistema. Toda
issue de frontend (`platform:web` o `platform:mobile`) apunta aqui desde su seccion
`Referencia de diseno`.

## Fuente del diseno

| Recurso              | Donde                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Prototipo navegable  | https://www.figma.com/make/OMT8OXRXlNdbwwEh4yXGYd/Control-de-inventario?p=f  |
| Wireframes anotados  | `docs/entregables/Entregable Semana 6.pdf`, paginas 61 a 68                   |
| Mapas de navegacion  | `docs/entregables/Entregable Semana 6.pdf`, paginas 69 y 70                   |

El PDF es la referencia citable porque queda versionada en el repositorio. El prototipo de
Figma manda para el detalle visual que el wireframe no captura: color, tipografia, estados de
interaccion y espaciado fino. Los wireframes del PDF son en escala de grises, asi que **para
color siempre manda el prototipo**.

## Paleta

La marca es **verde**, matiz ~127 grados. Los valores se midieron sobre el prototipo en vivo y
estan implementados en `packages/ui-tokens/index.js`, que es la unica fuente de color del
proyecto.

| Token | Valor | Donde se usa en el diseno |
| ----- | ----- | ------------------------- |
| `primary` | `#2A9C36` | Marca, banner, botones principales, elemento activo del sidebar |
| `primaryDark` / `primaryLight` | `#1E7E2A` / `#36AE42` | Extremos del degradado del banner |
| `success` | `#2A9C36` | Estado Disponible y estado Aprobado |
| `warning` | `#F1A239` | Estado Por vencer y alertas que no bloquean |
| `danger` | `#B81F6F` | Estado Critico, Sin stock y Rechazado |
| `info` | `#3C9CC0` | Estado Pendiente de validacion y valores informativos |
| `background` / `surface` | `#F7F8FA` / `#FFFFFF` | Fondo de pagina y tarjetas |
| `border` | `#E9E9E9` | Bordes, separadores y pista de las barras de progreso |

Dos matices importan porque contradicen la intuicion: el diseno marca lo critico en **magenta,
no en rojo**, y lo pendiente en **azul, no en ambar**.

Cada modulo tiene ademas un color de acento con el que el diseno lo identifica en tarjetas y
puntos de KPI: Pacientes verde, Donaciones azul, Inventario naranja, Presupuestos magenta.
Estan en `moduleAccents`.

Los hex exactos salen de muestreo de pixel sobre capturas del prototipo. Los matices son
fiables; conviene que el autor del diseno confirme los valores finales.

## Mapa de navegacion

Tras autenticarse, el usuario entra a un punto distinto segun su rol:

- **Administrador y Junta Directiva** entran al Dashboard / Metricas de Impacto.
- **Medico y Voluntario** entran al Tablero de Jornadas Activas.

Esconder una opcion del menu no es control de acceso: la restriccion real vive en las
politicas RLS y en el guard de rutas.

### Web: navegacion lateral, nueve modulos en cinco secciones

| Seccion | Modulos |
| ------- | ------- |
| Principal | Inicio |
| Atencion medica | Pacientes, Donaciones |
| Operaciones | Inventario, Presupuestos |
| Administracion | Proyectos, Reportes |
| Jornadas | Kanban Jornadas, Voluntarios |

La definicion vive una sola vez en `packages/shared/navegacion.js`, con la ruta, la seccion, el
modulo de permisos y los roles de cada uno. El sidebar de la web y la tab bar del movil salen de
ahi.

### Movil: tab bar de cinco

Inicio, Pacientes, Jornadas, Inventario, Ajustes. La pantalla de inicio ademas expone un grid
de modulos navegables, de modo que la app movil tiene paridad de modulos con la web salvo
Reportes, que existe solo en web.

## Pantallas web

### Inicio / Dashboard (p. 61)

- Banner hero con descripcion del sistema y acciones rapidas
- Grid de 8 modulos navegables con indicador de valor
- Panel de alertas activas de caducidad de inventario

### Gestion de Pacientes (p. 62)

- Panel de filtros: busqueda libre, Lugar, Genero y Rango de Edad
- Lista de pacientes con avatar, nombre, edad, municipio y condiciones
- Panel de detalle: ficha clinica con DPI, tipo sanguineo y campos clave
- Seccion de historial de consultas con diagnostico y tratamiento

### Control de Donaciones (p. 62)

- Desglose por tipo de donacion: Economica, Medicamentos, Insumos
- Tabla completa: donante, tipo, descripcion, vinculo, fecha, monto y estado

### Control de Inventario (p. 63)

- Tira de alertas criticas de caducidad con dias restantes
- Filtro por bodega (Central / Norte / Sur) y filtro de categoria
- Pills de categoria para filtrado rapido del catalogo
- Tabla multi-bodega: codigo, lote, caducidad, stock, precio, estado

### Gestion de Presupuestos (p. 63 y prototipo)

Subtitulo del prototipo: "Administracion financiera por jornada y proyecto".

- KPIs: Presupuesto Total (todas las jornadas), Gastado con porcentaje ejecutado, Disponible
  como saldo restante, y En Aprobacion con el monto de gastos pendientes
- Panel de proyectos: nombre, responsable, categoria, monto ejecutado sobre el asignado,
  porcentaje de ejecucion, disponible y barra de progreso
- Registro de gastos: tabla con concepto, categoria, proyecto, fecha, monto y estado
- Tabs de estado: Todos, Aprobado, Pendiente, Rechazado
- Categorias de gasto que usa el prototipo: Medicamentos, Logistica, Diagnostico, Honorarios,
  Educacion, Infraestructura

**El presupuesto se asigna por jornada.** Un proyecto agrupa varias jornadas y su presupuesto es
la sumatoria de las de sus jornadas; el total del sistema es la sumatoria general. El prototipo
todavia agrega por proyecto y no muestra el monto de cada jornada: ver "Huecos y decisiones
abiertas".

### Gestion de Proyectos (p. 64)

- Lista de proyectos con tipo, estado y barra de avance; clic para ver el detalle
- Header del proyecto: nombre, descripcion, fichas, responsable, presupuesto
- Tabs de detalle: Resumen, Equipo, Jornadas, Insumos, Gastos
- Panel de contenido segun el tab activo (por ejemplo, lista del equipo involucrado)

### Reportes e Impacto (p. 64)

- Panel de indicadores con seguimiento de avance y metas generales del proyecto
- Visualizacion comparativa de la actividad registrada en el periodo
- Vista desglosada de atenciones y categorias de servicio
- Listado de registros destacados con su estado de evolucion

### Kanban de Jornadas (p. 65)

- Tablero Kanban de tres etapas: Planificada, En curso, Finalizada
- Contador del total de registros por etapa
- Tarjeta de paciente con prioridad, condicion y botones de avance

### Voluntarios y Medicos (p. 65)

- Panel de filtros: busqueda libre y filtro por rol del voluntario
- Lista de voluntarios con avatar, nombre, especialidad, rol y jornadas
- Ficha completa: datos personales, acceso, telefono, correo, DPI
- Historial de jornadas con progreso de atencion y barra de avance

## Pantallas moviles

### Inicio (p. 66)

- Banner hero con descripcion del sistema y acciones rapidas
- Lista vertical de modulos navegables, adaptada de la web
- Carrusel de metricas clave o grid de 2 columnas, apilado
- Panel de alertas activas, apilado
- Menu de interaccion sin tooltips

### Gestion de Pacientes (p. 66)

- Lista y busqueda con filtros: Lugar, Genero, Rango de Edad y boton Aplicar Filtros
- Tarjeta de paciente con avatar, nombre, edad, genero, municipio y chips de condicion
- Ficha clinica expandida: DPI, fecha de nacimiento, tipo sanguineo, contacto
- Historial de consultas tactil con filtro de periodo y acordeones Ver Diagnostico,
  Ver Tratamiento y Editar Nota

### Control de Donaciones (p. 66)

- Resumen con KPIs: Total Recibido, Monto Pendiente, No. Donantes, Donaciones Confirmadas
- Grafica de donacion economica en el periodo y desglose de Medicamentos e Insumos
- Detalles y filtros: tipo de donacion, rango de fecha, busqueda
- Formulario Nueva Donacion: donante, tipo, descripcion, vinculo o deposito, monto, fecha,
  estado y boton Guardar Donacion

### Control de Inventario (p. 67)

- Resumen y alertario: tiras de alertas criticas de caducidad con dias restantes
- Filtros y catalogo: filtro por bodega (Central / Norte / Sur), busqueda y pills de categoria
- Tabla multi-bodega en tarjetas: codigo, lote, caducidad, stock, precio y estado

### Gestion de Proyectos y Presupuestos (p. 67)

- Lista de proyectos con presupuesto, monto usado y barra de ejecucion
- Tabla de gastos con filtros y KPIs: Total Aprobado, Pendiente, En Ejecucion, Ejecucion General
- Formulario de nuevo gasto con acciones rapidas

La parte presupuestal de esta pantalla depende de la decision pendiente sobre el modulo de
Presupuestos.

### Kanban de Jornadas (p. 68)

- Lista de jornadas con fecha y estado (Alta ocupacion, Normal) y contadores por etapa
- Tablero Kanban tactil de cinco etapas: Registro, Triaje, Consulta, Farmacia, Alta
- Tarjeta de paciente con prioridad, condicion y acciones Mover a Triaje, Ver Ficha,
  Asignar Medico
- Panel de detalle del paciente: resumen clinico, alergias, medicacion actual y botones
  Volver a Registro y Avanzar a Triaje

### Voluntarios y Medicos (p. 68)

- Pantalla principal con busqueda y filtros por rol (Medico, Voluntario)
- Lista con avatar, nombre, especialidad y estado
- Ficha completa del voluntario: datos personales, telefono, correo, DPI, acceso al sistema,
  estado y permisos
- Historial de jornadas con porcentaje de avance y pacientes atendidos

## Trazabilidad pantalla - issues

### Web

| Pantalla                 | Pag. | Issues                                                        |
| ------------------------ | ---- | ------------------------------------------------------------- |
| Layout y navegacion      | 61   | #51, #52, #53, #54                                            |
| Inicio / Dashboard       | 61   | #209                                                          |
| Autenticacion            | 69   | #100, #101, #102                                              |
| Gestion de Pacientes     | 62   | #124, #125, #126, #127, #128, #129, #130, #131, #132          |
| Control de Donaciones    | 62   | #196, #197, #198, #199                                        |
| Control de Inventario    | 63   | #153, #154, #155, #156, #157, #158, #159, #160, #161, #162    |
| Gestion de Presupuestos  | 63   | sin issues asignadas                                          |
| Gestion de Proyectos     | 64   | #200, #201                                                    |
| Reportes e Impacto       | 64   | #210, #211, #212, #213, #214, #215, #216                      |
| Kanban de Jornadas       | 65   | #178, #179, #180, #181, #182, #183                            |
| Voluntarios y Medicos    | 65   | #105, #106, #107, #108, #184, #185                            |
| Transversales            | -    | #222 (E2E), #224 (usabilidad), #235 (responsivo), #236 (accesibilidad) |

### Movil

| Pantalla                 | Pag. | Issues                                                        |
| ------------------------ | ---- | ------------------------------------------------------------- |
| Navegacion y layout base | 66   | #55, #56, #58                                                 |
| Autenticacion y Ajustes  | 66   | #109, #110                                                    |
| Inicio                   | 66   | #264                                                          |
| Gestion de Pacientes     | 66   | #133, #134, #135, #136, #137, #138, #139, #225                |
| Control de Donaciones    | 66   | #265, #266, #267                                              |
| Control de Inventario    | 67   | #163, #164, #165, #268, #269, #270                            |
| Gestion de Proyectos     | 67   | #271                                                          |
| Kanban de Jornadas       | 68   | #186, #187, #188, #217                                        |
| Voluntarios y Medicos    | 68   | #272, #273                                                    |

## Huecos y decisiones abiertas

**Presupuesto por jornada, pendiente en el prototipo.** El presupuesto se asigna a la jornada y
el proyecto muestra la sumatoria. El prototipo agrega directamente por proyecto y no muestra el
monto de cada jornada, ni el encargado en la tabla de gastos. Falta agregar al Figma: el monto
asignado y ejecutado por jornada dentro del tab Jornadas de un proyecto, y la columna Encargado
en el Registro de gastos.

**Kanban de proyectos, sin diseno.** El sistema tendra un tablero propio para el avance de los
proyectos, aparte del Kanban de Jornadas. El prototipo no lo dibuja: la pantalla de Proyectos es
maestro-detalle con tabs Resumen, Equipo, Jornadas, Insumos y Gastos. Las issues siguen el patron
visual del kanban de jornadas y la pantalla queda pendiente de agregar al Figma.

**Reportes solo en web.** El diseno dibuja pantallas de Reportes e Impacto para movil (p. 67),
pero el equipo decidio que el modulo de reportes existe unicamente en la version web. Esas
pantallas moviles no se implementan.

**Sin modo sin conexion.** El sistema no contempla registro sin conexion ni cola de
sincronizacion. Las pantallas asumen conectividad; el manejo de fallos de red se resuelve con
el manejo global de errores (#231).

## Notas resueltas

**Gestion de Presupuestos** entra en alcance, en web y en movil, con flujo de aprobacion. Ver
las issues de `module:presupuestos`. (#274 cerrada.)

**Los tokens de diseno** ya tienen valores, medidos del prototipo. Ver la seccion "Paleta".
