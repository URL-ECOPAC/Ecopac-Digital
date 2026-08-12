# Estrategia de Dependencias - Ecopac Digital

## Vulnerabilidades (17)

Estan en **dependencias transitivas profundas** de Expo/Metro:

- `image-size` (en Metro)
- `uuid` (en xcode)
- `fast-xml-parser` (en React Native CLI)

**No se pueden resolver sin romper Expo 57.** El equipo de Expo trabaja en actualizarlas.

**Riesgo:** Muy bajo en desarrollo. En produccion, estas afectan el *build process*, no el
codigo ejecutable.

## Reglas de Versioning

### Mobile (`apps/mobile/package.json`)

- Usa `~X.Y.Z` para Expo (patch updates solamente).
- Usa versiones fijas para React Native (sin `^`).
- Coordina con versiones de Expo.

### Web (`apps/web/package.json`)

- Independiente de Mobile.
- React 19.x es estable y segura.

### Shared Packages (`packages/shared`, `packages/ui-tokens`)

- No deben tener dependencias de Expo/React Native.
- Solo librerias agnosticas: Supabase, tipos TypeScript.

## Como Mantener Esto Actualizado

### Cada mes:

```bash
npm audit
```

### Si hay vulnerabilidades moderadas:

```bash
npm audit fix
```

### Si hay vulnerabilidades altas:

1. Revisa que paquete las causa.
2. Busca en GitHub si Expo/RN ya tiene fix.
3. Si no, crea un issue documentando por que no se puede actualizar.

## Checking en CI/CD

Los workflows deberian fallar si:

- Una vulnerabilidad ALTA afecta codigo (no build tools).
- `npm audit` sale con code != 0 sin justificacion documentada.

---

**Ultima actualizacion:** 2026-08-08
**Responsable:** Copilot
**Proxima revision:** 2026-09-08
