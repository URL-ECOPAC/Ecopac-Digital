import { View } from "react-native";

import Selector from "./Selector";
import SelectorConAlta from "./SelectorConAlta";

/**
 * Departamento -> municipio -> comunidad, con la opcion de crear una comunidad que falta.
 *
 * Ocupa el lugar del campo "comunidad" en el formulario de un paciente, tanto en el registro como
 * en la edicion (issue #840): la edicion tenia un selector plano con todas las comunidades del
 * pais. Espejo de apps/web/src/components/CascadaDeComunidad.jsx, con las mismas props.
 *
 * La logica es useCascadaTerritorial() en packages/shared. Aqui solo se dibuja.
 */
export default function CascadaDeComunidad({
  label,
  comunidadId,
  error,
  catalogos,
  departamentoId,
  municipioId,
  onDepartamento,
  onMunicipio,
  onComunidad,
  disabled = false,
  puedeCrear = false,
  onCrear,
  erroresAlta,
  creando = false,
}) {
  return (
    <View>
      <Selector
        label="Departamento"
        value={departamentoId}
        options={catalogos.departamentos}
        onSelect={onDepartamento}
        placeholder="Departamento"
        disabled={disabled || catalogos.departamentos.length === 0}
      />
      <Selector
        label="Municipio"
        value={municipioId}
        options={catalogos.municipios}
        onSelect={onMunicipio}
        placeholder="Municipio"
        disabled={disabled || !departamentoId || catalogos.municipios.length === 0}
      />
      {/* La comunidad de quien se atiende en jornada muchas veces todavia no esta en el
          catalogo: se crea aqui mismo, igual que en la web (issue #838). */}
      <SelectorConAlta
        label={label}
        value={comunidadId || null}
        options={catalogos.comunidades}
        onSelect={onComunidad}
        placeholder="Comunidad"
        error={error}
        disabled={disabled || !municipioId}
        puedeCrear={puedeCrear}
        habilitadoParaCrear={Boolean(municipioId)}
        etiquetaAlta="Crear una comunidad"
        labelNuevo="Nombre de la comunidad nueva"
        onCrear={onCrear}
        erroresAlta={erroresAlta}
        creando={creando}
      />
    </View>
  );
}
