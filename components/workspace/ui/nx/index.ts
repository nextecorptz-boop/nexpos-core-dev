// NEXPOS design-system primitives namespace.
// Re-export reusable client + server primitives. Keep this barrel narrow —
// adding heavy components here defeats Next's per-file code splitting.

export { Chip, type ChipTone, type ChipProps } from './chip'
export { StockChip, type StockChipProps } from './stock-chip'
export { Icon, type IconName, type IconProps } from './icon'
export { ModTile, type ModTileProps, type ModuleKind } from './modtile'
export { Sheet, type SheetProps } from './sheet'
export { EmptyState, type EmptyStateProps } from './empty-state'
export { ComingSoon, type ComingSoonProps } from './coming-soon'
export { Toast, type ToastProps } from './toast'
