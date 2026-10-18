# Guía de Despliegue de Base de Datos y Catálogos — Ecopac Digital

Este documento detalla la estrategia de despliegue para levantar la base de datos del entorno de producción (`ecopac-prod`) desde cero.

## 1. Estrategia de Despliegue en Producción
El despliegue en producción se ejecuta **estrictamente mediante las migraciones versionadas** utilizando el comando `supabase db push`.

### ¿Por qué NINGÚN `seed` se ejecuta en Producción?
* **Aislamiento de Entornos:** Los archivos como `datos-de-prueba.sql` (pacientes y datos ficticios) están diseñados exclusivamente para pruebas de desarrollo local.
* **Catálogos Nativos:** Los datos iniciales obligatorios del "Día 1" (departamentos, municipios, permisos, idiomas, bodegas) ya vienen incorporados de forma segura dentro de las migraciones del esquema.
* **Idempotencia:** Evita la duplicidad de registros maestros que ya manejan las restricciones del sistema.

## 2. Catálogos Operativos del Día 1
* **Geografía Nacional (`00125`):** 22 departamentos y 340 municipios de Guatemala.
* **Permisos y Roles (`00003`):** Matriz de permisos finos por rol.
* **Bodegas y Almacenes (`00010`):** Bodegas principales e insumos.
* **Catálogos Clínicos y Proveedores (`00017`, `00050`, `00105`, `00110`):** Medicamentos, diagnósticos CIE-10 e idiomas.
* **Administrador Inicial (`00063` y `00188`):** Creación del perfil administrador con la cuenta `ecopac@gmail.com`.

## 3. Administrador Inicial de Producción
* **Correo electrónico:** `ecopac@gmail.com`
* **Contraseña:** Se deja en valor nulo (`NULL`) por seguridad en el repositorio. La contraseña definitiva se establece en el primer inicio de sesión mediante la opción **"Olvidé mi contraseña"** desde la interfaz web.