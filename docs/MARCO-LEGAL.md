# Marco Legal — Sistema Ecopac Digital

**Versión:** 1.0
**Fecha:** 8 de octubre de 2026
**Elaborado por:** Equipo de Desarrollo

> **Nota importante:** Este documento no constituye asesoría legal. Debe ser revisado y validado por la asesoría jurídica de la universidad o de la organización antes de su aprobación.

---

## 1. Objetivo

Identificar el marco jurídico guatemalteco aplicable al sistema que gestiona expedientes clínicos, establecer obligaciones, riesgos y medidas para delimitar la responsabilidad del equipo de desarrollo frente a la organización que opera el sistema.

---

## 2. Marco Jurídico Aplicable

### 2.1 Protección de Datos Personales y Datos Sensibles
- **Ley de Acceso a la Información Pública — Decreto 57-2008**, Arts. 36–40
  - Define datos sensibles: salud, intimidad, creencias, datos de menores → los del sistema **califican como sensibles**
  - Establece el derecho de habeas data: acceso, rectificación y cancelación
  - Exige **consentimiento expreso** del titular para el tratamiento
  - Riesgo: el sistema **no registra** constancia de consentimiento

### 2.2 Confidencialidad del Expediente Clínico
- **Código de Salud — Decreto 90-97**, Libro I, Título IV
  - El expediente clínico es **confidencial** por definición
  - Solo el personal autorizado puede acceder
- **Secreto profesional** — Arts. 43 y 197
  - El personal de salud está obligado a reserva; la divulgación sin autorización es sancionable
- **Normas del Ministerio de Salud**
  - La custodia corresponde a la **institución prestadora**, no a quien desarrolla el sistema

### 2.3 Datos de Menores de Edad
- **Código Civil — Decreto 106**, Arts. 303–306
  - El menor no puede otorgar consentimiento por sí mismo → lo otorga **padre, madre o tutor**
- **Código de la Niñez y la Adolescencia — Decreto 27-2003**, Art. 34
  - Derecho a la intimidad y protección de datos; el interés superior prevalece
  - Riesgo: el sistema **no distingue** registro de menores ni quién autoriza

### 2.4 Validez de Registros Electrónicos
- **Ley de Firmas Electrónicas — Decreto 47-2008**, Arts. 5–7
  - Los registros electrónicos tienen **el mismo valor** que los físicos si se garantiza integridad
  - La bitácora de auditoría implementada **cumple** con este requisito

### 2.5 Delitos Informáticos y Custodia
- **Código Penal**, Arts. 214–217 bis
  - Acceso indebido, alteración o revelación de datos son delitos
  - La responsabilidad recae sobre **quien ejecuta la acción**, no sobre quien creó el sistema
- La custodia y protección activa corresponden a **quien administra** la base de datos: la organización

### 2.6 Propiedad Intelectual y Licencia
- **Ley de Derecho de Autor — Decreto 33-98**, Arts. 5 y 11
  - El código es obra protegida; sin licencia escrita **no se define uso ni titularidad**
- Reglamento de propiedad intelectual de la universidad → a consultar
- Riesgo: repositorio público **sin archivo LICENSE**

### 2.7 Transferencia Internacional de Datos
- Alojamiento en Supabase y Vercel → **datos salen de Guatemala**
- Guatemala no tiene ley específica de protección de datos que regule transferencias
- Medidas: cifrado en tránsito y en reposo; informar al paciente en el aviso de privacidad

---

## 3. Riesgos Identificados

| # | Riesgo | Nivel |
|---|---|---|
| R-01 | Sin consentimiento registrado | Alto |
| R-02 | Repositorio sin licencia | Medio |
| R-03 | Menores sin autorización de representante | Alto |
| R-04 | Datos fuera del país sin aviso explícito | Medio |
| R-05 | Sin acta de entrega, responsabilidad no se transmite formalmente | Alto |
| R-06 | Equipo podría conservar acceso tras entrega | Medio |
| R-07 | Sin aviso de privacidad ni términos de uso | Medio |

---

## 4. Medidas para Delimitar la Responsabilidad

### 4.1 Licencia del Repositorio
> Propuesta: **Licencia MIT** o la que indique la universidad
> Archivo: `LICENSE` en raíz del repositorio
> Incluye cláusula de **sin garantía** y limitación de responsabilidad

### 4.2 Acta de Entrega y Transferencia
La organización asume desde la fecha de firma:
- Responsabilidad exclusiva sobre **custodia, tratamiento y respaldo** de los datos
- Administración de **cuentas, credenciales y accesos**
- El equipo **se retira de todas las cuentas** y no conserva copias
- El sistema es herramienta de registro; **no sustituye valoración médica**
- La responsabilidad clínica corresponde al personal que atiende

### 4.3 Aviso de Privacidad y Consentimiento
- Destinado a pacientes, en lenguaje sencillo y en los idiomas de las comunidades
- Incluye: quién es el responsable, para qué se usan los datos, dónde se alojan, derechos del paciente
- Crear **issue de producto**: agregar campo de consentimiento en el formulario de registro

### 4.4 Términos de Uso para Personal y Voluntarios
- Cuenta **individual e intransferible**
- Prohibición de **capturas, fotos o divulgación** de datos
- Confidencialidad vigente **incluso al retirarse**
- Ante fallos: consultar al responsable, no intentar reparar ni difundir

### 4.5 Declaración de Propósito
> El sistema registra lo que decide el personal de salud; **no diagnostica ni trata**. La responsabilidad clínica y legal recae en quien atiende y en la organización. El equipo de desarrollo no tiene injerencia sobre las decisiones médicas.

---

## 5. Plan de Acción

| Paso | Acción | Estado |
|---|---|---|
| 1 | Revisión por asesoría jurídica |  Pendiente |
| 2 | Agregar archivo `LICENSE` al repositorio |  Pendiente |
| 3 | Diseñar campo de consentimiento en registro |  Issue pendiente |
| 4 | Redactar aviso de privacidad en idiomas locales |  Pendiente |
| 5 | Firmar Acta de Entrega antes de pasar a producción |  Pendiente |
| 6 | Capacitación del personal en confidencialidad |  Pendiente |
| 7 | Retirar al equipo de cuentas y rotar credenciales |  Tras entrega |
| 8 | Enlazar desde `docs/README.md` |  Pendiente |

---

## 6. Fuentes

1. Ley de Acceso a la Información Pública — Decreto 57-2008
2. Código de Salud — Decreto 90-97
3. Código de la Niñez y la Adolescencia — Decreto 27-2003
4. Ley de Firmas Electrónicas — Decreto 47-2008
5. Ley de Derecho de Autor — Decreto 33-98
6. Código Civil — Decreto 106
7. Código Penal de Guatemala