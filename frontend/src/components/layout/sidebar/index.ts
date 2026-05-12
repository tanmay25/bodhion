/**
 * Shared sidebar component system for Bodhion.
 *
 * Import from this barrel when building a new service sidebar:
 *
 *   import { SidebarShell, SidebarNavItem, SidebarUserFooter } from '@/components/layout/sidebar';
 *
 * Styling is in src/styles/sidebar.css (globally imported in layout.tsx).
 * Design tokens are in src/app/globals.css under :root / html.bodhion-light / html.bodhion-midnight.
 */

export { SidebarShell } from './SidebarShell';
export { SidebarNavItem } from './SidebarNavItem';
export { SidebarUserFooter } from './SidebarUserFooter';
export type { SidebarUserFooterUser } from './SidebarUserFooter';
