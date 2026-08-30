// Pruebas de RutaProtegida (issue #515): primera prueba real de un componente de apps/web.
//
// Se mockea useSesionCompartida en vez de envolver en <SesionProvider> real: lo que este
// archivo prueba es la logica de las 5 ramas del guard (comprobando/sin sesion/sin
// perfil/rol insuficiente/pasa), no el hook de sesion en si -eso ya lo prueba
// packages/shared/hooks/useSesion.test.js por su cuenta.
//
// MemoryRouter + Routes anidadas: es el mismo patron que usa el router real de la app
// (RutaProtegida como elemento padre, la ruta protegida como hijo via <Outlet/>), asi que la
// prueba ejercita Navigate/Outlet de verdad en vez de solo el render aislado del componente.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RutaProtegida from './RutaProtegida';
import { useSesionCompartida } from '../contexto/SesionProvider';

vi.mock('../contexto/SesionProvider', () => ({
  useSesionCompartida: vi.fn(),
}));

function renderConRuta({ roles = null } = {}) {
  return render(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route element={<RutaProtegida roles={roles} />}>
          <Route path="/protegida" element={<div>Contenido protegido</div>} />
        </Route>
        <Route path="/login" element={<div>Pantalla de login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RutaProtegida', () => {
  it('muestra el estado de carga mientras se restaura la sesion', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'cargando',
      haySesion: false,
      perfil: null,
      rol: null,
    });

    renderConRuta();

    expect(screen.getByText(/comprobando tu sesion/i)).toBeInTheDocument();
  });

  it('redirige a /login cuando no hay sesion', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'listo',
      haySesion: false,
      perfil: null,
      rol: null,
    });

    renderConRuta();

    expect(screen.getByText(/pantalla de login/i)).toBeInTheDocument();
  });

  it('muestra acceso denegado sin rol si hay sesion pero el perfil todavia no cargo', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'listo',
      haySesion: true,
      perfil: null,
      rol: null,
    });

    renderConRuta({ roles: ['administrador'] });

    expect(screen.getByText(/no se pudo confirmar tu rol/i)).toBeInTheDocument();
  });

  it('muestra acceso denegado cuando el rol no esta en la lista permitida', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'listo',
      haySesion: true,
      perfil: { id: '1' },
      rol: 'voluntario general',
    });

    renderConRuta({ roles: ['administrador'] });

    expect(screen.getByText(/tu usuario tiene el rol de/i)).toBeInTheDocument();
  });

  it('deja pasar cuando el rol esta en la lista permitida', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'listo',
      haySesion: true,
      perfil: { id: '1' },
      rol: 'administrador',
    });

    renderConRuta({ roles: ['administrador'] });

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('sin lista de roles (roles=null), cualquier sesion valida pasa', () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: 'listo',
      haySesion: true,
      perfil: { id: '1' },
      rol: 'voluntario general',
    });

    renderConRuta({ roles: null });

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });
});
