// Catalogo de componentes de la web (issue #280).
//
// Los mismos nombres y las mismas props que apps/mobile/src/components/, para que portar una
// pantalla de una plataforma a la otra sea mecanico. El contrato completo esta en
// docs/ARQUITECTURA-FRONTEND.md, seccion "El catalogo de componentes".
//
// Las dos unicas diferencias de API admitidas son de plataforma: la web usa onChange donde el
// movil usa onChangeText, y onClick donde el movil usa onPress.

export { default as ScreenContainer } from "./ScreenContainer";
export { default as PageHeader } from "./PageHeader";
export { default as SectionHeader } from "./SectionHeader";

export { default as TextField } from "./TextField";
export { default as PasswordField } from "./PasswordField";
export { default as Selector } from "./Selector";
export { default as SelectorConAlta } from "./SelectorConAlta";
export { default as MultiSelector } from "./MultiSelector";
export { default as CampoDeFormulario } from "./CampoDeFormulario";
export { default as SeccionDeFormulario } from "./SeccionDeFormulario";
export { default as DateField } from "./DateField";
export { default as NumberField } from "./NumberField";

export { default as PrimaryButton } from "./PrimaryButton";
export { default as SecondaryButton } from "./SecondaryButton";

// Las dos salidas de un listado (issue #862). BotonExportarPDF vivia fuera del barril y por ruta
// directa, que es parte de por que su defecto no lo vio nadie.
export { default as BotonExportarCSV } from "./BotonExportarCSV";
export { default as BotonImprimir } from "./BotonImprimir";
export { default as descargarCSV } from "./descargarCSV";

export { default as FilterBar } from "./FilterBar";
export { default as DataList } from "./DataList";
export { default as StatusChip } from "./StatusChip";
export { default as Card } from "./Card";
export { default as StatCard } from "./StatCard";

export { default as KanbanBoard } from "./KanbanBoard";
export { default as Tabs } from "./Tabs";
export { default as Modal } from "./Modal";
export { default as Paginacion } from "./Paginacion";
export { default as GraficaDeBarras } from "./GraficaDeBarras";

export { default as EmptyState } from "./EmptyState";
export { default as LoadingState } from "./LoadingState";
export { default as ErrorState } from "./ErrorState";
