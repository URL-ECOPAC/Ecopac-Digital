import { useCallback, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import {
  MODULOS,
  seccionesVisibles,
  etiquetaDeRol,
  formatearFechaCorta,
  useExpiracionPorInactividad,
  MINUTOS_INACTIVIDAD_POR_DEFECTO,
} from '@ecopac/shared';
import { useSesionCompartida } from '../contexto/SesionProvider';
import './MainLayout.css';


const EVENTOS_DE_ACTIVIDAD = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];


const SUBTITULOS = {
  inicio: 'Panel general del sistema',
  pacientes: 'Expedientes clinicos',
  donaciones: 'Ingresos registrados',
  inventario: 'Existencias y alertas de caducidad',
  presupuestos: 'Administracion financiera por jornada y proyecto',
  proyectos: 'Proyectos sociales y su avance',
  reportes: 'Indicadores de impacto',
  jornadas: 'Tablero de jornadas medicas',
  voluntarios: 'Medicos y voluntarios',
};

function moduloDeRuta(pathname) {
  return [...MODULOS]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((m) => (m.ruta === '/' ? pathname === '/' : pathname.startsWith(m.ruta)));
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const { perfil, logout } = useSesionCompartida();

  const secciones = seccionesVisibles(perfil.rol);
  const actual = moduloDeRuta(location.pathname);

  const iniciales = `${perfil.nombres[0] ?? ''}${perfil.apellidos[0] ?? ''}`.toUpperCase();

  const fecha = formatearFechaCorta(new Date());


  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const { registrarActividad } = useExpiracionPorInactividad({
    minutos: MINUTOS_INACTIVIDAD_POR_DEFECTO,
    alVencer: handleLogout,
  });

  useEffect(() => {
    EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, registrarActividad));
    return () => {
      EVENTOS_DE_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, registrarActividad),
      );
    };
  }, [registrarActividad]);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand__mark" aria-hidden="true" />
          <span>
            <span className="app-brand__name">Ecopac</span>
            <span className="app-brand__tagline">Jornadas medicas</span>
          </span>
        </div>

        <nav className="app-nav" aria-label="Navegacion principal">
          {secciones.map((seccion) => (
            <div key={seccion.id} className="app-nav__group">
              <p className="app-nav__title">{seccion.titulo}</p>
              {seccion.modulos.map((modulo) => (
                <NavLink
                  key={modulo.id}
                  to={modulo.ruta}
                  end={modulo.ruta === '/'}
                  className={({ isActive }) =>
                    `app-nav__item${isActive ? ' app-nav__item--active' : ''}`
                  }
                >
                  {modulo.etiqueta}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Punto de entrada a /perfil (issue #102): unica excepcion de alcance de este layout,
            que sigue siendo el de la issue #51 en todo lo demas. No es un boton nuevo ni un
            item de MODULOS, solo el mismo bloque de siempre vuelto navegable. */}
        <NavLink to="/perfil" className="app-user app-user--link">
          <span className="app-user__avatar" aria-hidden="true">
            {iniciales}
          </span>
          <span className="app-user__data">
            <span className="app-user__name">
              {perfil.nombres} {perfil.apellidos}
            </span>
            <span className="app-user__role">
              {etiquetaDeRol(perfil.rol)}
              {perfil.area ? ` · ${perfil.area}` : ''}
            </span>
          </span>
        </NavLink>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <h1 className="app-header__title">{actual?.etiqueta ?? 'Ecopac Digital'}</h1>
            <p className="app-header__subtitle">
              {actual ? SUBTITULOS[actual.id] : 'Ecopac Guatemala'} · {fecha}
            </p>
          </div>
          <div className="app-header__actions">
            <span className="app-status" title="Estado del sistema">
              <span className="app-status__dot" aria-hidden="true" />
              Sistema activo
            </span>
            <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
              Cerrar sesion
            </Button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
