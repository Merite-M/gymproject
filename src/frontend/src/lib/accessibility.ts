// Accessibility utilities and helper functions

/**
 * Generate unique IDs for accessibility components
 */
let idCounter = 0;
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * ARIA role mappings for common UI patterns
 */
export const ARIA_ROLES = {
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  banner: 'banner',
  contentinfo: 'contentinfo',
  search: 'search',
  button: 'button',
  link: 'link',
  dialog: 'dialog',
  alert: 'alert',
  status: 'status',
 progressbar: 'progressbar',
  tablist: 'tablist',
  tab: 'tab',
  tabpanel: 'tabpanel',
  menu: 'menu',
  menuitem: 'menuitem',
  checkbox: 'checkbox',
  radio: 'radio',
  combobox: 'combobox',
  listbox: 'listbox',
  option: 'option',
  grid: 'grid',
  gridcell: 'gridcell',
  row: 'row',
  columnheader: 'columnheader',
  rowheader: 'rowheader',
} as const;

/**
 * ARIA live region priorities
 */
export const ARIA_LIVE = {
  polite: 'polite',
  assertive: 'assertive',
  off: 'off',
} as const;

/**
 * Keyboard navigation key codes
 */
export const KEY_CODES = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (!element || element.disabled) {
    return false;
  }

  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME'];
  const isFocusableTag = focusableTags.includes(element.tagName);
  const hasTabIndex = element.hasAttribute('tabindex');
  const isContentEditable = element.isContentEditable;

  return isFocusableTag || hasTabIndex || isContentEditable;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
  );
  return Array.from(focusableElements).filter(isFocusable);
}

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (event: KeyboardEvent) => {
    if (event.key !== KEY_CODES.TAB) return;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);

  // Focus first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Get user's preferred color scheme
 */
export function getPreferredColorScheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * ARIA property generators for common patterns
 */
export const ariaProps = {
  // Button
  button: (label: string, pressed?: boolean, expanded?: boolean) => ({
    role: 'button',
    'aria-label': label,
    'aria-pressed': pressed,
    'aria-expanded': expanded,
    tabIndex: 0,
  }),

  // Link
  link: (label: string) => ({
    role: 'link',
    'aria-label': label,
    tabIndex: 0,
  }),

  // Menu
  menu: (label: string) => ({
    role: 'menu',
    'aria-label': label,
  }),

  // Menu item
  menuItem: (label: string, disabled?: boolean) => ({
    role: 'menuitem',
    'aria-label': label,
    'aria-disabled': disabled,
    tabIndex: disabled ? -1 : 0,
  }),

  // Dialog
  dialog: (label: string, describedBy?: string) => ({
    role: 'dialog',
    'aria-label': label,
    'aria-describedby': describedBy,
    'aria-modal': true,
  }),

  // Alert
  alert: (message: string) => ({
    role: 'alert',
    'aria-live': ARIA_LIVE.assertive,
    'aria-atomic': true,
    children: message,
  }),

  // Status
  status: (message: string) => ({
    role: 'status',
    'aria-live': ARIA_LIVE.polite,
    'aria-atomic': true,
    children: message,
  }),

  // Progress bar
  progressBar: (label: string, value: number, max: number = 100) => ({
    role: 'progressbar',
    'aria-label': label,
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max,
  }),

  // Tab
  tab: (label: string, selected: boolean, controlsId: string) => ({
    role: 'tab',
    'aria-label': label,
    'aria-selected': selected,
    'aria-controls': controlsId,
    tabIndex: selected ? 0 : -1,
  }),

  // Tab panel
  tabPanel: (labelId: string) => ({
    role: 'tabpanel',
    'aria-labelledby': labelId,
    tabIndex: 0,
  }),

  // Checkbox
  checkbox: (label: string, checked: boolean) => ({
    role: 'checkbox',
    'aria-label': label,
    'aria-checked': checked,
    tabIndex: 0,
  }),

  // Radio
  radio: (label: string, checked: boolean, name: string) => ({
    role: 'radio',
    'aria-label': label,
    'aria-checked': checked,
    'aria-required': true,
    name,
    tabIndex: 0,
  }),

  // Combobox
  combobox: (label: string, expanded: boolean, listboxId: string) => ({
    role: 'combobox',
    'aria-label': label,
    'aria-expanded': expanded,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list',
  }),

  // Listbox
  listbox: (label: string) => ({
    role: 'listbox',
    'aria-label': label,
  }),

  // Option
  option: (label: string, selected: boolean) => ({
    role: 'option',
    'aria-label': label,
    'aria-selected': selected,
  }),
} as const;

/**
 * Skip link for keyboard navigation
 */
export function createSkipLink(targetId: string, label: string = 'Skip to main content'): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded';
  skipLink.setAttribute('aria-label', label);
  return skipLink;
}

/**
 * Visual hidden class for screen readers only
 */
export const srOnly = `
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  .focus\\:not-sr-only:focus {
    position: static;
    width: auto;
    height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
`;

/**
 * Handle keyboard events for custom interactive elements
 */
export function handleKeyboardEvent(
  event: KeyboardEvent,
  handlers: {
    onEnter?: () => void;
    onSpace?: () => void;
    onEscape?: () => void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onArrowLeft?: () => void;
    onArrowRight?: () => void;
    onHome?: () => void;
    onEnd?: () => void;
  }
): void {
  switch (event.key) {
    case KEY_CODES.ENTER:
      handlers.onEnter?.();
      break;
    case KEY_CODES.SPACE:
      handlers.onSpace?.();
      break;
    case KEY_CODES.ESCAPE:
      handlers.onEscape?.();
      break;
    case KEY_CODES.ARROW_UP:
      handlers.onArrowUp?.();
      break;
    case KEY_CODES.ARROW_DOWN:
      handlers.onArrowDown?.();
      break;
    case KEY_CODES.ARROW_LEFT:
      handlers.onArrowLeft?.();
      break;
    case KEY_CODES.ARROW_RIGHT:
      handlers.onArrowRight?.();
      break;
    case KEY_CODES.HOME:
      handlers.onHome?.();
      break;
    case KEY_CODES.END:
      handlers.onEnd?.();
      break;
  }
}

/**
 * Validate color contrast ratio (WCAG AA)
 */
export function validateColorContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(foreground, background);
  const minimumRatio = level === 'AAA' ? 7 : 4.5;
  return ratio >= minimumRatio;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: string, color2: string): number {
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map(channel => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}