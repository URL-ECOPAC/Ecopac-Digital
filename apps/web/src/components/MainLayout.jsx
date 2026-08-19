import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import {
  MODULOS,
  seccionesVisibles,
  etiquetaDeRol,
  formatearFechaCorta,
} from '@ecopac/shared';
import { useUsuarioActual } from '../hooks/useUsuarioActual';
import './MainLayout.css';

// Subtitulo de cada modulo en el encabezado de pagina, segun el prototipo.
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
  // La ruta mas especifica gana, para que /pacientes/123 siga marcando Pacientes.
  return [...MODULOS]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((m) => (m.ruta === '/' ? pathname === '/' : pathname.startsWith(m.ruta)));
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useUsuarioActual();

  const secciones = seccionesVisibles(usuario.rol);
  const actual = moduloDeRuta(location.pathname);

  const iniciales = `${usuario.nombres[0] ?? ''}${usuario.apellidos[0] ?? ''}`.toUpperCase();
  // El formato sale de shared para que la web y el movil muestren la fecha igual.
  const fecha = formatearFechaCorta(new Date());

  const handleLogout = () => navigate('/login');

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

        <div className="app-user">
          <span className="app-user__avatar" aria-hidden="true">
            {iniciales}
          </span>
          <span className="app-user__data">
            <span className="app-user__name">
              {usuario.nombres} {usuario.apellidos}
            </span>
            <span className="app-user__role">
              {etiquetaDeRol(usuario.rol)}
              {usuario.area ? ` · ${usuario.area}` : ''}
            </span>
          </span>
        </div>
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
