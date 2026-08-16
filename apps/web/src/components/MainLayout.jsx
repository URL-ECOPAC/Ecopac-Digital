import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Badge } from 'react-bootstrap';


const MOCK_USER = {
  nombre: 'Dr. Jesús Quemé',
  rol: 'Administrador', // Cambiar a 'Medico' para probar el filtrado de navegación
};

// Configuración de módulos de navegación y permisos por rol
const NAV_ITEMS = [
  { path: '/', label: 'Inicio', roles: ['Administrador', 'Medico', 'Voluntario'] },
  { path: '/pacientes', label: 'Pacientes', roles: ['Administrador', 'Medico', 'Voluntario'] },
  { path: '/jornadas', label: 'Jornadas', roles: ['Administrador', 'Medico', 'Voluntario'] },
  { path: '/inventario', label: 'Inventario', roles: ['Administrador', 'Medico'] },
  { path: '/donaciones', label: 'Donaciones', roles: ['Administrador'] },
  { path: '/usuarios', label: 'Usuarios', roles: ['Administrador'] },
  { path: '/reportes', label: 'Reportes', roles: ['Administrador'] },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    // Redirigir a la pantalla de login al cerrar sesión
    navigate('/login');
  };

  // Filtrar módulos visibles según el rol del usuario
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(MOCK_USER.rol)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Barra Superior (Navbar) */}
      <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="px-3">
        <Navbar.Brand as={Link} to="/" className="fw-bold">
          EcoPac Digital
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-navbar-nav" />
        <Navbar.Collapse id="main-navbar-nav" className="justify-content-end">
          <div className="d-flex align-items-center gap-3">
            <div className="text-light text-end">
              <span className="d-block fw-semibold">{MOCK_USER.nombre}</span>
              <Badge bg="primary">{MOCK_USER.rol}</Badge>
            </div>
            <Button variant="outline-light" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </Navbar.Collapse>
      </Navbar>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Navegación Lateral (Sidebar) */}
        <aside
          className="bg-light border-end p-3"
          style={{ width: '240px', minWidth: '240px' }}
        >
          <Nav className="flex-column gap-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Nav.Link
                  key={item.path}
                  as={Link}
                  to={item.path}
                  className={`rounded px-3 py-2 ${
                    isActive ? 'bg-primary text-white fw-bold' : 'text-dark'
                  }`}
                >
                  {item.label}
                </Nav.Link>
              );
            })}
          </Nav>
        </aside>

        {/* Área de Contenido Principal */}
        <main style={{ flex: 1 }} className="p-4 bg-body-tertiary">
          <Container fluid>
            <Outlet />
          </Container>
        </main>
      </div>
    </div>
  );
}