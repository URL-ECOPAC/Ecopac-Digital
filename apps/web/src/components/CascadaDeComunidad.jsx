import Selector from "./Selector";
import SelectorConAlta from "./SelectorConAlta";

/**
 * Departamento -> municipio -> comunidad, con la opcion de crear una comunidad que falta.
 *
 * Ocupa el lugar del campo "comunidad" en el formulario de un paciente, tanto en el alta como en
 * la edicion (issue #840). Vivia dentro de ModalAltaPaciente, y la edicion tenia en su lugar un
 * selector plano con todas las comunidades del pais: al editar no se veian ni el departamento ni
 * el municipio. Espejo de apps/mobile/src/components/CascadaDeComunidad.js, con las mismas props.
 *
 * La logica -que listas cargar, que se invalida al cambiar de departamento- es
 * useCascadaTerritorial() en packages/shared. Aqui solo se dibuja.
 *
 * Departamento y municipio van en una fila; comunidad y "Crear una comunidad" en la siguiente,
 * lado a lado, para que la accion quede junto al campo al que se refiere.
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
    <div className="ec-form-grid--ancho ec-form-subgrid">
      <Selector
        label="Departamento"
        value={departamentoId}
        options={catalogos.departamentos}
        onSelect={onDepartamento}
        placeholder="Selecciona un departamento"
        disabled={disabled || catalogos.departamentos.length === 0}
      />
      <Selector
        label="Municipio"
        value={municipioId}
        options={catalogos.municipios}
        onSelect={onMunicipio}
        placeholder="Selecciona un municipio"
        disabled={disabled || !departamentoId || catalogos.municipios.length === 0}
      />
      <SelectorConAlta
        label={label}
        value={comunidadId || null}
        options={catalogos.comunidades}
        onSelect={onComunidad}
        placeholder="Selecciona una comunidad"
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
    </div>
  );
}
