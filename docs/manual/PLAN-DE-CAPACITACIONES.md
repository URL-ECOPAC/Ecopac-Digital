# Plan de capacitaciones - Ecopac Digital

Cuántas sesiones hacen falta para que el personal de Ecopac Guatemala use el sistema sin el equipo de desarrollo presente, a quién va dirigida cada una, qué se enseña y en qué orden, y cómo se comprueba que se entendió. Issue #251.

| | |
| --- | --- |
| Versión | 1.0 |
| Fecha | 12 de octubre de 2026 |
| Dirigido a | Dirección de Ecopac Guatemala y quien imparta las capacitaciones |
| Material de apoyo | Manuales de usuario por rol, guía rápida para voluntarios y videos cortos |
| Datos de práctica | Solo datos de demostración, todos ficticios |

## Estado del material de apoyo

Este plan se apoya en los manuales por rol, la guía rápida y los videos, que se están elaborando en paralelo. Mientras no estén publicados, el plan los cita por su **código** y por el **nombre del capítulo** (sección 8), que son fijos. Cuando se publiquen, cada cita se convierte en un enlace sin cambiar el contenido de las sesiones.

| Material | Estado al 12 de octubre de 2026 |
| --- | --- |
| Plan de capacitaciones (este documento) | Escrito |
| Manuales de usuario de los cinco roles | En elaboración |
| Guía rápida para voluntarios nuevos | En elaboración |
| Videos cortos de los flujos clave | En elaboración |
| Aplicación móvil instalable en los teléfonos | Pendiente de la salida a producción (issue #252) |

## 1. Objetivo y alcance

Al terminar las capacitaciones, cada persona puede hacer sola, en el sistema, el trabajo que le corresponde según su rol, y sabe qué hacer y a quién acudir cuando algo falla.

El plan cubre los cinco roles del sistema, la aplicación web y la aplicación móvil. No cubre el mantenimiento técnico (servidores, respaldos, despliegues), que está en la documentación técnica.

## 2. A quién va dirigido

Cada persona se capacita solo en lo que su rol puede hacer. Nadie recibe una sesión sobre pantallas que no va a ver.

| Rol | Qué hace en el sistema | Dónde trabaja | Manual |
| --- | --- | --- | --- |
| Administradora | Todo: planifica jornadas y proyectos, administra el inventario y aprueba sus movimientos, lleva presupuestos y donaciones, gestiona a las personas y sus permisos | Web y móvil | M-ADM |
| Médico | Atiende en la jornada: consulta, diagnóstico y receta. Registra pacientes, triaje y movimientos de inventario | Web y móvil | M-MED |
| Colaborador (voluntario general) | Apoya en la jornada: recibe y registra pacientes, toma el triaje y los signos vitales, apoya en inventario. No hace consultas ni recetas | Web y móvil | M-VOL y G-VOL |
| Junta directiva | Consulta los reportes | Solo web | M-JD |
| Socio fundador | Consulta los reportes. Tiene los mismos permisos que junta directiva | Solo web | M-SF |

## 3. Resumen de las sesiones

Son **ocho sesiones**. Nadie asiste a las ocho salvo la administradora.

| Sesión | Tema | Dirigida a | Duración |
| --- | --- | --- | --- |
| 1 | Primer ingreso, navegación y confidencialidad | Todos los roles | 45 minutos |
| 2 | La jornada en campo: recibir, registrar y hacer el triaje | Administradora, médicos y colaboradores | 1 hora 30 minutos |
| 3 | La consulta: diagnóstico, receta y entrega de medicamentos | Médicos y administradora | 1 hora 30 minutos |
| 4 | Inventario en campo: existencias, ingresos, salidas y vencimientos | Administradora, médicos y colaboradores | 1 hora 30 minutos |
| 5 | Administración I: jornadas, proyectos, presupuestos y donaciones | Administradora | 2 horas |
| 6 | Administración II: aprobaciones, catálogos, personas, permisos y bitácora | Administradora | 2 horas |
| 7 | Reportes | Junta directiva, socios fundadores y administradora | 1 hora |
| 8 | Simulacro de una jornada completa | Administradora, médicos y colaboradores | 2 horas |

Tiempo total por rol:

| Rol | Sesiones | Tiempo total |
| --- | --- | --- |
| Administradora | 1 a 8 | 12 horas 15 minutos |
| Médico | 1, 2, 3, 4 y 8 | 7 horas 15 minutos |
| Colaborador | 1, 2, 4 y 8 | 5 horas 45 minutos |
| Junta directiva y socio fundador | 1 y 7 | 1 hora 45 minutos |

Grupos de **ocho personas como máximo** por sesión, para que quien capacita pueda ver la pantalla de cada una. Si hay más personas, la sesión se repite.

## 4. El orden y su razón

Las sesiones van de lo que todos necesitan a lo que solo necesita una persona, y de lo que se hace primero en una jornada a lo que se hace después.

| Orden | Por qué va ahí |
| --- | --- |
| Sesión 1 primero | Sin entrar al sistema no se puede practicar nada. Las reglas de confidencialidad se dan antes de que nadie vea un expediente |
| Sesión 2 antes que la 3 | Es el orden real de una jornada: el paciente se recibe y pasa por triaje antes de llegar al médico. El médico necesita saber qué le llega ya registrado |
| Sesión 3 antes que la 4 | La receta descuenta medicamentos del inventario. Quien ya vio una receta entiende por qué las existencias tienen que estar bien |
| Sesión 4 antes que la 5 y la 6 | La administradora aprueba lo que el personal de campo registra. Primero se aprende a registrar un movimiento; después, a aprobarlo |
| Sesiones 5 y 6 separadas | Son las más largas y las más densas. La 5 es planificar (lo que pasa antes y después de una jornada); la 6 es controlar (aprobar, dar accesos, revisar) |
| Sesión 7 después de la 5 | Los reportes muestran lo que se registró en las jornadas. La administradora los entiende mejor después de planificar y cerrar una |
| Sesión 8 al final | Junta todo. Es la comprobación de que el equipo puede llevar una jornada completa sin ayuda |

La sesión 7 no depende de las sesiones 2 a 6 para junta directiva y socios fundadores: pueden recibirla cualquier día después de la sesión 1.

## 5. Dinámica de cada sesión

Todas las sesiones siguen la misma estructura, en tres momentos:

| Momento | Qué pasa | Proporción del tiempo |
| --- | --- | --- |
| Demostración | Quien capacita hace el flujo completo en la pantalla proyectada, despacio y explicando cada paso. Se proyecta el video correspondiente si existe | Una cuarta parte |
| Práctica guiada | Cada persona repite el flujo en su propio equipo, con su propio usuario de práctica, mientras quien capacita acompaña | La mitad |
| Ejercicio de comprobación | Cada persona resuelve sola una lista de tareas, sin ayuda. Quien capacita marca qué se logró | Una cuarta parte |

Reglas para quien capacita:

- Se practica **solo con datos de demostración**. Nunca se usa un paciente real para enseñar.
- Cada persona usa un usuario de práctica con **su mismo rol**, para que vea exactamente lo que verá después.
- Lo que es distinto entre la web y el teléfono se muestra en los dos.
- Cuando aparece un mensaje de error, no se esquiva: se lee en voz alta y se busca en el capítulo "Estados y mensajes" del manual.
- Nadie pasa a la sesión siguiente sin completar el ejercicio de comprobación de la anterior.

## 6. Las sesiones en detalle

### Sesión 1. Primer ingreso, navegación y confidencialidad

| | |
| --- | --- |
| Dirigida a | Todos los roles |
| Duración | 45 minutos |
| Requisito | Tener una cuenta creada por la administradora y acceso al correo con el que se creó |
| Equipo | Computadora para todos; además teléfono para administradora, médicos y colaboradores |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| Qué es Ecopac Digital y qué reemplaza (el papel y los mensajes) | Capítulo "Antes de empezar" del manual de cada rol | - |
| Reglas de confidencialidad: no tomar capturas, no compartir la cuenta, no hablar de pacientes fuera de la jornada | G-VOL, "Reglas de confidencialidad"; capítulo "Antes de empezar" | - |
| Primer ingreso: el correo de bienvenida y la creación de la contraseña | Capítulo "Ingreso al sistema" | V-01 |
| Iniciar y cerrar sesión, en la web y en el teléfono | Capítulo "Ingreso al sistema" | V-01 |
| Qué hacer si se olvida la contraseña | Capítulo "Ingreso al sistema" | V-01 |
| La pantalla de inicio y el menú: qué módulos ve cada rol y por qué no todos ven lo mismo | Capítulo "Inicio y navegación" | - |
| Mi perfil y las notificaciones | Capítulo "Inicio y navegación" | - |
| El cierre de sesión por inactividad | Capítulo "Estados y mensajes" | - |

Junta directiva y socios fundadores hacen esta sesión solo en la web: la aplicación del teléfono es para el trabajo de campo y no les abre pantallas.

Ejercicio de comprobación. Cada persona, sola:

- Entra al sistema con su usuario y su contraseña.
- Cierra la sesión y vuelve a entrar.
- Pide el correo para restablecer la contraseña y la cambia.
- Dice qué módulos ve en su menú y para qué sirve cada uno.
- Dice las tres reglas de confidencialidad.

### Sesión 2. La jornada en campo: recibir, registrar y hacer el triaje

| | |
| --- | --- |
| Dirigida a | Administradora, médicos y colaboradores |
| Duración | 1 hora 30 minutos |
| Requisito | Sesión 1 |
| Equipo | Teléfono con la aplicación para cada persona y una computadora por pareja |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| Qué es una jornada, sus estados y por qué casi todo lo clínico exige una jornada en curso | M-VOL y M-MED, "Jornadas" | V-07 |
| Ver las jornadas asignadas y elegir la jornada en la que se trabaja | M-VOL y M-MED, "Jornadas" | - |
| Buscar a un paciente antes de registrarlo, para no duplicarlo | M-VOL y M-MED, "Pacientes" | V-02 |
| Registrar a un paciente nuevo | M-VOL y M-MED, "Pacientes" | V-02 |
| La ficha del paciente: datos, historial y condiciones crónicas | M-VOL y M-MED, "Pacientes" | - |
| Recibir al paciente en la jornada | M-VOL y M-MED, "Atención en la jornada" | V-02 |
| Triaje y signos vitales | M-VOL y M-MED, "Atención en la jornada" | V-02 |
| La agenda de citas de la jornada | M-VOL y M-MED, "Pacientes" | - |
| Qué hacer si no hay señal o algo falla: el aviso "Sin conexión" y por qué lo que se escribe sin señal no queda guardado | G-VOL, "Si algo falla"; "Estados y mensajes" | - |

Ejercicio de comprobación. Cada persona, sola, en el teléfono:

- Abre la jornada en curso de práctica.
- Busca a un paciente que ya existe y abre su ficha.
- Registra a un paciente nuevo con los datos ficticios que le entregan.
- Lo recibe en la jornada y le registra el triaje con signos vitales.
- Explica qué haría si el teléfono se queda sin señal.

### Sesión 3. La consulta: diagnóstico, receta y entrega de medicamentos

| | |
| --- | --- |
| Dirigida a | Médicos y administradora |
| Duración | 1 hora 30 minutos |
| Requisito | Sesiones 1 y 2 |
| Equipo | Teléfono con la aplicación y computadora para cada persona |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| Abrir la consulta de un paciente que ya pasó por triaje | M-MED, "Consulta y receta" | V-02 |
| Motivo de consulta, síntomas y exploración | M-MED, "Consulta y receta" | V-02 |
| Diagnóstico principal y diagnósticos secundarios | M-MED, "Consulta y receta" | V-02 |
| Condiciones crónicas del paciente | M-MED, "Pacientes" | - |
| Generar la receta: qué medicamentos hay disponibles y qué pasa con uno vencido o sin existencia | M-MED, "Consulta y receta" | V-02 |
| Imprimir la receta | M-MED, "Consulta y receta" | - |
| Entregar los medicamentos y cómo se descuentan del inventario | M-MED, "Consulta y receta" | V-02 |
| Consultar el historial y la evolución de signos de un paciente | M-MED, "Pacientes" | - |

Ejercicio de comprobación. Cada persona, sola:

- Atiende al paciente que registró en la sesión 2: consulta completa con un diagnóstico principal.
- Genera una receta con dos medicamentos.
- Registra la entrega de los medicamentos.
- Encuentra esa consulta en el historial del paciente.
- Explica por qué el sistema no deja recetar un medicamento vencido.

### Sesión 4. Inventario en campo: existencias, ingresos, salidas y vencimientos

| | |
| --- | --- |
| Dirigida a | Administradora, médicos y colaboradores |
| Duración | 1 hora 30 minutos |
| Requisito | Sesiones 1 y 2 |
| Equipo | Teléfono con la aplicación y una computadora por pareja |

Es la parte más compleja del sistema. Se enseña con los cuatro videos de inventario.

| Tema | Manual | Video |
| --- | --- | --- |
| Medicamentos, insumos, lotes y bodegas: qué es cada cosa | M-VOL y M-MED, "Inventario" | - |
| Consultar las existencias por bodega y por lote | M-VOL y M-MED, "Inventario" | - |
| Registrar el ingreso de un lote, por compra y por donación | M-VOL y M-MED, "Inventario" | V-03 |
| Los estados de un movimiento: pendiente, aprobado y rechazado. Por qué un ingreso no cuenta hasta que se aprueba | M-VOL y M-MED, "Inventario"; "Estados y mensajes" | V-03 |
| Registrar una salida y un traslado entre bodegas | M-VOL y M-MED, "Inventario" | V-04 |
| Mis movimientos: ver en qué quedó lo que registré | M-VOL y M-MED, "Inventario" | V-04 |
| Insumos que salen a una jornada y lo que regresa | M-VOL y M-MED, "Inventario" | V-05 |
| Medicamentos vencidos o por vencer, y sus alertas | M-VOL y M-MED, "Inventario" | V-06 |

Ejercicio de comprobación. Cada persona, sola:

- Dice cuántas unidades hay de un medicamento en una bodega.
- Registra el ingreso de un lote con los datos ficticios que le entregan.
- Encuentra ese ingreso en "Mis movimientos" y dice en qué estado está.
- Encuentra el lote vencido y el lote por vencer de los datos de demostración.
- Explica qué pasa con un ingreso mientras nadie lo aprueba.

### Sesión 5. Administración I: jornadas, proyectos, presupuestos y donaciones

| | |
| --- | --- |
| Dirigida a | Administradora |
| Duración | 2 horas, con un descanso de 10 minutos |
| Requisito | Sesiones 1 a 4 |
| Equipo | Computadora. Esta sesión es en la web |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| Proyectos: crear uno, su equipo, sus hitos y su seguimiento | M-ADM, "Proyectos" | - |
| Planificar una jornada: comunidad, fechas, proyecto y bodega | M-ADM, "Jornadas" | V-07 |
| Asignar personal y armar el cuadro de turnos | M-ADM, "Jornadas" | V-07 |
| Los insumos previstos para la jornada | M-ADM, "Jornadas" | V-05 |
| Los estados de una jornada y cómo se pasa de uno a otro | M-ADM, "Jornadas"; "Estados y mensajes" | V-07 |
| Presupuesto de la jornada: de dónde salen los fondos | M-ADM, "Presupuestos" | - |
| Registrar un gasto y aprobarlo o rechazarlo | M-ADM, "Presupuestos" | - |
| Donantes y donaciones: dinero, medicamentos, insumos y servicios | M-ADM, "Donaciones" | V-03 |
| Cerrar la jornada: resumen, sobrante y lo que regresa a bodega | M-ADM, "Jornadas" | V-07 |

Ejercicio de comprobación. La administradora, sola:

- Crea una jornada planificada para una comunidad de práctica.
- Le asigna un médico y un colaborador, con su turno.
- Registra una donación de dinero para esa jornada y comprueba que aparece en su presupuesto.
- Registra un gasto y lo aprueba.
- Explica qué pasa con el sobrante al cerrar una jornada.

### Sesión 6. Administración II: aprobaciones, catálogos, personas, permisos y bitácora

| | |
| --- | --- |
| Dirigida a | Administradora |
| Duración | 2 horas, con un descanso de 10 minutos |
| Requisito | Sesión 5 |
| Equipo | Computadora y teléfono con la aplicación |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| La bandeja de validación: aprobar y rechazar movimientos de inventario, en la web y en el teléfono | M-ADM, "Inventario" | V-03 y V-04 |
| El kárdex: la historia de cada movimiento | M-ADM, "Inventario" | - |
| Catálogos de inventario: medicamentos, insumos, principios activos, presentaciones, bodegas y proveedores | M-ADM, "Catálogos" | - |
| Catálogos clínicos: diagnósticos, condiciones crónicas y comunidades | M-ADM, "Catálogos" | - |
| Pacientes duplicados: cómo se detectan y cómo se fusionan | M-ADM, "Pacientes" | - |
| Colaboradores: invitar a una persona, cambiarle el rol y darla de baja | M-ADM, "Colaboradores y permisos" | - |
| Dar una función concreta a una persona, y abrirle un módulo a un rol en solo lectura | M-ADM, "Colaboradores y permisos" | - |
| La bitácora de auditoría: quién hizo qué y cuándo | M-ADM, "Bitácora y notificaciones" | - |
| Las notificaciones y los correos que manda el sistema | M-ADM, "Bitácora y notificaciones" | - |

Ejercicio de comprobación. La administradora, sola:

- Aprueba uno de los ingresos que se registraron en la sesión 4 y rechaza otro, con su motivo.
- Agrega un medicamento al catálogo.
- Invita a una persona de práctica con el rol de colaborador.
- Le cambia el rol y después la da de baja.
- Encuentra en la bitácora la baja que acaba de hacer.

### Sesión 7. Reportes

| | |
| --- | --- |
| Dirigida a | Junta directiva, socios fundadores y administradora |
| Duración | 1 hora |
| Requisito | Sesión 1 |
| Equipo | Computadora. Esta sesión es en la web |

Qué se enseña, en orden:

| Tema | Manual | Video |
| --- | --- | --- |
| Qué reportes hay y qué pregunta responde cada uno: panel de métricas, pacientes atendidos, inventario actual, medicamentos por vencer y reporte de una jornada | M-JD y M-SF, "Reportes" | - |
| Usar los filtros de cada reporte | M-JD y M-SF, "Reportes" | - |
| Leer un reporte: qué significa cada número y de dónde sale | M-JD y M-SF, "Reportes" | - |
| Por qué los reportes muestran totales y no datos de un paciente | M-JD y M-SF, "Antes de empezar" | - |
| Exportar un reporte a una hoja de cálculo e imprimirlo | M-JD y M-SF, "Reportes" | - |

Ejercicio de comprobación. Cada persona, sola:

- Abre el reporte de una jornada finalizada de los datos de demostración.
- Dice cuántos pacientes se atendieron en ella.
- Aplica un filtro en el reporte de pacientes atendidos.
- Exporta o imprime un reporte.

### Sesión 8. Simulacro de una jornada completa

| | |
| --- | --- |
| Dirigida a | Administradora, médicos y colaboradores, juntos |
| Duración | 2 horas |
| Requisito | Todas las sesiones anteriores de su rol |
| Equipo | El de una jornada real: teléfonos con la aplicación y una computadora para la administradora |

No se enseña nada nuevo. Se hace una jornada de principio a fin, con cada persona en su papel y con personas del equipo haciendo de pacientes, con datos ficticios.

| Paso | Quién |
| --- | --- |
| Planificar la jornada y asignar al equipo | Administradora |
| Registrar la salida de insumos y medicamentos hacia la jornada, y aprobarla | Colaborador y administradora |
| Poner la jornada en curso | Administradora |
| Recibir a los pacientes, registrarlos y hacerles el triaje | Colaboradores |
| Consulta, diagnóstico, receta y entrega | Médicos |
| Registrar lo que regresa a bodega | Colaborador |
| Cerrar la jornada y revisar su resumen | Administradora |

Quien capacita **no interviene**: solo observa y anota dónde se detuvo cada persona. Al final se repasan esos puntos con el manual.

Comprobación: la jornada queda cerrada, con al menos cinco pacientes atendidos de principio a fin, sin que quien capacita haya tocado ningún equipo.

## 7. Materiales y equipo

| Qué | Cuánto | Para qué sesiones |
| --- | --- | --- |
| Computadora con navegador actualizado | Una por persona, o una por pareja donde se indica | Todas |
| Teléfono Android con la aplicación instalada | Uno por persona de campo | 1, 2, 3, 4, 6 y 8 |
| Proyector o pantalla grande | Uno | Todas |
| Conexión a internet estable | En la sala | Todas |
| Usuarios de práctica, uno por rol y por persona | Los prepara la administradora antes de la sesión 1 | Todas |
| Ambiente de práctica con los datos de demostración | Uno, distinto del sistema real | Todas |
| Manual impreso o en PDF del rol de cada persona | Uno por persona | Todas |
| Guía rápida para voluntarios, impresa | Una por colaborador | 1, 2 y 8 |
| Hoja de datos ficticios para los ejercicios | Una por persona | 2, 3, 4, 5 y 6 |
| Lista de comprobación de la sesión | Una por persona | Todas |

Antes de la primera sesión, quien capacita comprueba que:

- El ambiente de práctica abre y tiene los datos de demostración cargados.
- Cada persona tiene su usuario de práctica y puede abrir el correo con el que se creó.
- La aplicación está instalada en todos los teléfonos y abre.
- Los videos se pueden reproducir en la sala.

**Las capacitaciones no se hacen en el sistema real.** Todo lo que se registra en una sesión es ficticio, y en el sistema real se quedaría mezclado con los expedientes de verdad.

## 8. Cómo se cita el material de apoyo

Para que el plan, los manuales y los videos coincidan aunque los escriban personas distintas, todo el material usa los mismos códigos y los mismos nombres de capítulo. El detalle del formato está en `docs/manual/README.md`.

Manuales y guía:

| Código | Documento |
| --- | --- |
| M-ADM | Manual de la administradora, que es también el manual de administración |
| M-MED | Manual del médico |
| M-VOL | Manual del colaborador (voluntario general) |
| M-JD | Manual de junta directiva |
| M-SF | Manual del socio fundador |
| G-VOL | Guía rápida para voluntarios nuevos |

Videos:

| Código | Video |
| --- | --- |
| V-01 | Primer ingreso al sistema y cambio de contraseña |
| V-02 | La consulta completa: recibir al paciente, triaje, consulta, receta y entrega de medicamentos |
| V-03 | Ingreso de lotes por compra y por donación, y su aprobación |
| V-04 | Movimientos entre bodegas y su aprobación |
| V-05 | Insumos que salen a una jornada y lo que regresa |
| V-06 | Medicamentos vencidos o por vencer y sus alertas |
| V-07 | Planificar y cerrar una jornada |

## 9. Después de las capacitaciones

| Qué | Cuándo |
| --- | --- |
| Acompañamiento en la primera jornada real: una persona del equipo de soporte presente o disponible por teléfono | La primera jornada después del simulacro |
| Repaso de la sesión 8 | Antes de cada temporada de jornadas |
| Capacitación de personas nuevas: sesión 1 y las de su rol, con la guía rápida el mismo día para los colaboradores | Cada vez que entra alguien |
| Revisión de este plan y de los manuales | Cada vez que cambia una pantalla del sistema |

Quien llega a una jornada por primera vez sin haber recibido las sesiones trabaja acompañado, con la guía rápida, y solo en recibir y registrar pacientes.

## 10. Registro de las capacitaciones

Cada sesión impartida se anota aquí. Una sesión cuenta como aprobada cuando la persona completó sola el ejercicio de comprobación.

| Fecha | Sesión | Quién capacitó | Asistentes | Aprobaron | Observaciones |
| --- | --- | --- | --- | --- | --- |
| _pendiente_ | - | - | - | - | - |
