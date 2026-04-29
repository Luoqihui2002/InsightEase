import { useState, useEffect } from 'react';

export interface ChartColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  blue: string;
  muted: string;
  textPrimary: string;
  textSecondary: string;
  bgPrimary: string;
  bgSecondary: string;
  borderSubtle: string;
  palette: string[];
  categorical: string[];
  gradients: string[][];
}

const FALLBACKS: ChartColors = {
  primary: '#00f5ff',
  secondary: '#b829f7',
  accent: '#ff0080',
  success: '#00ff9d',
  warning: '#ffaa00',
  danger: '#ef4444',
  blue: '#3b82f6',
  muted: '#64748b',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  bgPrimary: '#0a0e27',
  bgSecondary: '#151b3d',
  borderSubtle: 'rgba(148, 163, 184, 0.2)',
  palette: [
    '#00f5ff',
    '#b829f7',
    '#ff0080',
    '#00ff9d',
    '#ffaa00',
    '#3b82f6',
    '#ef4444',
    '#eab308',
  ],
  categorical: [
    '#00f5ff',
    '#b829f7',
    '#ff0080',
    '#00ff9d',
    '#ffaa00',
    '#3b82f6',
    '#ef4444',
    '#eab308',
  ],
  gradients: [
    ['#00f5ff', '#0066ff'],
    ['#b829f7', '#ff0080'],
    ['#00ff9d', '#00f5ff'],
    ['#ffaa00', '#ff0080'],
    ['#3b82f6', '#8b5cf6'],
  ],
};

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

export function getChartColors(): ChartColors {
  return {
    primary: readCssVar('--neon-cyan', FALLBACKS.primary),
    secondary: readCssVar('--neon-purple', FALLBACKS.secondary),
    accent: readCssVar('--neon-pink', FALLBACKS.accent),
    success: readCssVar('--neon-green', FALLBACKS.success),
    warning: readCssVar('--status-warning', FALLBACKS.warning),
    danger: readCssVar('--status-error', FALLBACKS.danger),
    blue: readCssVar('--chart-blue', FALLBACKS.blue),
    muted: readCssVar('--text-muted', FALLBACKS.muted),
    textPrimary: readCssVar('--text-primary', FALLBACKS.textPrimary),
    textSecondary: readCssVar('--text-secondary', FALLBACKS.textSecondary),
    bgPrimary: readCssVar('--bg-primary', FALLBACKS.bgPrimary),
    bgSecondary: readCssVar('--bg-secondary', FALLBACKS.bgSecondary),
    borderSubtle: readCssVar('--border-subtle', FALLBACKS.borderSubtle),
    palette: FALLBACKS.palette,
    categorical: FALLBACKS.categorical,
    gradients: FALLBACKS.gradients,
  };
}

/**
 * Apply alpha to a hex color string.
 * Returns original color if parsing fails.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    // Try to replace existing alpha
    const match = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (match) {
      return `rgba(${color.replace(/rgba?\(/, '').replace(/,\s*[\d.]+\s*\)$/, '')}, ${alpha})`;
    }
    return color;
  }
  const hex = color.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(getChartColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getChartColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
