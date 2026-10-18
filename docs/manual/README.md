# Manual de usuario y material de capacitación - Ecopac Digital

Índice del material que le permite a Ecopac Guatemala usar el sistema sin el equipo de desarrollo presente (issue #251), y el **formato común** que sigue todo ese material para que las piezas encajen aunque las escriban personas distintas.

## Las piezas

| Código | Pieza | Archivo | Estado |
| --- | --- | --- | --- |
| - | Plan de capacitaciones | [PLAN-DE-CAPACITACIONES.md](./PLAN-DE-CAPACITACIONES.md) y [PDF](../formal/plan-de-capacitaciones.pdf) | Escrito |
| M-ADM | Manual de la administradora (es también el manual de administración) | [PDF](../formal/manual-del-administrador.pdf) | Escrito, solo en PDF |
| M-MED | Manual del médico | [PDF](../formal/manual-del-medico.pdf) | Escrito, solo en PDF |
| M-VOL | Manual del voluntario (rol Colaborador) | [PDF](../formal/manual-del-voluntario.pdf) | Escrito, solo en PDF. Computadora y teléfono |
| M-JD | Manual de junta directiva y socio fundador, uno solo para los dos roles porque tienen los mismos permisos | [PDF](../formal/manual-de-junta-directiva-y-socio-fundador.pdf) | Escrito, solo en PDF |
| G-VOL | Guía rápida del voluntario, imprimible | [PDF](../formal/guia-rapida-voluntario.pdf) | Escrita, solo en PDF |
| G-JD | Guía rápida de junta directiva y socio fundador, imprimible | [PDF](../formal/guia-rapida-junta-directiva-y-socio-fundador.pdf) | Escrita, solo en PDF |
| V-01 a V-07 | Videos cortos de los flujos clave | Enlaces en la [tabla de videos](#videos), abajo | Publicados en YouTube |

Cuando una pieza se publica, se cambia su estado aquí y se pone el enlace. El plan de capacitaciones cita cada manual por código y número de sección ("M-MED 7.3"): si un manual cambia su numeración, hay que revisar el plan.

Desde su versión 2.0 (octubre de 2026), M-VOL y M-JD siguen el formato común de abajo: "Antes de empezar", flujos en la computadora y en el teléfono, "Estados y mensajes" y "Ayuda". M-JD solo muestra la computadora, que es donde trabajan esos roles.

## Formato común

### Dónde va cada cosa

| Qué | Dónde |
| --- | --- |
| El texto de cada manual, en Markdown | `docs/manual/`, con el nombre de archivo de la tabla de arriba |
| Las capturas de pantalla | `docs/manual/img/` |
| La versión formal en PDF de cada pieza | `docs/formal/`, con el mismo nombre en minúsculas: `manual-medico.pdf`, `guia-rapida-voluntarios.pdf` |
| Los videos | En la cuenta de la organización (Drive o YouTube no listado), nunca en una cuenta personal ni en el repositorio |

### Cómo empieza cada documento

Igual que el plan de capacitaciones, para que el PDF salga con la misma portada:

1. Un título de nivel 1: `# Manual del médico - Ecopac Digital`.
2. Un párrafo corto que dice para quién es y para qué sirve.
3. Una tabla sin encabezado con **Versión**, **Fecha** y **Dirigido a**.
4. Los capítulos, como títulos de nivel 2, numerados.

### Los capítulos de un manual

Todos los manuales llevan estos capítulos, **con estos nombres exactos** y en este orden. Los del medio cambian según el rol; el primero, los dos siguientes y los dos últimos son los mismos en los cinco.

| Capítulo | Qué contiene | En qué manuales |
| --- | --- | --- |
| Antes de empezar | Qué es el sistema, qué puede hacer este rol y qué no, y las reglas de confidencialidad | Todos |
| Ingreso al sistema | Primer ingreso, crear la contraseña, iniciar y cerrar sesión, recuperar la contraseña | Todos |
| Inicio y navegación | La pantalla de inicio, el menú, mi perfil y las notificaciones | Todos |
| Jornadas | Ver las jornadas asignadas y elegir la jornada de trabajo. En M-ADM, además planificar, asignar personal y cerrar | M-ADM, M-MED, M-VOL |
| Pacientes | Buscar, registrar, la ficha, el historial, la agenda de citas. En M-ADM, además los duplicados | M-ADM, M-MED, M-VOL |
| Atención en la jornada | Recibir al paciente, triaje y signos vitales | M-ADM, M-MED, M-VOL |
| Consulta y receta | Consulta, diagnósticos, receta, impresión y entrega de medicamentos | M-ADM, M-MED |
| Inventario | Existencias, ingresos, salidas, traslados, mis movimientos, insumos de jornada, vencimientos. En M-ADM, además la validación y el kárdex | M-ADM, M-MED, M-VOL |
| Proyectos | Proyectos, equipo, hitos y seguimiento | M-ADM |
| Presupuestos | Fondos de la jornada, gastos y su aprobación | M-ADM |
| Donaciones | Donantes y donaciones de dinero, medicamentos, insumos y servicios | M-ADM |
| Catálogos | Medicamentos, insumos, principios activos, presentaciones, bodegas, proveedores, diagnósticos, condiciones crónicas y comunidades | M-ADM |
| Colaboradores y permisos | Invitar, cambiar rol, dar de baja, funciones por persona y módulos por rol | M-ADM |
| Bitácora y notificaciones | La bitácora de auditoría, las notificaciones y los correos del sistema | M-ADM |
| Reportes | Qué reportes hay, sus filtros, cómo leerlos, exportar e imprimir | M-ADM, M-JD |
| Estados y mensajes | Qué significa cada estado (de una jornada, de un movimiento, de un gasto) y cada mensaje de error, y qué hacer | Todos |
| Ayuda | A quién preguntar y qué decirle | Todos |

M-MED y M-VOL muestran Proyectos y Presupuestos dentro del capítulo "Jornadas", porque el personal de campo solo los consulta.

La guía rápida (G-VOL) no sigue estos capítulos: son pocas páginas, con estas secciones: "Entrar la primera vez", "Su trabajo en la jornada, en orden", "Lo que puede usar", "Reglas de confidencialidad", "Si algo falla" y "A quién preguntar".

### Cómo se escribe un flujo

- Un flujo es un título de nivel 3 con un verbo: "Registrar a un paciente nuevo".
- Debajo, una frase que dice para qué sirve y quién lo hace.
- Después los pasos, **numerados, uno por acción**, y **cada paso con su captura** debajo.
- Cuando el flujo existe en la web y en el teléfono, van los dos, cada uno bajo un título de nivel 4: "En la computadora" y "En el teléfono".
- Al final del flujo, "Si algo sale mal": los mensajes que pueden aparecer en ese flujo, con un enlace al capítulo "Estados y mensajes".
- Si hay un video del flujo, el enlace va justo debajo del título: "Video: V-02".

### Lenguaje

- Sin palabras técnicas. "Computadora" y "teléfono", no "web" y "móvil". "Guardar", no "persistir".
- Los nombres de botones y pantallas, tal como se ven en el sistema y en negrita: **Registrar ingreso**.
- Los roles, con el nombre que muestra el sistema: Administradora, Médico, Colaborador, Junta directiva, Socio fundador.
- Con tildes y signos de apertura. Es un documento para la organización, no para el equipo.
- Sin emojis.

### Capturas de pantalla

- **Ninguna captura muestra datos reales de pacientes.** Se toman sobre los datos de demostración (`docs/DATOS-DE-PRUEBA.md`).
- Nombre del archivo: `<prefijo>-<número>-<descripción>.png`, y `-telefono` al final si es del teléfono. Ya existe `comun-01-inicio-de-sesion.png`.
- Prefijos: `comun` (lo que comparten varios manuales), `adm`, `med`, `vol`, `jd`, `sf` y `guia`.
- Lo que se repite en varios manuales (ingreso, inicio, registrar un paciente) se captura **una vez** con el prefijo `comun` y se reutiliza.
- En la computadora, ventana de 1366 por 768. En el teléfono, la pantalla completa.
- La acción del paso se marca con un recuadro o una flecha del mismo color en todas las capturas.

### Videos

De pocos minutos, uno por flujo, con narración o subtítulos, grabados sobre los datos de demostración.

| Código | Video | En la computadora | En el teléfono |
| --- | --- | --- | --- |
| V-01 | Primer ingreso al sistema y cambio de contraseña | https://youtu.be/DFRs3Te8VC4 | https://youtu.be/8umqLyAj0nE |
| V-02 | La consulta completa: recibir al paciente, triaje, consulta, receta y entrega de medicamentos | https://youtu.be/Knd4ATnlUUs | https://youtu.be/hbmSSMQ3oJQ |
| V-03 | Ingreso de lotes por compra y por donación, y su aprobación | https://youtu.be/syuIWsvOSMY | https://youtu.be/KvrXnOd6_RE |
| V-04 | Movimientos entre bodegas y su aprobación | https://youtu.be/Rz50VTEznu4 | https://youtu.be/2Gtyj1r2Y_g |
| V-05 | Insumos que salen a una jornada y lo que regresa | https://youtu.be/X_Qt1l8gGwc | No aplica |
| V-06 | Medicamentos vencidos o por vencer y sus alertas | https://youtu.be/Zbg-o5bG48o | https://youtu.be/1ugbkPWuQlk |
| V-07 | Planificar y cerrar una jornada | https://youtu.be/3RO6gtUiXpg | No aplica |

V-05 y V-07 no tienen versión en el teléfono: el tablero y el detalle de una jornada (insumos, consumo, cierre) solo se usan en la computadora.

## Antes de entregar

- Cada pieza en PDF, con portada, índice, logo, versión y fecha.
- Ninguna captura ni video con datos reales.
- Cada manual enlaza sus videos en el punto que corresponde.
- Todo enlazado desde esta página y desde `docs/README.md`.
- Enviado a la dirección del proyecto, y revisado por la organización.
