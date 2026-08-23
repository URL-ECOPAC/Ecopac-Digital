import { Nav } from 'react-bootstrap';

/**
 * Pestañas de navegacion DENTRO de una pantalla: no cambian de ruta.
 *
 * Quien lo usa controla cual esta activa; este componente no guarda estado, igual que
 * FilterBar. `children` es el contenido de la pestaña activa, que decide quien llama.
 */
export default function Tabs({ tabs = [], activo, onChange, children }) {
  return (
    <div>
      <Nav variant="tabs" activeKey={activo} onSelect={(clave) => onChange?.(clave)}>
        {tabs.map((tab) => (
          <Nav.Item key={tab.id}>
            <Nav.Link eventKey={tab.id}>{tab.label}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <div className="pt-3">{children}</div>
    </div>
  );
}
