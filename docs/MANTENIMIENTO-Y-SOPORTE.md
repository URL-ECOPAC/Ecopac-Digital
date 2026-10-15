# Plan de mantenimiento y soporte - Ecopac Digital

Qué hay que revisar, cada cuánto y quién lo hace para que Ecopac Digital siga funcionando cuando el equipo de desarrollo ya no esté, cómo se reporta un problema y qué hacer en los casos que más se repiten. Issue #921.

| | |
| --- | --- |
| Versión | 1.0 |
| Fecha | 14 de octubre de 2026 |
| Dirigido a | Dirección de Ecopac Guatemala, la administradora del sistema, la persona responsable del sistema y quien dé soporte técnico |
| Estado | Borrador. Las personas, los canales y los plazos de soporte están marcados **PENDIENTE DE CONFIRMAR**; lo que depende de la salida a producción, **pendiente de la salida a producción (#252)** |

## Cómo leer este documento

- Cada tarea dice quién la puede hacer:
  - **La puede hacer:** cualquier persona con acceso a la cuenta o pantalla que se nombra. No hace falta saber programar.
  - **Requiere un técnico:** hace falta alguien que sepa usar la terminal, Git y la consola de Supabase.
- Los manuales se citan por código y sección, igual que en el [plan de capacitaciones](./manual/PLAN-DE-CAPACITACIONES.md): "M-ADM 13.4" es la sección 13.4 del [manual de la administradora](./formal/manual-del-administrador.pdf). Los códigos están en el plan de capacitaciones, sección 8.
- Este documento no repite lo que ya está escrito en otro lado. El respaldo y la restauración están en [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md); el uso diario del sistema, en los manuales de `docs/formal/`.
- Los nombres de botones y pantallas de GitHub, Google y Supabase se escriben como aparecen en esos servicios, casi siempre en inglés.

### Estado del sistema al 14 de octubre de 2026

Varias tareas de este plan solo tienen sentido cuando el sistema esté en producción, y **producción todavía no está desplegada** ([MANUAL-TECNICO.md](./MANUAL-TECNICO.md), sección 12):

- La base de producción (`Ecopac-Digital-Prod`) existe pero está pausada, y faltan sus secrets en GitHub.
- La dirección web de producción no existe todavía: **pendiente de la salida a producción (#252)**.
- La aplicación del teléfono se prueba con Expo Go; cómo se va a instalar en los teléfonos de la organización está **pendiente de la salida a producción (#252)**.
- El respaldo diario está escrito y ensayado en local, pero nunca ha corrido contra la base real ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), "Estado").
- Las tareas automáticas ("Alertas de vencimiento" y "Mantener Supabase activo") apuntan hoy a la base de desarrollo, no a la de producción ([MANUAL-TECNICO.md](./MANUAL-TECNICO.md), 12.4, punto 6).

Este plan se escribe ya para que las cuentas, las personas y los canales queden decididos antes de que el sistema reciba datos reales.

## 1. Responsables

| Papel | Quién | Qué hace |
| --- | --- | --- |
| Responsable del sistema | **PENDIENTE DE CONFIRMAR** | Hace las revisiones de la sección 2, recibe los avisos automáticos y decide cuándo llamar a un técnico |
| Administradora | **PENDIENTE DE CONFIRMAR** | Da de alta y de baja a las personas, les asigna su rol y aprueba los movimientos (M-ADM 13) |
| Persona responsable de la base, custodia de la llave privada | **Pendiente de designar** ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4) | Única persona que puede abrir un respaldo. Tiene que ser de la organización, no del equipo de desarrollo |
| Suplente de la custodia (segunda copia de la llave) | **Pendiente de designar** ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4) | Abre un respaldo si la titular no está disponible |
| Administra la cuenta de Google de la organización (`ecopac.digital@gmail.com`: Drive con los respaldos, credencial del respaldo) | **PENDIENTE DE CONFIRMAR**. El equipo de desarrollo solo conoce la dirección, no tiene la contraseña ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), "Estado") | Revisa los respaldos en Drive y renueva la credencial |
| Administra la organización de GitHub dueña del repositorio | **PENDIENTE DE CONFIRMAR** | Reactiva los workflows, cambia los secrets y da o quita acceso al repositorio |
| Administra la organización de Supabase (`Ecopac-Digital-Dev` y `Ecopac-Digital-Prod`) | **PENDIENTE DE CONFIRMAR** | Reanuda un proyecto pausado, revisa el consumo y cambia contraseñas y llaves |
| Administra la cuenta de Vercel (o el servicio donde quede la web) | **Pendiente de la salida a producción (#252)**: no está decidido dónde se publica la web | Revisa que la web esté publicada |
| Administra la cuenta de Expo (compilación de la aplicación del teléfono) | **Pendiente de la salida a producción (#252)**: no está decidido cómo se distribuye la aplicación | Compila y publica las versiones nuevas de la aplicación |
| Administra la cuenta de Sentry (monitoreo de errores) | **PENDIENTE DE CONFIRMAR**. Sentry todavía no está contratado ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), 4.1); el plan gratuito admite un solo usuario | Revisa los errores que reporta el sistema |
| Gestor de contraseñas de la organización (donde va una de las copias de la llave privada) | **PENDIENTE DE CONFIRMAR** qué gestor y quién lo administra | Guarda las credenciales de todas las cuentas de esta tabla |
| Soporte técnico del equipo de desarrollo | **PENDIENTE DE CONFIRMAR**: duración del soporte y canal. Al terminar, el equipo se retira de todas las cuentas ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4) | Atiende las fallas de la sección 3 mientras dure el soporte |
| A quién acudir cuando termine el soporte del equipo | **PENDIENTE DE CONFIRMAR** | Lo mismo, después |

**La persona responsable del sistema necesita una cuenta de GitHub que siga el repositorio.** Cuando algo automático falla -el respaldo, las alertas de vencimiento, el despliegue de la base- el sistema abre una issue en GitHub. Esa issue solo le llega por correo a quien sigue el repositorio: un workflow programado que falla, por sí solo, avisa nada más a la última persona que editó su archivo (comentario del paso "Avisar del fallo con una issue" en `.github/workflows/respaldo-base.yml`). Esa persona suele ser del equipo de desarrollo, que se va a ir.

Para seguir el repositorio:

1. Entrar a GitHub con la cuenta de la persona responsable y abrir la página del repositorio.
2. Arriba a la derecha, pulsar **Watch**.
3. Elegir **All Activity**, o **Custom** y marcar **Issues**.
4. En la configuración de la cuenta (foto de perfil > **Settings** > **Notifications**), comprobar que las notificaciones de **Watching** estén activadas para **Email**.

Lo mejor es que lo hagan al menos dos personas, para que un aviso no dependa de que una sola lea su correo.

## 2. Mantenimiento preventivo

Lo que se revisa aunque no haya ninguna falla, para que no la haya. El resumen de todo el año está en el anexo B.

### Lo que corre solo

Estas tareas no las hace nadie: corren solas en GitHub Actions ([CI-CD.md](./CI-CD.md), "Los seis workflows"). Lo que sí hay que hacer es comprobar que siguen corriendo (2.1).

| Workflow (nombre en la pestaña Actions) | Qué hace | Cuándo corre | Si falla |
| --- | --- | --- | --- |
| Respaldo de la base | Saca una copia cifrada de la base de producción y la guarda en Drive | Todos los días, 01:00 de Guatemala | Corrida en rojo y una issue "El respaldo de produccion fallo" |
| Alertas de vencimiento | Avisa a la administración de los medicamentos vencidos o por vencer | Todos los días, 00:00 de Guatemala | Una issue "[BUG] No se estan generando las alertas de vencimiento" |
| Verificar despliegue | Comprueba que las dos bases tengan todos los cambios de estructura | Todos los días, 07:00 de Guatemala | Una issue "[BUG] ... tiene migraciones sin aplicar" |
| Mantener Supabase activo | Hace una consulta mínima para que Supabase no pause la base | Cada 3 días | Solo la corrida en rojo; no abre issue |

### 2.1 Mensual

| Tarea | Frecuencia | Responsable | ¿Requiere técnico? | Pasos |
| --- | --- | --- | --- | --- |
| Revisar que los workflows programados corren y reactivar los desactivados | Mensual, la primera semana | Responsable del sistema | No | 2.1.1 |
| Comprobar en Drive que hay respaldos de los últimos días | Mensual, el mismo día | Quien administra la cuenta de Google, o la responsable del sistema con ese acceso | No | 2.1.2 |
| Revisar el consumo contra los límites de la capa gratuita, incluida la pausa de Supabase | Mensual | Quien administra Supabase | No | 2.1.3 |
| Revisar los PRs de Dependabot y la auditoría de dependencias | Mensual | Técnico | **Sí** | 2.1.4 |

#### 2.1.1 Los workflows programados

**La puede hacer:** cualquier persona con una cuenta de GitHub con acceso al repositorio. Para reactivar un workflow hace falta además permiso de administración o escritura en el repositorio.

**Por qué hace falta.** GitHub **desactiva los workflows programados de un repositorio que pasa 60 días sin actividad**, y no avisa a la organización ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 6; [CI-CD.md](./CI-CD.md), "La programacion de las alertas de vencimiento"). "Actividad" son cambios al código, no las corridas de los propios workflows: en la temporada sin jornadas, si nadie toca el repositorio en dos meses, se apagan **los cuatro a la vez**. Eso significa:

- **Respaldo de la base:** no se guarda ninguna copia nueva de la base, y el plan gratuito de Supabase no ofrece otra.
- **Alertas de vencimiento:** dejan de llegar los avisos de medicamentos por vencer, y la pantalla de alertas se ve igual de vacía que cuando no hay nada que avisar.
- **Mantener Supabase activo:** el proyecto puede pausarse a la semana sin uso (2.1.3).
- **Verificar despliegue:** nadie comprueba que la base tenga todos sus cambios.

Pasos:

1. Abrir el repositorio en GitHub y pulsar la pestaña **Actions**.
2. En la lista de la izquierda, pulsar **Respaldo de la base**.
3. Mirar la lista de corridas. Tiene que haber una por día con una marca verde, y la de arriba tiene que ser de ayer o de hoy.
4. Si arriba aparece un aviso de que el workflow está desactivado ("This scheduled workflow is disabled..."), pulsar **Enable workflow** en ese mismo aviso.
5. Repetir los pasos 2 a 4 con **Alertas de vencimiento**, **Verificar despliegue** y **Mantener Supabase activo** (este último corre cada 3 días, así que lo normal es una corrida cada 3 días).
6. Si un workflow tiene corridas en rojo (una X), abrir la más reciente y ver si ya hay una issue abierta en la pestaña **Issues**. Si no la hay, llamar a un técnico (sección 3).
7. Después de reactivar uno, se puede forzar una corrida en el momento: en la página del workflow, **Run workflow** > **Run workflow**. Tiene que terminar en verde.

> Mientras no se haga la salida a producción (#252), en la rama de producción solo existe "Mantener Supabase activo". Los otros tres empiezan a correr por horario cuando se haga ([MANUAL-TECNICO.md](./MANUAL-TECNICO.md), 12.3). Hasta entonces, que no aparezcan corridas de esos tres no es una falla.

#### 2.1.2 Los respaldos en Drive

**La puede hacer:** cualquier persona con acceso a la cuenta de Google `ecopac.digital@gmail.com`. No hace falta la llave privada: solo se mira que los archivos estén, no se abren.

1. Entrar a <https://drive.google.com> con la cuenta de la organización.
2. Abrir la carpeta `respaldos-ecopac-digital`.
3. Ordenar por fecha de modificación (encabezado de la columna).
4. Comprobar que el archivo más reciente es de hoy o de ayer. El nombre trae la fecha: `respaldo-ecopac-prod-20261012T070000Z.tar.gz.gpg` es del 12 de octubre de 2026, a la 01:00 de Guatemala.
5. Comprobar que hay alrededor de 30 archivos. El respaldo conserva los 30 más recientes y borra los viejos solo ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 2).
6. En la parte de abajo del menú izquierdo, mirar cuánto espacio queda en la cuenta. Si pasa del 80 %, avisar a un técnico.

Reglas que no se rompen ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4): la carpeta no se comparte con nadie, ni por enlace; los archivos no se mueven ni se cambian de nombre; la carpeta no se crea ni se borra a mano.

Si faltan respaldos recientes: revisar primero 2.1.1 (el workflow pudo quedar desactivado) y después la sección 5, "Llegó un correo de alerta".

#### 2.1.3 Consumo y pausa de Supabase

**La puede hacer:** cualquier persona con acceso a la organización de Supabase.

Ningún límite de la capa gratuita se agota por la cantidad de datos que maneja Ecopac ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), "Resumen"). Lo que más riesgo tiene es la **pausa**: un proyecto del plan gratuito se pausa tras **una semana sin actividad**, y un proyecto pausado no responde hasta que alguien lo reanuda a mano ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), 6.3).

1. Entrar a <https://supabase.com/dashboard> con la cuenta que administra la organización.
2. En la lista de proyectos, comprobar que `Ecopac-Digital-Prod` no aparece como pausado ("Paused"). Si lo está, seguir la sección 5, "El proyecto de Supabase se pausó".
3. Abrir la página de uso de la organización (**Usage**) y anotar estos números contra su límite:

| Qué | Límite del plan gratuito | Avisar a un técnico si pasa de |
| --- | --- | --- |
| Tamaño de la base de datos | 500 MB | 250 MB (la mitad) |
| Salida de datos (Egress) | 5 GB al mes | 4 GB en un mes |
| Usuarios activos al mes | 50,000 | No se espera acercarse |
| Invocaciones de Edge Functions | 500,000 al mes | No se espera acercarse |

4. Si se usa Sentry, revisar en su panel que no se acerque a los 5,000 errores al mes ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), 4.1). Que se acerque casi siempre significa un mismo error repetido: es una falla de prioridad alta (sección 3).
5. Anotar los números del mes. Así se ve si la base crece más rápido que lo estimado ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), sección 9). Dónde se anotan: **PENDIENTE DE CONFIRMAR**.

El umbral de 250 MB es el que propone la #762 para empezar a pensar qué hacer con la bitácora ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), sección 5). Lo que cuesta pasar al siguiente plan está en la sección 7 de ese mismo documento.

#### 2.1.4 Dependencias

**Requiere un técnico.**

1. En la pestaña **Pull requests** del repositorio, buscar los que abrió Dependabot. Llegan una vez al mes hacia `develop`, agrupados en dependencias de producción, de desarrollo y acciones de GitHub ([CI-CD.md](./CI-CD.md), "Dependencias fijadas").
2. Por cada uno: esperar a que el CI termine en verde, leer qué cambia y mergearlo, o cerrarlo explicando por qué.
3. Abrir la corrida más reciente del CI en `develop` y leer en el resumen los dos pasos de auditoría de dependencias. Una vulnerabilidad `critical` bloquea los PRs; una `high` solo avisa ([CI-CD.md](./CI-CD.md), "Auditoria de dependencias").
4. Si aparece una vulnerabilidad nueva sin arreglo, abrir una issue con la plantilla **Tarea Tecnica**.

Este paso también cuenta como actividad del repositorio y evita que GitHub desactive los workflows (2.1.1).

### 2.2 Cuando alguien entra o sale

| Tarea | Frecuencia | Responsable | ¿Requiere técnico? | Pasos |
| --- | --- | --- | --- | --- |
| Dar de alta a una persona y capacitarla | Cada vez que entra alguien | Administradora | No | 2.2.1 |
| Dar de baja a una persona | Cada vez que sale alguien | Administradora | No, salvo si la persona tenía acceso a alguna cuenta del anexo A | 2.2.2 |
| Revisar la lista de usuarios activos | Por temporada, antes de la primera jornada | Administradora | No | 2.2.3 |

#### 2.2.1 Alta y capacitación

**La puede hacer:** la administradora, en el sistema.

1. Invitar a la persona con su rol: M-ADM 13.2. Nadie se registra por su cuenta: solo la administración crea cuentas ([SEGURIDAD.md](./SEGURIDAD.md), "Alta de cuentas").
2. Confirmar con la persona que le llegó el correo y que eligió su contraseña. Hasta entonces la cuenta existe pero no puede entrar (M-ADM 13.2, paso 3).
3. Si hace falta, darle una función concreta: M-ADM 13.5.
4. Capacitarla: la sesión 1 y las de su rol, y la guía rápida el mismo día si es colaborador ([plan de capacitaciones](./manual/PLAN-DE-CAPACITACIONES.md), sección 9). Quien llega a una jornada sin capacitación trabaja acompañado y solo recibe y registra pacientes.
5. Anotar la capacitación en la sección 10 del plan de capacitaciones.

#### 2.2.2 Baja

**La puede hacer:** la administradora, en el sistema. **Requiere un técnico** solo el paso 4.

1. Desactivar la cuenta: M-ADM 13.4. La cuenta no se borra y su historial no se toca. Desde ese momento la base le niega todo, aunque todavía tenga la sesión abierta en un teléfono (migración `00079`).
2. Comprobar que aparece con el estado **Inactivo** (M-ADM 13.4, paso 3).
3. Si la persona tenía un teléfono de la organización con la aplicación, recuperarlo y cerrar la sesión en él (M-ADM 2.4).
4. Si la persona tenía acceso a alguna cuenta o secreto del anexo A -la cuenta de Google, GitHub, Supabase, Vercel, Expo, Sentry, el gestor de contraseñas o la llave privada-: quitarle el acceso en cada servicio y hacer la rotación de credenciales de 2.3.2 **en ese momento**, sin esperar a la fecha anual.

#### 2.2.3 Lista de usuarios activos

**La puede hacer:** la administradora, en el sistema.

1. Abrir **Colaboradores** (M-ADM 13.1) y filtrar por estado activo.
2. Por cada persona de la lista, confirmar que sigue en la organización y que su rol es el que le corresponde.
3. Dar de baja (2.2.2) a quien ya no esté, y corregir el rol (M-ADM 13.3) de quien haya cambiado de función.
4. Comprobar que hay al menos dos personas con rol de administración activas, para que el sistema no dependa de una sola. El sistema no deja desactivar al último administrador (migración `00072`).

### 2.3 Anual

| Tarea | Frecuencia | Responsable | ¿Requiere técnico? | Pasos |
| --- | --- | --- | --- | --- |
| Prueba de restauración del respaldo | Una vez al año, al cierre de la temporada de jornadas | Persona responsable de la base, con un técnico | **Sí** | 2.3.1 |
| Rotación de credenciales y comprobación de cuentas de demostración | Una vez al año, y cada vez que sale alguien con acceso | Técnico, con quien administra cada cuenta | **Sí** | 2.3.2 |

Cuándo cierra la temporada de jornadas: **PENDIENTE DE CONFIRMAR**.

#### 2.3.1 Prueba de restauración

**Requiere un técnico**, junto con la persona responsable de la base, que es quien tiene la llave privada.

Un respaldo que nunca se restauró no es un respaldo ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 6). El procedimiento completo, paso a paso, está en la sección 5 de ese documento (pasos 1 a 5 y 7; el paso 6, llevarlo a producción, **no** se hace en una prueba).

Al terminar:

1. Anotar fecha, resultado y quién la hizo en la tabla de la sección 6 de [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md) y en la tabla "Registro" de [CI-CD.md](./CI-CD.md).
2. Si algo no salió como dice el procedimiento, corregir el procedimiento en el mismo cambio.

La prueba también se hace después de cualquier cambio al script o al workflow del respaldo, o a la versión de la herramienta de Supabase que usa.

#### 2.3.2 Rotación de credenciales

**Requiere un técnico**, con la persona que administra cada cuenta.

Rotar es cambiar una contraseña, un token o una llave por uno nuevo y anular el viejo, para que quien lo haya conocido -una persona que ya no está, un equipo perdido- deje de poder usarlo. Se hace una vez al año y cada vez que sale alguien con acceso (2.2.2).

1. **Contraseñas de las cuentas** de la organización (Google, GitHub, Supabase, Vercel, Expo, Sentry y el gestor de contraseñas): cambiarlas y guardar las nuevas en el gestor. Quitar a las personas que ya no deban estar en cada organización.
2. **Secrets de GitHub Actions**: generar cada valor nuevo en su origen y reemplazarlo en el repositorio, **Settings** > **Secrets and variables** > **Actions**. La lista, con el origen de cada uno, está en el anexo A y en [CI-CD.md](./CI-CD.md), "Secrets". Atención con dos de ellos:
   - `SUPABASE_ACCESS_TOKEN` es un token **personal** de una cuenta de Supabase (anexo A). Al rotarlo, generarlo desde una cuenta de la organización, no desde la de una persona que se vaya a ir.
   - Si se cambia la llave de servicio de un proyecto de Supabase, hay que actualizarla en **los dos** lugares donde se copió a mano: el secret de GitHub (`SUPABASE_SERVICE_ROLE_KEY_DEV`) y la entrada de Vault `notificaciones_llave`. Si se cambia solo en uno, las alertas o los correos de notificación dejan de funcionar ([CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), "Antes de nada: que llave de servicio se usa").
3. **Secrets de las Edge Functions y de Vault** (anexo A): cambiar la contraseña del correo de envío (`SMTP_PASS`) en el proveedor y en Supabase.
4. **Credencial de Google Drive del respaldo**: repetir [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), 7.B desde el punto 6, reemplazar `RESPALDO_DRIVE_TOKEN` y quitar el acceso anterior desde la cuenta de Google. Comprobar en ese momento que la aplicación de Google Cloud sigue publicada ("En producción") y no en modo de prueba: en modo de prueba la credencial caduca a los 7 días (7.B, punto 4).
5. **Par de llaves del respaldo**: generar un par nuevo ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), 7.A), guardar la privada en sus dos copias y reemplazar `RESPALDO_GPG_CLAVE_PUBLICA` (7.C). **La llave privada vieja no se destruye todavía**: los respaldos de los 30 días anteriores solo se abren con ella. Se destruye a los 30 días, cuando el último respaldo cifrado con ella ya se borró solo.
6. Correr a mano **Respaldo de la base** (2.1.1, paso 7) y comprobar que termina en verde y que el archivo nuevo aparece en Drive.
7. **Cuentas de demostración en producción.** Las cuentas `*.demo@ecopac.test` y su contraseña están publicadas en el repositorio ([DATOS-DEMO.md](./DATOS-DEMO.md)), así que **no pueden existir en producción**. Solo las crean el stack local y el script de recarga de la base de desarrollo, que se niega a correr contra producción si se le indica cuál es ([DATOS-DEMO.md](./DATOS-DEMO.md), "Recargar `ecopac-dev` desde cero"). Para comprobarlo, en el SQL Editor del proyecto `Ecopac-Digital-Prod`:

   ```sql
   select email, created_at from auth.users where email ilike '%@ecopac.test';
   ```

   Tiene que devolver cero filas. Si devuelve alguna, desactivarlas de inmediato (M-ADM 13.4) y tratarlo como una falla crítica (sección 3).

8. Anotar la fecha de la rotación. Dónde se anota: **PENDIENTE DE CONFIRMAR**.

## 3. Mantenimiento correctivo

Lo que se hace cuando algo falla.

### 3.1 Cómo se reporta una falla

**Canal de reporte para el personal: PENDIENTE DE CONFIRMAR.** Mientras dure el soporte del equipo de desarrollo, el canal y su horario: **PENDIENTE DE CONFIRMAR**. Quien atiende el reporte lo registra como issue en GitHub con la plantilla **Bug** ([CONTRIBUTING.md](./CONTRIBUTING.md), "Issues"), que es donde se le da seguimiento.

Antes de reportar, buscar el mensaje en el capítulo "Estados y mensajes" del manual del rol (M-ADM 16, M-MED 9): muchas veces ahí está lo que hay que hacer.

Qué incluir en el reporte (M-ADM 17.2):

- **Rol** de quien tuvo el problema (administradora, médico, colaborador, junta directiva, socio fundador).
- **Pantalla** en la que estaba, y si era en la computadora o en el teléfono.
- **Fecha y hora** en que pasó.
- **El mensaje exacto** que apareció, copiado palabra por palabra.
- **Qué estaba haciendo** justo antes, paso por paso.
- Si le pasa a una sola persona o a varias, y si se repite.

Qué **nunca** incluir ([PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md); M-ADM 1.5 y 17.2):

- Nombres, DPI, teléfonos, fechas de nacimiento ni ningún otro dato que identifique a un paciente.
- Diagnósticos, síntomas, recetas ni ningún otro dato clínico.
- Capturas o fotos de pantalla en las que se vea un expediente o datos de un paciente. El problema se describe con palabras; si hace falta una captura, se toma con los datos de demostración.
- Contraseñas, de nadie. El equipo técnico nunca las pide.

### 3.2 Niveles de prioridad

> **Propuesta, a confirmar.** Los tiempos son una propuesta pensada para un equipo de voluntarios, no un compromiso. Los tiempos que de verdad aplican: **PENDIENTE DE CONFIRMAR**, junto con la duración del soporte (sección 1).

| Nivel | Qué es | Ejemplos de este sistema | Primera respuesta (propuesta, a confirmar) | Solución o salida provisional (propuesta, a confirmar) |
| --- | --- | --- | --- | --- |
| Crítica | Nadie puede trabajar, o hay datos de pacientes en riesgo | El sistema no carga para nadie; el proyecto de Supabase está pausado durante una jornada; se perdió o robaron un teléfono con la sesión abierta; aparecen cuentas de demostración en producción; un respaldo descifrado quedó en un lugar que no debía | El mismo día. Durante una jornada, lo antes posible | 1 día |
| Alta | Una función importante no sirve y no hay forma de evitarlo | El respaldo lleva más de un día fallando ("El respaldo de produccion fallo"); no llegan las alertas de vencimiento; una persona con rol de administración no puede entrar; no se puede registrar una consulta o una receta; una issue "tiene migraciones sin aplicar" | 1 día hábil | 3 días hábiles |
| Media | Algo falla pero se puede seguir trabajando de otra forma | No llegan los correos de notificación, pero el buzón del sistema sí los muestra; un reporte muestra números que no cuadran; una persona no recibe el correo de invitación | 3 días hábiles | 2 semanas |
| Baja | Molestias, mejoras o dudas | Un texto confuso; un botón que se ve mal en un teléfono; pedir un reporte nuevo (esto último es mantenimiento evolutivo, sección 4) | 1 semana | Se planifica con las demás mejoras |

Una falla sube de nivel si pasa durante una jornada.

## 4. Mantenimiento evolutivo

Cómo se pide un cambio o una función nueva, y el camino que recorre hasta que llega a la gente.

1. **Pedirlo.** Quien necesita el cambio se lo explica a la responsable del sistema: qué quiere hacer, en qué pantalla y para qué. Como con las fallas, sin datos de pacientes.
2. **Registrarlo.** Se abre una issue con la plantilla **Requerimiento Funcional** (o **Tarea Tecnica** si es algo interno), con su módulo, prioridad y plataforma ([CONTRIBUTING.md](./CONTRIBUTING.md), "Issues"). Entra al tablero en Backlog.
3. **Decidir.** Quién decide qué se hace y en qué orden: **PENDIENTE DE CONFIRMAR**.
4. **Construirlo** (técnico). Una rama desde `develop` por issue, los cambios y sus pruebas, y un Pull Request hacia `develop` con "Closes #X" ([CONTRIBUTING.md](./CONTRIBUTING.md), "Flujo de trabajo"). Las recetas de los cambios típicos, como agregar un campo o una pantalla, están en [MANUAL-TECNICO.md](./MANUAL-TECNICO.md), sección 13.
5. **Revisarlo.** El CI tiene que terminar en verde y otra persona aprueba el PR. Se mergea con "Squash and merge".
6. **Probarlo en desarrollo.** Al mergear a `develop`, los cambios de la base se aplican solos a `Ecopac-Digital-Dev`. Ahí se prueba, con los datos de demostración, antes de llevarlo a producción. Si el cambio toca una pantalla, la administradora lo prueba también.
7. **Llevarlo a producción.** Un PR de `develop` a `main`. Al mergearlo, los cambios de la base se aplican solos a producción ([CI-CD.md](./CI-CD.md), "Ambientes"). Cómo se publica la web y cómo llega la versión nueva de la aplicación a los teléfonos: **pendiente de la salida a producción (#252)**. Quién aprueba el paso a producción: **PENDIENTE DE CONFIRMAR**.
8. **Avisar y actualizar.** Si cambió una pantalla, se actualiza el manual y se avisa al personal ([plan de capacitaciones](./manual/PLAN-DE-CAPACITACIONES.md), sección 9: "Revisión de este plan y de los manuales").

Dos reglas que no se rompen nunca, aunque haya prisa ([CI-CD.md](./CI-CD.md)): un cambio de la base que ya se aplicó no se edita, se corrige con otro nuevo; y nadie aplica cambios de la base a mano contra producción: los aplica el workflow al mergear.

## 5. Qué hacer si...

### El sistema no carga

**Qué ve la persona:** la página no abre, se queda en blanco o cargando, o la aplicación del teléfono no deja entrar a nadie.

**Qué hace ella** (cualquier persona):

1. Comprobar que tiene internet: abrir cualquier otra página. Si el teléfono muestra "Sin conexión", es la señal, no el sistema (M-ADM 1.6). En jornada, no registrar datos hasta recuperarla (M-ADM 17.2).
2. Probar desde otro equipo o con otra red (los datos del teléfono en lugar del wifi, o al revés).
3. Preguntar a otra persona si a ella sí le funciona.
4. Si a nadie le funciona, avisar a la responsable del sistema.

**Qué hace la responsable del sistema:**

5. Revisar si el proyecto de Supabase está pausado (el caso siguiente).
6. Si no lo está, es una falla **crítica**: reportarla al técnico (sección 3), con la hora en que empezó.

La dirección web de producción: **pendiente de la salida a producción (#252)**.

### Una persona no puede entrar

**Qué ve la persona:** un mensaje en la pantalla de inicio de sesión.

**Qué hace ella:**

1. Leer el mensaje y buscarlo en M-ADM 16.2 (o en el capítulo de mensajes de su manual).
2. "El correo o la contraseña no son correctos": revisar los dos y, si no recuerda la contraseña, usar "¿Olvidaste tu contraseña?" (M-ADM 2.3). Buscar el correo también en la carpeta de spam.
3. "Tu sesión se cerró por inactividad": volver a entrar. Lo que ya había guardado no se pierde (M-ADM 16.2).

**Qué hace la administradora:**

4. Buscar a la persona en **Colaboradores** (M-ADM 13.1).
5. Si no aparece, invitarla (M-ADM 13.2). Si aparece **Inactivo**, reactivarla con el mismo botón con el que se desactiva (M-ADM 13.4).
6. Si se la invitó pero nunca eligió su contraseña, la cuenta existe pero no puede entrar (M-ADM 13.2, paso 3): pedirle que use "¿Olvidaste tu contraseña?" con ese mismo correo.

**Cuándo se llama a un técnico:** si la persona está activa, usa el correo correcto y no le llega ningún correo para elegir o recuperar la contraseña (puede ser el servidor de correo, [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), CFG-13), o si le pasa a varias personas a la vez. Si quien no puede entrar es la única persona con rol de administración, es **alta**.

### El proyecto de Supabase se pausó

**Qué ve la persona:** el sistema no carga o falla al iniciar sesión para todo el mundo (el caso "El sistema no carga"). La responsable del sistema puede ver además, en el panel de Supabase, el proyecto marcado como pausado ("Paused").

**Por qué pasa:** el plan gratuito pausa un proyecto tras una semana sin actividad ([COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md), 6.3). Lo evitan el uso normal, el workflow "Mantener Supabase activo" y el respaldo diario. Hoy "Mantener Supabase activo" solo protege la base de desarrollo, no la de producción ([MANUAL-TECNICO.md](./MANUAL-TECNICO.md), 12.4, punto 6): queda **pendiente de la salida a producción (#252)**.

**Qué hace la persona que administra Supabase:**

1. Entrar a <https://supabase.com/dashboard>.
2. Abrir el proyecto pausado y pulsar el botón para reanudarlo (**Restore project**).
3. Esperar a que termine (puede tardar unos minutos) y comprobar que el sistema vuelve a cargar.
4. Revisar los workflows (2.1.1): si el proyecto se pausó, lo más probable es que "Mantener Supabase activo" o el respaldo estén desactivados o fallando.

**Cuándo se llama a un técnico:** si el proyecto no se reanuda, o si después de reanudarlo el sistema sigue sin funcionar. Tras una pausa larga, comprobar también que el respaldo vuelve a correr en verde.

### Llegó un correo de alerta de GitHub o de Supabase

**Qué ve la persona:** un correo de GitHub con una issue nueva en el repositorio, o un correo de Supabase sobre el proyecto.

Lo primero, siempre: **no cerrar la issue** hasta que la falla esté resuelta. Si el workflow vuelve a fallar, comenta en la misma issue en lugar de abrir otra.

| Título de la issue | Qué significa | Nivel | Qué hacer |
| --- | --- | --- | --- |
| El respaldo de produccion fallo | No se está guardando ninguna copia nueva de la base | Alta | La responsable del sistema revisa que el workflow no esté desactivado (2.1.1) y que el Drive no esté lleno (2.1.2). Si no es nada de eso, llama al técnico, que sigue [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), "Si el respaldo falla". La issue se cierra a mano cuando una corrida vuelve a terminar en verde |
| [BUG] No se estan generando las alertas de vencimiento | No están llegando los avisos de medicamentos por vencer | Alta | Llamar al técnico. Mientras tanto, la administradora revisa a mano los vencimientos (M-ADM 8.8) |
| [BUG] Fallo el despliegue de base de datos en ... | Un cambio no llegó a la base | Alta | Llamar al técnico, que sigue [CI-CD.md](./CI-CD.md), "Que hacer cuando falla el despliegue" |
| [BUG] ... tiene migraciones sin aplicar | Una base no tiene todos sus cambios | Alta | Lo mismo que la anterior |

Si el correo es de **Supabase** y habla de la pausa del proyecto, seguir el caso anterior. Si habla de consumo o de límites, hacer la revisión de 2.1.3 en ese momento. Cualquier otro correo de Supabase: reenviarlo al técnico, **sin** abrir enlaces para iniciar sesión que no vengan del sitio `supabase.com`.

### Se perdió un teléfono con la aplicación

**Qué guarda la aplicación en el teléfono:** la sesión de la persona, la jornada en la que trabaja y los borradores de las consultas que estaba escribiendo, que pueden traer signos vitales y datos clínicos. Todo se guarda cifrado por el propio teléfono (`apps/mobile/src/almacenamiento.js`). Al cerrar sesión se borran la sesión y la jornada, pero no los borradores de consulta que hayan quedado sin guardar ni descartar.

El sistema **no tiene** forma de borrar a distancia lo que hay en un teléfono. Lo que sí se puede hacer a distancia es cortarle a esa cuenta todo acceso a la base.

**Qué hace la persona que perdió el teléfono:** avisar a la administradora **de inmediato**, aunque crea que lo va a encontrar.

**Qué hace la administradora:**

1. Desactivar la cuenta de esa persona (M-ADM 13.4). Desde ese momento la base le niega todo, aunque el teléfono tenga la sesión abierta (migración `00079`).
2. Avisar a la responsable del sistema: es una falla **crítica**, porque puede haber datos de pacientes expuestos.
3. Cuando la persona tenga otro teléfono, reactivar la cuenta (M-ADM 13.4) y pedirle que cambie su contraseña (M-ADM 3.4, o "¿Olvidaste tu contraseña?", M-ADM 2.3).

**Qué hace la responsable del sistema:** dejar constancia de qué teléfono era, de quién, cuándo se perdió y cuándo se desactivó la cuenta. Si el teléfono era de la organización y tiene algún servicio de localización o borrado del fabricante, usarlo. Si la pérdida hay que comunicarla a alguien más según [MARCO-LEGAL.md](./MARCO-LEGAL.md): **PENDIENTE DE CONFIRMAR**.

**Cuándo se llama a un técnico:** siempre, para que revise en la bitácora de auditoría (M-ADM 14.1) si hubo actividad de esa cuenta después de la pérdida.

### Los workflows aparecen desactivados

**Qué ve la persona:** en la pestaña **Actions** de GitHub, la página del workflow dice que está desactivado, o no hay corridas recientes y ninguna falló.

**Por qué pasa:** el repositorio pasó 60 días sin actividad (2.1.1).

**Qué hace ella** (cualquier persona con permiso de escritura en el repositorio):

1. En **Actions**, abrir cada uno: **Respaldo de la base**, **Alertas de vencimiento**, **Verificar despliegue** y **Mantener Supabase activo**.
2. En el aviso de arriba, pulsar **Enable workflow**.
3. En **Respaldo de la base**, pulsar **Run workflow** > **Run workflow** y esperar a que termine en verde.
4. Comprobar en Drive que apareció el respaldo nuevo (2.1.2).

**Cuándo se llama a un técnico:** si la corrida a mano termina en rojo. Si los workflows estuvieron apagados más de una semana, revisar también que el proyecto de Supabase no se haya pausado.

### Se perdió la llave privada

**Qué ve la persona:** la custodia de la llave no la encuentra, el equipo o la memoria USB donde estaba se perdió o se dañó, o no recuerda la frase de paso.

**Requiere un técnico**, junto con la persona responsable de la base.

1. **Si se perdió una sola de las dos copias:** abrir la otra, hacer de inmediato una copia nueva en el lugar de la perdida ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4) y comprobar que la frase de paso funciona.
2. **Si se perdieron las dos, o la frase de paso:** **ningún respaldo existente se puede abrir** y no hay forma de recuperarlos ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4). Hay que generar un par nuevo en ese momento (7.A), guardar la privada en sus dos copias, reemplazar `RESPALDO_GPG_CLAVE_PUBLICA` (7.C) y correr el respaldo a mano. A partir de ahí los respaldos nuevos sí se pueden abrir. Durante los próximos 30 días no hay forma de volver a un día anterior al cambio. Es una falla **crítica**.
3. **Si la llave no se perdió sino que pudo verla otra persona** (por ejemplo, un equipo robado): hacer lo mismo que en el punto 2. Quien tenga esa llave y además entre a la cuenta de Google puede leer los respaldos de los últimos 30 días. Si además se borran ya los respaldos viejos, o se espera a que salgan solos, es una decisión de la responsable del sistema con el técnico: **PENDIENTE DE CONFIRMAR** quién la toma.

## Anexo A. Cuentas y secrets

Solo los nombres. **Los valores nunca se escriben en este documento, ni en el repositorio, ni en una issue, ni en un chat.** Van en el gestor de contraseñas de la organización.

### Cuentas

| Cuenta | Para qué | Quién la administra |
| --- | --- | --- |
| Google, `ecopac.digital@gmail.com` | Drive con los respaldos y el proyecto de Google Cloud de la credencial del respaldo | **PENDIENTE DE CONFIRMAR** |
| Organización de GitHub dueña del repositorio | Código, workflows, secrets, issues | **PENDIENTE DE CONFIRMAR** |
| Organización de Supabase | Las bases `Ecopac-Digital-Dev` y `Ecopac-Digital-Prod`, la autenticación y las Edge Functions | **PENDIENTE DE CONFIRMAR** |
| Vercel (u otro servicio para la web) | Publicar la web | **Pendiente de la salida a producción (#252)** |
| Expo | Compilar y distribuir la aplicación del teléfono | **Pendiente de la salida a producción (#252)** |
| Sentry | Monitoreo de errores | **PENDIENTE DE CONFIRMAR** (no está contratado) |
| Proveedor de correo (SMTP) | Correos de invitación, recuperación de contraseña y notificaciones | **PENDIENTE DE CONFIRMAR**. En desarrollo se usa una cuenta personal de prueba ([CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), "Lo que cambia en produccion") |
| Gestor de contraseñas | Guardar todo lo de este anexo y una copia de la llave privada | **PENDIENTE DE CONFIRMAR** |

### Secrets de GitHub Actions

Se ven y se cambian en el repositorio, **Settings** > **Secrets and variables** > **Actions**. Una vez guardados no se pueden leer: si se pierde un valor, se genera uno nuevo en su origen. El origen de cada uno está en [CI-CD.md](./CI-CD.md), "Secrets", y en [QUICKSTART.md](./QUICKSTART.md).

| Secret | Lo usan los workflows | Nota |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase, Verificar despliegue, Respaldo de la base | Token **personal** de una cuenta de Supabase: si esa persona sale de la organización o lo revoca, dejan de funcionar los tres. Ya pasó el 8 de septiembre de 2026 ([CI-CD.md](./CI-CD.md), "La deriva de historial se avisa en el PR") |
| `SUPABASE_DB_PASSWORD` | Supabase, Verificar despliegue | Contraseña de la base de desarrollo |
| `SUPABASE_DB_PASSWORD_PROD` | Respaldo de la base | Contraseña de la base de producción. **Todavía no existe** (#252) |
| `SUPABASE_PROJECT_REF_DEV` | Supabase, Verificar despliegue | Identificador del proyecto de desarrollo |
| `SUPABASE_PROJECT_REF_PROD` | Supabase, Verificar despliegue, Respaldo de la base | Identificador del proyecto de producción. **Todavía no existe** (#252) |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Alertas de vencimiento, Mantener Supabase activo | Llave de servicio del proyecto de desarrollo. Salta todos los permisos: es la más delicada |
| `SUPABASE_URL_DEV` | Alertas de vencimiento | Dirección del proyecto de desarrollo |
| `VITE_SUPABASE_URL_DEV`, `VITE_SUPABASE_ANON_KEY_DEV` | CI (compilar la web), Mantener Supabase activo (la dirección) | Dirección y llave pública del proyecto de desarrollo |
| `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD` | CI (compilar la web en `main`) | Dirección y llave pública del proyecto de producción |
| `RESPALDO_GPG_CLAVE_PUBLICA` | Respaldo de la base | Llave **pública** con la que se cifra. La privada nunca va aquí. **Todavía no existe** (#252) |
| `RESPALDO_DRIVE_CLIENT_ID`, `RESPALDO_DRIVE_CLIENT_SECRET` | Respaldo de la base | Cliente de OAuth del proyecto de Google Cloud de la organización. **Todavía no existen** (#252) |
| `RESPALDO_DRIVE_TOKEN` | Respaldo de la base | Credencial de la cuenta de Drive. **Todavía no existe** (#252) |

En [CI-CD.md](./CI-CD.md) aparece también `SUPABASE_ANON_KEY_DEV`, que solo usa la versión de "Mantener Supabase activo" que está hoy en `main` ([CI-CD.md](./CI-CD.md), "Secrets"). Hay que mantenerlo hasta que `develop` llegue a `main`.

### Secrets fuera de GitHub

No están en GitHub y no viajan en el respaldo: si se pierde el proyecto, se vuelven a cargar a mano ([RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 1).

| Dónde | Nombres | Referencia |
| --- | --- | --- |
| Supabase, Edge Functions > Secrets, en cada proyecto | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `WEB_URL`, `ALLOWED_ORIGINS`, `SENTRY_DSN`, `AMBIENTE` | [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), CFG-14 a CFG-16; [CI-CD.md](./CI-CD.md), "Secrets" |
| Supabase Vault, en cada proyecto | `notificaciones_url`, `notificaciones_llave` | [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), CFG-18 y CFG-19 |
| Supabase Auth > SMTP Settings, en cada proyecto | Usuario y contraseña del correo de autenticación | [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md), CFG-13 |
| Vercel, Environment Variables | `VITE_SENTRY_DSN` | [CI-CD.md](./CI-CD.md), "Secrets" |
| Expo (EAS), variables del perfil de compilación | `EXPO_PUBLIC_SENTRY_DSN` | [CI-CD.md](./CI-CD.md), "Secrets" |
| Fuera de todo servicio: gestor de contraseñas y memoria USB | Llave privada GPG y su frase de paso (por separado) | [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 4 |

## Anexo B. Calendario anual

| Cuándo | Qué | Quién | ¿Técnico? | Dónde |
| --- | --- | --- | --- | --- |
| Todos los días, solo | Respaldo, alertas de vencimiento, verificar despliegue | GitHub Actions | - | Sección 2, "Lo que corre solo" |
| Cada 3 días, solo | Mantener Supabase activo | GitHub Actions | - | Sección 2, "Lo que corre solo" |
| Cada vez que llega una issue automática | Atenderla según su título | Responsable del sistema y técnico | Según el caso | Sección 5 |
| Primera semana de cada mes | Workflows en verde y activos | Responsable del sistema | No | 2.1.1 |
| Primera semana de cada mes | Respaldos en Drive | Quien administra Google | No | 2.1.2 |
| Primera semana de cada mes | Consumo y pausa de Supabase | Quien administra Supabase | No | 2.1.3 |
| Cada mes | PRs de Dependabot y auditoría | Técnico | Sí | 2.1.4 |
| Cada vez que entra alguien | Alta y capacitación | Administradora | No | 2.2.1 |
| Cada vez que sale alguien | Baja; rotación si tenía acceso a cuentas | Administradora; técnico | Solo la rotación | 2.2.2 y 2.3.2 |
| Antes de cada temporada de jornadas (**fecha PENDIENTE DE CONFIRMAR**) | Lista de usuarios activos; repaso de la sesión 8 del plan de capacitaciones | Administradora | No | 2.2.3; plan de capacitaciones, sección 9 |
| Al cierre de la temporada de jornadas (**fecha PENDIENTE DE CONFIRMAR**) | Prueba de restauración | Persona responsable de la base y técnico | Sí | 2.3.1 |
| Una vez al año (**fecha PENDIENTE DE CONFIRMAR**) | Rotación de credenciales y comprobación de cuentas de demostración | Técnico con quien administra cada cuenta | Sí | 2.3.2 |
| Una vez al año, con la rotación | Revisar este documento: personas, canales, plazos | Responsable del sistema | No | Todo el documento |

## Documentos relacionados

- [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md) - el respaldo, la restauración y la llave privada.
- [CI-CD.md](./CI-CD.md) - qué hace cada workflow, sus secrets y qué hacer cuando falla el despliegue.
- [COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md) - los límites de cada servicio y lo que cuesta el siguiente plan.
- [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md) - lo que se configura a mano en cada proyecto de Supabase.
- [SEGURIDAD.md](./SEGURIDAD.md) y [PROTECCION-DE-DATOS.md](./PROTECCION-DE-DATOS.md) - el alta de cuentas, la sesión y el tratamiento de los datos de pacientes.
- [CONTRIBUTING.md](./CONTRIBUTING.md) y [MANUAL-TECNICO.md](./MANUAL-TECNICO.md) - cómo se hace un cambio.
- [manual/PLAN-DE-CAPACITACIONES.md](./manual/PLAN-DE-CAPACITACIONES.md) y [manual/README.md](./manual/README.md) - los manuales y la capacitación.
