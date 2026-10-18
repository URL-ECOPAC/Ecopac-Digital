# Acta de implementación - Ecopac Digital

Constancia de que el sistema Ecopac Digital quedó instalado y funcionando en producción, en las cuentas de Ecopac Guatemala, de cómo se comprobó y de lo que la organización recibe y asume desde la firma.

Se firma en dos copias, una para la organización y otra para el equipo de desarrollo. Lo que esta acta afirma está respaldado por el registro de ejecución del plan de implementación y por la evidencia de las pruebas posteriores, que se citan en cada sección.

| | |
| --- | --- |
| Versión | 1.0 |
| Fecha | 18 de octubre de 2026 |
| Organización | Ecopac Guatemala |
| Sistema | Ecopac Digital: web, aplicación Android y base de datos |
| Puesta en producción | 14 de octubre de 2026 |
| Pruebas posteriores | 17 de octubre de 2026 |

---

## 1. Objeto

Dejar constancia de la **implementación de Ecopac Digital en el ambiente de producción** de Ecopac Guatemala: qué se instaló, dónde, con qué configuración, cómo se comprobó que funciona y qué queda pendiente. Con la firma, la organización recibe el sistema y asume las responsabilidades de la sección 8.

## 2. Lo que se instaló

Todo está a nombre de la organización, en cuentas creadas con su correo `ecopac.digital@gmail.com`. Ninguna pieza depende de una cuenta personal del equipo de desarrollo.

| Pieza | Dónde | Dirección o identificador |
| --- | --- | --- |
| Aplicación web (computadora) | Vercel, cuenta `ecopacdigital` | https://ecopac-digital.vercel.app |
| Base de datos, autenticación y funciones | Supabase, proyecto `ecopacdigital Prod` (región `us-east-2`) | `vuujluoxlkiakfstiiur` |
| Ambiente de desarrollo y pruebas | Supabase, proyecto `ecopacdigital Dev` (región `us-west-2`), y la vista previa de Vercel | `swwtjekapvnkjzshzdjk` |
| Aplicación Android | APK compilado en Expo (EAS), cuenta `ecopacdigitals-team`, perfil `produccion` | Identificador `org.ecopacguatemala.digital` |
| Código fuente y documentación | GitHub, cuenta `ecopacdigital` | https://github.com/ecopacdigital/Ecopac-Digital |
| Correo del sistema | Gmail de la organización por SMTP | `ecopac.digital@gmail.com` |
| Tareas programadas | GitHub Actions del mismo repositorio | Alertas de vencimiento, mantener activa la base y verificar el despliegue, diarias |

Detalle de cada paso, con la fecha y cómo se comprobó: [plan de implementación](./PLAN-DE-IMPLEMENTACION.md), secciones 9 y 10.

## 3. Configuración del ambiente de producción

| Tema | Cómo quedó |
| --- | --- |
| Dominio y hosting | `ecopac-digital.vercel.app`, con certificado HTTPS automático de Vercel. `http://` redirige a `https://` |
| Seguridad de la web | Seis cabeceras de seguridad (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy) |
| Registro de cuentas | Cerrado: nadie puede crearse una cuenta. Las personas entran solo por invitación de la administradora |
| Contraseñas y sesión | Mínimo 8 caracteres con letras y dígitos; sesión de una hora con renovación automática |
| Correo | Invitaciones, recuperación de contraseña y notificaciones salen del Gmail de la organización, con la plantilla de Ecopac |
| Control de acceso | Cada rol ve y hace solo lo suyo, según la matriz de [PERMISOS.md](./PERMISOS.md). Lo hacen cumplir las políticas de la propia base, no la pantalla |
| Despliegue de cambios | Un cambio aprobado en la rama `main` se aplica solo a la base y a la web. Las ramas `main` y `develop` están protegidas: todo cambio pasa por revisión y por las pruebas automáticas |

Toda la configuración, para reconstruirla desde cero: [manual de instalación y configuración](./MANUAL-DE-INSTALACION.md).

## 4. Estado de la base de datos al implementar

Comprobado sobre `ecopac-prod` el 18 de octubre de 2026:

- **181 migraciones aplicadas**, de la `00001` a la `00189`.
- **Catálogos cargados**: 22 departamentos y 340 municipios de Guatemala, 37 diagnósticos, 5 condiciones crónicas, 4 idiomas, 7 presentaciones, 6 categorías de gasto, 3 áreas de atención, la Bodega Principal y la matriz de permisos por rol. Detalle en [DESPLIEGUE_BASE_DE_DATOS.md](./DESPLIEGUE_BASE_DE_DATOS.md).
- **Un solo usuario**: `ecopac.digital@gmail.com`, con el rol de administrador.
- **Ningún dato de pacientes, jornadas ni inventario.** La base arranca limpia: no se migraron datos de las pruebas del equipo.

## 5. Pruebas posteriores a la implementación

El 17 de octubre de 2026 se corrieron en producción 25 pruebas, con una sesión real por cada rol y datos ficticios marcados como prueba. **Las 25 dieron el resultado esperado**:

- Alta e invitación de personas de los cinco roles, con el correo de bienvenida.
- El flujo completo de una jornada: paciente, triaje, consulta, receta, aprobación y entrega del medicamento.
- Un ingreso de inventario y su aprobación.
- Que cada rol ve solo lo suyo, y que la base rechaza lo que un rol no puede hacer.
- Correo de recuperación de contraseña y notificaciones a la administradora.
- Cabeceras de seguridad, recarga de pantallas internas, redirección a HTTPS y que la web apunta solo a la base de producción.
- Las tres tareas programadas en verde.

Además, el APK de producción se instaló en un teléfono Android real y funcionó contra la base de producción.

Al terminar se retiraron **todos** los datos de prueba, y se comprobó que la base quedó exactamente como antes de empezar. Evidencia completa: [evidencias/2026-10-17.md](./evidencias/2026-10-17.md).

## 6. Documentación que se entrega

Todo vive en la carpeta `docs/` del repositorio de la organización. Los documentos formales están en `docs/formal/`.

| Documento | Archivo |
| --- | --- |
| Plan de implementación | `formal/plan-de-implementacion.pdf` y `PLAN-DE-IMPLEMENTACION.md` |
| Esta acta | `formal/acta-de-implementacion.pdf` y `ACTA-DE-IMPLEMENTACION.md` |
| Pruebas posteriores | `evidencias/2026-10-17.md` |
| Manuales de usuario por rol | `formal/manual-del-administrador.pdf`, `formal/manual-del-medico.pdf`, `formal/manual-del-voluntario.pdf` y `formal/manual-de-junta-directiva-y-socio-fundador.pdf` |
| Manual de administración | `formal/manual-del-administrador.pdf` |
| Material de capacitación | `formal/plan-de-capacitaciones.pdf`, `formal/guia-rapida-voluntario.pdf`, `formal/guia-rapida-junta-directiva-y-socio-fundador.pdf` y los videos V-01 a V-07 (`manual/README.md`) |
| Lista de asistencia de las capacitaciones | `formal/lista-de-asistencia-capacitaciones.pdf` |
| Scripts de base de datos | `supabase/migrations/`, `supabase/esquema-final.sql` y `DESPLIEGUE_BASE_DE_DATOS.md` |
| Diccionario de datos | `DICCIONARIO-DE-DATOS.md` |
| Manual técnico | `formal/documentacion-tecnica.pdf` y `MANUAL-TECNICO.md` |
| Manual de instalación y configuración | `formal/manual-de-instalacion-y-configuracion.pdf` y `MANUAL-DE-INSTALACION.md` |
| Documentación de API e integraciones | `API-E-INTEGRACIONES.md` |
| Plan de mantenimiento y soporte | `formal/plan-de-mantenimiento-y-soporte.pdf` y `MANTENIMIENTO-Y-SOPORTE.md` |
| Plan de respaldo y recuperación | `formal/plan-de-respaldo-y-recuperacion.pdf` y `RESPALDO-Y-RECUPERACION.md` |
| Marco legal | `MARCO-LEGAL.md` |

Las credenciales de las cuentas **no** están en ningún documento: se entregan en persona o por el gestor de contraseñas de la organización.

## 7. Pendientes al momento de la firma

Lo que falta no impide usar el sistema, pero sí cargar datos reales de pacientes antes de completar las tres primeras filas. Se marca al firmar lo que ya esté hecho.

| Hecho | Pendiente | Quién |
| --- | --- | --- |
| ☐ | Activar el respaldo diario cifrado a Google Drive, con sus credenciales | Equipo de desarrollo con la persona responsable de la base |
| ☐ | Primer respaldo en verde y una restauración de prueba desde Drive | Equipo de desarrollo con la persona responsable de la base |
| ☐ | La organización inicia sesión con su cuenta de administradora y cambia la contraseña temporal | Organización |
| ☐ | Designar a las personas responsables del plan de mantenimiento y soporte (sección 1 de ese plan) | Organización |
| ☐ | Guardar una copia de la llave de firma del APK con las credenciales de la organización | Equipo de desarrollo |
| ☐ | Revocar los tokens que el equipo usó para instalar, y cambiar las contraseñas de las bases y las llaves de servicio | Equipo de desarrollo y organización |
| ☐ | Revisión del marco legal por asesoría jurídica | Organización |

## 8. Responsabilidades desde la firma

Desde la fecha de firma, Ecopac Guatemala:

- Es la responsable exclusiva de la **custodia, el tratamiento y el respaldo** de los datos registrados en el sistema.
- Administra las **cuentas, credenciales y accesos** de todos los servicios de la sección 2.
- Reconoce que el sistema es una herramienta de registro: **no diagnostica ni sustituye la valoración médica**, y la responsabilidad clínica es de quien atiende.

El equipo de desarrollo:

- Presta el soporte que define el [plan de mantenimiento y soporte](./MANTENIMIENTO-Y-SOPORTE.md), por el plazo que ahí se acuerde.
- Al terminar ese plazo, **se retira de todas las cuentas** de la organización y **no conserva copias** de datos de producción ni credenciales.

Fundamento: [MARCO-LEGAL.md](./MARCO-LEGAL.md), sección 4.2.

<div style="page-break-before: always"></div>

## 9. Conformidad

Las partes declaran que el sistema descrito quedó instalado y funcionando en producción, que se realizaron las pruebas de la sección 5 y que se recibió la documentación de la sección 6.

Lugar: ______________________________ Fecha: ____ de ______________ de 2026

**Por Ecopac Guatemala**

<table>
<thead><tr><th style="width:40%">Nombre</th><th style="width:30%">Cargo</th><th style="width:30%">Firma</th></tr></thead>
<tbody>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
</tbody>
</table>

**Por el equipo de desarrollo**

<table>
<thead><tr><th style="width:40%">Nombre</th><th style="width:30%">Rol en el proyecto</th><th style="width:30%">Firma</th></tr></thead>
<tbody>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
<tr style="height:16mm"><td></td><td></td><td></td></tr>
</tbody>
</table>
