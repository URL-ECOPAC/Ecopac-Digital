import { describe, it, expect } from 'vitest';
import { puede, PERMISOS_POR_ROL } from '../utils/permisos';

describe('Utilidad de permisos por rol - puede() (#99)', () => {
  it('Administrador tiene acceso a configuración administrativa y gestión general', () => {
    expect(puede('configuracion:admin', 'Administrador')).toBe(true);
    expect(puede('usuarios:write', 'Administrador')).toBe(true);
    expect(puede('donaciones:read', 'Administrador')).toBe(true);
  });

  it('Médico NO obtiene permisos de configuración administrativa ni usuarios', () => {
    expect(puede('configuracion:admin', 'Medico')).toBe(false);
    expect(puede('usuarios:read', 'Medico')).toBe(false);
    expect(puede('donaciones:write', 'Medico')).toBe(false);
  });

  it('Médico sí tiene permisos de su ámbito clínico', () => {
    expect(puede('pacientes:read', 'Medico')).toBe(true);
    expect(puede('pacientes:write', 'Medico')).toBe(true);
    expect(puede('inventario:read', 'Medico')).toBe(true);
  });

  it('Junta Directiva puede leer donaciones e inventario pero no usuarios ni admin', () => {
    expect(puede('donaciones:read', 'Junta Directiva')).toBe(true);
    expect(puede('configuracion:admin', 'Junta Directiva')).toBe(false);
    expect(puede('usuarios:write', 'Junta Directiva')).toBe(false);
  });

  it('Voluntario solo tiene accesos mínimos de lectura', () => {
    expect(puede('pacientes:read', 'Voluntario')).toBe(true);
    expect(puede('pacientes:write', 'Voluntario')).toBe(false);
    expect(puede('donaciones:read', 'Voluntario')).toBe(false);
  });

  it('Combina permisos individuales concedidos sobre el rol base', () => {
    // Un voluntario con un permiso individual adicional
    expect(puede('donaciones:read', 'Voluntario', ['donaciones:read'])).toBe(true);
  });

  it('Ante duda, datos nulos o vacíos, deniega por defecto (Default DENY)', () => {
    expect(puede('pacientes:read', null)).toBe(false);
    expect(puede('pacientes:read', undefined)).toBe(false);
    expect(puede('', 'Administrador')).toBe(false);
  });
});