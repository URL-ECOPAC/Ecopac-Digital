# Costos y limites de las capas gratuitas

Que limite tiene cada servicio que usa Ecopac Digital, cuanto se espera consumir, cual se agota
primero y que cuesta el siguiente escalon. Responde a la issue #234.

**Limites consultados el 11 de septiembre de 2026** en la documentacion oficial de cada servicio.
Los precios cambian; antes de decidir con este documento en la mano, vale la pena volver a mirar
las paginas enlazadas al final.

---

## Resumen: la conclusion, primero

**Ningun limite se agota por volumen de datos.** Con el tamano de operacion de Ecopac -jornadas
periodicas en comunidades rurales- los numeros de la capa gratuita sobran por un margen amplio, y
la seccion 5 lo desglosa.

Lo que aprieta son **tres restricciones estructurales**, que no dependen de crecer:

| # | Restriccion                                                              | Servicio | Efecto                                              |
| - | ------------------------------------------------------------------------ | -------- | ---------------------------------------------------- |
| 1 | Vercel Hobby **puede quitar un despliegue sin aviso**, y no conecta con repositorios de una organizacion | Vercel | Lo segundo tiene salida tecnica; lo primero no |
| 2 | El plan Free de Supabase **no incluye respaldos**                         | Supabase | Un borrado accidental no se puede deshacer          |
| 3 | Free permite **2 proyectos activos por organizacion**                     | Supabase | `dev` + `prod` ocupan los dos; no cabe un tercero   |

Estan desarrolladas en la seccion 6. La 1 tiene dos capas que conviene no confundir: **que no se
pueda conectar el repositorio se resuelve desplegando por CLI desde GitHub Actions, gratis**; lo
que no se resuelve sin pagar es que los terminos del plan Hobby permiten a Vercel retirar el
despliegue a su discrecion y sin aviso, que es lo que desaconseja dejar produccion ahi.

---

## 1. Supabase

Es el servicio critico: base de datos, autenticacion y Edge Functions.

| Recurso                        | Free                        | Pro (desde 25 USD/mes)              |
| ------------------------------ | --------------------------- | ------------------------------------ |
| Tamano de base de datos        | 500 MB                      | 8 GB, luego 0.125 USD/GB            |
| Almacenamiento de archivos     | 1 GB                        | 100 GB, luego 0.0213 USD/GB         |
| Egress (salida de datos)       | 5 GB/mes                    | 250 GB/mes, luego 0.09 USD/GB       |
| Usuarios activos al mes (MAU)  | 50,000                      | 100,000                              |
| Invocaciones de Edge Functions | 500,000/mes                 | 2,000,000/mes                        |
| Proyectos activos por organizacion | **2**                   | Sin ese limite                       |
| Respaldos                      | **Ninguno**                 | 7 dias de retencion                  |
| Pausa por inactividad          | **A la semana sin actividad** | No se pausa                        |

Dos notas que importan mas que los numeros:

- **El proyecto no usa Supabase Storage.** No hay ni una llamada a `.storage` en todo el
  repositorio, asi que el limite de 1 GB de archivos hoy no aplica. Cambiaria el dia que se
  suban fotografias de recetas o documentos escaneados, que es una idea que suele aparecer.
- **Hay dos Edge Functions** (`invitar-usuario` y `alertas-vencimiento`). Las 500,000
  invocaciones mensuales del plan Free no son un limite realista para dos funciones que se
  llaman al dar de alta a alguien y una vez al dia.

## 2. Vercel

Sirve la aplicacion web. El plan gratuito se llama **Hobby**.

| Recurso                      | Hobby                       |
| ---------------------------- | --------------------------- |
| Builds                       | 100 por hora                |
| Despliegues                  | 100 por dia                 |
| Proyectos                    | 200                         |
| Retencion de logs            | 1 hora (1 dia en Pro)       |
| Subida por CLI               | 100 MB de fuentes           |
| Conexion a repos de organizacion | **No soportada**        |

Los limites de volumen sobran: 100 despliegues al dia es mucho mas de lo que produce este equipo.
La duracion maxima de una funcion no entra en la tabla porque **la web no usa ninguna**: es una
SPA estatica, `vercel.json` solo declara el build y el rewrite a `index.html`, y no hay carpeta
`api/`. El navegador habla directamente con Supabase.

**El problema es la ultima fila**, y esta desarrollado en la seccion 6.1.

## 3. GitHub Actions

**No es un limite para este proyecto.** El repositorio es **publico**, y en repositorios publicos
los runners estandar de GitHub son gratuitos y sin limite de minutos.

Conviene saber lo que lo cambiaria: si alguna vez se hiciera privado, los workflows pasarian a
consumir la cuota mensual de minutos de la cuenta. El workflow de Supabase levanta un stack local
en Docker y tarda entre 3 y 4 minutos por corrida, y corre en cada PR y en cada push, asi que la
factura no seria simbolica. **Hacer privado este repositorio es una decision con costo**, no solo
de visibilidad.

## 4. EAS (Expo Application Services)

Compila la aplicacion movil.

| Recurso               | Free                                     |
| --------------------- | ----------------------------------------- |
| Builds                | 30 al mes, de los cuales hasta 15 de iOS  |
| Prioridad de cola     | Baja                                      |
| EAS Update            | 1,000 usuarios activos, 100 GiB de ancho de banda |
| Builds que fallan rapido | Los que fallan antes de 3 minutos no cuentan, hasta 10 al mes |

30 builds al mes alcanzan con holgura para un ritmo de entrega normal. El riesgo no es el numero
sino **la cola de baja prioridad**: en epoca de entrega, una compilacion puede tardar horas en
empezar. Es un riesgo de calendario, no de dinero, y se mitiga compilando con tiempo.

---

## 5. Estimacion de consumo

Los limites de arriba son datos verificados. **Lo que sigue son estimaciones**, y los supuestos
que las sostienen estan en la seccion 9 porque Ecopac todavia no los ha confirmado.

Supuesto de trabajo: **12 jornadas al ano, 150 pacientes atendidos por jornada**, o sea unas 1,800
atenciones anuales.

### Base de datos (limite: 500 MB)

Contando el peso de una fila con su sobrecarga de Postgres y sus indices:

| Que crece                                           | Por unidad | 5 anos    |
| --------------------------------------------------- | ---------- | --------- |
| Pacientes y expedientes (~7,000 personas)           | ~1.2 KB    | ~8 MB     |
| Atenciones, triajes, consultas, diagnosticos, recetas (~9,000) | ~2 KB | ~18 MB |
| Movimientos de inventario (~45,000)                 | ~0.3 KB    | ~14 MB    |
| Lotes, medicamentos, catalogos                      | -          | ~5 MB     |

**Total a cinco anos: del orden de 45 MB, menos del 10% de los 500 MB.**

La excepcion es `eventos_auditoria`, que crece con cada accion registrada y no tiene politica de
retencion escrita. Es la unica tabla del esquema sin techo conocido. Definir cuanto se conserva es
justamente uno de los puntos de la issue #762, y hasta que se defina esta estimacion tiene un cabo
suelto.

### Egress (limite: 5 GB/mes)

El paquete de la aplicacion web lo sirve Vercel, no Supabase, asi que el egress de Supabase son
solo las respuestas JSON de la API. Un dia de jornada con 150 pacientes, con todas las consultas y
recargas que eso implica, mueve del orden de decenas de megabytes. **Doce jornadas al ano no se
acercan a 5 GB mensuales.**

### Usuarios activos (limite: 50,000 MAU)

Los usuarios del sistema son el personal de Ecopac: administracion, medicos y voluntarios. Son
decenas, no miles. **Sobra por tres ordenes de magnitud.**

---

## 6. Que se agota primero

No es un limite de volumen. Son estas tres, en orden de urgencia.

### 6.1 Vercel Hobby no conecta con repositorios de una organizacion

La documentacion de Vercel es explicita: un proyecto en un equipo Hobby no puede conectarse a un
repositorio **propiedad de** una organizacion de Git. `URL-ECOPAC/Ecopac-Digital` lo es.

**La restriccion es sobre quien es dueno del repositorio, no sobre quien hace el enlace.** Da igual
desde que cuenta se intente conectar, y da igual que quien lo intente sea miembro de la
organizacion: mientras el repositorio pertenezca a `URL-ECOPAC`, la integracion nativa de Git no
esta disponible en Hobby. Vercel aclara ademas que aplica igual al importar un repositorio
existente y al clonar una plantilla dentro de la organizacion.

**Pero eso no obliga a mover el repositorio ni a pagar.** Hay cuatro salidas, en orden de menos a
mas coste:

1. **Desplegar por CLI desde GitHub Actions, sin conectar el repositorio a Vercel.** El proyecto de
   Vercel se queda sin integracion Git y el workflow le empuja el build con `vercel pull`,
   `vercel build` y `vercel deploy --prebuilt`, autenticando con tres secrets (`VERCEL_TOKEN`,
   `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Como no hay conexion con Git, la restriccion no aplica y
   el repositorio se queda donde esta. `--prebuilt` es lo que evita que se compile dos veces.
   **El coste es que se pierden los preview deployments automaticos por PR**, que son
   precisamente lo que da la integracion nativa; recrearlos es escribir mas workflow.
2. **Vercel Pro**, 20 USD por usuario al mes. Habilita la integracion nativa con sus previews, sube
   la retencion de logs de 1 hora a 1 dia, y de paso resuelve la cuestion de la licencia que viene
   abajo.
3. **Solicitar el Vercel Open Source Program**, que da creditos a proyectos totalmente de codigo
   abierto. Este repositorio es publico, asi que la solicitud es viable; no hay garantia de que la
   acepten ni plazo comprometido.
4. **Desplegar la web en otro sitio.** Cloudflare Pages y Netlify no ponen esa restriccion en sus
   planes gratuitos. Cuesta rehacer el despliegue y reescribir `docs/CI-CD.md`.

Forkear el repositorio a una cuenta personal y conectar el fork tambien funciona, pero obliga a
mantener el fork sincronizado y los previews seguirian al fork y no al repositorio real. La opcion
1 hace lo mismo sin ese doble mantenimiento.

#### La licencia del plan Hobby, que pesa mas que la parte tecnica

El plan Hobby esta restringido a **uso personal no comercial**. La definicion de Vercel es amplia:
cualquier despliegue usado para el beneficio economico de cualquiera que participe en cualquier
parte de la produccion del proyecto, **incluido un empleado o consultor al que se le pague por
escribir el codigo**.

Dos lecturas de eso, para este proyecto en concreto:

- **A favor.** Vercel aclara de forma expresa que **pedir donaciones NO es uso comercial**. Una ONG
  que se financia con donaciones no queda fuera por ese motivo, que es la duda obvia.
- **En contra.** "Recibir un pago por crear, actualizar u hospedar el sitio" SI es uso comercial.
  Mientras el sistema lo construya gente sin cobrar por ello, encaja en Hobby; **el dia que Ecopac
  le pague a alguien por mantenerlo, deja de encajar** y hace falta Pro.

Y dos clausulas de los terminos de servicio que conviene conocer antes de montar produccion sobre
el plan gratuito:

> We reserve the right to disable or remove any Project or website deployment on the Hobby plan
> **with or without notice at our sole discretion.**

> If you are on a Hobby plan or trial Pro plan, you agree that we may use Your Content to **train
> our artificial intelligence and machine learning models.**

La segunda **no es un problema de confidencialidad clinica aqui**, y conviene decirlo con
precision para no alarmar de mas: "Your Content" en Vercel es lo que se despliega -el codigo y los
assets-, que en este repositorio ya es publico. **Los datos de pacientes nunca pasan por Vercel**:
la web es una SPA estatica y el navegador consulta a Supabase directamente, sin intermediario.

La primera si es un riesgo operativo real. Un sistema del que depende una jornada medica puede
quedarse caido sin aviso previo y sin derecho a reclamacion. **Esa es la razon de fondo para no
dejar produccion en Hobby**, mas que la restriccion de los repositorios de organizacion, que tiene
solucion tecnica.

Esto condiciona la issue #252 (salida a produccion) y conviene decidirlo antes de empezarla, no
durante.

### 6.2 El plan Free no tiene respaldos

El plan Free de Supabase no incluye respaldos de ningun tipo. Un `DELETE` mal filtrado, o un
proyecto borrado por accidente, **no se puede deshacer**.

Choca de frente con la issue #762, que pide "respaldos confirmados, restauracion probada y
procedimiento documentado". Ese punto **no se puede cerrar en el plan Free**: no hay nada que
probar.

Salidas:

1. **Supabase Pro**, 25 USD al mes, con 7 dias de retencion.
2. **Volcado periodico propio** con `pg_dump` desde un workflow programado, guardando el archivo
   fuera de Supabase. Sale gratis en un repositorio publico, y hay que escribirlo, probar la
   restauracion y decidir donde se guarda un volcado que contiene datos de pacientes -lo cual lo
   convierte en una decision de proteccion de datos, no solo tecnica (ver
   `docs/PROTECCION-DE-DATOS.md`)-.

### 6.3 Dos proyectos activos por organizacion

`ecopac-dev` y `ecopac-prod` ocupan exactamente los dos que permite el plan Free. **No hay sitio
para un tercero** -un staging de verdad, o un proyecto de respaldo para ensayar una restauracion-
sin pasar a Pro o sin crear otra organizacion.

Y el limite muerde por partida doble: un proyecto Free **se pausa tras una semana sin actividad**.
Para eso existe `keep-alive-supabase.yml`, que segun la issue #762 llevaba desde el 13 de agosto
reportando verde mientras cada ping fallaba. Un proyecto pausado no responde hasta que alguien lo
reactiva a mano desde el panel, y si eso pasa en mitad de una jornada, el sistema no esta.

---

## 7. Que cuesta el siguiente escalon

| Servicio | Plan   | Costo                 | Que desbloquea                                       |
| -------- | ------ | --------------------- | ----------------------------------------------------- |
| Supabase | Pro    | 25 USD/mes            | Respaldos de 7 dias, sin pausa, sin limite de 2 proyectos |
| Vercel   | Pro    | 20 USD/usuario/mes    | Repositorios de organizacion, funciones de 60 s, logs de 1 dia |
| EAS      | Starter| 19 USD/mes            | 45 USD de credito de build y cola con prioridad       |
| GitHub   | -      | 0 mientras sea publico | -                                                     |

**Minimo para cubrir lo imprescindible (respaldos y despliegue web): 45 USD al mes**, que son
Supabase Pro mas Vercel Pro. EAS Starter no hace falta salvo que la cola de baja prioridad se
vuelva un problema de calendario.

Si eso no cabe en el presupuesto, **la prioridad es Supabase Pro (25 USD/mes)**: los respaldos son
lo unico de esta lista sin sustituto gratuito razonable.

Para la web hay dos formas de gastar cero, y se eligen segun cuanto pese el riesgo de que Vercel
retire el despliegue sin aviso:

- **Quedarse en Vercel Hobby y desplegar por CLI desde GitHub Actions** (seccion 6.1, opcion 1).
  Es lo que menos trabajo cuesta y no mueve el repositorio, pero deja produccion sujeta a los
  terminos del plan Hobby.
- **Mover la web a Cloudflare Pages o Netlify**, cuyos planes gratuitos no traen ni la restriccion
  de repositorios de organizacion ni esa clausula. Cuesta rehacer el despliegue una vez.

La segunda es la que conviene si la web va a sostener jornadas reales; la primera, si todavia se
esta validando el sistema.

---

## 8. Programas para organizaciones sin fines de lucro

| Servicio | Programa                  | Que da                                      | Estado                        |
| -------- | ------------------------- | ------------------------------------------- | ----------------------------- |
| GitHub   | GitHub for Nonprofits     | Plan Team gratis, o 25% de descuento en Enterprise | **Vale la pena solicitarlo** |
| Vercel   | Open Source Program       | Creditos de plataforma                      | Solicitable: el repo es publico |
| Supabase | Sin programa publicado    | Evalua creditos caso por caso               | Hay que escribirles          |
| Expo     | Sin programa para ONG publicado | -                                     | -                             |

**GitHub for Nonprofits** es el de criterios mas claros: pide ser una organizacion 501(c)(3) o
equivalente, no gubernamental, no academica, no comercial, no politica y sin afiliacion religiosa.
La revision tarda alrededor de 7 dias. Ecopac tendria que comprobar que su figura legal
guatemalteca califica como equivalente, que es justamente la clase de pregunta que no se resuelve
desde el repositorio.

Para **Supabase**, que es donde mas aprieta el limite, no hay programa publicado pero si declaran
que evaluan solicitudes de creditos caso por caso. Dado que los 25 USD mensuales son el gasto que
mas importa, escribirles explicando el proyecto es la gestion con mejor relacion entre esfuerzo y
retorno de esta lista.

---

## 9. Lo que falta confirmar con Ecopac

La seccion 5 se sostiene sobre supuestos que **nadie de la organizacion ha confirmado todavia**.
Se dejan escritos para que se confirmen o se corrijan, no para que se den por buenos:

1. **Cuantas jornadas al ano** se hacen de verdad (supuesto: 12).
2. **Cuantos pacientes por jornada** se atienden (supuesto: 150).
3. **Cuantas personas usan el sistema** entre administracion, medicos y voluntarios.
4. **Si se piensan subir archivos** -fotos de recetas, documentos escaneados-, que es lo unico que
   pondria el limite de 1 GB de Storage en juego.
5. **Cuanto tiempo debe conservarse `eventos_auditoria`**, que es la unica tabla sin techo
   conocido (lo pide tambien la issue #762).
6. **Que figura legal tiene Ecopac** y si califica para GitHub for Nonprofits.

Si los dos primeros numeros resultaran ser un orden de magnitud mayores -120 jornadas al ano en vez
de 12-, la estimacion de base de datos subiria a unos 450 MB a cinco anos y **el limite de 500 MB
si entraria en juego**. Es el unico supuesto cuya correccion cambiaria la conclusion de este
documento.

---

## Fuentes

- [Supabase Pricing](https://supabase.com/pricing)
- [Vercel Limits](https://vercel.com/docs/limits) (restriccion de repos de organizacion)
- [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (uso comercial y la excepcion de las donaciones)
- [Vercel Terms of Service](https://vercel.com/legal/terms) (clausulas del plan Hobby)
- [Vercel: usar GitHub Actions para desplegar](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)
- [GitHub Actions: billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Expo: subscriptions, plans and add-ons](https://docs.expo.dev/billing/plans/)
- [GitHub for Nonprofits](https://docs.github.com/en/nonprofit/nonprofit-teams-plan)
- [Vercel Open Source Program](https://vercel.com/open-source-program)
- [Supabase: credits](https://supabase.com/docs/guides/platform/credits)
