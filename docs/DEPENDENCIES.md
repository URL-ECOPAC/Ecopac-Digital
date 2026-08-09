# Estrategia de Dependencias - Ecopac Digital

## Vulnerabilidades (17)
Están en **dependencias transitivas profundas** de Expo/Metro:
- `image-size` (en Metro)
- `uuid` (en xcode)
- `fast-xml-parser` (en React Native CLI)

**No se pueden resolver sin romper Expo 57.** El equipo de Expo trabaja en actualizarlas.

**Riesgo:** Muy bajo en desarrollo. En producción, estas afectan el *build process*, no el código ejecutable.

## Reglas de Versioning

### Mobile (`apps/mobile/package.json`)
- ✅ Usa `~X.Y.Z` para Expo (patch updates solamente)
- ✅ Usa versiones fijas para React Native (sin `^`)
- ✅ Coordina con versiones de Expo

### Web (`apps/web/package.json`)
- ✅ Independiente de Mobile
- ✅ React 19.x es estable y seguro

### Shared Packages (`packages/shared`, `packages/ui-tokens`)
- ✅ No deben tener dependencias de Expo/React Native
- ✅ Solo librerías agnósticas: Supabase, tipos TypeScript

## Cómo Mantener Esto Actualizado

### Cada mes:
```bash
npm audit
```

### Si hay vulnerabilidades moderadas:
```bash
npm audit fix
```

### Si hay vulnerabilidades altas:
1. Revisa qué paquete las causa
2. Busca en GitHub si Expo/RN ya tiene fix
3. Si no, crea un issue documentando por qué no se puede actualizar


## Checking en CI/CD

Los workflows deberían fallar si:
- Una vulnerabilidad ALTA afecta código (no build tools)
- `npm audit` sale con code != 0 sin justificación documentada

---

**Última actualización:** 2026-08-08
**Responsable:** Copilot
**Próxima revisión:** 2026-09-08
