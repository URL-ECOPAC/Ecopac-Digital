import { Component } from "react";
import { reportarError } from "@ecopac/shared";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Limite de error de React (issue #762, "manejo global de errores").
 *
 * Sin el, cualquier excepcion en un render -el ReferenceError de "Nuevo paciente" que arreglo la
 * #827 es el ejemplo- desmontaba la aplicacion entera y dejaba la pagina EN BLANCO: ni menu, ni
 * mensaje, ni forma de volver, y nada registrado en ningun sitio. Ahora el fallo se reporta (ya
 * limpio de datos de paciente, ver packages/shared/observabilidad) y la persona ve que paso y
 * tiene dos salidas.
 *
 * Tiene que ser una clase: React solo ofrece getDerivedStateFromError/componentDidCatch ahi.
 *
 * `claveDeReinicio` (la ruta, desde MainLayout) vacia el error al navegar: un fallo en una pantalla
 * no deja rota la siguiente.
 */
export default class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportarError(error, {
      origen: "render",
      ruta: this.props.ruta,
      modulo: this.props.modulo,
      pilaDeComponentes: info?.componentStack,
    });
  }

  componentDidUpdate(propsAnteriores) {
    if (this.state.error && propsAnteriores.claveDeReinicio !== this.props.claveDeReinicio) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="ec-panel-vacio" role="alert">
        <h1 className="ec-cabecera-titulo">Algo salió mal en esta pantalla</h1>
        <p className="ec-cabecera-subtitulo" style={{ maxWidth: "36rem" }}>
          El error quedó registrado. Lo que ya estaba guardado no se perdió; lo que se estaba
          escribiendo en esta pantalla, sí. Puedes reintentar o volver al inicio.
        </p>
        <div className="ec-acciones justify-content-center">
          <SecondaryButton
            title="Volver al inicio"
            variant="neutra"
            onClick={() => {
              this.setState({ error: null });
              this.props.onVolverAlInicio?.();
            }}
          />
          <PrimaryButton title="Reintentar" onClick={() => this.setState({ error: null })} />
        </div>
      </div>
    );
  }
}
