import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency in RWF (Rwandan Francs)
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "RWF 1,234,567")
 */
export function formatRWF(amount: number): string {
  return new Intl.NumberFormat('rw-RW', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('RWF', 'RWF');
}

/**
 * Format currency for display with proper spacing
 * @param amount - The amount to format
 * @returns Formatted currency string for UI display
 */
export function formatCurrencyDisplay(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `RWF ${formatted}`;
}

/**
 * Get status color class based on status type
 * @param status - The status type ('cleared', 'action', 'blocked', 'info')
 * @returns CSS class for status color
 */
export function getStatusColor(status: 'cleared' | 'action' | 'blocked' | 'info'): string {
  const colors = {
    cleared: 'text-status-cleared bg-status-cleared/10 border-status-cleared/20',
    action: 'text-status-action bg-status-action/10 border-status-action/20',
    blocked: 'text-status-blocked bg-status-blocked/10 border-status-blocked/20',
    info: 'text-status-info bg-status-info/10 border-status-info/20',
  };
  return colors[status] || colors.info;
}

/**
 * Get status icon based on status type
 * @param status - The status type
 * @returns Icon name for the status
 */
export function getStatusIcon(status: 'cleared' | 'action' | 'blocked' | 'info'): string {
  const icons = {
    cleared: 'check_circle',
    action: 'warning',
    blocked: 'block',
    info: 'info',
  };
  return icons[status] || icons.info;
}
