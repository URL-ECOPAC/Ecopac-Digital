// Catalogo de componentes de la app movil (issue #281).
//
// Los mismos nombres y las mismas props que apps/web/src/components/, para que portar una
// pantalla de una plataforma a la otra sea mecanico. El contrato completo esta en
// docs/ARQUITECTURA-FRONTEND.md, seccion "El catalogo de componentes".
//
// Las dos unicas diferencias de API admitidas son de plataforma: el movil usa onChangeText
// donde la web usa onChange, y onPress donde la web usa onClick.

export { default as ScreenContainer } from "./ScreenContainer";
export { default as PageHeader } from "./PageHeader";

export { default as TextField } from "./TextField";
export { default as Selector } from "./Selector";
export { default as DateField } from "./DateField";
export { default as NumberField } from "./NumberField";

export { default as PrimaryButton } from "./PrimaryButton";
export { default as SecondaryButton } from "./SecondaryButton";

export { default as FilterBar } from "./FilterBar";
export { default as DataList } from "./DataList";
export { default as StatusChip } from "./StatusChip";
export { default as Card } from "./Card";

export { default as KanbanBoard } from "./KanbanBoard";
export { default as Tabs } from "./Tabs";
export { default as Modal } from "./Modal";

export { default as EmptyState } from "./EmptyState";
export { default as LoadingState } from "./LoadingState";
export { default as ErrorState } from "./ErrorState";

export { default as UsuarioActivo } from "./UsuarioActivo";
export { default as JornadaActivaBadge } from "./JornadaActivaBadge";
